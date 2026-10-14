"""Independent physical values and import coverage for the twelve new topics."""
import base64
from collections import Counter
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.experiment_catalog import ExperimentCatalog, ReadingRequest, analyze_readings
from app.knowledge import KnowledgeBase
from app.main import create_app
from app.math_engine import evaluate_formula

CATALOG = ExperimentCatalog()
IDEAL_VALUES = {
    'uniform_acceleration': .30, 'newtons_second_law': .60, 'work_energy': .50,
    'archimedes': 1000, 'resistivity': .40, 'joule_heating': 80,
    'capacitor_discharge': .020, 'transformer_ratio': .50, 'grating_diffraction': 600,
    'total_internal_reflection': 1.50, 'thermal_expansion': 23, 'string_waves': .60,
}


def analysis(case_id):
    topic, case = CATALOG.cases[case_id]
    return analyze_readings(topic, ReadingRequest(columns=case.columns, parameters=case.parameters))


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(Settings(database_path=tmp_path/'doubled.db',
        knowledge_base_path=Path(__file__).parents[1]/'app/data/knowledge_base.json', enable_llm=False)))


@pytest.mark.parametrize('eid,expected', IDEAL_VALUES.items())
def test_new_ideal_models_recover_independent_physical_values(eid, expected):
    result = analysis(eid+'-basic')
    assert result['result'] == pytest.approx(expected, rel=2e-6)
    evidence = result['mathematics']
    assert evidence['student_result'] is None
    assert evaluate_formula(evidence['formula'], evidence['variables']) == pytest.approx(expected, rel=2e-6)
    topic, case = CATALOG.cases[eid+'-basic']
    assert all(len(chart['points']) == len(case.columns[topic.columns[0].key]) for chart in result['charts'])
    assert result['unit'] == topic.output_unit


def test_new_sixty_six_cases_have_balanced_levels_and_distinct_inputs():
    topics = [CATALOG.by_id[eid] for eid in IDEAL_VALUES]
    cases = [case for topic in topics for case in topic.cases]
    assert len(cases) == 66
    assert Counter(case.level for case in cases) == {'basic':22, 'standard':22, 'challenge':22}
    assert sum(len(case.questions) for case in cases) == 198
    for topic in topics:
        assert len(topic.conditions) >= 3 and len(topic.steps) >= 3
        assert len(topic.data_questions) >= 2 and len(topic.knowledge_ids) == 3
        signatures = [(tuple((key, tuple(values)) for key, values in sorted(case.columns.items())),
                       tuple(sorted(case.parameters.items()))) for case in topic.cases]
        assert len(signatures) == len(set(signatures))
        assert all(case.provenance == 'synthetic-example' for case in topic.cases)


def test_every_new_csv_roundtrip_retains_readings_parameters_and_original_questions(client):
    for eid in IDEAL_VALUES:
        for case in CATALOG.by_id[eid].cases:
            download = client.get('/api/v1/practice/'+case.case_id+'/data.csv')
            assert download.status_code == 200 and download.content.startswith(b'\xef\xbb\xbf')
            imported = client.post('/api/v1/experiments/'+eid+'/import', json={
                'filename':case.case_id+'.csv', 'content_base64':base64.b64encode(download.content).decode()})
            assert imported.status_code == 200, imported.text
            payload = imported.json()
            assert payload['origin'] == 'imported-example'
            assert payload['readings'] == {'columns':case.columns, 'parameters':case.parameters}
            assert payload['analysis']['result'] == pytest.approx(analysis(case.case_id)['result'])
            exercise = client.get('/api/v1/practice/'+case.case_id+'/worksheet')
            answer = client.get('/api/v1/practice/'+case.case_id+'/worksheet?answers=true')
            assert exercise.status_code == answer.status_code == 200
            assert '非真实测量' in exercise.text and '参考处理结果为' not in exercise.text
            assert '参考处理结果为' in answer.text
            for question in case.questions:
                assert question.prompt in exercise.text
                assert question.solution and question.hint


