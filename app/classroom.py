"""Account-scoped classrooms. A teacher sees immutable, explicitly shared work only."""
from __future__ import annotations

import csv
import hashlib
import hmac
import io
import json
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import Field, field_validator

from app.database import Database
from app.experiment_catalog import ExperimentCatalog
from app.models import StrictModel
from app.repository import Repository

COOKIE = 'lab_access'
SCHEMA = '''
CREATE TABLE IF NOT EXISTS lab_users (
 user_id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher','student')),
 password_hash TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_access (
 token_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_session_owners (
 session_id TEXT PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_owner ON lab_session_owners(owner_id);
CREATE TABLE IF NOT EXISTS lab_classes (
 class_id TEXT PRIMARY KEY, teacher_id TEXT NOT NULL REFERENCES lab_users(user_id),
 name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_members (
 class_id TEXT NOT NULL REFERENCES lab_classes(class_id),
 user_id TEXT NOT NULL REFERENCES lab_users(user_id), student_number TEXT NOT NULL,
 joined_at TEXT NOT NULL, PRIMARY KEY(class_id,user_id), UNIQUE(class_id,student_number)
);
CREATE TABLE IF NOT EXISTS lab_assignments (
 assignment_id TEXT PRIMARY KEY, class_id TEXT NOT NULL REFERENCES lab_classes(class_id),
 title TEXT NOT NULL, experiment_id TEXT NOT NULL, instructions TEXT NOT NULL,
 due_at TEXT, closed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lab_work (
 assignment_id TEXT NOT NULL REFERENCES lab_assignments(assignment_id),
 user_id TEXT NOT NULL REFERENCES lab_users(user_id),
 session_id TEXT NOT NULL UNIQUE REFERENCES sessions(session_id),
 PRIMARY KEY(assignment_id,user_id)
);
CREATE TABLE IF NOT EXISTS lab_submissions (
 submission_id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES lab_assignments(assignment_id),
 user_id TEXT NOT NULL REFERENCES lab_users(user_id), version INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL, note TEXT NOT NULL, submitted_at TEXT NOT NULL,
 late INTEGER NOT NULL, fingerprint TEXT NOT NULL,
 UNIQUE(assignment_id,user_id,version)
);
CREATE TABLE IF NOT EXISTS lab_reviews (
 submission_id TEXT PRIMARY KEY REFERENCES lab_submissions(submission_id),
 status TEXT NOT NULL CHECK(status IN ('accepted','needs_revision')),
 feedback TEXT NOT NULL, reviewed_at TEXT NOT NULL
);
'''


def now():
    return datetime.now(timezone.utc)


def fail(code, message):
    raise HTTPException(code, message)


class Register(StrictModel):
    username: str = Field(min_length=3, max_length=60, pattern=r'^[A-Za-z0-9_.@-]+$')
    name: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=10, max_length=128)
    role: str = Field(pattern=r'^(teacher|student)$')

    @field_validator('username', 'name', mode='before')
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value


class Login(StrictModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=128)


