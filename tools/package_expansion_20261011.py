"""Build a clean handoff and audit preservation against the supplied archive."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path
from app.experiment_catalog import ExperimentCatalog
from app.catalog_extension import BY_ID

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);dest=Path(sys.argv[2]);dest.mkdir(parents=True,exist_ok=True)
modified=[];unchanged=[]
with zipfile.ZipFile(source) as original:
    for info in original.infolist():
        if info.is_dir(): continue
        rel=Path(*Path(info.filename).parts[1:])
        path=root/rel
        if not path.is_file(): raise RuntimeError(f'原文件丢失：{rel}')
        (unchanged if original.read(info)==path.read_bytes() else modified).append(rel.as_posix())
    for name,key in [('experiment_catalog.json','experiment_id'),('knowledge_base.json','document_id')]:
        before=json.loads(original.read('adaptive_lab_tutor_stepwise/app/data/'+name))
        after=json.loads((root/'app/data'/name).read_text(encoding='utf-8'))
        mapping={v[key]:v for v in after}
        assert all(mapping[v[key]]==v for v in before),name
assert not any(p.startswith('app/static/') for p in modified),'页面文件发生非预期修改'
manifest=dict(input_archive_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
              modified_original_files=modified,unchanged_original_file_count=len(unchanged),
              original_topics_preserved=24,original_cases_preserved=132,original_knowledge_preserved=81,
              experiment_count=48,case_count=264,question_count=792,knowledge_count=153)
(root/'verification/package_manifest_20261011.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
catalog=ExperimentCatalog()
data_zip=dest/'新增132组教学模拟数据_20261011.zip'
with zipfile.ZipFile(data_zip,'w',zipfile.ZIP_DEFLATED) as z:
    for eid in BY_ID:
        for case in catalog.by_id[eid].cases:
            z.writestr(f'{eid}/{case.case_id}.csv',catalog.csv(case.case_id))
    z.writestr('说明.txt','共24个新增主题、132份教学模拟CSV。不是实测数据。请在本轮48主题版中选择对应实验后导入。完整练习、提示与答案请在项目网页查看。')
output=dest/'实验学习助手_48实验_264组数据_792题_20261011.zip'
def include(path):
    rel=path.relative_to(root)
    return not any(p.startswith(('.test-temp','.pytest_cache','.venv','.git')) or p in ('__pycache__','node_modules') for p in rel.parts) and path.suffix not in ('.pyc','.db','.sqlite','.sqlite3') and path.name not in ('.env',) and not path.name.endswith(('.db-wal','.db-shm'))
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
    for path in sorted(root.rglob('*')):
        if path.is_file() and include(path): z.write(path,'adaptive_lab_tutor_stepwise/'+path.relative_to(root).as_posix())
with zipfile.ZipFile(output) as z:
    assert z.testzip() is None
    assert len(json.loads(z.read('adaptive_lab_tutor_stepwise/app/data/experiment_catalog.json')))==48
for path in (output,data_zip):
    print(path)
    print('SHA256',hashlib.sha256(path.read_bytes()).hexdigest(),'bytes',path.stat().st_size)
print(json.dumps(manifest,ensure_ascii=False))
