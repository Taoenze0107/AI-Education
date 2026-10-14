import base64
import csv
import io
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.experiment_catalog import ExperimentCatalog, ReadingRequest, analyze_readings
from app.main import create_app
from app.math_engine import evaluate_formula

CATALOG=ExperimentCatalog()
ORIGINAL_EXPERIMENT_IDS={
    'ohms_law','rc_time_constant','simple_pendulum','hookes_law','spring_oscillation',
    'free_fall','inclined_friction','thin_lens','snell_refraction','double_slit','calorimetry','sound_resonance',
}

@pytest.mark.parametrize('eid,expected',[
    ('ohms_law',250),('rc_time_constant',0.01),('simple_pendulum',9.81),
    ('hookes_law',50),('spring_oscillation',25),('free_fall',9.81),
    ('inclined_friction',math.tan(math.radians(20))),('thin_lens',10),
    ('snell_refraction',1.5),('double_slit',650),('calorimetry',900),('sound_resonance',343),
])
def test_ideal_data_recovers_independent_physical_values(eid,expected):
    topic,case=CATALOG.cases[eid+'-basic']
    result=analyze_readings(topic,ReadingRequest(columns=case.columns,parameters=case.parameters))
    assert result['result']==pytest.approx(expected,rel=2e-6)
    math_evidence=result['mathematics']
    assert evaluate_formula(math_evidence['formula'],math_evidence['variables'])==pytest.approx(result['result'])
    assert math_evidence['student_result'] is None
    assert len(result['charts'][0]['points'])==len(next(iter(case.columns.values())))


def test_all_levels_are_valid_original_cases_and_faults_remain_visible():
    assert len(CATALOG.topics)==128 and len(CATALOG.cases)==504
    for topic in CATALOG.topics:
        assert {c.level for c in topic.cases}=={'basic','standard','challenge'}
        for case in topic.cases:
            assert case.provenance=='synthetic-example' and len(case.questions)==3
            assert all(q.hint and q.solution for q in case.questions)
            result=analyze_readings(topic,ReadingRequest(columns=case.columns,parameters=case.parameters))
            assert len(result['raw_measurements'][topic.columns[0].key])==len(case.columns[topic.columns[0].key])
            assert all(math.isfinite(v['value']) for v in result['metrics'])
            assert evaluate_formula(result['mathematics']['formula'],result['mathematics']['variables'])==pytest.approx(result['result'])
    def result(eid,level):
        t,c=CATALOG.cases[eid+'-'+level]
        return analyze_readings(t,ReadingRequest(columns=c.columns,parameters=c.parameters))
    assert result('double_slit','standard')['result']==pytest.approx(result('double_slit','challenge')['result'])
    assert result('free_fall','challenge')['result']<9.81
    assert result('thin_lens','challenge')['result']>10
    assert result('calorimetry','challenge')['result']<900
    assert result('sound_resonance','challenge')['result']>400
    assert next(m['value'] for m in result('rc_time_constant','challenge')['metrics'] if m['label']=='63.2% 阈值')==pytest.approx(1+4*(1-math.exp(-1)))

@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(Settings(database_path=tmp_path/'catalog.db',knowledge_base_path=Path(__file__).parents[1]/'app/data/knowledge_base.json',enable_llm=False)))


def test_catalog_deep_links_downloads_and_unknown_ids(client):
    response=client.get('/api/v1/experiments')
    assert response.json()['question_count']==1512
    for topic in CATALOG.topics:
        assert client.get('/experiments/'+topic.experiment_id).status_code==200
        for case in topic.cases:
            assert client.get('/practice/'+case.case_id).status_code==200
            csv_file=client.get('/api/v1/practice/'+case.case_id+'/data.csv')
            assert csv_file.status_code==200 and csv_file.content.startswith(b'\xef\xbb\xbf')
    assert client.get('/experiments/not-real').status_code==404
    assert client.get('/practice/not-real').status_code==404
    assert client.get('/api/v1/experiments/not-real').status_code==404
    student=client.get('/api/v1/practice/thin_lens-basic/worksheet')
    solutions=client.get('/api/v1/practice/thin_lens-basic/worksheet?answers=true')
    assert '参考结果为' not in student.text
    assert '参考结果为' in solutions.text and '非真实测量' in solutions.text
    assert 'attachment' in student.headers['content-disposition']


def test_csv_roundtrip_preserves_parameters_and_teaching_provenance(client):
    for eid in ['hookes_law','spring_oscillation','double_slit','calorimetry','sound_resonance']:
        topic,case=CATALOG.cases[eid+'-standard']
        text=client.get('/api/v1/practice/'+case.case_id+'/data.csv').content
        response=client.post('/api/v1/experiments/'+eid+'/import',json=dict(filename='example.csv',content_base64=base64.b64encode(text).decode()))
        assert response.status_code==200,response.text
        data=response.json()
        assert data['readings']['columns']==case.columns
        assert data['readings']['parameters']==case.parameters
        assert data['origin']=='imported-example'
        assert data['analysis']['result']==pytest.approx(analyze_readings(topic,ReadingRequest(columns=case.columns,parameters=case.parameters))['result'])


