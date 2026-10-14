from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4

from app.database import Database
from app.models import (
    AttemptCreate,
    AttemptResponse,
    OutcomeCreate,
    OutcomeRecorded,
    SessionCreate,
    SessionCreated,
    SessionList,
    SessionSummary,
)


class NotFoundError(LookupError):
    pass


class ConflictError(RuntimeError):
    pass


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Repository:
    """AT7 persistence for sessions, attempts, hint levels and outcomes."""

    def __init__(self, database: Database) -> None:
        self.database = database

    def create_session(self, payload: SessionCreate) -> SessionCreated:
        record = SessionCreated(
            session_id=str(uuid4()),
            student_id=payload.student_id,
            experiment_id=payload.experiment_id,
            course_id=payload.course_id,
            created_at=utc_now(),
        )
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO sessions(session_id, student_id, experiment_id, course_id, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    record.session_id,
                    record.student_id,
                    record.experiment_id,
                    record.course_id,
                    record.created_at.isoformat(),
                ),
            )
        return record

    def get_session(self, session_id: str) -> SessionCreated:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
            ).fetchone()
        if row is None:
            raise NotFoundError(f"找不到会话：{session_id}")
        return SessionCreated(
            session_id=row["session_id"],
            student_id=row["student_id"],
            experiment_id=row["experiment_id"],
            course_id=row["course_id"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def list_sessions(
        self, student_id: str | None = None, limit: int = 20, offset: int = 0, owner_id: str | None = None
    ) -> SessionList:
        """Return a stable newest-first page, with the latest recorded outcome."""
        conditions = []
        values: list[object] = []
        if student_id is not None:
            conditions.append('s.student_id = ?')
            values.append(student_id)
        if owner_id is not None:
            conditions.append('s.session_id IN (SELECT session_id FROM lab_session_owners WHERE owner_id=?)')
            values.append(owner_id)
        where = 'WHERE ' + ' AND '.join(conditions) if conditions else ''
        parameters = tuple(values)
        with self.database.connect() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) AS count FROM sessions s {where}", parameters
            ).fetchone()["count"]
            rows = connection.execute(
                f"""
                SELECT s.*,
                    (SELECT COUNT(*) FROM attempts a
                     WHERE a.session_id = s.session_id) AS attempt_count,
                    (SELECT COUNT(*) FROM outcomes o
                     JOIN attempts a ON a.attempt_id = o.attempt_id
                     WHERE a.session_id = s.session_id) AS modification_count,
                    (SELECT a.status FROM attempts a
                     WHERE a.session_id = s.session_id
                     ORDER BY a.attempt_number DESC LIMIT 1) AS latest_status,
                    (SELECT o.result FROM outcomes o
                     JOIN attempts a ON a.attempt_id = o.attempt_id
                     WHERE a.session_id = s.session_id
                     ORDER BY o.recorded_at DESC, a.attempt_number DESC, o.outcome_id DESC
                     LIMIT 1) AS latest_result
                FROM sessions s
                {where}
                ORDER BY s.created_at DESC, s.session_id DESC
                LIMIT ? OFFSET ?
                """,
                (*parameters, limit, offset),
            ).fetchall()
        return SessionList(
            sessions=[SessionSummary.model_validate(dict(row)) for row in rows],
            total=int(total),
            limit=limit,
            offset=offset,
        )

    def count_attempts(self, session_id: str) -> int:
        self.get_session(session_id)
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM attempts WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return int(row["count"])

    def save_attempt(
        self, request: AttemptCreate, response: AttemptResponse
    ) -> AttemptResponse:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO attempts(
                    attempt_id, session_id, attempt_number, status, hint_level,
                    issue_type, request_json, response_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    response.attempt_id,
                    response.session_id,
                    response.attempt_number,
                    response.status.value,
                    int(response.intervention.level) if response.intervention else None,
                    response.diagnosis.issue_type.value if response.diagnosis else None,
                    request.model_dump_json(),
                    response.model_dump_json(),
                    response.created_at.isoformat(),
                ),
            )
        return response

    def record_outcome(
        self, attempt_id: str, payload: OutcomeCreate
    ) -> OutcomeRecorded:
        outcome = OutcomeRecorded(
            outcome_id=str(uuid4()),
            attempt_id=attempt_id,
            result=payload.result,
            recorded_at=utc_now(),
        )
        try:
            with self.database.connect() as connection:
                exists = connection.execute(
                    "SELECT 1 FROM attempts WHERE attempt_id = ?", (attempt_id,)
                ).fetchone()
                if exists is None:
                    raise NotFoundError(f"找不到诊断尝试：{attempt_id}")
                connection.execute(
                    """
                    INSERT INTO outcomes(
                        outcome_id, attempt_id, result, student_revision,
                        final_result, self_check_notes, recorded_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        outcome.outcome_id,
                        attempt_id,
                        payload.result,
                        payload.student_revision,
                        payload.final_result,
                        payload.self_check_notes,
                        outcome.recorded_at.isoformat(),
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise ConflictError("该诊断尝试已经记录过修改结果。") from exc
        return outcome

    def session_history(self, session_id: str) -> dict[str, object]:
        session = self.get_session(session_id)
        with self.database.connect() as connection:
            rows = connection.execute(
                """
                SELECT a.*, o.outcome_id, o.result AS outcome_result,
                       o.student_revision, o.final_result, o.self_check_notes,
                       o.recorded_at
                FROM attempts a
                LEFT JOIN outcomes o ON o.attempt_id = a.attempt_id
                WHERE a.session_id = ?
                ORDER BY a.attempt_number ASC
                """,
                (session_id,),
            ).fetchall()

        attempts: list[dict[str, object]] = []
        for row in rows:
            item: dict[str, object] = {
                "attempt_id": row["attempt_id"],
                "attempt_number": row["attempt_number"],
                "status": row["status"],
                "hint_level": row["hint_level"],
                "issue_type": row["issue_type"],
                "request": json.loads(row["request_json"]),
                "response": json.loads(row["response_json"]),
                "created_at": row["created_at"],
                "outcome": None,
            }
            if row["outcome_id"]:
                item["outcome"] = {
                    "outcome_id": row["outcome_id"],
                    "result": row["outcome_result"],
                    "student_revision": row["student_revision"],
                    "final_result": row["final_result"],
                    "self_check_notes": row["self_check_notes"],
                    "recorded_at": row["recorded_at"],
                }
            attempts.append(item)

        corrected = sum(
            1
            for item in attempts
            if item["outcome"]
            and isinstance(item["outcome"], dict)
            and item["outcome"].get("result") == "corrected"
        )
        recorded_outcomes = [
            (item["outcome"]["recorded_at"], item["attempt_number"], item["outcome"])
            for item in attempts
            if isinstance(item["outcome"], dict)
        ]
        latest_outcome = (
            max(recorded_outcomes, key=lambda item: (item[0], item[1]))[2]
            if recorded_outcomes
            else None
        )
        return {
            "session": session.model_dump(mode="json"),
            "summary": {
                "attempt_count": len(attempts),
                "modification_count": sum(1 for item in attempts if item["outcome"]),
                "corrected_count": corrected,
                "latest_status": attempts[-1]["status"] if attempts else None,
                "latest_result": latest_outcome["result"] if latest_outcome else None,
            },
            "attempts": attempts,
        }
