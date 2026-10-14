import base64
import hashlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app
from app.experiment_catalog import ExperimentCatalog, ReadingRequest, analyze_readings
from app.knowledge import KnowledgeBase
from app.math_engine import evaluate_formula

ROOT=Path(__file__).resolve().parents[1]
CAT=ExperimentCatalog()
EXPECTED={'photoelectric_effect':6.62607015e-34,'malus_law':800,'single_slit':.2,
 'michelson':632.8,'newton_rings':1,'optical_rotation':66.5,'centripetal_force':.2,
 'rotational_inertia':.012,'kinetic_friction':.25,'hydrostatic_pressure':1000,
 'stokes_viscosity':1.2,'young_modulus':200,'charge_capacitance':2.2,
 'parallel_plate':1,'solenoid_field':1000,'ampere_force':.2,'faraday_induction':200,
 'boyle_law':5000,'constant_volume_gas':.34,'newton_cooling':100,
 'thermal_conduction':.2,'torsion_pendulum':.04,'sound_timeflight':343,'damped_oscillation':.08}

@pytest.mark.parametrize('eid,expected',EXPECTED.items())
def test_physical_reference_values(eid,expected):
    t,c=CAT.cases[eid+'-extension-1']
    r=analyze_readings(t,ReadingRequest(columns=c.columns))
    # abs=0 is essential: h~1e-34 must not pass by pytest's default 1e-12 tolerance.
    assert r['result']==pytest.approx(expected,rel=2e-8,abs=0)
    assert evaluate_formula(r['mathematics']['formula'],r['mathematics']['variables'])==pytest.approx(expected,rel=2e-8,abs=0)

def test_preservation_counts_and_knowledge_links():
    report=json.loads((ROOT/'verification/expansion_20261011.json').read_text(encoding='utf-8'))
    topics=json.loads((ROOT/'app/data/experiment_catalog.json').read_text(encoding='utf-8'))
    knowledge=json.loads((ROOT/'app/data/knowledge_base.json').read_text(encoding='utf-8'))
    for items,key,saved in [(topics,'experiment_id',report['original_topics']),(knowledge,'document_id',report['original_knowledge'])]:
        for v in items:
            if v[key] in saved:
                assert hashlib.sha256(json.dumps(v,sort_keys=True,ensure_ascii=False).encode()).hexdigest()==saved[v[key]]
    assert len(CAT.topics)==128 and len(CAT.cases)==504
    assert sum(len(c.questions) for _,c in CAT.cases.values())==1512
    assert len(report['original_topics'])==24 and len(report['original_knowledge'])==81
    kb=KnowledgeBase(ROOT/'app/data/knowledge_base.json')
    assert len(kb.documents)==393
    known={k.document_id for k in kb.documents}
    for eid in EXPECTED:
        t=CAT.by_id[eid]
        assert set(t.knowledge_ids)<=known
        assert len({json.dumps(c.columns,sort_keys=True) for c in t.cases})==len(t.cases)

def test_all_new_downloads_imports_answers_and_graphs(tmp_path):
    with TestClient(create_app(Settings(database_path=tmp_path/'expanded.db',knowledge_base_path=ROOT/'app/data/knowledge_base.json',enable_llm=False))) as client:
        assert client.get('/api/v1/experiments').json()['question_count']==1512
        for eid in EXPECTED:
            assert client.get('/experiments/'+eid).status_code==200
            for case in CAT.by_id[eid].cases:
                url='/api/v1/practice/'+case.case_id
                result=client.get(url)
                assert result.status_code==200
                assert len(result.json()['analysis']['charts'])==2
                data=client.get(url+'/data.csv')
                imported=client.post('/api/v1/experiments/'+eid+'/import',json={'filename':'readings.csv','content_base64':base64.b64encode(data.content).decode()})
                assert imported.status_code==200,imported.text
                assert imported.json()['readings']['columns']==case.columns
                assert imported.json()['origin']=='imported-example'
                assert '非真实测量' in client.get(url+'/worksheet').text
                assert '参考处理结果为' in client.get(url+'/worksheet?answers=true').text

@pytest.mark.parametrize('eid',EXPECTED)
def test_degenerate_coordinates_rejected(eid):
    t,c=CAT.cases[eid+'-extension-1']
    cols={k:list(v) for k,v in c.columns.items()}
    cols[t.columns[0].key]=[cols[t.columns[0].key][0]]*len(cols[t.columns[0].key])
    with pytest.raises(ValueError): analyze_readings(t,ReadingRequest(columns=cols))

@pytest.mark.parametrize('eid',EXPECTED)
def test_negative_reading_rejected(eid):
    t,c=CAT.cases[eid+'-extension-1']
    cols={k:list(v) for k,v in c.columns.items()}; cols[t.columns[1].key][0]=-1
    with pytest.raises(ValueError): analyze_readings(t,ReadingRequest(columns=cols))
