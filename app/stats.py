"""教师端班级聚合统计（MS-3）。

只读查询 SQLite，三张真实表：
  sessions(session_id, student_id, experiment_id, course_id, created_at)
  attempts(attempt_id, session_id, attempt_number, status, hint_level,
           issue_type, request_json, response_json, created_at)
  outcomes(outcome_id, attempt_id UNIQUE, result, student_revision,
           final_result, self_check_notes, recorded_at)

attempts.status ∈ needs_more_evidence / teaching_intervention / completed
attempts.issue_type ∈ data_error / calculation_error / concept_misunderstanding
                     / mixed / no_error / insufficient_evidence
outcomes.result ∈ corrected / partially_corrected / unchanged / abandoned

路由通过 ``create_stats_router`` 工厂注入数据库路径，保证与应用 Settings
使用同一个库，且测试可传入临时库。
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

# 需要纳入「高频错误」统计的异常类别（no_error / insufficient_evidence 不算错误）
ERROR_TYPES = (
    "data_error",
    "calculation_error",
    "concept_misunderstanding",
    "mixed",
)

# 历史/别名归一到标准四类，保证前端与统计口径稳定
ISSUE_ALIAS = {
    "outlier": "data_error",
    "missing": "data_error",
    "noise": "data_error",
    "drift": "data_error",
    "unit_error": "calculation_error",
}

ISSUE_LABELS_ZH = {
    "data_error": "数据采集/录入问题",
    "calculation_error": "计算/公式使用错误",
    "concept_misunderstanding": "概念理解偏差",
    "mixed": "多因素混合问题",
}


def create_stats_router(database_path: Path | str) -> APIRouter:
    database_path = Path(database_path)
    router = APIRouter(prefix="/api/v1/stats", tags=["teacher-stats"])

    def _connect() -> sqlite3.Connection:
        if not database_path.exists():
            raise HTTPException(status_code=503, detail="统计数据库尚未初始化")
        connection = sqlite3.connect(database_path, timeout=10.0)
        connection.row_factory = sqlite3.Row
        return connection

    @router.get("/class-summary")
    def class_summary(
        experiment_id: str | None = Query(default=None, description="按实验过滤；不传则全班全部实验"),
        course_id: str | None = Query(default=None, description="按课程/班级过滤"),
    ) -> dict[str, Any]:
        """班级整体完成情况：会话数、完成率、平均尝试次数、尝试状态分布、平均提示等级。"""
        where_sessions: list[str] = []
        params: list[Any] = []
        if experiment_id is not None:
            where_sessions.append("s.experiment_id = ?")
            params.append(experiment_id)
        if course_id is not None:
            where_sessions.append("s.course_id = ?")
            params.append(course_id)
        where_sql = ("WHERE " + " AND ".join(where_sessions)) if where_sessions else ""

        connection = _connect()
        try:
            # 会话级聚合：每个会话的尝试数、是否完成、最大提示等级
            per_session = connection.execute(
                f"""
                SELECT
                    s.session_id AS sid,
                    COUNT(a.attempt_id) AS n_attempts,
                    MAX(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS is_completed,
                    COALESCE(MAX(a.hint_level), 0) AS max_hint
                FROM sessions s
                LEFT JOIN attempts a ON a.session_id = s.session_id
                {where_sql}
                GROUP BY s.session_id
                """,
                params,
            ).fetchall()

            # 尝试状态分布（仅统计范围内会话）
            status_rows = connection.execute(
                f"""
                SELECT a.status AS status, COUNT(*) AS cnt
                FROM attempts a
                JOIN sessions s ON s.session_id = a.session_id
                {where_sql}
                GROUP BY a.status
                """,
                params,
            ).fetchall()
        finally:
            connection.close()

        total_sessions = len(per_session)
        completed_sessions = sum(row["is_completed"] or 0 for row in per_session)
        total_attempts = sum(row["n_attempts"] or 0 for row in per_session)
        avg_attempts = round(total_attempts / total_sessions, 2) if total_sessions else 0.0
        avg_max_hint = (
            round(sum(row["max_hint"] or 0 for row in per_session) / total_sessions, 2)
            if total_sessions
            else 0.0
        )

        status_distribution = {
            "completed": 0,
            "needs_more_evidence": 0,
            "teaching_intervention": 0,
        }
        for row in status_rows:
            status_distribution[row["status"]] = row["cnt"]

        return {
            "scope": {
                "experiment_id": experiment_id,
                "course_id": course_id,
            },
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "completion_rate": round(completed_sessions / total_sessions, 4) if total_sessions else 0.0,
            "total_attempts": total_attempts,
            "average_attempts_per_session": avg_attempts,
            "average_max_hint_level": avg_max_hint,
            "attempt_status_distribution": status_distribution,
        }

    @router.get("/first-attempt-success")
    def first_attempt_success(
        experiment_id: str | None = Query(default=None, description="按实验过滤；不传则全部实验"),
        course_id: str | None = Query(default=None, description="按课程/班级过滤"),
    ) -> dict[str, Any]:
        """一次做对率（FAS）：首次提交即完成，且无提示、无异常、且无需二次尝试。"""
        where_sessions: list[str] = []
        params: list[Any] = []
        if experiment_id is not None:
            where_sessions.append("s.experiment_id = ?")
            params.append(experiment_id)
        if course_id is not None:
            where_sessions.append("s.course_id = ?")
            params.append(course_id)
        where_sql = ("WHERE " + " AND ".join(where_sessions)) if where_sessions else ""

        connection = _connect()
        try:
            # 每个会话的首条尝试 + 该会话尝试总数
            rows = connection.execute(
                f"""
                SELECT
                    s.session_id AS sid,
                    (
                        SELECT a1.status
                        FROM attempts a1
                        WHERE a1.session_id = s.session_id
                        ORDER BY a1.attempt_number ASC, a1.created_at ASC
                        LIMIT 1
                    ) AS first_status,
                    (
                        SELECT COALESCE(a2.hint_level, 0)
                        FROM attempts a2
                        WHERE a2.session_id = s.session_id
                        ORDER BY a2.attempt_number ASC, a2.created_at ASC
                        LIMIT 1
                    ) AS first_hint,
                    (
                        SELECT COALESCE(a3.issue_type, 'no_error')
                        FROM attempts a3
                        WHERE a3.session_id = s.session_id
                        ORDER BY a3.attempt_number ASC, a3.created_at ASC
                        LIMIT 1
                    ) AS first_issue,
                    (SELECT COUNT(*) FROM attempts a4 WHERE a4.session_id = s.session_id) AS n_attempts
                FROM sessions s
                {where_sql}
                """,
                params,
            ).fetchall()
        finally:
            connection.close()

        total = len(rows)
        breakdown = {
            "first_completed": 0,
            "no_hint": 0,
            "no_issue": 0,
            "single_attempt": 0,
        }
        success = 0
        for row in rows:
            cond_completed = row["first_status"] == "completed"
            cond_no_hint = (row["first_hint"] or 0) <= 0
            cond_no_issue = (row["first_issue"] or "no_error") in ("no_error", "")
            cond_single = (row["n_attempts"] or 0) <= 1
            breakdown["first_completed"] += int(cond_completed)
            breakdown["no_hint"] += int(cond_no_hint)
            breakdown["no_issue"] += int(cond_no_issue)
            breakdown["single_attempt"] += int(cond_single)
            if cond_completed and cond_no_hint and cond_no_issue and cond_single:
                success += 1

        return {
            "scope": {"experiment_id": experiment_id, "course_id": course_id},
            "total_sessions": total,
            "first_attempt_success_count": success,
            "first_attempt_success_rate": round(success / total, 4) if total else 0.0,
            # 分步满足数，便于教师定位是「要提示」还是「做错」拉低了一次成功率
            "condition_breakdown": breakdown,
        }

    @router.get("/common-errors")
    def common_errors(
        experiment_id: str | None = Query(default=None, description="按实验过滤；不传则全部实验"),
        course_id: str | None = Query(default=None, description="按课程/班级过滤"),
    ) -> dict[str, Any]:
        """高频错误分布与各类纠错成功率（关联 outcomes.result）。"""
        where_sessions = ["a.issue_type IS NOT NULL", "a.issue_type != ''",
                          "a.issue_type != 'no_error'", "a.issue_type != 'insufficient_evidence'"]
        params: list[Any] = []
        if experiment_id is not None:
            where_sessions.append("s.experiment_id = ?")
            params.append(experiment_id)
        if course_id is not None:
            where_sessions.append("s.course_id = ?")
            params.append(course_id)
        where_sql = "WHERE " + " AND ".join(where_sessions)

        # 归一化表达式：把历史/别名标签映射到标准四类
        alias_case = " ".join(
            f"WHEN '{alias}' THEN '{canonical}'" for alias, canonical in ISSUE_ALIAS.items()
        )
        norm_expr = f"CASE a.issue_type {alias_case} ELSE a.issue_type END"

        connection = _connect()
        try:
            rows = connection.execute(
                f"""
                SELECT
                    a.issue_type AS raw_issue,
                    {norm_expr} AS canonical_issue,
                    s.experiment_id AS experiment_id,
                    COUNT(*) AS occurrences,
                    COUNT(DISTINCT a.session_id) AS affected_sessions,
                    SUM(CASE WHEN o.result = 'corrected' THEN 1 ELSE 0 END) AS corrected,
                    SUM(CASE WHEN o.result = 'partially_corrected' THEN 1 ELSE 0 END) AS partially,
                    SUM(CASE WHEN o.result = 'unchanged' THEN 1 ELSE 0 END) AS unchanged,
                    SUM(CASE WHEN o.result = 'abandoned' THEN 1 ELSE 0 END) AS abandoned,
                    SUM(CASE WHEN o.result IS NULL THEN 1 ELSE 0 END) AS no_outcome
                FROM attempts a
                JOIN sessions s ON s.session_id = a.session_id
                LEFT JOIN outcomes o ON o.attempt_id = a.attempt_id
                {where_sql}
                GROUP BY canonical_issue, s.experiment_id
                ORDER BY occurrences DESC
                """,
                params,
            ).fetchall()

            # 跨实验去重的「受影响会话数」，按归一化类别统计
            scope_filters = []
            scope_params: list[Any] = []
            if experiment_id is not None:
                scope_filters.append("s.experiment_id = ?")
                scope_params.append(experiment_id)
            if course_id is not None:
                scope_filters.append("s.course_id = ?")
                scope_params.append(course_id)
            scope_sql = ("AND " + " AND ".join(scope_filters)) if scope_filters else ""
            session_rows = connection.execute(
                f"""
                SELECT {norm_expr} AS canonical_issue,
                       COUNT(DISTINCT a.session_id) AS sessions_cnt
                FROM attempts a
                JOIN sessions s ON s.session_id = a.session_id
                WHERE a.issue_type IS NOT NULL AND a.issue_type != ''
                  AND a.issue_type != 'no_error' AND a.issue_type != 'insufficient_evidence'
                  {scope_sql}
                GROUP BY canonical_issue
                """,
                scope_params,
            ).fetchall()
        finally:
            connection.close()

        session_map = {r["canonical_issue"]: r["sessions_cnt"] for r in session_rows}

        merged: dict[str, dict[str, Any]] = {}
        details: list[dict[str, Any]] = []
        for row in rows:
            raw = row["raw_issue"]
            canonical = row["canonical_issue"]
            if canonical not in ERROR_TYPES:
                canonical = "mixed"
            occurrences = row["occurrences"] or 0
            corrected = row["corrected"] or 0
            partially = row["partially"] or 0
            unchanged = row["unchanged"] or 0
            abandoned = row["abandoned"] or 0
            no_outcome = row["no_outcome"] or 0
            reviewed = corrected + partially + unchanged + abandoned

            bucket = merged.setdefault(
                canonical,
                {
                    "issue_type": canonical,
                    "label_zh": ISSUE_LABELS_ZH.get(canonical, canonical),
                    "occurrences": 0,
                    "corrected": 0,
                    "partially_corrected": 0,
                    "unchanged": 0,
                    "abandoned": 0,
                    "no_outcome": 0,
                },
            )
            bucket["occurrences"] += occurrences
            bucket["corrected"] += corrected
            bucket["partially_corrected"] += partially
            bucket["unchanged"] += unchanged
            bucket["abandoned"] += abandoned
            bucket["no_outcome"] += no_outcome

            details.append(
                {
                    "experiment_id": row["experiment_id"],
                    "issue_type": canonical,
                    "raw_issue_type": raw,
                    "label_zh": ISSUE_LABELS_ZH.get(canonical, canonical),
                    "occurrences": occurrences,
                    "affected_sessions": row["affected_sessions"] or 0,
                    "correction": {
                        "corrected": corrected,
                        "partially_corrected": partially,
                        "unchanged": unchanged,
                        "abandoned": abandoned,
                        "no_outcome": no_outcome,
                        "correction_rate": round(corrected / reviewed, 4) if reviewed else None,
                    },
                }
            )

        distribution = []
        for canonical, bucket in merged.items():
            reviewed = (
                bucket["corrected"] + bucket["partially_corrected"]
                + bucket["unchanged"] + bucket["abandoned"]
            )
            distribution.append(
                {
                    "issue_type": canonical,
                    "label_zh": bucket["label_zh"],
                    "occurrences": bucket["occurrences"],
                    "affected_sessions": session_map.get(canonical, 0),
                    "corrected": bucket["corrected"],
                    "partially_corrected": bucket["partially_corrected"],
                    "unchanged": bucket["unchanged"],
                    "abandoned": bucket["abandoned"],
                    "no_outcome": bucket["no_outcome"],
                    "correction_rate": round(bucket["corrected"] / reviewed, 4) if reviewed else None,
                }
            )
        distribution.sort(key=lambda item: item["occurrences"], reverse=True)

        total_errors = sum(item["occurrences"] for item in distribution)
        return {
            "scope": {"experiment_id": experiment_id, "course_id": course_id},
            "total_error_attempts": total_errors,
            "distribution": distribution,
            "by_experiment": details,
        }

    return router
