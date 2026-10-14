"""Cloud driver semantics, persistence and safe configuration failure."""
import json
from pathlib import Path
import sqlite3

import pytest

from app.cloud_database import CloudConnection, CloudRow
from app.database import Database

libsql = pytest.importorskip("libsql")


@pytest.fixture
def cloud_database(tmp_path, monkeypatch):
    # Exercise the actual libSQL driver against a separate file. The app sees
    # a remote URL; its ephemeral DATABASE_PATH must never be opened.
    connect = libsql.connect
    persistent = tmp_path / "cloud-primary.db"
    monkeypatch.setattr(libsql, "connect", lambda **kwargs: connect(str(persistent)))
    db = Database(tmp_path / "ephemeral" / "unused.db", remote_url="libsql://test.invalid", auth_token="test-token", require_persistent=True)
    db.initialize()
    return db


def test_rows_work_with_mappings_and_position():
    row = CloudRow(("label", "value"), ("试验", 250))
    assert row["value"] == row[1] == 250
    assert dict(row) == {"label": "试验", "value": 250}


def test_cloud_reconnect_retains_record_and_rollback(cloud_database):
    db = cloud_database
    with db.connect() as con:
        con.execute("INSERT INTO sessions VALUES (?,?,?,?,?)", ("saved", "S001", "ohms_law", None, "2026-10-14"))
    with db.connect() as con:
        assert con.execute("SELECT student_id FROM sessions WHERE session_id=?", ("saved",)).fetchone()["student_id"] == "S001"
    with pytest.raises(RuntimeError):
        with db.connect() as con:
            con.execute("INSERT INTO sessions VALUES (?,?,?,?,?)", ("rollback", "S002", "ohms_law", None, "2026-10-14"))
            raise RuntimeError("cancel transaction")
    with db.connect() as con:
        assert con.execute("SELECT COUNT(*) FROM sessions WHERE session_id='rollback'").fetchone()[0] == 0
    assert not db.path.exists()
    assert not db.path.parent.exists()


def test_cloud_constraints_preserve_repository_error_handling(cloud_database):
    with pytest.raises(sqlite3.IntegrityError):
        with cloud_database.connect() as con:
            con.execute("INSERT INTO attempts VALUES (?,?,?,?,?,?,?,?,?)", ("id", "missing-session", 1, "completed", None, None, "{}", "{}", "today"))


@pytest.mark.parametrize("kwargs", [
    {"require_persistent": True},
    {"remote_url": "libsql://test.invalid"},
    {"auth_token": "private-test-token"},
    {"remote_url": "http://test.invalid", "auth_token": "private-test-token"},
])
def test_incomplete_or_insecure_cloud_config_fails_closed(tmp_path, kwargs):
    with pytest.raises(ValueError) as exc:
        Database(tmp_path / "local.db", **kwargs)
    assert "private-test-token" not in str(exc.value)


def test_cloud_connection_errors_do_not_disclose_token(monkeypatch):
    def failed_connect(**kwargs):
        raise ValueError("network request included private-test-token")
    monkeypatch.setattr(libsql, "connect", failed_connect)
    with pytest.raises(sqlite3.OperationalError) as exc:
        CloudConnection.open("libsql://test.invalid", "private-test-token")
    assert "private-test-token" not in str(exc.value)


def test_classroom_and_history_survive_app_restart(cloud_database):
    from fastapi.testclient import TestClient
    from app.config import Settings
    from app.main import create_app

    root = Path(__file__).resolve().parents[1]
    settings = Settings(database_path=cloud_database.path, knowledge_base_path=root / "app/data/knowledge_base.json", enable_llm=False, turso_database_url=cloud_database.remote_url, turso_auth_token=cloud_database.auth_token, require_persistent_database=True)
    app = create_app(settings)
    teacher, student = TestClient(app), TestClient(app)
    password = "Cloud-Integration-Test-2026!"
    base = "/api/v1/classroom"
    for client, role in ((teacher, "teacher"), (student, "student")):
        assert client.post(base + "/register", json={"username": role, "name": role, "role": role, "password": password}).status_code == 201
    assert student.post(base + "/register", json={"username": "teacher", "name": "duplicate", "role": "student", "password": password}).status_code == 409
    classroom = teacher.post(base + "/classes", json={"name": "Cloud test class"}).json()
    assert student.post(base + "/join", json={"code": classroom["invite_code"], "student_number": "S001"}).status_code == 200
    assignment = teacher.post(base + "/classes/" + classroom["class_id"] + "/assignments", json={"title": "Cloud persistence test", "experiment_id": "ohms_law", "instructions": "Check units."}).json()
    sid = student.post(base + "/assignments/" + assignment["assignment_id"] + "/start", json={}).json()["session_id"]
    sample = json.loads((root / "examples/sufficient_calculation_error.json").read_text())
    assert student.post("/api/v1/sessions/" + sid + "/attempts", json=sample).status_code == 201
    submitted = student.post(base + "/assignments/" + assignment["assignment_id"] + "/submit", json={"session_id": sid, "note": "Saved in cloud"}).json()
    assert teacher.post(base + "/submissions/" + submitted["submission_id"] + "/review", json={"status": "needs_revision", "feedback": "Check mA to A."}).status_code == 200

    # A newly started application must see the same account and class work.
    restarted = create_app(settings)
    teacher, student = TestClient(restarted), TestClient(restarted)
    for client, username in ((teacher, "teacher"), (student, "student")):
        assert client.post(base + "/login", json={"username": username, "password": password}).status_code == 200
    summary = teacher.get(base + "/assignments/" + assignment["assignment_id"]).json()["summary"]
    assert summary["submitted_count"] == summary["needs_revision_count"] == 1
    assert student.get("/api/v1/sessions/" + sid + "/history").json()["summary"]["attempt_count"] == 1
    assert student.get(base + "/submissions/" + submitted["submission_id"]).json()["submission"]["feedback"] == "Check mA to A."
