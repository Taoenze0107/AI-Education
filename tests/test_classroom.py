"""Workflow and tenant boundaries; no live student data or accounts used."""
import csv
import io
import json
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

ROOT=Path(__file__).resolve().parents[1]
BASE='/api/v1/classroom'
PASSWORD='Classroom-Test-2026!'

@pytest.fixture
def setup(tmp_path):
    app=create_app(Settings(database_path=tmp_path/'lab.db',knowledge_base_path=ROOT/'app/data/knowledge_base.json',enable_llm=False))
    clients=[]
    for username,role,name in [('teacher','teacher','林老师'),('otherteacher','teacher','另一位老师'),('student','student','小林'),('peer','student','=HYPERLINK("bad")'),('outsider','student','未加入同学')]:
        client=TestClient(app)
        result=client.post(BASE+'/register',json=dict(username=username,password=PASSWORD,role=role,name=name))
        assert result.status_code==201
        clients.append(client)
    teacher,other,student,peer,outsider=clients
    cl=teacher.post(BASE+'/classes',json={'name':'大学物理 · 周三班'}).json()
    for client,num in [(student,'001'),(peer,'002')]:
        assert client.post(BASE+'/join',json=dict(code=cl['invite_code'],student_number=num)).status_code==200
    assignment=teacher.post(BASE+'/classes/'+cl['class_id']+'/assignments',json=dict(title='伏安法 · 单位核查',experiment_id='ohms_law',instructions='至少测量五组数据，保存计算与复查。')).json()
    return dict(app=app,teacher=teacher,other=other,student=student,peer=peer,outsider=outsider,cl=cl,a=assignment)

def work(ctx,student='student'):
    return ctx[student].post(BASE+'/assignments/'+ctx['a']['assignment_id']+'/start',json={}).json()['session_id']

def attempt(ctx,sid,student='student',file='sufficient_calculation_error.json'):
    result=ctx[student].post('/api/v1/sessions/'+sid+'/attempts',json=json.loads((ROOT/'examples'/file).read_text()))
    assert result.status_code==201,result.text
    return result.json()

def submit(ctx,sid,student='student',note=''):
    result=ctx[student].post(BASE+'/assignments/'+ctx['a']['assignment_id']+'/submit',json=dict(session_id=sid,note=note))
    assert result.status_code==201,result.text
    return result.json()

def test_teacher_student_assignment_revision_review_and_summary(setup):
    c=setup; sid=work(c); a=attempt(c,sid); first=submit(c,sid)
    teacher=c['teacher'];student=c['student'];aid=c['a']['assignment_id']
    detail=teacher.get(BASE+'/assignments/'+aid).json()
    assert detail['summary']['member_count']==2
    assert detail['summary']['submitted_count']==1
    assert detail['summary']['pending_count']==1
    assert detail['summary']['errors'][1]['affected_students']==1
    assert teacher.get('/api/v1/sessions/'+sid+'/history').status_code==404 # Private draft endpoint is never a teacher shortcut.
    assert teacher.post(BASE+'/submissions/'+first['submission_id']+'/review',json=dict(status='needs_revision',feedback='请把 mA 换算为 A 后复算。')).status_code==200
    assert student.get(BASE+'/submissions/'+first['submission_id']).json()['submission']['feedback'].startswith('请把')
    assert student.post('/api/v1/attempts/'+a['attempt_id']+'/outcome',json=dict(result='corrected',student_revision='已换算单位并复算',final_result='250 Ω')).status_code==201
    attempt(c,sid,file='normal.json') if (ROOT/'examples/normal.json').exists() else attempt(c,sid)
    old=teacher.get(BASE+'/submissions/'+first['submission_id']).json()['submission']
    assert old['attempt_count']==1 and old['modification_count']==0
    second=submit(c,sid)
    assert second['version']==2
    new=teacher.get(BASE+'/submissions/'+second['submission_id']).json()['submission']
    assert new['attempt_count']==2 and new['modification_count']==1
    assert new['review_status'] is None
    assert teacher.get(BASE+'/submissions/'+first['submission_id']).json()['submission']['review_status']=='needs_revision'
    detail=teacher.get(BASE+'/assignments/'+aid).json()['summary']
    assert detail['needs_revision_count']==0 and detail['unreviewed_count']==1
    assert detail['errors'][1]['affected_students']==1 # repeated category counts the student once
    assert teacher.post(BASE+'/submissions/'+second['submission_id']+'/review',json=dict(status='accepted',feedback='单位与结果已核对，可以通过。')).status_code==200
    assert teacher.get(BASE+'/assignments/'+aid).json()['summary']['accepted_count']==1

