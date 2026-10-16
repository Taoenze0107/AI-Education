"""Private low-stakes progress, server grading and revision scheduling; synthetic data only."""
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.learning as learning
from app.config import Settings
from app.main import create_app

ROOT = Path(__file__).resolve().parents[1]
BASE = "/api/v1/learning"
TOPICS = ("simple_pendulum", "ohms_law", "rc_time_constant")
CORRECT = {"simple_pendulum": {"prediction": "b", "transfer": "a"},
           "ohms_law": {"prediction": "c", "transfer": "b"},
           "rc_time_constant": {"prediction": "d", "transfer": "a"}}


@pytest.fixture
def lab(tmp_path):
    settings = Settings(database_path=tmp_path / "learning.db",
                        knowledge_base_path=ROOT / "app/data/knowledge_base.json", enable_llm=False)
    app = create_app(settings)
    assert hasattr(app.state, "learning"), "create_app must install the interactive learning routes"
    return app, TestClient(app)


def answer(client, topic="ohms_law", node="prediction", choice="a"):
    return client.post(f"{BASE}/courses/{topic}/answers", json={"node_id": node, "choice_id": choice})


def test_catalog_contains_three_courses_without_solutions(lab):
    _, client = lab
    listing = client.get(BASE + "/courses").json()
    assert {course["experiment_id"] for course in listing["courses"]} == set(TOPICS)
    for topic in TOPICS:
        response = client.get(BASE + "/courses/" + topic)
        assert response.status_code == 200
        course = response.json()
        assert course["progress"] == []
        assert {node["stage"] for node in course["nodes"]} == {"prediction", "transfer"}
        for node in course["nodes"]:
            assert len(node["choices"]) == 4 and node["tag"] and node["question"]
        assert "correct_choice_id" not in response.text
        assert "explanation" not in response.text and "hints" not in response.text


@pytest.mark.parametrize("topic", TOPICS)
@pytest.mark.parametrize("node", ("prediction", "transfer"))
def test_all_six_questions_grade_on_server_and_explain_only_after_success(lab, topic, node):
    app, client = lab
    right = CORRECT[topic][node]
    wrong = next(choice for choice in "abcd" if choice != right)
    first = answer(client, topic, node, wrong)
    assert first.status_code == 200
    body = first.json()
    assert body["correct"] is False and body["explanation"] is None and body["hint"]
    assert "correct_choice_id" not in first.text
    standard_explanation = next(n for n in app.state.learning.by_id[topic]["nodes"] if n["id"] == node)["explanation"]
    assert standard_explanation not in first.text
    second = answer(client, topic, node, right)
    assert second.status_code == 200
    result = second.json()
    assert result["correct"] is True and result["assisted"] is True
    assert result["attempt_count"] == 2 and result["cycle_attempt_count"] == 2
    assert result["hint"] is None and result["explanation"] == standard_explanation
    assert "不计正式成绩" in result["feedback"]
    with app.state.learning.db.connect() as con:
        saved = con.execute("SELECT choice_id,correct,assisted FROM lab_learning_answers ORDER BY answer_id").fetchall()
        assert [tuple(row) for row in saved] == [(wrong, 0, 0), (right, 1, 1)]


def test_hint_levels_are_bounded_and_attempts_do_not_claim_mastery(lab):
    _, client = lab
    hints = [answer(client).json() for _ in range(4)]
    assert len({item["hint"] for item in hints}) == 3
    assert hints[-1]["hint"] == hints[-2]["hint"]
    assert all(item["explanation"] is None and item["correct"] is False for item in hints)
    review = client.get(BASE + "/review").json()
    assert review["summary"] == {"total": 1, "needs_retry": 1, "review_due": 0, "scheduled": 0}
    assert review["items"][0]["attempt_count"] == 4


