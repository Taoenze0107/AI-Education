"""Rule authority regressions. All model responses are local test doubles."""
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.evidence import EvidenceAnalyzer
from app.llm import DiagnosisResult, LLMClient
from app.main import create_app
from app.models import AttemptCreate, Diagnosis, IssueType, TeachingPlan

ROOT = Path(__file__).resolve().parents[1]


def model_diagnosis(issue="no_error"):
    return Diagnosis(issue_type=issue, confidence=.99, summary="模型给出的判断",
        evidence_basis=["模拟模型依据"], knowledge_gaps=[], recommended_level=1,
        teaching_plan=TeachingPlan(module_location="检查模块", socratic_question="如何核实？",
            concrete_checks=["保留读数"], full_explanation="模拟教学解释"))


def evidence(kind="math"):
    data = json.loads((ROOT / "examples/sufficient_calculation_error.json").read_text())
    if kind in {"data", "valid", "anomaly_only"}:
        data["mathematics"]["student_result"] = 250
    if kind in {"data", "mixed"}:
        data["consistency"]["checks"][0]["passed"] = False
    if kind in {"data", "valid"}:
        data["anomaly"].update(status="normal", predicted_issue=None)
    if kind == "anomaly_only":
        data["anomaly"]["predicted_issue"] = "data_error"
    return data


@pytest.fixture
def lab(tmp_path):
    settings = Settings(database_path=tmp_path / "rules.db",
        knowledge_base_path=ROOT / "app/data/knowledge_base.json", enable_llm=True)
    app = create_app(settings)
    calls = []
    response = SimpleNamespace(output_parsed=model_diagnosis())
    def parse(**kwargs):
        calls.append(kwargs)
        return response
    app.state.llm_client._client = SimpleNamespace(responses=SimpleNamespace(parse=parse))
    with TestClient(app) as client:
        registered = client.post("/api/v1/classroom/register", json={
            "username":"rulelearner", "name":"规则测试", "role":"student", "password":"Local-only-2026!"})
        assert registered.status_code == 201
        sid = client.post("/api/v1/sessions", json={"student_id":"rules", "experiment_id":"ohms_law"}).json()["session_id"]
        yield app, client, sid, calls, response


@pytest.mark.parametrize("kind,required", [("math","calculation_error"),("data","data_error"),("mixed","mixed")])
def test_model_no_error_cannot_complete_confirmed_error(lab,kind,required):
    _, client, sid, calls, _ = lab
    result = client.post(f"/api/v1/sessions/{sid}/attempts", json=evidence(kind))
    assert result.status_code == 201, result.text
    body = result.json()
    assert body["status"] == "teaching_intervention"
    assert body["diagnosis"]["issue_type"] == required
    assert body["engine_mode"] == "rules_fallback"
    assert "规则" in body["engine_message"]
    assert len(calls) == 1 and calls[0]["max_output_tokens"] == 3000 and calls[0]["store"] is False
    if kind == "math":
        assert body["evidence_assessment"]["computed_math_result"] == 250
        assert body["evidence_assessment"]["math_relative_error_percent"] == 90
        assert any("25" in item and "250" in item for item in body["diagnosis"]["evidence_basis"])
    saved = client.get(f"/api/v1/sessions/{sid}/history").json()
    assert saved["summary"]["latest_status"] != "completed"


def test_wrong_category_also_cannot_hide_math_error(lab):
    _, client, sid, _, response = lab
    response.output_parsed = model_diagnosis("data_error")
    body = client.post(f"/api/v1/sessions/{sid}/attempts", json=evidence()).json()
    assert body["diagnosis"]["issue_type"] == "calculation_error"
    assert body["status"] == "teaching_intervention"


def test_compatible_model_diagnosis_is_preserved(lab):
    _, client, sid, _, response = lab
    response.output_parsed = model_diagnosis("calculation_error")
    body = client.post(f"/api/v1/sessions/{sid}/attempts", json=evidence()).json()
    assert body["engine_mode"] == "openai"
    assert body["diagnosis"] == response.output_parsed.model_dump(mode="json")


@pytest.mark.parametrize("kind", ["valid", "anomaly_only"])
def test_no_hard_error_still_allows_completion(lab, kind):
    _, client, sid, calls, _ = lab
    body = client.post(f"/api/v1/sessions/{sid}/attempts", json=evidence(kind)).json()
    assert body["status"] == "completed" and body["engine_mode"] == "openai"
    assert len(calls) == 1


def test_service_guard_applies_even_if_model_adapter_omits_validation(lab):
    app, client, sid, _, _ = lab
    app.state.llm_client.diagnose = lambda **kwargs: DiagnosisResult(model_diagnosis(),"openai","mock")
    body = client.post(f"/api/v1/sessions/{sid}/attempts", json=evidence()).json()
    assert body["status"] == "teaching_intervention" and body["engine_mode"] == "rules_fallback"


def test_service_without_authorization_guard_never_calls_model(lab):
    app, _, sid, calls, _ = lab
    result = app.state.service.process_attempt(sid, AttemptCreate.model_validate(evidence()))
    assert result.status.value == "teaching_intervention"
    assert result.engine_mode == "rules_fallback" and len(calls) == 0


def test_direct_llm_adapter_also_rejects_conflicting_no_error(tmp_path):
    payload = AttemptCreate.model_validate(evidence())
    client = LLMClient(Settings(database_path=tmp_path/"unused.db", knowledge_base_path=ROOT/"app/data/knowledge_base.json", enable_llm=True))
    client._client = SimpleNamespace(responses=SimpleNamespace(parse=lambda **kwargs: SimpleNamespace(output_parsed=model_diagnosis())))
    result = client.diagnose("ohms_law", payload, EvidenceAnalyzer().analyze(payload), [])
    assert result.mode == "rules_fallback" and result.diagnosis.issue_type == IssueType.CALCULATION_ERROR
