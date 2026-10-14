from __future__ import annotations

import base64
import binascii
import csv
import io
import json
from html import escape
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, Response

from app.experiment_catalog import ExperimentCatalog, ReadingRequest, analyze_readings
from app.models import AnomalyImportRequest


def create_catalog_router(index_path) -> APIRouter:
    catalog = ExperimentCatalog()
    router = APIRouter()
    coverage=json.loads((Path(__file__).parent/'data/textbook_coverage.json').read_text(encoding='utf-8'))
    if any(eid not in catalog.by_id for b in coverage['books'] for i in b['items'] for eid in i['experiment_ids']):raise ValueError('教材条目引用了不存在的专题。')

    def topic_or_404(experiment_id):
        if experiment_id not in catalog.by_id:
            raise HTTPException(404, "找不到这个实验主题。")
        return catalog.by_id[experiment_id]

    def case_or_404(case_id):
        if case_id not in catalog.cases:
            raise HTTPException(404, "找不到这份练习。")
        return catalog.cases[case_id]

    @router.get("/experiments", include_in_schema=False)
    def catalog_page():
        return FileResponse(index_path)

    @router.get("/experiments/{experiment_id}", include_in_schema=False)
    def topic_page(experiment_id: str):
        topic_or_404(experiment_id)
        return FileResponse(index_path)

    @router.get("/practice/{case_id}", include_in_schema=False)
    def practice_page(case_id: str):
        case_or_404(case_id)
        return FileResponse(index_path)

    @router.get("/api/v1/experiments", tags=["实验资料"])
    def list_catalog():
        return dict(experiment_count=len(catalog.topics), case_count=len(catalog.cases),
                    question_count=sum(len(c.questions) for _,c in catalog.cases.values()),
                    topics=[t.model_dump(mode="json") for t in catalog.topics])

    @router.get('/api/v1/textbooks',tags=['实验资料'])
    def textbooks():return coverage

    @router.get('/api/v1/textbooks/coverage.csv',tags=['实验资料'])
    def coverage_csv():
        out=io.StringIO();writer=csv.writer(out)
        writer.writerow(['教材','编者','出版社','目录主题','对应专题','范围说明','目录来源'])
        for b in coverage['books']:
            for item in b['items']:writer.writerow([b['title'],b['authors'],b['publisher'],item['label'],'；'.join(catalog.by_id[eid].title for eid in item['experiment_ids']),item['note'],b['url']])
        return Response('\ufeff'+out.getvalue(),media_type='text/csv; charset=utf-8',headers={'Content-Disposition':'attachment; filename="textbook-coverage.csv"'})

    @router.get("/api/v1/experiments/{experiment_id}", tags=["实验资料"])
    def get_topic(experiment_id: str):
        return topic_or_404(experiment_id)

    @router.post("/api/v1/experiments/{experiment_id}/analyze", tags=["实验资料"])
    def calculate(experiment_id: str, request: ReadingRequest):
        try:
            return analyze_readings(topic_or_404(experiment_id),request)
        except (ValueError, ArithmeticError) as exc:
            raise HTTPException(422,str(exc)) from exc

    @router.get("/api/v1/practice/{case_id}", tags=["实验资料"])
    def get_case(case_id: str):
        topic,case=case_or_404(case_id)
        return dict(experiment_id=topic.experiment_id, case=case.model_dump(mode="json"),
                    analysis=analyze_readings(topic,ReadingRequest(columns=case.columns,parameters=case.parameters)))

    @router.get("/api/v1/practice/{case_id}/data.csv", tags=["实验资料"])
    def download_data(case_id: str):
        case_or_404(case_id)
        return Response(catalog.csv(case_id),media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition":f'attachment; filename="{case_id}-synthetic.csv"'})

    @router.get("/api/v1/experiments/{experiment_id}/template.csv", tags=["实验资料"])
    def download_template(experiment_id: str):
        topic=topic_or_404(experiment_id)
        stream=io.StringIO();writer=csv.writer(stream)
        writer.writerow([*(c.key for c in topic.columns),*(p.key for p in topic.parameters),"data_origin"])
        writer.writerow([*("" for _ in topic.columns),*(p.default for p in topic.parameters),"manual-entry"])
        return Response("\ufeff"+stream.getvalue(),media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition":f'attachment; filename="{experiment_id}-blank.csv"'})

    @router.post("/api/v1/experiments/{experiment_id}/import", tags=["实验资料"])
    def import_csv(experiment_id: str, request: AnomalyImportRequest):
        topic=topic_or_404(experiment_id)
        if not request.filename.lower().endswith(".csv"):
            raise HTTPException(422,"本实验请上传 CSV 文件；可先下载空白模板。")
        try:
            data=base64.b64decode(request.content_base64,validate=True)
            if len(data)>2_000_000: raise ValueError("CSV 文件不能超过 2 MB。")
            try: text=data.decode("utf-8-sig")
            except UnicodeDecodeError: text=data.decode("gb18030")
            reader=csv.DictReader(io.StringIO(text))
            if not reader.fieldnames or len(reader.fieldnames)!=len(set(reader.fieldnames)):
                raise ValueError("CSV 表头缺失或含重复列。")
            if any(c.key not in reader.fieldnames for c in [*topic.columns,*topic.parameters]):
                raise ValueError("CSV 缺少所需读数列，请使用本实验空白模板。")
            columns={c.key:[] for c in topic.columns};param_sets={p.key:set() for p in topic.parameters};origins=set()
            for row in reader:
                if not any(str(v or "").strip() for k,v in row.items() if k in columns): continue
                for key in columns: columns[key].append(float(row[key]))
                for key in param_sets:
                    if (row.get(key) or "").strip(): param_sets[key].add(float(row[key]))
                origins.add(row.get("data_origin") or "")
                if len(next(iter(columns.values())))>500: raise ValueError("一次最多导入 500 组读数。")
            if any(len(values)>1 for values in param_sets.values()):
                raise ValueError("参数列须在同一组实验内保持一致，请拆分成不同文件。")
            if any(not values for values in param_sets.values()):
                raise ValueError("请在参数列填写本次实验的实际参数，至少一行需要有值。")
            parameters={p.key:next(iter(param_sets[p.key])) for p in topic.parameters}
            reading=ReadingRequest(columns=columns,parameters=parameters)
            analysis=analyze_readings(topic,reading)
            origin="imported-example" if any("example" in v for v in origins) else "manual-import"
            return dict(readings=reading.model_dump(mode="json"),analysis=analysis,origin=origin)
        except (ValueError, ArithmeticError, binascii.Error, UnicodeError, csv.Error, TypeError) as exc:
            raise HTTPException(422,f"无法导入：{exc}") from exc

    @router.get("/api/v1/practice/{case_id}/worksheet", tags=["实验资料"])
    def worksheet(case_id: str, answers: bool = Query(default=False)):
        topic,case=case_or_404(case_id)
        e=escape; variant="解答版" if answers else "练习版"
        cols=topic.columns
        table='<table><thead><tr>'+''.join(f'<th>{e(c.label)} ({e(c.unit)})</th>' for c in cols)+'</tr></thead><tbody>'
        for row in zip(*(case.columns[c.key] for c in cols)):
            table+='<tr>'+''.join(f'<td>{v:g}</td>' for v in row)+'</tr>'
        table+='</tbody></table>'
        params='；'.join(f'{p.label}：{case.parameters[p.key]:g} {p.unit}' for p in topic.parameters)
        questions=''
        for i,q in enumerate(case.questions,1):
            questions+=f'<section><h2>{i}. {e(q.prompt)}</h2>'
            questions+=('<ol>'+''.join(f'<li>{e(s)}</li>' for s in q.solution)+'</ol>') if answers else '<div class="space"></div>'
            questions+='</section>'
        links=' / '.join(f'<a href="{e(s.url)}">{e(s.title)}</a>' for s in topic.sources)
        body=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>{e(case.title)} · {variant}</title>
<style>body{{font-family:system-ui,sans-serif;color:#243d32;max-width:800px;margin:36px auto;padding:0 24px;line-height:1.7}}h1{{font-family:serif;font-size:28px}}h2{{font-size:16px}}table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #ccc;text-align:left;padding:6px}}section{{break-inside:avoid}}.space{{height:130px;border-bottom:1px dotted #aaa}}footer{{font-size:11px;margin-top:30px}}@media print{{body{{margin:0}}a{{color:inherit}}}}</style>
<h1>{e(case.title)} · {variant}</h1><p>姓名 / 编号：________________　日期：________________</p>
<p>{e(case.description)} 所有读数均为教学模拟数据，非真实测量。</p><p>{e(params)}</p>{table}{questions}
<footer>实验学习助手 · 原创练习与解答。物理关系参考：{links}。<br>可在浏览器打开此文件，打印或保存为 PDF。</footer></html>'''
        return HTMLResponse(body,headers={"Content-Disposition":f'attachment; filename="{case_id}-{"solutions" if answers else "student"}.html"'})

    return router
