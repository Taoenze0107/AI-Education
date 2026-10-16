"""Owner-scoped low-stakes checks and scheduled revision for interactive lab lessons.

Answers stay on the server. These checks are learning prompts, never formal grades.
"""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import Field

from app.database import Database
from app.models import StrictModel

COURSE_PATH = Path(__file__).resolve().parent / "data" / "learning_courses.json"
MAX_BODY_BYTES = 4096
LIMIT_PER_MINUTE = 30
LIMIT_PER_DAY = 200
SCHEMA = """
CREATE TABLE IF NOT EXISTS lab_learning_answers (
 answer_id INTEGER PRIMARY KEY AUTOINCREMENT,
 owner_id TEXT NOT NULL,
 experiment_id TEXT NOT NULL,
 node_id TEXT NOT NULL,
 choice_id TEXT NOT NULL,
 correct INTEGER NOT NULL CHECK(correct IN (0,1)),
 assisted INTEGER NOT NULL CHECK(assisted IN (0,1)),
 cycle_number INTEGER NOT NULL,
 cycle_attempt_count INTEGER NOT NULL,
 answered_at TEXT NOT NULL,
 due_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lab_learning_owner_node
 ON lab_learning_answers(owner_id,experiment_id,node_id,answer_id);
CREATE INDEX IF NOT EXISTS idx_lab_learning_owner_time
 ON lab_learning_answers(owner_id,answered_at);
"""


def now() -> datetime:
    return datetime.now(timezone.utc)


class LearningAnswer(StrictModel):
    node_id: str = Field(min_length=1, max_length=32, pattern=r"^[a-z][a-z0-9_]*$")
    choice_id: str = Field(min_length=1, max_length=16, pattern=r"^[a-z][a-z0-9_]*$")


