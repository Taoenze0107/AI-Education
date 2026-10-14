"""Reproducible teaching assets; append-only relative to the supplied catalog."""
import hashlib
import json
import math
from pathlib import Path

from app.catalog_extension import SPECS, transform
from app.experiment_catalog import ExperimentTopic, ReadingRequest, analyze_readings

ROOT=Path(__file__).resolve().parents[1]
LEVELS=['basic','standard','challenge','basic','standard','challenge']
NAMES=['理想关系','模拟读数扰动','末点偏移调查','不同测量范围','稀疏测点比较','共同标定偏差']
SOURCES={
 'mechanics':('OpenStax University Physics Volume 1','https://openstax.org/books/university-physics-volume-1/pages/1-introduction'),
 'waves':('OpenStax University Physics Volume 1','https://openstax.org/books/university-physics-volume-1/pages/1-introduction'),
 'thermal':('OpenStax University Physics Volume 2','https://openstax.org/books/university-physics-volume-2/pages/1-introduction'),
 'electricity':('OpenStax University Physics Volume 2','https://openstax.org/books/university-physics-volume-2/pages/1-introduction'),
 'optics':('OpenStax University Physics Volume 3','https://openstax.org/books/university-physics-volume-3/pages/1-introduction'),
}

def digest(v):
    return hashlib.sha256(json.dumps(v,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def generate():
    cp=ROOT/'app/data/experiment_catalog.json';kp=ROOT/'app/data/knowledge_base.json'
    topics=json.loads(cp.read_text(encoding='utf-8')); knowledge=json.loads(kp.read_text(encoding='utf-8'))
    ids={s[0] for s in SPECS}
    prior_topics=topics; prior_knowledge=knowledge
    existing=ids & {t['experiment_id'] for t in topics}
    if existing and existing!=ids: raise SystemExit('发现部分同名主题，停止追加以避免覆盖。')
    if existing:
        topics=[t for t in topics if t['experiment_id'] not in ids]
        knowledge=[k for k in knowledge if k['experiment_id'] not in ids]
    original={t['experiment_id']:digest(t) for t in topics}
    original_k={k['document_id']:digest(k) for k in knowledge}
    report=[]
    for index,s in enumerate(SPECS):
        eid,title,area=s[:3]
        sources=[dict(zip(('title','url'),SOURCES[area]))]
        conditions=[s[19],s[20],'仪器量程、零点与固定装置参数须在现场独立核实。']
        method=f'按 {s[15]} 变换坐标，用全部读数进行带截距线性拟合；'+('用换算因子除以斜率求结果。' if s[11] else '将斜率乘以换算因子求结果。')
        topic=dict(experiment_id=eid,title=title,area=area,summary=f'通过{s[4]}与{s[7]}测定{s[16]}，讨论模型条件与误差。',
          goal=f'掌握{s[15]}的适用条件，测定{s[16]}，并用拟合及残差区分读数离散与系统偏差。',
          equipment=s[18].split('、'),conditions=conditions,
          steps=[s[20],f'记录不少于5组对应的{s[4]}和{s[7]}，同时保留原始单位。',method],
          columns=[dict(key=s[3],label=s[4],unit=s[5]),dict(key=s[6],label=s[7],unit=s[8])],parameters=[],
          relation=s[15],output_label=s[16],output_unit=s[17],data_questions=[f'{s[4]}的单位和坐标变换是否正确？',f'残差是否集中在末点，{s[16]}是否受共同标定误差影响？'],
          checks=conditions,knowledge_ids=[eid+'-principle',eid+'-measurement',eid+'-errors'],sources=sources,cases=[])
        for j in range(6 if index<12 else 5):
            x=list(s[14])
            if j==3: x=[v*1.05 if s[9]!='kelvin_x' else v+2 for v in x]
            if j==3 and eid in ('single_slit','newton_rings','michelson'): x=[v+1 for v in s[14]]
            if j==4: x=x[::2]
            tx,_=transform(s,x,[30.0]*len(x))
            y=[s[12]*v+s[13] for v in tx]
            if s[9]=='square_y': y=[math.sqrt(v) for v in y]
            if s[9] in ('cooling','log_decay'): y=[math.exp(v)+(20 if s[9]=='cooling' else 0) for v in y]
            if j==1: y=[v*(1+d) for v,d in zip(y,[.002,-.003,.004,-.002,.001,-.001,.003])]
            if j==2: y[-1]*=1.08
            if j==5: y=[v*1.03 for v in y]
            y=[round(v,12) for v in y]
            desc=['按物理模型生成的理想读数。','对原始因变量依次施加+0.2%、−0.3%、+0.4%、−0.2%、+0.1%、−0.1%、+0.3%的模拟扰动。','仅将末个原始因变量乘1.08；这是预设读数偏差，不能据此断定真实故障原因。','改变自变量测量范围，保持原物理参数。','只保留原7点中的第1、3、5、7点，比较减少测点后的信息损失。','所有原始因变量统一乘1.03，模拟共同增益标定偏差；非真实故障记录。'][j]
            case=dict(case_id=f'{eid}-extension-{j+1}',title=f'{title} · {NAMES[j]}',level=LEVELS[j],description=desc+' 所有数据均为教学模拟，非实测。',provenance='synthetic-example',columns={s[3]:x,s[6]:y},parameters={},questions=[dict(prompt='占位',hint='占位',solution=['占位'])]*3)
            # Schema requires three cases; temporary duplicates never leave this local object.
            temp=ExperimentTopic.model_validate({**topic,'cases':[case]*3})
            result=analyze_readings(temp,ReadingRequest(columns=case['columns']))
            actual=f"{result['result']:.8g} {s[17]}"
            ideal=s[10]/s[12] if s[11] else s[10]*s[12]
            error=(result['result']/ideal-1)*100
            metrics=[f"{m['label']}：{m['value']:.6g} {m['unit']}。" for m in result['metrics'] if m['label']!=s[16]]
            case['questions']=[
              dict(prompt=f'对本组{len(x)}个测点，写出{s[15]}对应的作图坐标、单位及斜率含义。',hint=method,solution=[method,f"横轴：{result['charts'][0]['x_label']}；纵轴：{result['charts'][0]['y_label']}。",f"结果换算因子为{s[10]:.10g}，{'除以' if s[11] else '乘以'}拟合斜率。"]),
              dict(prompt=f'利用全部读数求{s[16]}，报告截距及残差情况，并与模拟基准{ideal:.8g} {s[17]}比较。',hint='使用带截距拟合；不能只拿首尾或删除末点。',solution=[f'参考处理结果为 {actual}。',f'相对本组模拟基准的有符号偏差为{error:.5g}%。',*metrics,'残差是原始变换读数减拟合预测；高R²不等于没有系统误差。']),
              dict(prompt=f'针对“{NAMES[j]}”，解释读数变化能说明什么、不能说明什么，并设计一次现场复查。',hint=s[21],solution=[desc,f'必须核实：{s[19]}。',f'复查操作：{s[20]}。',f'常见错误：{s[21]}。','模拟数据只验证计算流程，真实异常原因仍需独立仪器记录和重复实验支持。'])]
            topic['cases'].append(case)
            report.append(dict(case_id=case['case_id'],experiment_id=eid,result=result['result'],unit=s[17],baseline=ideal))
        topics.append(topic)
        for suffix,label in [('principle','原理与目的'),('measurement','测量与数据规范'),('errors','误差与复查')]:
            knowledge.append(dict(document_id=eid+'-'+suffix,experiment_id=eid,title=title+'：'+label,keywords=[title,s[16],s[3],s[6],label],principles=[s[15],s[19]],data_standards=[method,s[20],'保留全部原始数据，记录单位、零点和装置参数。'],typical_errors=[s[21],'依据高R²直接宣称实验条件全部满足。'],check_questions=topic['data_questions'],sources=sources))
    assert len(topics)==48 and sum(len(t['cases']) for t in topics)==264
    if existing and (topics!=prior_topics or knowledge!=prior_knowledge):
        raise SystemExit('已有扩展内容经过修改；拒绝覆盖，请先比较差异。')
    cp.write_text(json.dumps(topics,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    kp.write_text(json.dumps(knowledge,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (ROOT/'verification').mkdir(exist_ok=True)
    (ROOT/'verification/expansion_20261011.json').write_text(json.dumps(dict(original_topics=original,original_knowledge=original_k,new_cases=report),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'48 topics; 264 cases; 792 questions; {len(knowledge)} knowledge entries; originals preserved')

if __name__=='__main__': generate()
