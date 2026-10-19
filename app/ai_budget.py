"""One persistent model-call budget shared by chat and legacy diagnosis.

The existing tutor table remains the ledger so deployment preserves today's
already-used quota. Diagnosis reservations have no response_json and therefore
never appear in (or get sent back as) tutor conversation history.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4


class AIBudgetDenied(RuntimeError):
    """A safe user-facing reason to use deterministic checks instead of AI."""


def reserve_model_call(database, settings, *, owner, thread_id, experiment_id,
                       session_id, message):
    turn_id = str(uuid4())
    now = datetime.now(timezone.utc)
    stamp, day = now.isoformat(), now.date().isoformat()
    # The lease outlives either configured request timeout. No network call is
    # made inside a database transaction; crashed workers eventually release it.
    lease = max(45.0, settings.llm_timeout_seconds + 15,
                settings.tutor_timeout_seconds + 15)
    pending_after = (now - timedelta(seconds=lease)).isoformat()
    cooldown_after = (now - timedelta(seconds=3)).isoformat()
    with database.connect() as con:
        # A single conditional write makes checking and reservation atomic on
        # SQLite/libSQL, including independent workers sharing the same DB.
        con.execute("""INSERT INTO lab_tutor_turns
            (turn_id,owner_id,thread_id,experiment_id,session_id,user_message,
             response_json,status,model_call,created_at)
            SELECT ?,?,?,?,?,?,NULL,'pending',1,?
            WHERE (SELECT COUNT(*) FROM lab_tutor_turns
                   WHERE model_call=1 AND created_at>=?) < ?
              AND (SELECT COUNT(*) FROM lab_tutor_turns
                   WHERE model_call=1 AND owner_id=? AND created_at>=?) < ?
              AND NOT EXISTS (SELECT 1 FROM lab_tutor_turns
                   WHERE model_call=1 AND owner_id=?
                     AND ((status='pending' AND created_at>=?) OR created_at>=?))""",
            (turn_id, owner, thread_id, experiment_id, session_id, message,
             stamp, day, settings.tutor_global_daily_limit,
             owner, day, settings.tutor_daily_limit,
             owner, pending_after, cooldown_after))
        accepted = con.execute("SELECT 1 FROM lab_tutor_turns WHERE turn_id=?",
                               (turn_id,)).fetchone()
        if not accepted:
            counts = con.execute("""SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN owner_id=? THEN 1 ELSE 0 END),0) AS own
                FROM lab_tutor_turns WHERE model_call=1 AND created_at>=?""",
                (owner, day)).fetchone()
            if (counts["total"] >= settings.tutor_global_daily_limit or
                    counts["own"] >= settings.tutor_daily_limit):
                raise AIBudgetDenied("今天的 AI 额度已用完；已保留规则检查，实验资料和数据录入仍可使用。")
            raise AIBudgetDenied("上一条 AI 请求正在处理，或刚刚完成；已保留规则检查，请稍后再试。")
    return turn_id


def finish_model_call(database, turn_id, owner, *, failed=False):
    """Settle the pending lease even when the model call or its parsing fails."""
    with database.connect() as con:
        con.execute("UPDATE lab_tutor_turns SET status=? WHERE turn_id=? AND owner_id=?",
                    ("failed" if failed else "done", turn_id, owner))