def test_private_owners_cannot_read_or_overwrite_each_others_progress(lab):
    app, first = lab
    other = TestClient(app)
    answer(first)
    assert first.get(BASE + "/review").json()["summary"]["total"] == 1
    assert other.get(BASE + "/review").json()["items"] == []
    assert other.get(BASE + "/courses/ohms_law").json()["progress"] == []
    forged = other.post(BASE + "/courses/ohms_law/answers", json={"node_id": "prediction", "choice_id": "c", "owner_id": "someone-else"})
    assert forged.status_code == 422
    assert first.get(BASE + "/courses/ohms_law").json()["progress"][0]["last_correct"] is False


def test_progress_persists_when_application_restarts(lab):
    app, client = lab
    answer(client, node="transfer", choice="b")
    recreated = create_app(app.state.settings)
    reconnected = TestClient(recreated)
    reconnected.cookies.update(client.cookies)
    progress = reconnected.get(BASE + "/courses/ohms_law").json()["progress"]
    assert len(progress) == 1 and progress[0]["last_correct"] is True
    assert progress[0]["assisted"] is False and progress[0]["attempt_count"] == 1
    assert progress[0]["last_choice_id"] == "b" and progress[0]["explanation"]
    assert progress[0]["attempts"][0]["choice_id"] == "b"
    assert progress[0]["total"] == 1 and progress[0]["truncated"] is False


def test_bounded_current_round_choice_history_is_private_and_keeps_full_sql_record(lab):
    app, client = lab
    for _ in range(9):
        assert answer(client).status_code == 200
    progress = client.get(BASE + "/courses/ohms_law").json()["progress"][0]
    assert progress["last_choice_id"] == "a" and progress["explanation"] is None
    assert len(progress["attempts"]) == 8 and progress["total"] == 9 and progress["truncated"] is True
    assert all(attempt["correct"] is False and attempt["answered_at"].endswith("+00:00") for attempt in progress["attempts"])
    assert TestClient(app).get(BASE + "/courses/ohms_law").json()["progress"] == []
    assert answer(client, choice="c").status_code == 200
    restored = client.get(BASE + "/courses/ohms_law").json()["progress"][0]
    assert restored["explanation"] and restored["last_choice_id"] == "c"
    assert restored["attempts"][-1]["correct"] is True and restored["total"] == 10
    with app.state.learning.db.connect() as con:
        assert con.execute("SELECT COUNT(*) FROM lab_learning_answers").fetchone()[0] == 10


def test_guest_progress_follows_login_and_logout_is_private(lab):
    app, client = lab
    peer = TestClient(app)
    answer(client)
    result = client.post("/api/v1/classroom/register", json={"username": "lesson-student", "name": "测试学生",
                         "role": "student", "password": "Lesson-Test-2026!"})
    assert result.status_code == 201
    assert len(client.get(BASE + "/review").json()["items"]) == 1
    assert peer.get(BASE + "/review").json()["items"] == []
    client.post("/api/v1/classroom/logout", json={})
    assert client.get(BASE + "/review").json()["items"] == []
    client.post("/api/v1/classroom/login", json={"username": "lesson-student", "password": "Lesson-Test-2026!"})
    assert len(client.get(BASE + "/review").json()["items"]) == 1


def test_claimed_guest_round_does_not_mix_old_account_solution_into_new_hint_history(lab):
    _, client = lab
    credentials = {"username": "returning-student", "password": "Lesson-Test-2026!"}
    assert client.post("/api/v1/classroom/register", json={**credentials, "role": "student", "name": "回访同学"}).status_code == 201
    assert answer(client, choice="c").status_code == 200
    client.post("/api/v1/classroom/logout", json={})
    assert answer(client, choice="a").status_code == 200
    assert client.post("/api/v1/classroom/login", json=credentials).status_code == 200
    progress = client.get(BASE + "/courses/ohms_law").json()["progress"][0]
    assert progress["attempt_count"] == 2 and progress["total"] == 1
    assert progress["explanation"] is None
    assert [attempt["choice_id"] for attempt in progress["attempts"]] == ["a"]


