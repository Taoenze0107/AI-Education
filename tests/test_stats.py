"""教师端统计接口（MS-3）测试：用受控 SQLite 数据验证三个聚合端点的精确口径。"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from fastapi import FastAPI
from app.database import Database
from app.stats import create_stats_router


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def make_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        database_path=tmp_path / "stats.db",
        knowledge_base_path=PROJECT_ROOT / "app" / "data" / "knowledge_base.json",
        openai_api_key=None,
        openai_model="test-model",
        enable_llm=False,
        llm_timeout_seconds=1,
    )
    database = Database(settings.database_path)
    database.initialize()
    app = FastAPI()
    app.state.settings = settings
    app.include_router(create_stats_router(settings.database_path))
    return TestClient(app)


def seed(client: TestClient) -> Path:
    """构造受控数据集（见每条记录注释）。"""
    db_path: Path = client.app.state.settings.database_path
    connection = sqlite3.connect(db_path)
    # S1: 一次做对（completed/0 提示/no_error/单次）→ FAS
    # S2: completed 但有提示+data_error（已纠错）→ 非 FAS
    # S3: 两次尝试才 completed（首条 needs_more_evidence）→ 非 FAS
    # S4: rc 实验 teaching_intervention + calculation_error(unchanged)
    # S5: ohms_law teaching_intervention + data_error(abandoned)，课程 C2
    sessions = [
        ("S1", "stu1", "ohms_law", "C1", "2026-09-18T10:00:00"),
        ("S2", "stu2", "ohms_law", "C1", "2026-09-18T10:01:00"),
        ("S3", "stu3", "ohms_law", "C1", "2026-09-18T10:02:00"),
        ("S4", "stu4", "rc_time_constant", "C1", "2026-09-18T10:03:00"),
        ("S5", "stu5", "ohms_law", "C2", "2026-09-18T10:04:00"),
    ]
    connection.executemany(
        "INSERT INTO sessions(session_id, student_id, experiment_id, course_id, created_at)"
        " VALUES (?,?,?,?,?)",
        sessions,
    )
    attempts = [
        # attempt_id, session_id, n, status, hint_level, issue_type
        ("A1", "S1", 1, "completed", 0, "no_error"),
        ("A2", "S2", 1, "completed", 1, "data_error"),
        ("A3a", "S3", 1, "needs_more_evidence", 0, None),
        ("A3b", "S3", 2, "completed", 0, "no_error"),
        ("A4", "S4", 1, "teaching_intervention", 2, "calculation_error"),
        ("A5", "S5", 1, "teaching_intervention", 1, "data_error"),
    ]
    connection.executemany(
        "INSERT INTO attempts(attempt_id, session_id, attempt_number, status, hint_level,"
        " issue_type, request_json, response_json, created_at)"
        " VALUES (?,?,?,?,?,?,'{}','{}','2026-09-18T10:00:00')",
        attempts,
    )
    outcomes = [
        ("O2", "A2", "corrected", "fixed"),
        ("O4", "A4", "unchanged", "no change"),
        ("O5", "A5", "abandoned", "gave up"),
    ]
    connection.executemany(
        "INSERT INTO outcomes(outcome_id, attempt_id, result, student_revision,"
        " final_result, self_check_notes, recorded_at)"
        " VALUES (?,?,?,? ,NULL,NULL,'2026-09-18T10:10:00')",
        outcomes,
    )
    connection.commit()
    connection.close()
    return db_path


def test_class_summary_full_scope(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    seed(client)
    data = client.get("/api/v1/stats/class-summary").json()
    assert data["total_sessions"] == 5
    assert data["completed_sessions"] == 3
    assert data["completion_rate"] == 0.6
    assert data["total_attempts"] == 6
    assert data["average_attempts_per_session"] == 1.2
    # max hint 分别为 0,1,0,2,1 → 均值 0.8
    assert data["average_max_hint_level"] == 0.8
    dist = data["attempt_status_distribution"]
    assert dist == {
        "completed": 3,
        "needs_more_evidence": 1,
        "teaching_intervention": 2,
    }


def test_class_summary_experiment_and_course_filters(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    seed(client)
    ohms = client.get(
        "/api/v1/stats/class-summary", params={"experiment_id": "ohms_law"}
    ).json()
    # S1,S2,S3,S5；completed=S1,S2,S3
    assert ohms["total_sessions"] == 4
    assert ohms["completed_sessions"] == 3
    assert ohms["completion_rate"] == 0.75

    course_c1 = client.get(
        "/api/v1/stats/class-summary", params={"course_id": "C1"}
    ).json()
    assert course_c1["total_sessions"] == 4
    assert course_c1["completed_sessions"] == 3


def test_first_attempt_success(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    seed(client)
    data = client.get("/api/v1/stats/first-attempt-success").json()
    assert data["total_sessions"] == 5
    assert data["first_attempt_success_count"] == 1
    assert data["first_attempt_success_rate"] == 0.2
    breakdown = data["condition_breakdown"]
    # 首条 completed: S1,S2,S3b? → 首条为 A1,A2,A3a,A4,A5 → completed 只有 S1,S2
    assert breakdown["first_completed"] == 2
    # 单尝试会话：S1,S2,S4,S5（S3 两次）
    assert breakdown["single_attempt"] == 4
    # 首条无异常：S1,S2(data_error 否),S3(None 视为无),S4(calc 否),S5(data 否) → S1,S3
    assert breakdown["no_issue"] == 2


def test_common_errors_distribution_and_correction_rate(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    seed(client)
    data = client.get("/api/v1/stats/common-errors").json()
    assert data["total_error_attempts"] == 3
    dist = {item["issue_type"]: item for item in data["distribution"]}
    assert set(dist) == {"data_error", "calculation_error"}

    data_err = dist["data_error"]
    assert data_err["occurrences"] == 2
    assert data_err["affected_sessions"] == 2  # S2,S5
    assert data_err["corrected"] == 1
    assert data_err["abandoned"] == 1
    assert data_err["correction_rate"] == 0.5

    calc_err = dist["calculation_error"]
    assert calc_err["occurrences"] == 1
    assert calc_err["affected_sessions"] == 1
    assert calc_err["unchanged"] == 1
    assert calc_err["correction_rate"] == 0.0

    # 实验维度明细存在且归一标签正确
    by_exp = data["by_experiment"]
    assert {(row["experiment_id"], row["issue_type"]) for row in by_exp} == {
        ("ohms_law", "data_error"),
        ("rc_time_constant", "calculation_error"),
    }


def test_empty_database_returns_zeroes_not_error(tmp_path: Path) -> None:
    client = make_client(tmp_path)  # 仅建表，无数据
    summary = client.get("/api/v1/stats/class-summary")
    assert summary.status_code == 200
    body = summary.json()
    assert body["total_sessions"] == 0
    assert body["completion_rate"] == 0.0
    fas = client.get("/api/v1/stats/first-attempt-success").json()
    assert fas["first_attempt_success_rate"] == 0.0
    errors = client.get("/api/v1/stats/common-errors").json()
    assert errors["total_error_attempts"] == 0
    assert errors["distribution"] == []
