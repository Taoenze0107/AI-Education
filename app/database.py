from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.cloud_database import CloudConnection


SCHEMA = """
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    experiment_id TEXT NOT NULL,
    course_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
    attempt_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    hint_level INTEGER,
    issue_type TEXT,
    request_json TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE,
    UNIQUE (session_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS outcomes (
    outcome_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL UNIQUE,
    result TEXT NOT NULL,
    student_revision TEXT NOT NULL,
    final_result TEXT,
    self_check_notes TEXT,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (attempt_id) REFERENCES attempts(attempt_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attempts_session
ON attempts(session_id, attempt_number);
"""


class Database:
    def __init__(
        self,
        path: Path,
        *,
        remote_url: str | None = None,
        auth_token: str | None = None,
        require_persistent: bool = False,
    ) -> None:
        self.path = path
        self.remote_url = remote_url
        self.auth_token = auth_token
        if bool(remote_url) != bool(auth_token):
            raise ValueError("TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN 必须一起配置。")
        if require_persistent and not remote_url:
            raise ValueError("云端部署要求持久数据库；请先配置 Turso 连接。")
        if remote_url and not remote_url.startswith(("libsql://", "https://")):
            raise ValueError("Turso 数据库地址必须使用 libsql:// 或 https://。")

    def initialize(self) -> None:
        if not self.remote_url:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            # The cloud primary manages its own journal mode.
            schema = SCHEMA.replace("PRAGMA journal_mode = WAL;", "") if self.remote_url else SCHEMA
            connection.executescript(schema)

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection | CloudConnection]:
        if self.remote_url:
            connection = CloudConnection.open(self.remote_url, self.auth_token)
        else:
            connection = sqlite3.connect(self.path, timeout=10.0)
            connection.row_factory = sqlite3.Row
        try:
            connection.execute("PRAGMA foreign_keys = ON")
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