class LearningService:
    def __init__(self, db: Database, classroom):
        self.db, self.classroom = db, classroom
        self.courses = json.loads(COURSE_PATH.read_text(encoding="utf-8"))["courses"]
        self.by_id = {course["experiment_id"]: course for course in self.courses}
        self.rate_lock = threading.Lock()
        self.hits: dict[str, list[float]] = {}
        with self.db.connect() as con:
            con.executescript(SCHEMA)

    def course(self, experiment_id: str) -> dict:
        if experiment_id not in self.by_id:
            raise HTTPException(404, "这项实验暂未开设交互课程。")
        return self.by_id[experiment_id]

    def throttle(self, owner: str) -> None:
        stamp = time.monotonic()
        with self.rate_lock:
            self.hits = {key: [t for t in value if stamp - t < 60]
                         for key, value in self.hits.items()
                         if value and stamp - value[-1] < 60}
            recent = self.hits.setdefault(owner, [])
            if len(recent) >= LIMIT_PER_MINUTE:
                raise HTTPException(429, "答题较频繁，请稍等一分钟再试。", headers={"Retry-After": "60"})
            recent.append(stamp)

    @staticmethod
    def progress_row(row, stamp: datetime) -> dict:
        due_at = datetime.fromisoformat(row["due_at"])
        correct = bool(row["correct"])
        status = "needs_retry" if not correct else "review_due" if due_at <= stamp else "scheduled"
        return dict(node_id=row["node_id"], last_correct=correct,
                    assisted=bool(row["assisted"]), attempt_count=row["attempt_count"],
                    cycle_attempt_count=row["cycle_attempt_count"],
                    status=status, due_at=row["due_at"], can_answer=status != "scheduled")

    def progress(self, owner: str, experiment_id: str | None = None, *, include_history: bool = False) -> list[dict]:
        query = """SELECT a.*, counts.attempt_count FROM lab_learning_answers a
          JOIN (SELECT experiment_id,node_id,MAX(answer_id) AS latest_id,COUNT(*) AS attempt_count
          FROM lab_learning_answers WHERE owner_id=? GROUP BY experiment_id,node_id) counts
          ON a.answer_id=counts.latest_id"""
        params = [owner]
        if experiment_id is not None:
            query += " WHERE a.experiment_id=?"
            params.append(experiment_id)
        stamp = now()
        result = []
        with self.db.connect() as con:
            rows = con.execute(query, params).fetchall()
            for row in rows:
                item = dict(experiment_id=row["experiment_id"], **self.progress_row(row, stamp))
                if include_history:
                    course = self.by_id.get(row["experiment_id"], {})
                    node = next((node for node in course.get("nodes", []) if node["id"] == row["node_id"]), {})
                    new_review = item["status"] == "review_due"
                    # A due review starts with no preselected solution or past correct choice.
                    # The full immutable choice history remains stored in SQL.
                    attempts = [] if new_review else con.execute("""SELECT choice_id,correct,assisted,answered_at
                      FROM lab_learning_answers WHERE owner_id=? AND experiment_id=? AND node_id=? AND cycle_number=?
                      ORDER BY answer_id DESC LIMIT 8""", (owner, row["experiment_id"], row["node_id"], row["cycle_number"])).fetchall()
                    item.update(last_choice_id=None if new_review else row["choice_id"],
                                explanation=node.get("explanation") if item["status"] == "scheduled" else None,
                                attempts=[dict(choice_id=attempt["choice_id"], correct=bool(attempt["correct"]),
                                               assisted=bool(attempt["assisted"]), answered_at=attempt["answered_at"])
                                          for attempt in reversed(attempts)],
                                total=0 if new_review else row["cycle_attempt_count"],
                                truncated=False if new_review else row["cycle_attempt_count"] > 8)
                result.append(item)
        return result

    def course_view(self, owner: str, experiment_id: str) -> dict:
        course = self.course(experiment_id)
        # Enumerate public fields rather than trying to remove answer fields later.
        nodes = [dict(id=node["id"], stage=node["stage"], question=node["question"],
                      choices=node["choices"], tag=node["tag"]) for node in course["nodes"]]
        return dict(experiment_id=experiment_id, title=course["title"], summary=course["summary"],
                    nodes=nodes, progress=self.progress(owner, experiment_id, include_history=True))

    def answer(self, owner: str, experiment_id: str, payload: LearningAnswer) -> dict:
        self.throttle(owner)
        course = self.course(experiment_id)
        node = next((node for node in course["nodes"] if node["id"] == payload.node_id), None)
        if node is None:
            raise HTTPException(404, "找不到这道课程自检。")
        if payload.choice_id not in {choice["id"] for choice in node["choices"]}:
            raise HTTPException(422, "请选择本题提供的一个选项。")
        stamp = now().astimezone(timezone.utc)
        start = stamp.replace(hour=0, minute=0, second=0, microsecond=0)
        with self.db.connect() as con:
            # Serialize read/update on both SQLite and the configured Turso primary.
            con.execute("BEGIN IMMEDIATE")
            previous = con.execute("""SELECT * FROM lab_learning_answers
              WHERE owner_id=? AND experiment_id=? AND node_id=? ORDER BY answer_id DESC LIMIT 1""",
              (owner, experiment_id, payload.node_id)).fetchone()
            if previous and previous["correct"] and datetime.fromisoformat(previous["due_at"]) > stamp:
                raise HTTPException(409, "这道自检已完成，已安排复习；到期后可再次作答。")
            daily = con.execute("SELECT COUNT(*) FROM lab_learning_answers WHERE owner_id=? AND answered_at>=? AND answered_at<?",
                                (owner, start.isoformat(), (start + timedelta(days=1)).isoformat())).fetchone()[0]
            if daily >= LIMIT_PER_DAY:
                remaining = max(1, int(((start + timedelta(days=1)) - stamp).total_seconds()))
                raise HTTPException(429, "今天的自检次数已用完，请明天再试（按 UTC 日期重置）。",
                                    headers={"Retry-After": str(remaining)})
            count = con.execute("SELECT COUNT(*) FROM lab_learning_answers WHERE owner_id=? AND experiment_id=? AND node_id=?",
                                (owner, experiment_id, payload.node_id)).fetchone()[0] + 1
            new_cycle = previous is None or bool(previous["correct"])
            # A globally unique cycle number preserves distinct guest/account rounds
            # when same-browser guest work is claimed at login.
            cycle = con.execute("SELECT COALESCE(MAX(answer_id),0)+1 FROM lab_learning_answers").fetchone()[0] if new_cycle else previous["cycle_number"]
            cycle_count = 1 if new_cycle else previous["cycle_attempt_count"] + 1
            correct = payload.choice_id == node["correct_choice_id"]
            # A later independent review can be unassisted; a quick retry after hints cannot.
            assisted = cycle_count > 1
            due = stamp + timedelta(days=1 if assisted else 3) if correct else stamp
            con.execute("""INSERT INTO lab_learning_answers
              (owner_id,experiment_id,node_id,choice_id,correct,assisted,cycle_number,
               cycle_attempt_count,answered_at,due_at) VALUES (?,?,?,?,?,?,?,?,?,?)""",
              (owner, experiment_id, payload.node_id, payload.choice_id, int(correct), int(assisted),
               cycle, cycle_count, stamp.isoformat(), due.isoformat()))
        hint = None if correct else node["hints"][min(cycle_count - 1, len(node["hints"]) - 1)]
        return dict(node_id=payload.node_id, correct=correct,
                    feedback=("已完成本题；这是课程自检，不计正式成绩。" if correct else "还需要再想一步。请根据提示重新选择。"),
                    hint=hint, explanation=node["explanation"] if correct else None,
                    attempt_count=count, cycle_attempt_count=cycle_count, assisted=assisted,
                    due_at=due.isoformat(), status="scheduled" if correct else "needs_retry")

    def review(self, owner: str) -> dict:
        items = []
        for progress in self.progress(owner):
            course = self.by_id.get(progress["experiment_id"])
            if course is None:
                continue
            node = next((node for node in course["nodes"] if node["id"] == progress["node_id"]), None)
            if node is None:
                continue
            items.append(dict(title=course["title"], question=node["question"], tag=node["tag"], **progress))
        priority = {"needs_retry": 0, "review_due": 1, "scheduled": 2}
        items.sort(key=lambda item: (priority[item["status"]], item["due_at"], item["experiment_id"], item["node_id"]))
        summary = {status: sum(item["status"] == status for item in items) for status in priority}
        summary["total"] = len(items)
        return dict(items=items, summary=summary)