class ClassCreate(StrictModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator('name', mode='before')
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value


class Join(StrictModel):
    code: str = Field(min_length=8, max_length=8)
    student_number: str = Field(min_length=1, max_length=60)

    @field_validator('code', 'student_number', mode='before')
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value


class AssignmentCreate(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    experiment_id: str = Field(min_length=1, max_length=100)
    instructions: str = Field(min_length=1, max_length=6000)
    due_at: datetime | None = None

    @field_validator('title', 'instructions', mode='before')
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator('due_at')
    @classmethod
    def date_timezone(cls, value):
        if value is not None and value.tzinfo is None:
            raise ValueError('截止时间必须包含时区。')
        return value.astimezone(timezone.utc) if value else None


class AssignmentState(StrictModel):
    closed: bool


class Submit(StrictModel):
    session_id: str = Field(min_length=1, max_length=100)
    note: str = Field(default='', max_length=4000)


class Review(StrictModel):
    status: str = Field(pattern=r'^(accepted|needs_revision)$')
    feedback: str = Field(min_length=1, max_length=6000)

    @field_validator('feedback', mode='before')
    @classmethod
    def trim(cls, value):
        return value.strip() if isinstance(value, str) else value


class Classroom:
    def __init__(self, db: Database, repository: Repository):
        self.db, self.repository = db, repository
        self.catalog = ExperimentCatalog()
        self.rate_lock = threading.Lock()
        self.auth_hits = {}
        with db.connect() as con:
            con.executescript(SCHEMA)

    def throttle(self, req: Request, category='auth'):
        # Count failures/successes before expensive password derivation; no password is logged.
        key = (category, req.client.host if req.client else 'unknown')
        stamp = time.monotonic()
        with self.rate_lock:
            self.auth_hits = {k: [t for t in v if stamp-t < 600] for k, v in self.auth_hits.items() if v and stamp-v[-1] < 600}
            hits = self.auth_hits.setdefault(key, [])
            if len(hits) >= (30 if category == 'auth' else 40):
                fail(429, '操作较频繁，请十分钟后再试。')
            hits.append(stamp)

    def resolve(self, token):
        if not token or len(token) > 100:
            return None
        with self.db.connect() as con:
            row = con.execute('SELECT a.owner_id,u.user_id,u.username,u.name,u.role FROM lab_access a LEFT JOIN lab_users u ON u.user_id=a.owner_id WHERE a.token_hash=? AND a.expires_at>?', (hashlib.sha256(token.encode()).hexdigest(),now().isoformat())).fetchone()
        return dict(row) if row else None

    def create_access(self, owner=None):
        token = secrets.token_urlsafe(32)
        owner = owner or 'guest-' + str(uuid4())
        with self.db.connect() as con:
            con.execute('DELETE FROM lab_access WHERE expires_at<?', (now().isoformat(),))
            con.execute('INSERT INTO lab_access VALUES (?,?,?)', (hashlib.sha256(token.encode()).hexdigest(),owner,(now()+timedelta(days=30)).isoformat()))
        return token, self.resolve(token)

    def cookie(self, response, token, req):
        response.set_cookie(COOKIE,token,max_age=30*86400,httponly=True,samesite='lax',secure=req.url.scheme == 'https',path='/')

    def actor(self, req, role=None):
        actor = req.state.lab_actor
        if not actor['user_id']:
            fail(401,'请先登录班级账号。')
        if role and actor['role'] != role:
            fail(403,'当前账号没有这项权限。')
        return actor

    def own_session(self, req, session_id):
        with self.db.connect() as con:
            row = con.execute('SELECT 1 FROM lab_session_owners WHERE session_id=? AND owner_id=?', (session_id,req.state.lab_actor['owner_id'])).fetchone()
        if not row:
            fail(404,'找不到属于你的实验记录。')

    def bind_session(self, req, session_id):
        with self.db.connect() as con:
            con.execute('INSERT INTO lab_session_owners VALUES (?,?)', (session_id,req.state.lab_actor['owner_id']))

    def class_access(self, req, con, class_id, teacher=False):
        actor = self.actor(req, 'teacher' if teacher else None)
        row = con.execute('SELECT * FROM lab_classes WHERE class_id=?', (class_id,)).fetchone()
        member = con.execute('SELECT 1 FROM lab_members WHERE class_id=? AND user_id=?', (class_id,actor['user_id'])).fetchone()
        if not row or (row['teacher_id'] != actor['user_id'] and (teacher or not member)):
            fail(404,'找不到这个班级。')
        return dict(row)

    def assignment_access(self, req, con, aid, teacher=False):
        row = con.execute('SELECT * FROM lab_assignments WHERE assignment_id=?', (aid,)).fetchone()
        if not row:
            fail(404,'找不到这份作业。')
        cl = self.class_access(req, con, row['class_id'], teacher)
        result = dict(row)
        result.update(class_name=cl['name'],experiment_title=self.catalog.by_id[row['experiment_id']].title)
        return result

    def snapshot(self, con, sid):
        session = con.execute('SELECT * FROM sessions WHERE session_id=?',(sid,)).fetchone()
        rows = con.execute('SELECT * FROM attempts WHERE session_id=? ORDER BY attempt_number',(sid,)).fetchall()
        if not rows:
            fail(422,'先完成一次诊断，再提交给老师。')
        attempts = []
        for row in rows:
            outcome = con.execute('SELECT * FROM outcomes WHERE attempt_id=?',(row['attempt_id'],)).fetchone()
            attempts.append(dict(attempt_number=row['attempt_number'],created_at=row['created_at'],status=row['status'],issue_type=row['issue_type'],request=json.loads(row['request_json']),response=json.loads(row['response_json']),outcome=dict(outcome) if outcome else None))
        snapshot = dict(experiment_id=session['experiment_id'],attempts=attempts)
        text = json.dumps(snapshot,ensure_ascii=False,separators=(',',':'))
        if len(text.encode())>2_000_000:
            fail(422,'这份记录过大，请新建实验记录后再提交。')
        return text

    def submissions(self, con, aid, user_id=None, snapshots=False):
        query = '''SELECT s.*,u.name,m.student_number,r.status AS review_status,r.feedback,r.reviewed_at
        FROM lab_submissions s JOIN lab_users u ON s.user_id=u.user_id
        JOIN lab_assignments a ON a.assignment_id=s.assignment_id
        JOIN lab_members m ON m.class_id=a.class_id AND m.user_id=s.user_id
        LEFT JOIN lab_reviews r ON r.submission_id=s.submission_id
        WHERE s.assignment_id=?'''
        params = [aid]
        if user_id:
            query+=' AND s.user_id=?'; params.append(user_id)
        rows = con.execute(query+' ORDER BY s.submitted_at DESC,s.version DESC', params).fetchall()
        result=[]
        for row in rows:
            item=dict(row); snapshot=json.loads(item.pop('snapshot_json')); item.pop('fingerprint')
            item['attempt_count']=len(snapshot['attempts'])
            item['modification_count']=sum(bool(a['outcome']) for a in snapshot['attempts'])
            item['latest_status']=snapshot['attempts'][-1]['status']
            if snapshots: item['snapshot']=snapshot
            result.append(item)
        return result

    def summary(self, con, assignment, submissions):
        members = [dict(r) for r in con.execute('SELECT m.user_id,m.student_number,u.name FROM lab_members m JOIN lab_users u ON u.user_id=m.user_id WHERE m.class_id=? ORDER BY m.student_number', (assignment['class_id'],)).fetchall()]
        latest={}
        for sub in submissions:
            latest.setdefault(sub['user_id'], sub)
        for member in members:
            member['submission']=({k:v for k,v in latest[member['user_id']].items() if k!='snapshot'} if member['user_id'] in latest else None)
        labels={'data_error':'数据采集或录入','calculation_error':'计算与单位换算','concept_misunderstanding':'概念理解','mixed':'多因素问题'}
        issues={key:set() for key in labels}; insufficient=set(); counts=[]
        for uid,sub in latest.items():
            attempts=sub['snapshot']['attempts']; counts.append(len(attempts))
            if attempts[-1]['status']=='needs_more_evidence': insufficient.add(uid)
            for a in attempts:
                issue=a.get('issue_type') or (a.get('response',{}).get('diagnosis') or {}).get('issue_type')
                if issue in issues: issues[issue].add(uid)
        return dict(member_count=len(members),submitted_count=len(latest),pending_count=len(members)-len(latest),
                    accepted_count=sum(s['review_status']=='accepted' for s in latest.values()),
                    needs_revision_count=sum(s['review_status']=='needs_revision' for s in latest.values()),
                    unreviewed_count=sum(s['review_status'] is None for s in latest.values()),
                    late_count=sum(bool(s['late']) for s in latest.values()),
                    insufficient_count=len(insufficient),average_attempts=round(sum(counts)/len(counts),1) if counts else 0,
                    errors=[dict(issue_type=k,label=labels[k],affected_students=len(v)) for k,v in issues.items()],members=members)


def install_classroom(app: FastAPI, db: Database, repository: Repository, static: Path):
    lab=Classroom(db, repository); app.state.classroom=lab
    router=APIRouter(prefix='/api/v1/classroom',tags=['班级与作业'])

    @app.middleware('http')
    async def privacy(req: Request, call_next):
        api=req.url.path.startswith('/api/')
        token=req.cookies.get(COOKIE); actor=lab.resolve(token) if api else None
        fresh=False
        if api:
            # JSON-only mutations plus origin check prevent cross-site form submissions.
            if req.method not in ('GET','HEAD','OPTIONS'):
                origin=req.headers.get('origin')
                if (origin and origin.rstrip('/') != str(req.base_url).rstrip('/')) or req.headers.get('sec-fetch-site')=='cross-site':
                    return JSONResponse({'detail':'请从本网站页面提交操作。'},status_code=403)
                if req.headers.get('content-length','0') != '0' and not req.headers.get('content-type','').startswith('application/json'):
                    return JSONResponse({'detail':'请使用 JSON 提交操作。'},status_code=415)
            if not actor:
                token,actor=lab.create_access(); fresh=True
            req.state.lab_actor=actor
        response=await call_next(req)
        if api:
            response.headers['Cache-Control']='no-store'
            response.headers['Vary']='Cookie'
            if fresh and not getattr(req.state,'lab_auth_changed',False): lab.cookie(response,token,req)
        return response

    def authenticated_response(req, uid):
        old=req.cookies.get(COOKIE); owner=req.state.lab_actor['owner_id']
        with db.connect() as con:
            if owner.startswith('guest-'):
                con.execute('UPDATE lab_session_owners SET owner_id=? WHERE owner_id=?',(uid,owner))
                con.execute('DELETE FROM lab_access WHERE owner_id=?',(owner,))
            if old: con.execute('DELETE FROM lab_access WHERE token_hash=?',(hashlib.sha256(old.encode()).hexdigest(),))
        token,actor=lab.create_access(uid)
        req.state.lab_auth_changed=True
        response=JSONResponse({'user':{k:actor[k] for k in ('user_id','username','name','role')}})
        lab.cookie(response,token,req); return response

    def encode_password(password, salt=None):
        salt=salt or secrets.token_hex(16)
        digest=hashlib.pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600_000).hex()
        return salt+':'+digest

    @router.get('/me')
    def me(req: Request):
        actor=req.state.lab_actor
        return {'user':{k:actor[k] for k in ('user_id','username','name','role')} if actor['user_id'] else None}

    @router.post('/register',status_code=201)
    def register(payload: Register,req: Request):
        lab.throttle(req); uid=str(uuid4()); hashed=encode_password(payload.password)
        try:
            with db.connect() as con:
                con.execute('INSERT INTO lab_users VALUES (?,?,?,?,?,?)',(uid,payload.username.lower(),payload.name,payload.role,hashed,now().isoformat()))
        except sqlite3.IntegrityError:
            fail(409,'这个账号名已被使用，请换一个。')
        response=authenticated_response(req,uid); response.status_code=201; return response

    @router.post('/login')
    def login(payload: Login,req: Request):
        lab.throttle(req)
        with db.connect() as con:
            user=con.execute('SELECT * FROM lab_users WHERE username=? COLLATE NOCASE',(payload.username.strip(),)).fetchone()
        stored=user['password_hash'] if user else '0'*32+':'+'0'*64
        if not hmac.compare_digest(encode_password(payload.password,stored.split(':')[0]),stored) or not user:
            fail(401,'账号或密码不正确。')
        return authenticated_response(req,user['user_id'])

    @router.post('/logout')
    def logout(req: Request):
        with db.connect() as con:
            con.execute('DELETE FROM lab_access WHERE token_hash=?',(hashlib.sha256(req.cookies.get(COOKIE,'').encode()).hexdigest(),))
        token,_=lab.create_access(); response=JSONResponse({'ok':True}); req.state.lab_auth_changed=True
        lab.cookie(response,token,req); return response

    @router.get('/classes')
    def classes(req: Request):
        actor=lab.actor(req)
        with db.connect() as con:
            rows=con.execute('SELECT * FROM lab_classes WHERE teacher_id=? ORDER BY created_at DESC',(actor['user_id'],)).fetchall() if actor['role']=='teacher' else con.execute('SELECT c.class_id,c.name,c.created_at FROM lab_classes c JOIN lab_members m ON m.class_id=c.class_id WHERE m.user_id=? ORDER BY c.created_at DESC',(actor['user_id'],)).fetchall()
            result=[]
            for row in rows:
                item=dict(row)
                item['member_count']=con.execute('SELECT COUNT(*) FROM lab_members WHERE class_id=?',(row['class_id'],)).fetchone()[0]
                item['assignment_count']=con.execute('SELECT COUNT(*) FROM lab_assignments WHERE class_id=?',(row['class_id'],)).fetchone()[0]
                result.append(item)
        return {'classes':result}

    @router.post('/classes',status_code=201)
    def create_class(payload: ClassCreate,req: Request):
        actor=lab.actor(req,'teacher'); cid=str(uuid4())
        with db.connect() as con:
            con.execute('INSERT INTO lab_classes VALUES (?,?,?,?,?)',(cid,actor['user_id'],payload.name,secrets.token_hex(4).upper(),now().isoformat()))
            return dict(con.execute('SELECT * FROM lab_classes WHERE class_id=?',(cid,)).fetchone())

    @router.post('/join')
    def join(payload: Join,req: Request):
        actor=lab.actor(req,'student'); lab.throttle(req,'join')
        with db.connect() as con:
            cl=con.execute('SELECT class_id,name FROM lab_classes WHERE invite_code=?',(payload.code.upper(),)).fetchone()
            if not cl: fail(404,'邀请码不正确，请向老师确认。')
            existing=con.execute('SELECT * FROM lab_members WHERE class_id=? AND user_id=?',(cl['class_id'],actor['user_id'])).fetchone()
            if existing: return dict(cl)
            try:
                con.execute('INSERT INTO lab_members VALUES (?,?,?,?)',(cl['class_id'],actor['user_id'],payload.student_number,now().isoformat()))
            except sqlite3.IntegrityError:
                fail(409,'这个班级编号已被使用，请向老师确认。')
            return dict(cl)

    @router.get('/classes/{cid}')
    def class_detail(cid: str,req: Request):
        actor=lab.actor(req)
        with db.connect() as con:
            cl=lab.class_access(req,con,cid)
            if actor['role']!='teacher': cl.pop('invite_code'); cl.pop('teacher_id')
            cl['member_count']=con.execute('SELECT COUNT(*) FROM lab_members WHERE class_id=?',(cid,)).fetchone()[0]
            cl['assignments']=[dict(row) for row in con.execute('SELECT * FROM lab_assignments WHERE class_id=? ORDER BY created_at DESC',(cid,)).fetchall()]
            for assignment in cl['assignments']:
                assignment['experiment_title']=lab.catalog.by_id[assignment['experiment_id']].title
                subs=lab.submissions(con,assignment['assignment_id'],None if actor['role']=='teacher' else actor['user_id'],snapshots=True)
                if actor['role']=='teacher': assignment['summary']=lab.summary(con,assignment,subs)
                else: assignment['my_submission']=({k:v for k,v in subs[0].items() if k!='snapshot'} if subs else None)
            if actor['role']=='teacher':
                cl['members']=[dict(row) for row in con.execute('SELECT u.name,m.student_number,m.joined_at FROM lab_members m JOIN lab_users u ON u.user_id=m.user_id WHERE m.class_id=? ORDER BY m.student_number',(cid,)).fetchall()]
            return cl

    @router.post('/classes/{cid}/assignments',status_code=201)
    def create_assignment(cid: str,payload: AssignmentCreate,req: Request):
        if payload.experiment_id not in lab.catalog.by_id: fail(422,'请选择资料库中已有的实验。')
        aid=str(uuid4())
        with db.connect() as con:
            lab.class_access(req,con,cid,teacher=True)
            con.execute('INSERT INTO lab_assignments VALUES (?,?,?,?,?,?,0,?)',(aid,cid,payload.title,payload.experiment_id,payload.instructions,payload.due_at.isoformat() if payload.due_at else None,now().isoformat()))
            return lab.assignment_access(req,con,aid)

    @router.get('/assignments/{aid}')
    def assignment_detail(aid: str,req: Request):
        actor=lab.actor(req)
        with db.connect() as con:
            assignment=lab.assignment_access(req,con,aid)
            subs=lab.submissions(con,aid,None if actor['role']=='teacher' else actor['user_id'],snapshots=True)
            if actor['role']=='teacher': assignment['summary']=lab.summary(con,assignment,subs)
            assignment['submissions']=[{k:v for k,v in sub.items() if k!='snapshot'} for sub in subs]
            return assignment

    @router.patch('/assignments/{aid}')
    def assignment_state(aid: str,payload: AssignmentState,req: Request):
        with db.connect() as con:
            lab.assignment_access(req,con,aid,teacher=True)
            con.execute('UPDATE lab_assignments SET closed=? WHERE assignment_id=?',(int(payload.closed),aid))
        return {'closed':payload.closed}

    @router.post('/assignments/{aid}/start')
    def start(aid: str,req: Request):
        actor=lab.actor(req,'student')
        with db.connect() as con:
            con.execute('BEGIN IMMEDIATE')
            assignment=lab.assignment_access(req,con,aid)
            row=con.execute('SELECT session_id FROM lab_work WHERE assignment_id=? AND user_id=?',(aid,actor['user_id'])).fetchone()
            if row: return dict(con.execute('SELECT * FROM sessions WHERE session_id=?',(row['session_id'],)).fetchone())
            if assignment['closed']: fail(409,'老师已结束收集这份作业。')
            member=con.execute('SELECT student_number FROM lab_members WHERE class_id=? AND user_id=?',(assignment['class_id'],actor['user_id'])).fetchone()
            sid=str(uuid4()); stamp=now().isoformat()
            con.execute('INSERT INTO sessions VALUES (?,?,?,?,?)',(sid,member['student_number'],assignment['experiment_id'],assignment['class_name'],stamp))
            con.execute('INSERT INTO lab_session_owners VALUES (?,?)',(sid,actor['user_id']))
            con.execute('INSERT INTO lab_work VALUES (?,?,?)',(aid,actor['user_id'],sid))
            return dict(session_id=sid,student_id=member['student_number'],experiment_id=assignment['experiment_id'],course_id=assignment['class_name'],created_at=stamp)

    @router.get('/work/{sid}')
    def work_context(sid: str,req: Request):
        lab.own_session(req,sid)
        with db.connect() as con:
            work=con.execute('SELECT assignment_id FROM lab_work WHERE session_id=?',(sid,)).fetchone()
            return {'assignment':lab.assignment_access(req,con,work['assignment_id']) if work else None}

    @router.post('/assignments/{aid}/submit',status_code=201)
    def submit(aid: str,payload: Submit,req: Request):
        actor=lab.actor(req,'student'); lab.own_session(req,payload.session_id)
        with db.connect() as con:
            con.execute('BEGIN IMMEDIATE')
            assignment=lab.assignment_access(req,con,aid)
            if assignment['closed']: fail(409,'老师已结束收集这份作业，暂时不能提交。')
            work=con.execute('SELECT 1 FROM lab_work WHERE assignment_id=? AND user_id=? AND session_id=?',(aid,actor['user_id'],payload.session_id)).fetchone()
            if not work: fail(422,'请从这份作业的“开始实验”入口完成记录。')
            snapshot=lab.snapshot(con,payload.session_id)
            fingerprint=hashlib.sha256((snapshot+'\n'+payload.note.strip()).encode()).hexdigest()
            previous=con.execute('SELECT * FROM lab_submissions WHERE assignment_id=? AND user_id=? ORDER BY version DESC LIMIT 1',(aid,actor['user_id'])).fetchone()
            if previous and previous['fingerprint']==fingerprint:
                return dict(submission_id=previous['submission_id'],version=previous['version'],duplicate=True)
            version=previous['version']+1 if previous else 1; subid=str(uuid4());stamp=now()
            late=int(bool(assignment['due_at'] and stamp>datetime.fromisoformat(assignment['due_at'])))
            con.execute('INSERT INTO lab_submissions VALUES (?,?,?,?,?,?,?,?,?)',(subid,aid,actor['user_id'],version,snapshot,payload.note.strip(),stamp.isoformat(),late,fingerprint))
            return dict(submission_id=subid,version=version,late=bool(late),duplicate=False)

    @router.get('/submissions/{subid}')
    def submission_detail(subid: str,req: Request):
        actor=lab.actor(req)
        with db.connect() as con:
            sub=con.execute('SELECT * FROM lab_submissions WHERE submission_id=?',(subid,)).fetchone()
            if not sub: fail(404,'找不到这份提交。')
            assignment=lab.assignment_access(req,con,sub['assignment_id'])
            if actor['role']=='student' and sub['user_id']!=actor['user_id']: fail(404,'找不到这份提交。')
            item=next(s for s in lab.submissions(con,sub['assignment_id'],snapshots=True) if s['submission_id']==subid)
            return dict(assignment=assignment,submission=item)

    @router.post('/submissions/{subid}/review')
    def review(subid: str,payload: Review,req: Request):
        with db.connect() as con:
            sub=con.execute('SELECT assignment_id FROM lab_submissions WHERE submission_id=?',(subid,)).fetchone()
            if not sub: fail(404,'找不到这份提交。')
            lab.assignment_access(req,con,sub['assignment_id'],teacher=True)
            con.execute('INSERT INTO lab_reviews VALUES (?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET status=excluded.status,feedback=excluded.feedback,reviewed_at=excluded.reviewed_at',(subid,payload.status,payload.feedback,now().isoformat()))
        return {'ok':True}

    @router.get('/assignments/{aid}/export.csv')
    def export(aid: str,req: Request):
        with db.connect() as con:
            assignment=lab.assignment_access(req,con,aid,teacher=True)
            summary=lab.summary(con,assignment,lab.submissions(con,aid,snapshots=True))
        # A leading formula marker in a student-provided name must not execute in Excel.
        def cell(value):
            value=str(value)
            return "'"+value if value.lstrip().startswith(('=','+','-','@','\t','\r','\n')) else value
        output=io.StringIO();writer=csv.writer(output)
        writer.writerow(['学生姓名','班级编号','作业','提交状态','最新版本','提交时间','迟交','诊断轮数','修改次数','批阅结论','老师反馈'])
        statuses={None:'待批阅','accepted':'已通过','needs_revision':'需修改'}
        for member in summary['members']:
            sub=member['submission']
            writer.writerow([cell(member['name']),cell(member['student_number']),cell(assignment['title']), '已提交' if sub else '未提交',sub['version'] if sub else '',sub['submitted_at'] if sub else '', '是' if sub and sub['late'] else '否',sub['attempt_count'] if sub else '',sub['modification_count'] if sub else '',statuses[sub['review_status']] if sub else '',cell(sub['feedback'] or '') if sub else ''])
        return Response('\ufeff'+output.getvalue(),media_type='text/csv; charset=utf-8',headers={'Content-Disposition':'attachment; filename="class-assignment.csv"'})

    # Old unrestricted aggregate endpoints cannot be used to enumerate private records.
    @app.get('/api/v1/stats/{legacy_path:path}',include_in_schema=False)
    def legacy_statistics(legacy_path: str):
        fail(410,'请登录班级空间，查看你任教班级的作业统计。')

    @app.get('/classroom',include_in_schema=False)
    @app.get('/classroom/{page:path}',include_in_schema=False)
    def classroom_page():
        return FileResponse(static/'classroom.html')

    app.include_router(router)
    return lab
