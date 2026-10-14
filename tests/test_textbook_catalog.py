import base64,csv,hashlib,io,json,math
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.config import Settings
from app.experiment_catalog import ExperimentCatalog,ReadingRequest,analyze_readings
from app.knowledge import KnowledgeBase
from app.main import create_app
from app.math_engine import evaluate_formula
from app.textbook_models import IDS
ROOT=Path(__file__).parents[1];CAT=ExperimentCatalog()
EXPECTED={
 'length_measurement':25.02,'mass_measurement':50,'solid_density':7800,'density_buoyancy':7800,'multimeter':1,'oscilloscope':1000,'virtual_daq':2*math.sqrt(50/101),
 'trifilar':.004,'shear_modulus':40,'forced_resonance':50,'collision':1,'air_heat_ratio':1.4,'surface_tension':.072,'ice_latent_heat':334,'vapor_latent_heat':2256,
 'heat_engine':.8,'temperature_viscosity':2500,'wheatstone':470,'potentiometer':1.5,'meter_conversion':1,'meter_resistance':1000,'diode':1.8,'thermistor':3500,
 'unbalanced_bridge':1.25,'hall_effect':.01,'helmholtz':130,'rlc_series':1/(2*math.pi*math.sqrt(.01*1e-6)),'curie_temperature':120,'electrostatic_field':math.hypot(20,10),
 'photoresistor':.7,'solar_cell':6.8,'magnetoresistance':.5,'strain_gauge':2,'temperature_sensor':10,'rectifier':.3*math.sqrt(50/101)/5,'magnetic_pendulum':.01,
 'wireless_power':60*math.exp(-.12),'fuel_cell':.348,'railgun':100*.002/.045,'prism_angle':60,'prism_refraction':1.5,'abbe_refractometer':1.333,
 'lens_group':7.5,'lens_bessel':10,'fresnel_biprism':632.8,'grating_characteristics':300,'wire_diffraction':80,'optical_flatness':73.6625,
 'diffraction_intensity':.2*math.sqrt(1+.003164**2),'holography':632.8,'infrared_radiation':.8,'thermal_imaging':10,'astronomical_imaging':2,
 'optical_cloaking':100*1.98/(7*.8),'stereo_display':60,'white_light_interference':500,'doppler':343,'acoustic_levitation':343,'ultrasonic_echo':1480,'double_grating':50,
 'millikan':1.602176634e-19,'electron_em':1.75882001076e11,'franck_hertz':4.9,'hydrogen_spectrum':10967758.34,'thermionic_work_function':2.2,
 'nuclear_magnetic_resonance':42.57747892,'zeeman':9.2740100783e-24,'nuclear_counts':10,'nuclear_decay':120,'microwave_properties':299792458,
 'microwave_bragg':2.99792458,'magnus_ball':.02,'dancing_coin':.0025*9.81/(math.pi*.01**2),'light_speed':299792458,'dc_source':10}
def result(eid,level='basic',columns=None,parameters=None):
    t,c=CAT.cases[eid+'-textbook-'+level]
    return analyze_readings(t,ReadingRequest(columns=columns or c.columns,parameters=parameters or c.parameters))
@pytest.fixture(scope='module')
def client(tmp_path_factory):
    with TestClient(create_app(Settings(database_path=tmp_path_factory.mktemp('textbooks')/'test.db',knowledge_base_path=ROOT/'app/data/knowledge_base.json',enable_llm=False))) as c:yield c
@pytest.mark.parametrize('eid,expected',EXPECTED.items())
def test_independent_physical_values(eid,expected):
    r=result(eid);assert r['result']==pytest.approx(expected,rel=2e-8,abs=0)
    m=r['mathematics'];assert evaluate_formula(m['formula'],m['variables'])==pytest.approx(expected,rel=2e-8,abs=0)
    assert m['student_result'] is None
def test_window_and_descriptive_models_from_hand_examples():
    assert result('temperature_pid',columns={'time_s':[0,1,2],'temperature_C':[40,45,50]})['result']==10
    assert result('hysteresis',columns={'field_A_m':[-1,1,1,-1,-1],'flux_T':[-1,-1,1,1,-1]})['result']==4
    assert result('chaos',columns={'time_s':[0,1,2],'x_V':[1,2,3],'y_V':[3,2,1]})['result']==1
    assert result('color_design',columns={'red':[255,0,0],'green':[0,255,0],'blue':[0,0,255]})['result']==pytest.approx(1/3)
    assert result('magnetic_levitation')['result']==pytest.approx(.02*(2*math.pi*3)**2,rel=.003)
    assert set(EXPECTED)|{'temperature_pid','hysteresis','chaos','color_design','magnetic_levitation'}==IDS
def test_original_topics_and_knowledge_hashes():
    report=json.loads((ROOT/'verification/textbook_expansion_20261012.json').read_text())
    for filename,key,hashes in [('experiment_catalog.json','experiment_id',report['original_topics']),('knowledge_base.json','document_id',report['original_knowledge'])]:
        assert len(hashes)==(48 if key=='experiment_id' else 153)
        for row in json.loads((ROOT/'app/data'/filename).read_text()):
            if row[key] in hashes:assert hashlib.sha256(json.dumps(row,sort_keys=True,ensure_ascii=False).encode()).hexdigest()==hashes[row[key]]
    assert len(CAT.topics)==128 and len(CAT.cases)==504
    assert sum(len(c.questions) for _,c in CAT.cases.values())==1512