@pytest.mark.parametrize('who',['other','outsider'])
def test_other_class_and_nonmember_cannot_read_or_modify(setup,who):
    c=setup; client=c[who]; aid=c['a']['assignment_id']; cid=c['cl']['class_id'];sid=work(c);attempt(c,sid);sub=submit(c,sid)['submission_id']
    for url in [BASE+'/classes/'+cid,BASE+'/assignments/'+aid,BASE+'/submissions/'+sub,BASE+'/assignments/'+aid+'/export.csv']:
        assert client.get(url).status_code in (403,404)
    assert client.post(BASE+'/submissions/'+sub+'/review',json=dict(status='accepted',feedback='forged')).status_code in (403,404)
    assert client.patch(BASE+'/assignments/'+aid,json={'closed':True}).status_code in (403,404)


def test_students_cannot_inspect_peers_or_review(setup):
    c=setup;sid=work(c);a=attempt(c,sid);sub=submit(c,sid)['submission_id'];peer=c['peer'];aid=c['a']['assignment_id']
    assert peer.get(BASE+'/submissions/'+sub).status_code==404
    assert peer.get('/api/v1/sessions/'+sid+'/history').status_code==404
    assert peer.post('/api/v1/sessions/'+sid+'/attempts',json=json.loads((ROOT/'examples/insufficient_evidence.json').read_text())).status_code==404
    assert peer.post('/api/v1/attempts/'+a['attempt_id']+'/outcome',json=dict(result='corrected',student_revision='forged')).status_code==404
    assert peer.post(BASE+'/submissions/'+sub+'/review',json=dict(status='accepted',feedback='forged')).status_code==403
    own=peer.get(BASE+'/assignments/'+aid).json()
    assert 'summary' not in own and own['submissions']==[]
    assert 'members' not in peer.get(BASE+'/classes/'+c['cl']['class_id']).json()
    assert peer.get(BASE+'/assignments/'+aid+'/export.csv').status_code==403
    assert peer.get('/api/v1/sessions?student_id=001').json()['total']==0


def test_guest_ownership_and_legacy_preservation(setup):
    c=setup;g=TestClient(c['app']);g2=TestClient(c['app']);db=c['app'].state.settings.database_path
    sid=g.post('/api/v1/sessions',json=dict(student_id='shared-id',experiment_id='ohms_law')).json()['session_id']
    assert g.get('/api/v1/sessions').json()['total']==1
    assert g2.get('/api/v1/sessions').json()['total']==0
    assert g2.get('/api/v1/sessions/'+sid+'/history').status_code==404
    assert g2.get(BASE+'/classes').status_code==401
    assert g.get('/api/v1/stats/class-summary').status_code==410
    assert c['teacher'].get('/api/v1/stats/common-errors').status_code==410
    with sqlite3.connect(db) as con:
        con.execute('INSERT INTO sessions VALUES (?,?,?,?,?)',('legacy','shared-id','ohms_law',None,'2026-01-01T00:00:00+00:00'))
    assert g.get('/api/v1/sessions').json()['total']==1
    with sqlite3.connect(db) as con: assert con.execute('SELECT COUNT(*) FROM sessions WHERE session_id="legacy"').fetchone()[0]==1
    response=g.post(BASE+'/login',json=dict(username='student',password=PASSWORD))
    assert response.status_code==200
    assert 'HttpOnly' in response.headers['set-cookie'] and 'SameSite=lax' in response.headers['set-cookie']
    assert g.get('/api/v1/sessions/'+sid+'/history').status_code==200 # same-browser guest work claimed by account
    assert g2.get('/api/v1/sessions/'+sid+'/history').status_code==404
    assert g.post(BASE+'/logout',json={}).status_code==200
    assert g.get('/api/v1/sessions/'+sid+'/history').status_code==404


