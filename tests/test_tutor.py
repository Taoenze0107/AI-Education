"""Grounding, incomplete drafts, ownership and bounded model calls; no paid requests."""
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.tutor import TutorAnswer, TutorContext

ROOT = Path(__file__).resolve().parents[1]
BASE = "/api/v1/tutor"


@pytest.fixture
def lab(tmp_path):
    settings = Settings(database_path=tmp_path / "tutor.db",
        knowledge_base_path=ROOT / "app/data/knowledge_base.json", enable_llm=False,
        tutor_daily_limit=2, tutor_global_daily_limit=4)
    app = create_app(settings)
    return app, TestClient(app)


def context(**changes):
    return dict(experiment_id="ohms_law", stage="data", **changes)


def question(ctx=None, thread="thread-example-001", text="电流的单位应该怎么换算？"):
    return dict(thread_id=thread, message=text, context=ctx or context())


def register(client, username="learner"):
    r = client.post("/api/v1/classroom/register", json=dict(username=username,
        name="测试学生", role="student", password="Tutor-Test-2026!"))
    assert r.status_code == 201, r.text


class Responses:
    def __init__(self, answer=None, error=None):
        self.calls, self.error = [], error
        self.answer = answer or TutorAnswer(answer="先核对 20 mA 是否换算为 0.02 A。",
            next_question="你代入公式时使用的是什么单位？", suggestions=["保留原始读数。"],
            knowledge_ids=["ohms-law-core", "fabricated-source"])

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(output_parsed=self.answer)


def attach_model(app, **kwargs):
    fake = Responses(**kwargs)
    app.state.tutor.client = SimpleNamespace(responses=fake)
    return fake


def test_partial_readings_and_blank_values_are_not_zero_or_claimed_wrong(lab):
    _, client = lab
    result = client.post(BASE + "/feedback", json=context(columns={"voltage_V": [1, None, 3], "current_mA": [4, 8]}))
    assert result.status_code == 200
    body = result.json()
    assert body["calculation"] is None
    assert "空白" in str(body) and "数量不同" in str(body)
    assert "模型输出正确" not in str(body)


def test_independent_calculation_and_student_difference(lab):
    _, client = lab
    ctx = context(columns={"voltage_V": [1, 2, 3, 4, 5], "current_mA": [4, 8, 12, 16, 20]},
                  student_result=25, formula="R=U/I", variables={"U": 5, "I": .02}, unit="Ω")
    original = json.dumps(ctx)
    body = client.post(BASE + "/feedback", json=ctx).json()
    assert body["calculation"]["result"] == pytest.approx(250)
    assert body["formula_result"] == pytest.approx(250)
    assert any("差异" in i["title"] for i in body["items"])
    assert any("mA" in i["detail"] for i in body["items"])
    assert json.dumps(ctx) == original


def test_different_result_unit_is_not_compared_as_same_unit(lab):
    _, client = lab
    body = client.post(BASE + "/feedback", json=context(columns={"voltage_V": [1, 2, 3], "current_mA": [4, 8, 12]}, student_result=.25, unit="kΩ")).json()
    assert any("单位" in i["title"] for i in body["items"])
    assert not any("差异" in i["title"] for i in body["items"])


def test_safe_formula_and_nonfinite_or_oversized_input(lab):
    _, client = lab
    body = client.post(BASE + "/feedback", json=context(formula="__import__('os').getcwd()" )).json()
    assert any("暂不能复算" in i["title"] for i in body["items"])
    assert client.post(BASE + "/feedback", content='{"student_result":NaN}', headers={"Content-Type": "application/json"}).status_code == 422
    assert client.post(BASE + "/feedback", json=context(columns={"a": [1] * 501})).status_code == 422
    assert client.post(BASE + "/chat", json=question(text=" " )).status_code == 422


def test_every_catalog_topic_has_compatible_feedback(lab):
    app, _ = lab
    tutor = app.state.tutor
    for topic in tutor.catalog.topics:
        case = topic.cases[0]
        result = tutor.checks(TutorContext(experiment_id=topic.experiment_id,
            columns=case.columns, parameters=case.parameters, stage="data"), topic)
        assert result["calculation"] is not None, topic.experiment_id
        assert result["calculation"]["result"] > 0


def test_reference_mode_is_explicit_and_history_is_private(lab):
    app, a = lab
    b = TestClient(app)
    result = a.post(BASE + "/chat", json=question())
    assert result.status_code == 200
    assert result.json()["mode"] == "reference" and "不是模型回答" in result.json()["notice"]
    path = BASE + "/history?thread_id=thread-example-001&experiment_id=ohms_law"
    assert len(a.get(path).json()["turns"]) == 1
    assert b.get(path).json()["turns"] == []
    assert a.get(path.replace("ohms_law", "simple_pendulum")).json()["turns"] == []
    recreated = create_app(app.state.settings)
    reconnected = TestClient(recreated); reconnected.cookies.update(a.cookies)
    assert len(reconnected.get(path).json()["turns"]) == 1


def test_guest_history_follows_account_and_logout_hides_it(lab):
    _, client = lab
    client.post(BASE + "/chat", json=question())
    register(client)
    path = BASE + "/history?thread_id=thread-example-001&experiment_id=ohms_law"
    assert len(client.get(path).json()["turns"]) == 1
    client.post("/api/v1/classroom/logout", json={})
    assert client.get(path).json()["turns"] == []