def test_textbook_crosswalk_and_download(client):
    data=client.get('/api/v1/textbooks').json();assert [len(b['items']) for b in data['books']]==[27,40,38,32,32]
    assert all(i['note'] and set(i['experiment_ids'])<=set(CAT.by_id) for b in data['books'] for i in b['items'])
    csv_file=client.get('/api/v1/textbooks/coverage.csv');assert csv_file.content.startswith(b'\xef\xbb\xbf')
    assert len(list(csv.reader(io.StringIO(csv_file.content.decode('utf-8-sig')))))==170
def test_all_new_csv_and_question_exports(client):
    for eid in IDS:
        t=CAT.by_id[eid];signatures=[]
        assert {c.level for c in t.cases}=={'basic','standard','challenge'}
        for c in t.cases:
            signatures.append(json.dumps({'c':c.columns,'p':c.parameters},sort_keys=True))
            url='/api/v1/practice/'+c.case_id;r=client.get(url).json()['analysis']
            assert len(r['charts'][0]['points'])==len(c.columns[t.columns[0].key])
            assert all(math.isfinite(p['x']) and math.isfinite(p['y']) for chart in r['charts'] for p in chart['points'])
            file=client.get(url+'/data.csv')
            imported=client.post('/api/v1/experiments/'+eid+'/import',json={'filename':'data.csv','content_base64':base64.b64encode(file.content).decode()})
            assert imported.status_code==200,imported.text
            assert imported.json()['readings']=={'columns':c.columns,'parameters':c.parameters}
            assert imported.json()['origin']=='imported-example'
            assert imported.json()['analysis']['result']==pytest.approx(r['result'],rel=1e-10,abs=0)
            blank=client.get(url+'/worksheet');answers=client.get(url+'/worksheet?answers=true')
            assert '非真实测量' in blank.text and '参考处理结果为' not in blank.text and '参考处理结果为' in answers.text
        assert len(signatures)==len(set(signatures))
@pytest.mark.parametrize('eid,kind,key,value',[
 ('length_measurement','parameters','resolution',0),('solid_density','columns','diameter_mm',[0]*7),('density_buoyancy','columns','apparent_mass_g',[80]*7),
 ('oscilloscope','parameters','timebase_ms_div',0),('trifilar','parameters','length_m',-1),('shear_modulus','parameters','radius_mm',0),
 ('air_heat_ratio','columns','restored_height_mm',[60]*7),('wheatstone','columns','null_mV',[1]*7),('potentiometer','columns','standard_length_mm',[0]*7),
 ('meter_conversion','parameters','ammeter_range_mA',.01),('diode','columns','current_mA',[0]*7),('thermistor','columns','temperature_C',[-274]*7),
 ('unbalanced_bridge','columns','delta_resistance_ohm',[100]*7),('hall_effect','parameters','thickness_mm',-1),('helmholtz','parameters','coil_radius_m',0),
 ('curie_temperature','parameters','remaining_fraction',1),('solar_cell','columns','voltage_V',[.05,.1,.2,.3,.4,.45,.5,.55,.6]),
 ('magnetoresistance','parameters','zero_field_resistance',0),('abbe_refractometer','columns','critical_angle_deg',[90]*7),('prism_refraction','parameters','apex_deg',180),
 ('lens_group','columns','separation_cm',[30]*7),('grating_characteristics','parameters','order',1.5),('millikan','columns','charge_number',[1,2,3,4,5,6,6.5]),
 ('electron_em','parameters','turns',130.5),('nuclear_counts','columns','counts',[.5]*7),('nuclear_decay','parameters','background_cps',100),
 ('microwave_bragg','columns','bragg_angle_deg',[0,20,30]),('light_speed','columns','optical_path_m',[0]*7)])
def test_invalid_physical_inputs(client,eid,kind,key,value):
    _,c=CAT.cases[eid+'-textbook-basic'];payload={'columns':{k:list(v) for k,v in c.columns.items()},'parameters':dict(c.parameters)};payload[kind][key]=value
    assert client.post('/api/v1/experiments/'+eid+'/analyze',json=payload).status_code==422
def test_model_semantics_and_prescribed_biases():
    field=result('electrostatic_field');assert field['charts'][0]['kind']=='heatmap' and len(field['charts'][0]['points'])==25
    assert all('z' in p for p in field['charts'][0]['points'])
    h=result('hysteresis');assert h['charts'][0]['connect'] and h['charts'][0]['points'][0]==h['charts'][0]['points'][-1]
    assert result('zeeman','challenge')['result']==pytest.approx(2*9.2740100783e-24,rel=1e-10,abs=0)
    assert result('nuclear_decay','challenge')['result']>120
    assert result('hall_effect','challenge')['result']==pytest.approx(.0095,rel=1e-10,abs=0)
    assert result('solid_density','challenge')['result']==pytest.approx(7800/1.02**2)
    assert result('dc_source','challenge')['result']==pytest.approx(10.4)
    assert result('diffraction_intensity','standard')['result']==pytest.approx(.2,rel=.00002)
    assert any('不等同于混沌证据' in n for n in result('chaos')['notes'])
def test_every_model_has_three_sourced_filtered_knowledge_entries():
    kb=KnowledgeBase(ROOT/'app/data/knowledge_base.json');assert len(kb.documents)==393
    for eid in IDS:
        matches=kb.search(CAT.by_id[eid].relation,eid,20)
        assert set(CAT.by_id[eid].knowledge_ids)<={m.document_id for m in matches}
        assert all(m.experiment_id in {eid,'generic'} and m.sources and m.check_questions for m in matches)
