from pathlib import Path
import csv
import base64
import io
import zipfile

from fastapi.testclient import TestClient

from app.anomaly import AnomalyDetector
from app.anomaly_import import parse_tabular_upload
from app.config import Settings
from app.main import create_app
from anomaly_module.evaluate_real_data import evaluate


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def detector() -> AnomalyDetector:
    return AnomalyDetector(model_path=PROJECT_ROOT / "anomaly_module" / "models" / "missing.joblib")


def test_rules_identify_normal_outlier_and_missing_data() -> None:
    normal = detector().analyze(
        "ohms_law",
        {"voltage_V": [1, 2, 3, 4, 5], "current_mA": [4, 8, 12, 16, 20]},
        {"expected_resistance_ohm": 250},
    )
    assert normal.details.anomaly_type == "normal"
    outlier = detector().analyze(
        "ohms_law",
        {"voltage_V": [1, 2, 3, 4, 5], "current_mA": [4, 8, 35, 16, 20]},
        {"expected_resistance_ohm": 250},
    )
    assert outlier.details.anomaly_type == "outlier"
    assert outlier.details.locations[0].point_index == 3
    missing = detector().analyze(
        "ohms_law",
        {"voltage_V": [1, 2, 3, 4, 5], "current_mA": [4, None, 12, 16, 20]},
        {},
    )
    assert missing.details.anomaly_type == "missing"


def test_api_returns_structured_auto_analysis(tmp_path: Path) -> None:
    settings = Settings(
        database_path=tmp_path / "test.db",
        knowledge_base_path=PROJECT_ROOT / "app" / "data" / "knowledge_base.json",
        openai_api_key=None,
        openai_model="test-model",
        enable_llm=False,
        llm_timeout_seconds=1,
    )
    client = TestClient(create_app(settings))
    response = client.post(
        "/api/v1/anomaly/analyze",
        json={
            "experiment_id": "ohms_law",
            "raw_measurements": {
                "voltage_V": [1, 2, 3, 4, 5],
                "current_mA": [4, 8, 12, 16, 20000],
            },
            "metadata": {"expected_resistance_ohm": 250},
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["anomaly"]["status"] == "anomalous"
    assert result["details"]["anomaly_type"] in {"outlier", "unit_error"}
    assert result["details"]["diagnostic_basis"]


def test_csv_import_groups_runs_and_preserves_missing_readings() -> None:
    content = (
        "run_id,point_index,voltage_V,current_mA,expected_resistance_ohm\n"
        "A,1,1,4,250\nA,2,2,,250\nB,1,1,5,200\n"
    )
    runs = parse_tabular_upload("measurements.csv", base64.b64encode(content.encode()).decode())
    assert [run["run_id"] for run in runs] == ["A", "B"]
    assert runs[0]["current_mA"] == [4.0, None]
    assert runs[0]["metadata"]["expected_resistance_ohm"] == 250.0


def test_xlsx_import_reads_a_basic_first_worksheet() -> None:
    workbook = io.BytesIO()
    sheet_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>voltage_V</t></is></c><c r="B1" t="inlineStr"><is><t>current_mA</t></is></c></row>
    <row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>4</v></c></row>
    <row r="3"><c r="A3"><v>2</v></c><c r="B3"><v>8</v></c></row>
    </sheetData></worksheet>"""
    with zipfile.ZipFile(workbook, "w") as archive:
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    runs = parse_tabular_upload("measurements.xlsx", base64.b64encode(workbook.getvalue()).decode())
    assert runs[0]["voltage_V"] == [1.0, 2.0]
    assert runs[0]["current_mA"] == [4.0, 8.0]


def test_import_endpoint_accepts_csv(tmp_path: Path) -> None:
    settings = Settings(
        database_path=tmp_path / "test.db",
        knowledge_base_path=PROJECT_ROOT / "app" / "data" / "knowledge_base.json",
        openai_api_key=None,
        openai_model="test-model",
        enable_llm=False,
        llm_timeout_seconds=1,
    )
    payload = "voltage_V,current_mA\n1,4\n2,8\n"
    response = TestClient(create_app(settings)).post(
        "/api/v1/anomaly/import",
        json={"filename": "readings.csv", "content_base64": base64.b64encode(payload.encode()).decode()},
    )
    assert response.status_code == 200
    assert response.json()["runs"][0]["voltage_V"] == [1.0, 2.0]


def test_material_analysis_combines_pc_and_ad_evidence(tmp_path: Path) -> None:
    settings = Settings(
        database_path=tmp_path / "test.db",
        knowledge_base_path=PROJECT_ROOT / "app" / "data" / "knowledge_base.json",
        openai_api_key=None,
        openai_model="test-model",
        enable_llm=False,
        llm_timeout_seconds=1,
    )
    csv_data = "run_id,point_index,voltage_V,current_A\nrun-a,1,1,0.004\nrun-a,2,2,0.008\nrun-a,3,3,0.012\n"
    response = TestClient(create_app(settings)).post(
        "/api/v1/materials/analyze",
        json={
            "filename": "pc_data.csv",
            "content_base64": base64.b64encode(csv_data.encode()).decode(),
            "run_id": "run-a",
            "student_result": 250,
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["anomaly"]["details"]["anomaly_type"] == "normal"
    assert result["mathematics"]["reference_result"] == 250.0
    assert len(result["consistency"]["checks"]) >= 3
    assert set(result["charts"]) == {"scatter", "fitted", "residuals"}


def test_real_data_evaluator_keeps_real_data_report_separate(tmp_path: Path) -> None:
    input_path = tmp_path / "real_data.csv"
    output_path = tmp_path / "real_data_evaluation.json"
    rows = [
        {"run_id": "real-normal", "point_index": index, "voltage_V": index, "current_mA": index * 4, "label": "normal"}
        for index in range(1, 6)
    ] + [
        {"run_id": "real-outlier", "point_index": index, "voltage_V": index, "current_mA": value, "label": "outlier"}
        for index, value in enumerate([4, 8, 35, 16, 20], start=1)
    ]
    with input_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["run_id", "point_index", "voltage_V", "current_mA", "label"])
        writer.writeheader()
        writer.writerows(rows)
    report = evaluate(input_path, output_path)
    assert report["runs"] == 2
    assert output_path.exists()
    assert "false_positive_rate" in report