def test_empty_task_rejects_submission_and_unbound_session(setup):
    c=setup;sid=work(c);aid=c['a']['assignment_id'];student=c['student']
    assert student.post(BASE+'/assignments/'+aid+'/submit',json=dict(session_id=sid)).status_code==422
    attempt(c,sid)
    another=student.post('/api/v1/sessions',json=dict(student_id='001',experiment_id='ohms_law')).json()['session_id'];attempt(c,another)
    assert student.post(BASE+'/assignments/'+aid+'/submit',json=dict(session_id=another)).status_code==422
    duplicate=student.post(BASE+'/assignments/'+aid+'/start',json={}).json()
    assert duplicate['session_id']==sid


def test_duplicate_and_closed_submission(setup):
    c=setup;sid=work(c);attempt(c,sid);first=submit(c,sid);second=submit(c,sid)
    assert second['version']==1 and second['duplicate'] and second['submission_id']==first['submission_id']
    aid=c['a']['assignment_id'];assert c['teacher'].patch(BASE+'/assignments/'+aid,json={'closed':True}).status_code==200
    assert c['student'].post(BASE+'/assignments/'+aid+'/submit',json=dict(session_id=sid,note='changed')).status_code==409
    assert c['peer'].post(BASE+'/assignments/'+aid+'/start',json={}).status_code==409
    assert c['student'].get(BASE+'/submissions/'+first['submission_id']).status_code==200
    assert c['teacher'].patch(BASE+'/assignments/'+aid,json={'closed':False}).status_code==200
    assert submit(c,sid,note='补充说明')['version']==2


def test_timezone_late_and_csv_formula_injection(setup):
    c=setup;teacher=c['teacher'];cid=c['cl']['class_id']
    args=dict(title='=SUM(1,2)',experiment_id='ohms_law',instructions='记录数据',due_at='2020-01-01T09:00:00+08:00')
    a=teacher.post(BASE+'/classes/'+cid+'/assignments',json=args).json();c['a']=a
    assert a['due_at']=='2020-01-01T01:00:00+00:00'
    sid=work(c,'peer');attempt(c,sid,'peer');sub=submit(c,sid,'peer')
    assert sub['late']
    rows=list(csv.reader(io.StringIO(teacher.get(BASE+'/assignments/'+a['assignment_id']+'/export.csv').text.lstrip('\ufeff'))))
    assert any(row[0].startswith("'=HYPERLINK") for row in rows[1:])
    assert all(row[2].startswith("'=SUM") for row in rows[1:])
    args['due_at']='2026-01-01T09:00:00'
    assert teacher.post(BASE+'/classes/'+cid+'/assignments',json=args).status_code==422


def test_insufficient_evidence_not_counted_as_error(setup):
    c=setup;sid=work(c);attempt(c,sid,file='insufficient_evidence.json');submit(c,sid)
    summary=c['teacher'].get(BASE+'/assignments/'+c['a']['assignment_id']).json()['summary']
    assert summary['insufficient_count']==1
    assert sum(x['affected_students'] for x in summary['errors'])==0
    assert summary['accepted_count']==0


def test_cross_site_mutation_and_session_cookie_rotation(setup):
    c=setup;client=c['student'];old=client.cookies.get('lab_access')
    assert client.post(BASE+'/logout',json={},headers={'Origin':'https://evil.example'}).status_code==403
    assert client.post(BASE+'/logout',data='{}',headers={'Content-Type':'text/plain'}).status_code==415
    assert client.post(BASE+'/logout',json={}).status_code==200
    assert client.cookies.get('lab_access')!=old
    attacker=TestClient(c['app']);attacker.cookies.set('lab_access',old)
    assert attacker.get(BASE+'/me').json()['user'] is None
    assert client.post(BASE+'/login',json=dict(username='STUDENT',password=PASSWORD)).status_code==200
    assert client.get(BASE+'/me').json()['user']['role']=='student'
    with sqlite3.connect(c['app'].state.settings.database_path) as con:
        value=con.execute('SELECT password_hash FROM lab_users WHERE username="student"').fetchone()[0]
        assert PASSWORD not in value and len(value.split(':')[1])==64