@pytest.mark.parametrize('eid,columns,parameters',[
 ('hookes_law',{'extension_cm':[1,1,1],'force_N':[1,2,3]},{}),
 ('hookes_law',{'extension_cm':[1,2,3],'force_N':[1,2]},{}),
 ('free_fall',{'height_cm':[10,20,30],'time_ms':[0,100,150]},{}),
 ('spring_oscillation',{'mass_g':[100,200,300],'total_time_s':[3,4,5]},{'cycles':2.5}),
 ('snell_refraction',{'incidence_deg':[10,20,30],'refraction_deg':[0,15,20]},{}),
 ('calorimetry',{'metal_initial_C':[80,85,90],'equilibrium_C':[10,25,30]},{'metal_mass_g':100,'water_mass_g':150,'water_initial_C':20,'water_specific_heat':4180}),
 ('sound_resonance',{'frequency_Hz':[400,500,600],'first_length_cm':[10,10,10],'second_length_cm':[5,20,30]},{}),
])
def test_model_conditions_reject_invalid_or_mismatched_readings(client,eid,columns,parameters):
    r=client.post('/api/v1/experiments/'+eid+'/analyze',json=dict(columns=columns,parameters=parameters))
    assert r.status_code==422


def test_csv_reports_duplicate_headers_and_varying_parameters(client):
    for text in ['mass_g,mass_g,total_time_s\n100,100,3\n200,200,4\n300,300,5',
                 'mass_g,total_time_s,cycles\n100,3,10\n200,4,11\n300,5,10']:
        r=client.post('/api/v1/experiments/spring_oscillation/import',json=dict(filename='bad.csv',content_base64=base64.b64encode(text.encode()).decode()))
        assert r.status_code==422


def test_csv_missing_parameters_are_not_silently_replaced_by_defaults(client):
    for text in ['mass_g,total_time_s\n100,3\n200,4\n300,5',
                 'mass_g,total_time_s,cycles\n100,3,\n200,4,\n300,5,']:
        r=client.post('/api/v1/experiments/spring_oscillation/import',json=dict(filename='incomplete.csv',content_base64=base64.b64encode(text.encode()).decode()))
        assert r.status_code==422


ADDED_IDEAL_CASES=[
    ('ohms_law-basic-470-ohm',470),
    ('rc_time_constant-basic-4k7-2u2',.01034),
    ('simple_pendulum-basic-60cm-20cycles',9.81),
    ('hookes_law-basic-80-newton',80),
    ('spring_oscillation-basic-18-newton',18),
    ('free_fall-basic-9p8-model',9.8),
    ('inclined_friction-basic-25-degrees',math.tan(math.radians(25))),
    ('snell_refraction-basic-n1p33',1.33),
    ('double_slit-basic-green-532',532),
    ('sound_resonance-basic-340-speed',340),
]


@pytest.mark.parametrize('case_id,expected',ADDED_IDEAL_CASES)
def test_added_ideal_cases_recover_their_independent_generation_parameters(case_id,expected):
    topic,case=CATALOG.cases[case_id]
    result=analyze_readings(topic,ReadingRequest(columns=case.columns,parameters=case.parameters))
    assert result['result']==pytest.approx(expected,rel=2e-7)


def added_cases():
    original_ids={eid+'-'+level for eid in ORIGINAL_EXPERIMENT_IDS for level in ['basic','standard','challenge']}
    return [(t,c) for cid,(t,c) in CATALOG.cases.items() if t.experiment_id in ORIGINAL_EXPERIMENT_IDS and cid not in original_ids]


def test_thirty_additions_are_balanced_and_have_distinct_readings():
    additions=added_cases()
    assert len(additions)==30
    assert {level:sum(c.level==level for _,c in additions) for level in ['basic','standard','challenge']}=={'basic':10,'standard':10,'challenge':10}
    assert {t.experiment_id for t,_ in additions}==ORIGINAL_EXPERIMENT_IDS
    for t in CATALOG.topics:
        signatures=[(tuple((key,tuple(value)) for key,value in sorted(c.columns.items())),tuple(sorted(c.parameters.items()))) for c in t.cases]
        assert len(signatures)==len(set(signatures))


def test_new_case_downloads_import_losslessly_and_have_printable_questions(client):
    for t,c in added_cases():
        content=client.get('/api/v1/practice/'+c.case_id+'/data.csv')
        result=client.post('/api/v1/experiments/'+t.experiment_id+'/import',json=dict(filename=c.case_id+'.csv',content_base64=base64.b64encode(content.content).decode()))
        assert result.status_code==200,result.text
        data=result.json()
        assert data['readings']['columns']==c.columns
        assert data['readings']['parameters']==c.parameters
        assert data['origin']=='imported-example'
        exercise=client.get('/api/v1/practice/'+c.case_id+'/worksheet')
        solution=client.get('/api/v1/practice/'+c.case_id+'/worksheet?answers=true')
        assert '参考处理结果为' not in exercise.text
        assert '参考处理结果为' in solution.text
        assert '非真实测量' in exercise.text
        assert len(c.questions)==3 and len(c.questions[0].solution)>=2


def test_new_challenges_expose_multiple_different_limits_of_the_model():
    def result(cid):
        t,c=CATALOG.cases[cid]
        return analyze_readings(t,ReadingRequest(columns=c.columns,parameters=c.parameters))
    short=result('rc_time_constant-challenge-short-window')
    assert short['result']==pytest.approx(.03196)
    assert not any(m['label']=='阈值时间（插值）' for m in short['metrics'])
    assert any('未跨过' in n for n in short['notes'])
    height=result('free_fall-challenge-height-zero')
    assert height['result']==pytest.approx(9.81,rel=2e-7)
    assert next(m['value'] for m in height['metrics'] if m['label']=='拟合截距')==pytest.approx(.04,abs=1e-8)
    assert result('simple_pendulum-challenge-miscount')['result']==pytest.approx(9.81*(12/11)**2,rel=2e-7)
    assert result('spring_oscillation-challenge-last-count')['result']<24
    assert result('thin_lens-challenge-object-zero')['result']>8
    assert result('calorimetry-challenge-container-heat')['result']==pytest.approx(900*752.4/812.4,rel=2e-7)
    assert result('sound_resonance-challenge-second-zero')['result']==pytest.approx(343+2*505*.012,rel=2e-7)