@pytest.mark.parametrize('eid,target,key,value', [
    ('uniform_acceleration','columns','time_s',[0,.3,.6,.9,1.2,1.5,1.8,1.8]),
    ('newtons_second_law','columns','net_force_N',[-1,-2,-3,-4,-5,-6,-7]),
    ('work_energy','parameters','initial_speed_m_s',-1),
    ('work_energy','parameters','initial_speed_m_s',2),
    ('archimedes','columns','submerged_volume_cm3',[0,20,35,50,70,90,110]),
    ('resistivity','parameters','diameter_mm',0),
    ('joule_heating','parameters','current_A',0),
    ('capacitor_discharge','columns','capacitor_voltage_V',[0,1,2,3,4,5,6,7]),
    ('capacitor_discharge','columns','capacitor_voltage_V',[1,2,3,4,5,6,7,8]),
    ('capacitor_discharge','columns','time_ms',[0,5,10,15,25,40,60,60]),
    ('transformer_ratio','parameters','primary_turns',600.5),
    ('grating_diffraction','columns','diffraction_order',[1,2,2.5,4,5,6]),
    ('grating_diffraction','columns','angle_deg',[0,20,30,40,50,60]),
    ('total_internal_reflection','columns','critical_angle_deg',[90,40,40,40,40,40]),
    ('thermal_expansion','columns','temperature_rise_C',[-10,0,10,20,30,40,50]),
    ('string_waves','parameters','tension_N',-1),
])
def test_new_models_reject_invalid_physical_inputs(client,eid,target,key,value):
    _, case = CATALOG.cases[eid+'-basic']
    request = {'columns':{k:list(v) for k,v in case.columns.items()}, 'parameters':dict(case.parameters)}
    request[target][key] = value
    assert client.post('/api/v1/experiments/'+eid+'/analyze', json=request).status_code == 422


def test_new_fault_cases_preserve_bias_and_model_limits():
    assert analysis('uniform_acceleration-challenge-v2')['result'] == pytest.approx(.45/1.1, rel=2e-6)
    assert analysis('archimedes-challenge-v2')['result'] == pytest.approx(800/.9, rel=2e-6)
    assert analysis('resistivity-challenge-v2')['result'] == pytest.approx(.7*1.1**2, rel=2e-6)
    heating = analysis('joule_heating-challenge-v2')
    assert heating['result'] > 100 and any('超过 100%' in note for note in heating['notes'])
    discharge = analysis('capacitor_discharge-challenge')
    assert discharge['result'] > .02
    assert len(discharge['charts']) == 3 and discharge['charts'][0]['y_label'] == '电容电压（V）'
    transformer = analysis('transformer_ratio-challenge')
    assert transformer['result'] == pytest.approx(.44)
    assert next(metric['value'] for metric in transformer['metrics'] if metric['label']=='理想匝数比') == .5
    assert analysis('thermal_expansion-challenge')['result'] == pytest.approx(30)
    assert analysis('thermal_expansion-challenge-v2')['result'] == pytest.approx(23/.8)
    # A clean straight line can still have the wrong standing-wave mode.
    harmonic = analysis('string_waves-challenge')
    assert harmonic['result'] == pytest.approx(.6/4, rel=2e-6)
    assert next(metric['value'] for metric in harmonic['metrics'] if metric['label']=='R²') > .999
    work = analysis('work_energy-challenge-v2')
    assert work['result'] == pytest.approx(.75, rel=2e-6)
    assert next(metric['value'] for metric in work['metrics'] if metric['label']=='拟合截距') == pytest.approx(-.24)


@pytest.mark.parametrize('eid', IDEAL_VALUES)
def test_new_topic_knowledge_retains_sources_and_experiment_filter(eid):
    base = KnowledgeBase(Path(__file__).parents[1]/'app/data/knowledge_base.json')
    matches = base.search(CATALOG.by_id[eid].relation, eid, 10)
    assert {eid+'-'+suffix for suffix in ['model','data','errors']} <= {m.document_id for m in matches}
    assert all(match.experiment_id in {eid,'generic'} for match in matches)
    assert all(match.sources and match.check_questions for match in matches)
