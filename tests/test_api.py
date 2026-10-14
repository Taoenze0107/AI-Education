import json
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def make_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        database_path=tmp_path / "test.db",
        knowledge_base_path=PROJECT_ROOT / "app" / "data" / "knowledge_base.json",
        openai_api_key=None,
        openai_model="test-model",
        enable_llm=False,
        llm_timeout_seconds=1,
    )
    return TestClient(create_app(settings))


def load_json(name: str) -> dict:
    return json.loads((PROJECT_ROOT / "examples" / name).read_text(encoding="utf-8"))


def create_session(client: TestClient) -> str:
    response = client.post(
        "/api/v1/sessions",
        json={
            "student_id": "S001",
            "experiment_id": "ohms_law",
            "course_id": "TEST",
        },
    )
    assert response.status_code == 201
    return response.json()["session_id"]


def test_full_flow_records_progress_and_escalates(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    session_id = create_session(client)
    sample = load_json("sufficient_calculation_error.json")

    first = client.post(f"/api/v1/sessions/{session_id}/attempts", json=sample)
    assert first.status_code == 201
    first_data = first.json()
    assert first_data["status"] == "teaching_intervention"
    assert first_data["intervention"]["level"] == 1
    assert first_data["engine_mode"] == "rules_only"

    outcome = client.post(
        f"/api/v1/attempts/{first_data['attempt_id']}/outcome",
        json={
            "result": "partially_corrected",
            "student_revision": "检查了单位，但还没有完成复算。",
            "final_result": None,
            "self_check_notes": None,
        },
    )
    assert outcome.status_code == 201

    second = client.post(f"/api/v1/sessions/{session_id}/attempts", json=sample)
    assert second.status_code == 201
    assert second.json()["intervention"]["level"] == 2

    history = client.get(f"/api/v1/sessions/{session_id}/history")
    assert history.status_code == 200
    summary = history.json()["summary"]
    assert summary["attempt_count"] == 2
    assert summary["modification_count"] == 1
    assert summary["latest_result"] == "partially_corrected"
    assert summary["latest_status"] == "teaching_intervention"


def test_insufficient_evidence_branch_does_not_call_model(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    session_id = create_session(client)
    response = client.post(
        f"/api/v1/sessions/{session_id}/attempts",
        json=load_json("insufficient_evidence.json"),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "needs_more_evidence"
    assert data["diagnosis"] is None
    assert data["follow_up"]["questions"]
    assert data["engine_mode"] == "rules_only"


def test_health_and_knowledge_search(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["knowledge_documents"] >= 4

    search = client.get(
        "/api/v1/knowledge/search",
        params={"q": "电流 mA 换算电阻", "experiment_id": "ohms_law"},
    )
    assert search.status_code == 200
    assert search.json()[0]["experiment_id"] == "ohms_law"
    assert any(match["document_id"] == "ohms-law-core" for match in search.json())


def test_session_listing_pagination_exact_filter_and_resume(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    empty = client.get("/api/v1/sessions").json()
    assert empty == {"sessions": [], "total": 0, "limit": 20, "offset": 0}
    created = []
    for student_id in ("S001", "S002", "S001", "S001-extra"):
        response = client.post(
            "/api/v1/sessions",
            json={"student_id": student_id, "experiment_id": "ohms_law"},
        )
        assert response.status_code == 201
        created.append(response.json())

    page = client.get("/api/v1/sessions", params={"limit": 2, "offset": 1}).json()
    assert page["total"] == 4
    assert page["limit"] == 2
    assert page["offset"] == 1
    assert [item["session_id"] for item in page["sessions"]] == [
        created[2]["session_id"], created[1]["session_id"]
    ]
    assert page["sessions"][0]["attempt_count"] == 0
    assert page["sessions"][0]["latest_status"] is None
    assert page["sessions"][0]["latest_result"] is None
    filtered = client.get("/api/v1/sessions", params={"student_id": "S001"}).json()
    assert filtered["total"] == 2
    assert [item["session_id"] for item in filtered["sessions"]] == [
        created[2]["session_id"], created[0]["session_id"]
    ]
    assert client.get("/api/v1/sessions", params={"offset": 9}).json()["sessions"] == []
    assert client.get("/api/v1/sessions", params={"student_id": "S00"}).json()["total"] == 0

    session_id = filtered["sessions"][0]["session_id"]
    attempt = client.post(f"/api/v1/sessions/{session_id}/attempts", json={}).json()
    # The same browser cookie survives a server restart; other browsers cannot discover this private session.
    resumed = make_client(tmp_path)
    resumed.cookies.update(client.cookies)
    history = resumed.get(f"/api/v1/sessions/{session_id}/history").json()
    assert history["attempts"][0]["attempt_id"] == attempt["attempt_id"]
    next_attempt = resumed.post(f"/api/v1/sessions/{session_id}/attempts", json={})
    assert next_attempt.status_code == 201
    assert next_attempt.json()["attempt_number"] == 2
    listed = resumed.get("/api/v1/sessions", params={"student_id": "S001"}).json()["sessions"][0]
    assert listed["attempt_count"] == 2
    assert listed["latest_status"] == "needs_more_evidence"


@pytest.mark.parametrize("parameters", [{"limit": 0}, {"limit": 101}, {"offset": -1}])
def test_session_pagination_rejects_invalid_bounds(tmp_path: Path, parameters: dict) -> None:
    client = make_client(tmp_path)
    assert client.get("/api/v1/sessions", params=parameters).status_code == 422


def test_latest_result_uses_recording_order_and_keeps_prior_outcomes(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    session_id = create_session(client)
    attempts = [
        client.post(f"/api/v1/sessions/{session_id}/attempts", json={}).json()
        for _ in range(3)
    ]
    for index, result in ((1, "partially_corrected"), (0, "corrected")):
        response = client.post(
            f"/api/v1/attempts/{attempts[index]['attempt_id']}/outcome",
            json={"result": result, "student_revision": "Checked the calculation."},
        )
        assert response.status_code == 201
    history = client.get(f"/api/v1/sessions/{session_id}/history").json()
    summary = history["summary"]
    assert summary["attempt_count"] == 3
    assert summary["modification_count"] == 2
    assert summary["corrected_count"] == 1
    assert summary["latest_result"] == "corrected"
    listed = client.get("/api/v1/sessions").json()["sessions"][0]
    assert listed["modification_count"] == 2
    assert listed["latest_result"] == "corrected"
    duplicate = client.post(
        f"/api/v1/attempts/{attempts[0]['attempt_id']}/outcome",
        json={"result": "unchanged", "student_revision": "Changed my mind."},
    )
    assert duplicate.status_code == 409
    assert client.get(f"/api/v1/sessions/{session_id}/history").json()["summary"] == summary


def test_knowledge_browse_filter_reload_and_invalid_reload_preserves_data(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    response = client.get("/api/v1/knowledge/documents")
    assert response.status_code == 200
    documents = response.json()
    assert all("keywords" in document for document in documents)
    filtered = client.get("/api/v1/knowledge/documents", params={"experiment_id": "ohms_law"}).json()
    assert filtered == [
        document for document in documents if document["experiment_id"] in {"ohms_law", "generic"}
    ]
    generic = client.get("/api/v1/knowledge/documents", params={"experiment_id": "unknown"}).json()
    assert generic == [document for document in documents if document["experiment_id"] == "generic"]

    replacement = tmp_path / "knowledge.json"
    new_document = {
        "document_id": "new-experiment", "experiment_id": "new-experiment", "title": "Fresh knowledge",
        "keywords": ["unique-search-keyword"], "principles": ["Measure carefully"],
        "data_standards": [], "typical_errors": [],
    }
    replacement.write_text(json.dumps([new_document]), encoding="utf-8")
    client.app.state.knowledge_base.path = replacement
    assert client.post("/api/v1/knowledge/reload").json() == {"status": "ok", "document_count": 1}
    expected_document = {**new_document, "check_questions": [], "sources": []}
    assert client.get("/api/v1/knowledge/documents").json() == [expected_document]
    assert client.get("/api/v1/health").json()["knowledge_documents"] == 1
    matches = client.get("/api/v1/knowledge/search", params={"q": "unique-search-keyword"}).json()
    assert matches[0]["document_id"] == "new-experiment"
    for invalid in ("{bad json", '{"not": "an array"}', '[{"document_id": "incomplete"}]',
                    json.dumps([new_document, new_document])):
        replacement.write_text(invalid, encoding="utf-8")
        assert client.post("/api/v1/knowledge/reload").status_code == 422
        assert client.get("/api/v1/knowledge/documents").json() == [expected_document]
        assert client.get("/api/v1/knowledge/search", params={"q": "unique-search-keyword"}).json()[0]["document_id"] == "new-experiment"


def test_static_page_assets_and_existing_api_docs_are_accessible(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    home = client.get("/")
    assert home.status_code == 200
    assert "text/html" in home.headers["content-type"]
    assert client.get("/static/index.html").text == home.text
    assets = re.findall(r'(?:src|href)=[\"\'](/static/[^\"\']+\.(?:css|js))[\"\']', home.text)
    for asset in assets:
        response = client.get(asset)
        assert response.status_code == 200
        assert "css" in response.headers["content-type"] if asset.endswith(".css") else "javascript" in response.headers["content-type"]
    assert client.get("/static/missing-file.js").status_code == 404
    assert "伏安法快速输入" in home.text
    assert "autoAnomalyButton" in home.text
    assert "csvFile" in home.text
    assert "CSV 或 Excel 实验表" in home.text
    assert "fullMaterialAnalysisButton" in home.text
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


@pytest.mark.parametrize("field", ["student_id", "experiment_id"])
@pytest.mark.parametrize("blank", ["", " ", "\t\n", "\u3000"])
def test_required_session_fields_reject_blank_whitespace(tmp_path: Path, field: str, blank: str) -> None:
    client = make_client(tmp_path)
    payload = {"student_id": "S001", "experiment_id": "ohms_law", field: blank}
    assert client.post("/api/v1/sessions", json=payload).status_code == 422
    assert client.get("/api/v1/sessions").json()["total"] == 0


def test_session_and_outcome_values_trim_whitespace(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    session = client.post("/api/v1/sessions", json={
        "student_id": " S001 ", "experiment_id": " ohms_law ", "course_id": "  "
    }).json()
    assert session["student_id"] == "S001"
    assert session["experiment_id"] == "ohms_law"
    assert session["course_id"] is None
    attempt = client.post(f"/api/v1/sessions/{session['session_id']}/attempts", json={}).json()
    for blank in ("", " ", "\t\n", "\u3000"):
        response = client.post(f"/api/v1/attempts/{attempt['attempt_id']}/outcome", json={
            "result": "corrected", "student_revision": blank
        })
        assert response.status_code == 422
    response = client.post(f"/api/v1/attempts/{attempt['attempt_id']}/outcome", json={
        "result": "corrected", "student_revision": "  Fixed the units. \n"
    })
    assert response.status_code == 201
    history = client.get(f"/api/v1/sessions/{session['session_id']}/history").json()
    assert history["attempts"][0]["outcome"]["student_revision"] == "Fixed the units."


def test_missing_history_attempt_session_and_outcome_return_404(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    assert client.get("/api/v1/sessions/missing/history").status_code == 404
    assert client.post("/api/v1/sessions/missing/attempts", json={}).status_code == 404
    assert client.post("/api/v1/attempts/missing/outcome", json={
        "result": "corrected", "student_revision": "Fixed."
    }).status_code == 404


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
@pytest.mark.parametrize("field", ["mathematics", "raw_measurements", "metadata"])
def test_nonfinite_values_return_validation_errors_without_saving_attempts(
    tmp_path: Path, value: float, field: str
) -> None:
    client = make_client(tmp_path)
    session_id = create_session(client)
    payload = {field: {"student_result": value} if field == "mathematics" else {"nested": [value]}}
    response = client.post(
        f"/api/v1/sessions/{session_id}/attempts",
        content=json.dumps(payload),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["detail"]
    assert client.get(f"/api/v1/sessions/{session_id}/history").json()["summary"]["attempt_count"] == 0
