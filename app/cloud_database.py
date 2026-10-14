"""Small DB-API adapter for the official libSQL remote driver.

Reads and writes go directly to Turso; no ephemeral local replica is used.
Existing repositories keep their SQLite row and constraint-error semantics.
"""
from __future__ import annotations

import sqlite3
from collections.abc import Iterator, Mapping, Sequence
from typing import Any


class CloudRow(Mapping[str, Any]):
    def __init__(self, names: Sequence[str], values: Sequence[Any]):
        self._names = tuple(names)
        self._values = tuple(values)
        self._lookup = dict(zip(self._names, self._values))

    def __getitem__(self, key: str | int | slice) -> Any:
        return self._values[key] if isinstance(key, (int, slice)) else self._lookup[key]

    def __iter__(self) -> Iterator[str]:
        return iter(self._lookup)

    def __len__(self) -> int:
        return len(self._lookup)


def _call(operation, *args):
    try:
        return operation(*args)
    except Exception as exc:
        # libSQL currently reports SQL errors as ValueError/Error instead of
        # sqlite3 subclasses. Never put credentials/network responses in logs.
        message = str(exc).lower()
        if "constraint failed" in message or "sqlite_constraint" in message:
            raise sqlite3.IntegrityError("云数据库约束冲突。") from None
        raise sqlite3.OperationalError("云数据库操作失败，请检查连接及服务状态。") from None


class CloudCursor:
    def __init__(self, cursor):
        self._cursor = cursor

    @property
    def description(self):
        return self._cursor.description

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        return self._cursor.lastrowid

    def _row(self, values):
        return None if values is None else CloudRow([column[0] for column in self.description], values)

    def fetchone(self):
        return self._row(_call(self._cursor.fetchone))

    def fetchall(self):
        return [self._row(row) for row in _call(self._cursor.fetchall)]

    def __iter__(self):
        while (row := self.fetchone()) is not None:
            yield row


class CloudConnection:
    def __init__(self, connection):
        self._connection = connection

    @classmethod
    def open(cls, url: str, token: str):
        import libsql

        # Use named arguments so driver upgrades cannot alter auth placement.
        try:
            connection = libsql.connect(database=url, auth_token=token, timeout=10.0)
        except Exception:
            raise sqlite3.OperationalError("无法连接云数据库，请检查连接配置。") from None
        return cls(connection)

    def execute(self, sql: str, parameters=()):
        return CloudCursor(_call(self._connection.execute, sql, parameters))

    def executemany(self, sql: str, parameters):
        return CloudCursor(_call(self._connection.executemany, sql, parameters))

    def executescript(self, sql: str):
        return CloudCursor(_call(self._connection.executescript, sql))

    def commit(self):
        return _call(self._connection.commit)

    def rollback(self):
        return _call(self._connection.rollback)

    def close(self):
        return _call(self._connection.close)
