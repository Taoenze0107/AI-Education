"""Export public teaching materials and portable source, excluding local records."""
from pathlib import Path
import argparse
import csv
import io
import json
import sys
import zipfile
from html import escape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.catalog_routes import create_catalog_router
from app.experiment_catalog import ExperimentCatalog

AREAS = dict(measurement="测量与仪器", mechanics="力学", electricity="电学", optics="光学",
             thermal="热学", waves="振动与波", modern="近代与综合")
LEVELS = dict(basic="基础", standard="标准", challenge="探究")
VERSION = "20261012"


def export(output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    catalog = ExperimentCatalog()
    assert len(catalog.topics) == 128 and len(catalog.cases) == 504
    app = FastAPI()
    app.include_router(create_catalog_router(ROOT / "app/static/index.html"))
    materials = output_dir / f"大学物理实验_504组数据与1512题_{VERSION}.zip"
    rows = []
    html_rows = []
    with TestClient(app) as client, zipfile.ZipFile(materials, "w", zipfile.ZIP_DEFLATED) as archive:
        for topic in catalog.topics:
            for case in topic.cases:
                base = f"{AREAS[topic.area]}/{topic.experiment_id}/{case.case_id}"
                csv_path = base + ".csv"
                exercise_path, answer_path = base + "_练习.html", base + "_解答.html"
                archive.writestr(csv_path, catalog.csv(case.case_id).encode("utf-8"))
                for path, query in [(exercise_path, ""), (answer_path, "?answers=true")]:
                    response = client.get(f"/api/v1/practice/{case.case_id}/worksheet{query}")
                    response.raise_for_status()
                    archive.writestr(path, response.content)
                row = [AREAS[topic.area], topic.title, LEVELS[case.level], case.title,
                       csv_path, exercise_path, answer_path, "教学模拟，非真实测量"]
                rows.append(row)
                html_rows.append("<tr>" + "".join(f"<td>{escape(v)}</td>" for v in row[:4]) +
                                 "".join(f'<td><a href="{escape(path, quote=True)}">{label}</a></td>'
                                         for path, label in [(csv_path, "数据 CSV"), (exercise_path, "练习"), (answer_path, "解答")]) + "</tr>")
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["学科", "实验主题", "层次", "案例", "数据文件", "练习文件", "解答文件", "来源性质"])
        writer.writerows(rows)
        archive.writestr("资料目录.csv", ("\ufeff" + stream.getvalue()).encode("utf-8"))
        response = client.get("/api/v1/textbooks/coverage.csv")
        response.raise_for_status()
        archive.writestr("169条教材目录对照.csv", response.content)
        archive.writestr("实验主题与完整题库.json", json.dumps([t.model_dump(mode="json") for t in catalog.topics], ensure_ascii=False, indent=2))
        archive.writestr("教材范围与来源.md", (ROOT / f"本轮教材资料扩充_{VERSION}.md").read_bytes())
        archive.writestr("使用说明.txt", "128个实验专题，504组数据，1512道原创问题。\n全部为教学模拟，非真实测量。\n解压整个文件夹后，在浏览器打开‘资料目录.html’，可直接查看练习与解答、打印或保存PDF。\nCSV可在相应实验的数据页导入，不包含学生结果和仪器条件确认。每组参数须一致。\n五本教材169个公开目录条目的对应范围详见对照表；综合项目仅提供注明范围的训练。\n在线分步诊断需启动配套网站。\n")
        html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>大学物理实验资料目录</title><style>body{font-family:system-ui;max-width:1200px;margin:32px auto;padding:0 16px;color:#243d32}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #ddd}a{color:#28583e}.scroll{overflow:auto}</style><h1>大学物理实验资料目录</h1><p>128个主题 · 504组教学模拟数据 · 1512道原创练习。非真实测量。</p><p>先做练习，再按需查阅解答。打开HTML后可打印或保存PDF。</p><div class="scroll"><table><thead><tr>' + ''.join(f'<th>{t}</th>' for t in ["学科", "实验", "层次", "案例", "数据", "练习", "解答"]) + '</tr></thead><tbody>' + ''.join(html_rows) + '</tbody></table></div></html>'
        archive.writestr("资料目录.html", html)
    source = output_dir / f"实验学习助手_128实验_504组数据_1512题_{VERSION}.zip"
    exclude_dirs = {".venv", "__pycache__", ".pytest_cache", ".git", "node_modules"}
    with zipfile.ZipFile(source, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(ROOT.rglob("*")):
            relative = path.relative_to(ROOT)
            if not path.is_file() or any(p in exclude_dirs or p.endswith(".egg-info") for p in relative.parts):
                continue
            if path.name in {".env", ".DS_Store"} or path.name.startswith(".env.") and path.name != ".env.example":
                continue
            if path.suffix in {".db", ".sqlite", ".sqlite3", ".pyc", ".zip"} or path.name.endswith(("-wal", "-shm", "-journal")):
                continue
            archive.write(path, "adaptive_lab_tutor_stepwise/" + str(relative))
    for path in [materials, source]:
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None
        print(f"{path.name}: {path.stat().st_size:,} bytes")
    with zipfile.ZipFile(materials) as archive:
        assert sum(name.endswith(".csv") for name in archive.namelist()) == 506
        assert sum(name.endswith("_练习.html") for name in archive.namelist()) == 504
        assert sum(name.endswith("_解答.html") for name in archive.namelist()) == 504
    with zipfile.ZipFile(source) as archive:
        assert not any(Path(name).name == ".env" or Path(name).suffix == ".db" for name in archive.namelist())
        data = json.loads(archive.read("adaptive_lab_tutor_stepwise/app/data/experiment_catalog.json"))
        assert len(data) == 128 and sum(len(t["cases"]) for t in data) == 504
    return source, materials


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True, type=Path)
    export(parser.parse_args().output_dir.resolve())