def test_role_title_experiment_and_invite_validation(setup):
    c=setup;cid=c['cl']['class_id']
    assert c['student'].post(BASE+'/classes',json={'name':'forged'}).status_code==403
    assert c['teacher'].post(BASE+'/classes/'+cid+'/assignments',json=dict(title='x',experiment_id='missing',instructions='x')).status_code==422
    assert c['teacher'].post(BASE+'/classes/'+cid+'/assignments',json=dict(title=' ',experiment_id='ohms_law',instructions='x')).status_code==422
    assert c['outsider'].post(BASE+'/join',json=dict(code='00000000',student_number='003')).status_code==404
    assert c['outsider'].post(BASE+'/join',json=dict(code=c['cl']['invite_code'],student_number='001')).status_code==409
    assert c['teacher'].post(BASE+'/join',json=dict(code=c['cl']['invite_code'],student_number='003')).status_code==403


def test_empty_stats_and_classroom_routes(setup):
    c=setup;summary=c['teacher'].get(BASE+'/assignments/'+c['a']['assignment_id']).json()['summary']
    assert summary['submitted_count']==0 and summary['pending_count']==2 and summary['average_attempts']==0
    for route in ['/classroom','/classroom/classes/'+c['cl']['class_id'],'/classroom/assignments/'+c['a']['assignment_id']]:
        assert c['teacher'].get(route).status_code==200


def test_login_throttle_and_registration_rules(setup):
    c=setup;g=TestClient(c['app'])
    assert g.post(BASE+'/register',json=dict(username='new',name='x',role='admin',password=PASSWORD)).status_code==422
    assert g.post(BASE+'/register',json=dict(username='new',name='x',role='teacher',password='weak')).status_code==422
    results=[g.post(BASE+'/login',json=dict(username='student',password='wrong')).status_code for _ in range(31)]
    assert 401 in results and results[-1]==429


def test_https_cookie_is_secure_and_foreign_origin_rejected(setup):
    c=setup; client=TestClient(c['app'],base_url='https://lab.example')
    response=client.post(BASE+'/login',json=dict(username='student',password=PASSWORD),headers={'Origin':'https://lab.example'})
    assert response.status_code==200
    assert 'Secure' in response.headers['set-cookie'] and 'HttpOnly' in response.headers['set-cookie']
    assert client.get(BASE+'/me').json()['user']['role']=='student'
    assert client.post(BASE+'/logout',json={},headers={'Origin':'https://other.example'}).status_code==403


def test_local_legacy_claim_preview_backup_and_owner_protection(setup):
    from tools.claim_legacy_records import claim
    c=setup;db=c['app'].state.settings.database_path
    with sqlite3.connect(db) as con:
        con.execute('INSERT INTO sessions VALUES (?,?,?,?,?)',('legacy-own','001','ohms_law',None,'2026-01-01T00:00:00+00:00'))
    rows,backup=claim(db,'student',['legacy-own'])
    assert len(rows)==1 and backup is None
    assert c['student'].get('/api/v1/sessions/legacy-own/history').status_code==404
    _,backup=claim(db,'student',['legacy-own'],apply=True)
    assert backup.is_file()
    with sqlite3.connect(backup) as con: assert con.execute('SELECT COUNT(*) FROM lab_session_owners WHERE session_id="legacy-own"').fetchone()[0]==0
    assert c['student'].get('/api/v1/sessions/legacy-own/history').status_code==200
    assert c['peer'].get('/api/v1/sessions/legacy-own/history').status_code==404
    with pytest.raises(ValueError):claim(db,'peer',['legacy-own'],apply=True)
