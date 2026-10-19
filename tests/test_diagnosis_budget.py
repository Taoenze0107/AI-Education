"""Legacy diagnosis and tutor share paid-call limits; all model APIs are mocked."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from threading import Barrier, Event
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.ai_budget import AIBudgetDenied, finish_model_call, reserve_model_call
from app.config import Settings
from app.database import Database
from app.main import create_app
from app.models import Diagnosis, IssueType, TeachingPlan
from app.tutor import TutorAnswer

ROOT = Path(__file__).resolve().parents[1]
SUFFICIENT = json.loads((ROOT / "examples/sufficient_calculation_error.json").read_text())
INSUFFICIENT = json.loads((ROOT / "examples/insufficient_evidence.json").read_text())
QUESTION = dict(thread_id="budget-test-thread", message="如何核对电流单位？",
                context=dict(experiment_id="ohms_law", stage="data"))


class Model:
    def __init__(self, answer, error=None):
        self.answer, self.error, self.calls = answer, error, []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(output_parsed=self.answer)


def setup_lab(tmp_path, *, own=2, total=4):
    settings = Settings(database_path=tmp_path / "budget.db",
        knowledge_base_path=ROOT / "app/data/knowledge_base.json", enable_llm=False,
        tutor_daily_limit=own, tutor_global_daily_limit=total)
    app = create_app(settings)
    legacy = Model(Diagnosis(issue_type=IssueType.CALCULATION_ERROR, confidence=.95,
        summary="核对计算过程。", evidence_basis=["独立复算与填写结果有差异。"],
        knowledge_gaps=["电流单位"], recommended_level=1,
        teaching_plan=TeachingPlan(module_location="计算代入", socratic_question="电流单位是什么？",
                                   concrete_checks=["检查电流单位。"], full_explanation="保留原始读数。")))
    tutor = Model(TutorAnswer(answer="读数保留 mA，公式使用 A。", next_question="代入时用什么单位？",
                              suggestions=[], knowledge_ids=[]))
    app.state.llm_client.settings = replace(settings, enable_llm=True)
    app.state.llm_client._client = SimpleNamespace(responses=legacy)
    app.state.tutor.client = SimpleNamespace(responses=tutor)
    return app, TestClient(app), legacy, tutor


def register(client, name="budgetlearner"):
    response = client.post("/api/v1/classroom/register", json=dict(username=name,
        name="隔离测试", role="student", password="Budget-Only-2026!"))
    assert response.status_code == 201, response.text


def session(client):
    response = client.post("/api/v1/sessions", json=dict(student_id="isolated-budget", experiment_id="ohms_law"))
    assert response.status_code == 201, response.text
    return response.json()["session_id"]


def diagnose(client, sid, payload=SUFFICIENT):
    return client.post(f"/api/v1/sessions/{sid}/attempts", json=payload)


def ledger(app):
    with app.state.tutor.db.connect() as con:
        return [dict(row) for row in con.execute("SELECT * FROM lab_tutor_turns WHERE model_call=1").fetchall()]


def finish_cooldown(app):
    stamp = (datetime.now(timezone.utc) - timedelta(seconds=10)).isoformat()
    with app.state.tutor.db.connect() as con:
        con.execute("UPDATE lab_tutor_turns SET created_at=?", (stamp,))


def test_anonymous_diagnosis_never_calls_paid_model_and_remains_usable(tmp_path):
    app, client, model, _ = setup_lab(tmp_path, own=1, total=1)
    sid = session(client)
    responses = [diagnose(client, sid) for _ in range(3)]
    assert [r.status_code for r in responses] == [201, 201, 201]
    assert all(r.json()["engine_mode"] == "rules_fallback" for r in responses)
    assert all("登录" in r.json()["engine_message"] for r in responses)
    assert model.calls == [] and ledger(app) == []


@pytest.mark.parametrize("state", ["disabled", "unconfigured", "insufficient"])
def test_only_actual_configured_sufficient_calls_reserve_budget(tmp_path, state):
    app, client, model, _ = setup_lab(tmp_path)
    register(client)
    if state == "disabled":
        app.state.llm_client.settings = replace(app.state.llm_client.settings, enable_llm=False)
    elif state == "unconfigured":
        app.state.llm_client._client = None
    response = diagnose(client, session(client), INSUFFICIENT if state == "insufficient" else SUFFICIENT)
    assert response.status_code == 201, response.text
    assert response.json()["engine_mode"] != "openai"
    assert model.calls == [] and ledger(app) == []


@pytest.mark.parametrize("first", ["diagnosis", "tutor"])
def test_quota_is_shared_in_both_directions_and_persists_recreation(tmp_path, first):
    app, client, model, tutor = setup_lab(tmp_path, own=1, total=10)
    register(client)
    sid = session(client)
    initial = diagnose(client, sid) if first == "diagnosis" else client.post("/api/v1/tutor/chat", json=QUESTION)
    assert initial.status_code in (200, 201), initial.text
    finish_cooldown(app)
    # Re-create services against the same persistent ledger, rather than relying
    # on one in-memory lock shared by both endpoints.
    recreated = create_app(app.state.settings)
    recreated.state.llm_client.settings = app.state.llm_client.settings
    recreated.state.llm_client._client = app.state.llm_client._client
    recreated.state.tutor.client = app.state.tutor.client
    reconnected = TestClient(recreated)
    reconnected.cookies.update(client.cookies)
    if first == "diagnosis":
        blocked = reconnected.post("/api/v1/tutor/chat", json=QUESTION)
        assert blocked.status_code == 429
    else:
        blocked = diagnose(reconnected, sid)
        assert blocked.status_code == 201
        assert blocked.json()["engine_mode"] == "rules_fallback"
        assert "额度" in blocked.json()["engine_message"]
    assert len(model.calls) + len(tutor.calls) == 1
    assert len(ledger(app)) == 1


def test_global_quota_is_shared_across_accounts_and_endpoints(tmp_path):
    app, one, model, tutor = setup_lab(tmp_path, own=5, total=1)
    register(one, "budgetone")
    assert one.post("/api/v1/tutor/chat", json=QUESTION).status_code == 200
    two = TestClient(app)
    register(two, "budgettwo")
    response = diagnose(two, session(two))
    assert response.status_code == 201
    assert "额度" in response.json()["engine_message"]
    assert model.calls == [] and len(tutor.calls) == 1


def test_diagnosis_reservations_do_not_appear_in_tutor_history(tmp_path):
    app, client, model, _ = setup_lab(tmp_path)
    register(client)
    assert diagnose(client, session(client)).status_code == 201
    rows = ledger(app)
    assert len(rows) == 1 and rows[0]["status"] == "done"
    assert rows[0]["response_json"] is None and rows[0]["user_message"] == ""
    history = client.get("/api/v1/tutor/history", params=dict(thread_id="legacy-diagnosis", experiment_id="ohms_law"))
    assert history.status_code == 200 and history.json()["turns"] == []
    assert len(model.calls) == 1


@pytest.mark.parametrize("route", ["diagnosis", "tutor"])
def test_model_failure_releases_pending_but_still_counts_attempted_call(tmp_path, route):
    app, client, model, tutor = setup_lab(tmp_path)
    register(client)
    (model if route == "diagnosis" else tutor).error = RuntimeError("private-api-secret")
    response = diagnose(client, session(client)) if route == "diagnosis" else client.post("/api/v1/tutor/chat", json=QUESTION)
    assert response.status_code in (200, 201), response.text
    assert "private-api-secret" not in response.text
    rows = ledger(app)
    assert len(rows) == 1 and rows[0]["status"] != "pending"
    finish_cooldown(app)
    (model if route == "diagnosis" else tutor).error = None
    repeated = diagnose(client, rows[0]["session_id"]) if route == "diagnosis" else client.post("/api/v1/tutor/chat", json=QUESTION)
    assert repeated.status_code in (200, 201), repeated.text
    assert len(ledger(app)) == 2


@pytest.mark.parametrize("first", ["diagnosis", "tutor"])
def test_pending_call_blocks_the_other_endpoint_before_paid_call(tmp_path, first):
    app, client, model, tutor = setup_lab(tmp_path, own=10, total=20)
    register(client)
    sid = session(client)
    entered, release = Event(), Event()
    slow_model = model if first == "diagnosis" else tutor
    original = slow_model.parse

    def slow(**kwargs):
        entered.set()
        assert release.wait(10)
        return original(**kwargs)

    slow_model.parse = slow
    with ThreadPoolExecutor(max_workers=2) as pool:
        initial = pool.submit(diagnose, client, sid) if first == "diagnosis" else pool.submit(client.post, "/api/v1/tutor/chat", json=QUESTION)
        assert entered.wait(10)
        try:
            second = client.post("/api/v1/tutor/chat", json=QUESTION) if first == "diagnosis" else diagnose(client, sid)
            if first == "diagnosis":
                assert second.status_code == 429
            else:
                assert second.status_code == 201
                assert "正在处理" in second.json()["engine_message"]
        finally:
            release.set()
        assert initial.result().status_code in (200, 201)
    assert len(model.calls) + len(tutor.calls) == 1
    assert all(row["status"] != "pending" for row in ledger(app))


@pytest.mark.parametrize("scope", ["owner", "global"])
def test_independent_workers_cannot_overreserve_shared_sqlite(tmp_path, scope):
    app, _, _, _ = setup_lab(tmp_path, own=1 if scope == "owner" else 10,
                             total=1 if scope == "global" else 10)
    settings = app.state.settings
    workers = [Database(settings.database_path), Database(settings.database_path)]
    barrier = Barrier(2)

    def reserve(index):
        barrier.wait(timeout=5)
        owner = "same-owner" if scope == "owner" else f"owner-{index}"
        try:
            turn = reserve_model_call(workers[index], settings, owner=owner,
                thread_id="atomic-test-thread", experiment_id="ohms_law", session_id=None, message="")
            return turn, owner
        except AIBudgetDenied:
            return None

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(reserve, range(2)))
    accepted = [result for result in results if result]
    assert len(accepted) == 1 and len(ledger(app)) == 1
    finish_model_call(workers[0], accepted[0][0], accepted[0][1])
    assert ledger(app)[0]["status"] == "done"