def test_retry_then_independent_due_review_uses_utc_and_cannot_be_spammed(lab, monkeypatch):
    _, client = lab
    singapore = timezone(timedelta(hours=8))
    stamp = datetime(2026, 12, 31, 23, 55, tzinfo=singapore)
    monkeypatch.setattr(learning, "now", lambda: stamp)
    wrong = answer(client).json()
    assert wrong["due_at"] == "2026-12-31T15:55:00+00:00"
    fixed = answer(client, choice="c").json()
    assert fixed["assisted"] is True and fixed["due_at"] == "2027-01-01T15:55:00+00:00"
    assert client.get(BASE + "/review").json()["items"][0]["status"] == "scheduled"
    assert answer(client, choice="c").status_code == 409
    assert client.get(BASE + "/review").json()["items"][0]["attempt_count"] == 2
    stamp += timedelta(days=1)
    due = client.get(BASE + "/review").json()["items"][0]
    assert due["status"] == "review_due" and due["can_answer"] is True
    reopened = client.get(BASE + "/courses/ohms_law").json()["progress"][0]
    assert reopened["last_choice_id"] is None and reopened["explanation"] is None
    assert reopened["attempts"] == [] and reopened["total"] == 0
    reviewed = answer(client, choice="c").json()
    assert reviewed["correct"] is True and reviewed["assisted"] is False
    assert reviewed["attempt_count"] == 3 and reviewed["cycle_attempt_count"] == 1
    assert datetime.fromisoformat(reviewed["due_at"]) - stamp == timedelta(days=3)


def test_daily_limit_is_persistent_and_resets_at_utc_midnight(lab, monkeypatch):
    app, client = lab
    monkeypatch.setattr(learning, "LIMIT_PER_DAY", 2)
    stamp = datetime(2026, 10, 15, 23, 59, tzinfo=timezone.utc)
    monkeypatch.setattr(learning, "now", lambda: stamp)
    assert answer(client).status_code == 200
    assert answer(client).status_code == 200
    assert answer(client).status_code == 429
    restarted = create_app(app.state.settings)
    reconnected = TestClient(restarted)
    reconnected.cookies.update(client.cookies)
    assert answer(reconnected).status_code == 429
    assert answer(TestClient(app)).status_code == 200
    stamp += timedelta(minutes=1)
    assert answer(reconnected).status_code == 200


def test_short_rate_limit_is_owner_scoped(lab, monkeypatch):
    app, client = lab
    monkeypatch.setattr(learning, "LIMIT_PER_MINUTE", 2)
    assert answer(client).status_code == 200
    assert answer(client).status_code == 200
    third = answer(client)
    assert third.status_code == 429 and third.headers["retry-after"] == "60"
    assert answer(TestClient(app)).status_code == 200


def test_unknown_ids_invalid_or_oversized_payloads_and_csrf_do_not_save_answers(lab):
    app, client = lab
    assert client.get(BASE + "/courses/unknown").status_code == 404
    assert answer(client, topic="unknown").status_code == 404
    assert answer(client, node="unknown").status_code == 404
    assert answer(client, choice="unknown").status_code == 422
    assert answer(client, node="x" * 40).status_code == 422
    assert answer(client, choice=1).status_code == 422
    endpoint = BASE + "/courses/ohms_law/answers"
    assert client.post(endpoint, content=" " * 5000, headers={"content-type": "application/json"}).status_code == 413
    assert client.post(endpoint, content=" " * 5000, headers={"content-type": "application/json", "content-length": "2"}).status_code == 413
    assert client.post(endpoint, json={"node_id": "prediction", "choice_id": "a"}, headers={"origin": "https://evil.example"}).status_code == 403
    assert client.post(endpoint, json={"node_id": "prediction", "choice_id": "a"}, headers={"sec-fetch-site": "cross-site"}).status_code == 403
    assert client.post(endpoint, content='{"node_id":"prediction","choice_id":"a"}', headers={"content-type": "text/plain"}).status_code == 415
    with app.state.learning.db.connect() as con:
        assert con.execute("SELECT COUNT(*) FROM lab_learning_answers").fetchone()[0] == 0
