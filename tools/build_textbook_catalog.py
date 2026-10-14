"""Append-only original textbook lessons. Refuse overwriting existing authored material."""
from pathlib import Path
import copy,hashlib,json,sys
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from tools.textbook_blueprints import PLANS,variant
from tools.textbook_mapping import BOOKS,EXTRA_SOURCES
from app.experiment_catalog import ExperimentTopic,ReadingRequest,analyze_readings
from app.knowledge import KnowledgeDocument
from app.textbook_models import IDS
def digest(v):return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
def save(p,value):
    tmp=p.with_suffix(p.suffix+'.tmp');tmp.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n');tmp.replace(p)
def build():
    cf=ROOT/'app/data/experiment_catalog.json';kf=ROOT/'app/data/knowledge_base.json'
    old=json.loads(cf.read_text());oldkb=json.loads(kf.read_text())
    if any(t['experiment_id'] in IDS for t in old):raise SystemExit('教材专题已存在；拒绝覆盖人工修改。')
    assert len(old)==48 and sum(len(t['cases']) for t in old)==264
    assert {p['experiment_id'] for p in PLANS}==IDS
    assert [len(b['items']) for b in BOOKS]==[27,40,38,32,32]
    known={t['experiment_id'] for t in old}|IDS
    assert all(set(i['experiment_ids'])<=known for b in BOOKS for i in b['items'])
    additions=[];documents=[];results={}
    for plan in PLANS:
        eid=plan['experiment_id'];topic={k:copy.deepcopy(v) for k,v in plan.items() if k not in {'method','question','fault'}}
        matches=[b for b in BOOKS if any(eid in i['experiment_ids'] for i in b['items'])]
        sources=[dict(title=b['publisher']+' · '+b['title']+'目录',url=b['url']) for b in matches[:2]]
        if eid in EXTRA_SOURCES:
            title,url=EXTRA_SOURCES[eid];sources.insert(0,dict(title=title,url=url))
        assert sources
        topic.update(summary=plan['method'],goal='完成'+plan['output_label']+'的数据处理，核查方法、单位和模型条件。',
            data_questions=[plan['question'],'哪些仪器与模型条件已有证据，哪些需要核实？'],checks=plan['conditions'],
            knowledge_ids=[eid+'-textbook-'+k for k in ['model','data','review']],sources=sources,cases=[])
        for level,title in [('basic','基础：单位与方法'),('standard','标准：重复读数与波动'),('challenge','探究：'+plan['fault'])]:
            cols,params,description=variant(eid,level)
            topic['cases'].append(dict(case_id=eid+'-textbook-'+level,title=title,level=level,
                description=description+' 所有读数均为教学模拟数据，非真实测量。',provenance='synthetic-example',columns=cols,parameters=params,
                questions=[dict(prompt='验证',hint='验证',solution=['验证'])]*3))
        model=ExperimentTopic.model_validate(topic);results[eid]={}
        for index,case in enumerate(model.cases):
            r=analyze_readings(model,ReadingRequest(columns=case.columns,parameters=case.parameters));numeric=f"{r['result']:.9g} {r['unit']}".strip()
            results[eid][case.level]=r['result']
            metrics=[f"{m['label']}：{m['value']:.7g} {m['unit']}。" for m in r['metrics'] if m['label']!=model.output_label]
            scenario='本组是理想教学模拟。' if case.level=='basic' else '本组是带确定小扰动的教学模拟。' if case.level=='standard' else '本组明确预设了'+plan['fault']+'，不自动改回理想生成参数。'
            topic['cases'][index]['questions']=[
                dict(prompt=plan['question'],hint='先核对 '+plan['relation']+'，再看本组说明和条件。',solution=[scenario,plan['method'],'必须核查：'+plan['conditions'][0]+'。',f'当前读数参考处理值为 {numeric}；数值不自动确认仪器条件。']),
                dict(prompt='处理本组全部读数，求'+model.output_label+'，写出换算、过程和单位。',hint=plan['method'],solution=[plan['method'],f'参考处理结果为 {numeric}。',*metrics,*r['notes']]),
                dict(prompt='设计一次独立复查：'+plan['fault']+'应如何发现？怎样保留复查前后证据？',hint=plan['steps'][0]+'；'+plan['steps'][-1],solution=[
                    '该偏差是练习预设或待查情形，不是对用户实测的结论。','先保存未经筛选的原始读数、零位、量程和环境记录。',
                    '复查重点：'+plan['conditions'][0]+'；'+plan['conditions'][-1]+'。','实施：'+plan['steps'][0]+'；'+plan['steps'][-1]+'。',
                    '控制一项条件独立复测，用相同处理方式比较前后；仍未核实的条件明确写出。'])]
        ExperimentTopic.model_validate(topic);additions.append(topic)
        for kind,principles,standards,errors,questions in [
            ('model',[plan['relation'],*plan['conditions']],[plan['method']],[plan['fault']],[plan['question']]),
            ('data',[plan['method']],plan['steps'],['遗漏单位、零位或测量基准。','把模拟参考值当成实测证据。'],[plan['question'],'哪些量是独立实测，哪些来自模型？']),
            ('review',['预设偏差是练习场景，不是当前用户数据的诊断。'],[plan['steps'][0],plan['steps'][-1]],[plan['fault'],'把拟合程度当成实验条件正确的证明。'],['如何独立检验：'+plan['fault']+'？','复查前后哪些条件需相同？'])]:
            d=dict(document_id=eid+'-textbook-'+kind,experiment_id=eid,title=plan['title']+' · '+{'model':'原理与条件','data':'记录与处理','review':'偏差与复查'}[kind],
                principles=principles,data_standards=standards,typical_errors=errors,check_questions=questions,sources=sources,keywords=[plan['title'],model.output_label,eid,*[c['key'] for c in topic['columns']]])
            KnowledgeDocument.model_validate(d);documents.append(d)
    assert len(old+additions)==128 and sum(len(t['cases']) for t in old+additions)==504
    assert len(oldkb+documents)==393
    save(cf,old+additions);save(kf,oldkb+documents)
    save(ROOT/'app/data/textbook_coverage.json',dict(updated='2026-10-12',scope='五本公开目录的169个条目。综合名称按注明范围的专题组合对应，不宣称囊括全国全部教材。',note='目录用于核对课程范围；中文讲解、问题和模拟数据为项目原创。',books=BOOKS))
    save(ROOT/'verification/textbook_expansion_20261012.json',dict(date='2026-10-12',original_topics={t['experiment_id']:digest(t) for t in old},original_knowledge={d['document_id']:digest(d) for d in oldkb},new_ids=sorted(IDS),reference_results=results))
    print('128 topics / 504 datasets / 1512 questions / 393 knowledge entries / 169 crosswalk rows')
if __name__=='__main__':build()