def test_model_requires_login_and_uses_server_context_and_allowed_citations(lab):
    app, client = lab
    fake = attach_model(app)
    assert client.post(BASE + "/chat", json=question()).status_code == 401
    assert fake.calls == []
    register(client)
    ctx = context(columns={"voltage_V": [1, 2, 3], "current_mA": [4, 8, 12]}, student_result=25)
    result = client.post(BASE + "/chat", json=question(ctx))
    assert result.status_code == 200, result.text
    reply = result.json()
    assert reply["mode"] == "openai"
    assert "fabricated-source" not in reply["reply"]["knowledge_ids"]
    call = fake.calls[0]
    assert call["store"] is False and call["max_output_tokens"] <= 3000
    material = json.loads(call["input"][-1]["content"])
    assert material["server_checks"]["calculation"]["result"] == pytest.approx(250)
    assert "session_id" not in material["current_step"]
    assert "username" not in json.dumps(material)
    assert material["current_step"]["student_result"] == 25


def test_model_failure_is_disclosed_and_exception_secrets_not_returned(lab):
    app, client = lab
    register(client)
    attach_model(app, error=RuntimeError("secret-credential-must-not-leak"))
    result = client.post(BASE + "/chat", json=question())
    assert result.status_code == 200
    assert result.json()["mode"] == "reference"
    assert "暂时没有连接成功" in result.json()["notice"]
    assert "secret-credential" not in result.text


def test_session_context_cannot_read_another_students_work(lab):
    app, a = lab
    b = TestClient(app)
    sid = a.post("/api/v1/sessions", json=dict(student_id="lab-test", experiment_id="ohms_law")).json()["session_id"]
    assert b.post(BASE + "/chat", json=question(context(session_id=sid))).status_code == 404
    wrong = dict(experiment_id="simple_pendulum", session_id=sid)
    assert a.post(BASE + "/feedback", json=wrong).status_code == 409


def test_quota_persists_and_new_threads_do_not_reset_it(lab):
    app, client = lab
    register(client)
    fake = attach_model(app)
    for index in range(2):
        with app.state.tutor.db.connect() as con:
            con.execute("UPDATE lab_tutor_turns SET created_at='2026-01-01T00:00:00+00:00'")
        assert client.post(BASE + "/chat", json=question(thread=f"thread-number-{index}" )).status_code == 200
    # Keep quota rows in today's window without relying on wall-clock sleeps.
    from datetime import datetime, timezone
    stamp = datetime.now(timezone.utc).isoformat()
    with app.state.tutor.db.connect() as con:
        con.execute("UPDATE lab_tutor_turns SET created_at=?", (stamp,))
    assert client.post(BASE + "/chat", json=question(thread="another-new-thread")).status_code == 429
    assert len(fake.calls) == 2
    assert client.post(BASE + "/feedback", json=context()).status_code == 200


def test_overlapping_questions_reserve_one_model_call(lab):
    app, client = lab
    register(client)
    entered, release = Event(), Event()
    fake = attach_model(app)
    original = fake.parse
    def slow(**kwargs):
        entered.set(); assert release.wait(5)
        return original(**kwargs)
    fake.parse = slow
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(client.post, BASE + "/chat", json=question())
        assert entered.wait(5)
        try:
            second = client.post(BASE + "/chat", json=question(thread="overlapping-thread"))
            assert second.status_code == 429
        finally:
            release.set()
        assert first.result().status_code == 200
    assert len(fake.calls) == 1


def test_cross_origin_chat_is_rejected_before_model(lab):
    app, client = lab
    register(client); fake = attach_model(app)
    result = client.post(BASE + "/chat", json=question(), headers={"Origin": "https://other.invalid"})
    assert result.status_code == 403 and not fake.calls


def test_real_sdk_serializes_and_parses_without_contacting_openai(lab):
    import httpx
    from openai import OpenAI
    app, client = lab
    register(client)
    calls = []
    expected = TutorAnswer(answer="先把电流统一为 A。", next_question="20 mA 等于多少 A？",
                           suggestions=["保留原始记录。"], knowledge_ids=["ohms-law-core"])
    def respond(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json=dict(id="resp_fixture", object="response", created_at=1,
            status="completed", model="gpt-5-mini", error=None, incomplete_details=None,
            output=[dict(id="msg_fixture", type="message", role="assistant", status="completed",
                content=[dict(type="output_text", text=expected.model_dump_json(), annotations=[])])]))
    transport = httpx.MockTransport(respond)
    app.state.tutor.client = OpenAI(api_key="test-not-a-real-key", max_retries=0,
                                   http_client=httpx.Client(transport=transport))
    result = client.post(BASE + "/chat", json=question())
    assert result.status_code == 200 and result.json()["mode"] == "openai", result.text
    assert calls[0]["text"]["format"]["type"] == "json_schema"
    assert calls[0]["store"] is False
    assert calls[0]["reasoning"]["effort"] == "low"


def test_tutor_flag_is_independent_of_public_diagnosis(monkeypatch, tmp_path):
    for name in ("TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("ENABLE_LLM", "false")
    monkeypatch.setenv("ENABLE_TUTOR", "true")
    settings = Settings.from_env()
    assert settings.enable_tutor is True and settings.enable_llm is False


def test_large_readings_are_explicitly_sampled_but_calculation_uses_all(lab):
    app, client = lab
    register(client)
    fake = attach_model(app)
    ctx = context(columns={"voltage_V": list(range(1, 121)),
                           "current_mA": [4*i for i in range(1, 121)]})
    result = client.post(BASE + "/chat", json=question(ctx))
    assert result.status_code == 200 and result.json()["mode"] == "openai"
    material = json.loads(fake.calls[0]["input"][-1]["content"])
    sample = material["current_step"]["sampled_columns"]["voltage_V"]
    assert sample["sampled"] is True and sample["total_count"] == 120
    assert len(sample["points"]) <= 26
    assert sample["points"][-1] == dict(index=120, value=120)
    assert material["server_checks"]["calculation"]["result"] == pytest.approx(250)
    assert len(ctx["columns"]["voltage_V"]) == 120