def install_learning(app: FastAPI, db: Database, classroom) -> LearningService:
    service = LearningService(db, classroom)
    app.state.learning = service
    router = APIRouter(prefix="/api/v1/learning", tags=["交互实验与复习"])

    @app.middleware("http")
    async def limit_learning_body(req: Request, call_next):
        if req.url.path.startswith("/api/v1/learning/") and req.method not in ("GET", "HEAD", "OPTIONS"):
            try:
                declared = int(req.headers.get("content-length", "0"))
            except ValueError:
                return JSONResponse({"detail": "请求长度无效。"}, status_code=400)
            if declared < 0:
                return JSONResponse({"detail": "请求长度无效。"}, status_code=400)
            if declared > MAX_BODY_BYTES:
                return JSONResponse({"detail": "自检请求过大，请只提交题目与选项。"}, status_code=413)
            chunks, size = [], 0
            async for chunk in req.stream():
                size += len(chunk)
                if size > MAX_BODY_BYTES:
                    return JSONResponse({"detail": "自检请求过大，请只提交题目与选项。"}, status_code=413)
                chunks.append(chunk)
            req._body = b"".join(chunks)
        return await call_next(req)

    @router.get("/courses")
    def courses():
        return {"courses": [{key: course[key] for key in ("experiment_id", "title", "summary")}
                            for course in service.courses]}

    @router.get("/courses/{experiment_id}")
    def course(experiment_id: str, req: Request):
        return service.course_view(req.state.lab_actor["owner_id"], experiment_id)

    @router.post("/courses/{experiment_id}/answers")
    def answer(experiment_id: str, payload: LearningAnswer, req: Request):
        return service.answer(req.state.lab_actor["owner_id"], experiment_id, payload)

    @router.get("/review")
    def review(req: Request):
        return service.review(req.state.lab_actor["owner_id"])

    app.include_router(router)
    return service
