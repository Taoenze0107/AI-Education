from __future__ import annotations

import math
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.anomaly_detector import AnomalyDetector
from app.anomaly_import import parse_tabular_upload
from app.material_parser import analyze_ohms_law_material
from app.database import Database
from app.evidence import EvidenceAnalyzer
from app.knowledge import KnowledgeBase, KnowledgeDocument
from app.llm import LLMClient
from app.models import (
    AttemptCreate,
    AttemptResponse,
    AnomalyAnalyzeRequest,
    AnomalyAnalysisResponse,
    AnomalyImportRequest,
    AnomalyImportResponse,
    MaterialAnalyzeRequest,
    MaterialAnalysisResponse,
    HealthResponse,
    KnowledgeMatch,
    OutcomeCreate,
    OutcomeRecorded,
    SessionCreate,
    SessionCreated,
    SessionList,
)
from app.repository import ConflictError, NotFoundError, Repository
from app.service import DiagnosticService
from app.classroom import install_classroom
from app.catalog_routes import create_catalog_router
from app.teaching import TeachingPolicy
from app.tutor import TutorService, create_tutor_router
from app.learning import install_learning


STATIC_DIRECTORY = Path(__file__).resolve().parent / "static"
STATIC_INDEX = STATIC_DIRECTORY / "index.html"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    database = Database(
        settings.database_path,
        remote_url=settings.turso_database_url,
        auth_token=settings.turso_auth_token,
        require_persistent=settings.require_persistent_database,
    )
    database.initialize()
    repository = Repository(database)
    knowledge_base = KnowledgeBase(settings.knowledge_base_path)
    llm_client = LLMClient(settings)
    service = DiagnosticService(
        repository=repository,
        evidence_analyzer=EvidenceAnalyzer(),
        knowledge_base=knowledge_base,
        llm_client=llm_client,
        teaching_policy=TeachingPolicy(),
    )
    anomaly_detector = AnomalyDetector()

    app = FastAPI(
        title="AT 大模型诊断与自适应教学 API",
        description=(
            "三路诊断证据汇总、实验知识检索、知识盲区识别、"
            "证据充分性判断、分级提示与修改过程记录。"
        ),
        version="1.2.0",
    )
    app.state.settings = settings
    app.state.repository = repository
    app.state.knowledge_base = knowledge_base
    app.state.llm_client = llm_client
    app.state.service = service
    app.state.anomaly_detector = anomaly_detector
    app.mount("/static", StaticFiles(directory=STATIC_DIRECTORY), name="static")

    classroom = install_classroom(app, database, repository, STATIC_DIRECTORY)
    tutor = TutorService(settings, database, classroom, knowledge_base)
    app.state.tutor = tutor
    app.include_router(create_tutor_router(tutor))
    install_learning(app, database, classroom)
    app.include_router(create_catalog_router(STATIC_INDEX))

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_request, exc: RequestValidationError) -> JSONResponse:
        # The JSON parser accepts NaN/Infinity; report those rejected values safely.
        detail = jsonable_encoder(
            exc.errors(),
            custom_encoder={float: lambda value: value if math.isfinite(value) else str(value)},
        )
        return JSONResponse(status_code=422, content={"detail": detail})

    @app.get("/experiment", include_in_schema=False)
    @app.get("/data", include_in_schema=False)
    @app.get("/review", include_in_schema=False)
    @app.get("/observations", include_in_schema=False)
    @app.get("/checks", include_in_schema=False)
    @app.get("/calculation", include_in_schema=False)
    @app.get("/diagnosis", include_in_schema=False)
    @app.get("/revision", include_in_schema=False)
    @app.get("/history", include_in_schema=False)
    @app.get("/library", include_in_schema=False)
    @app.get("/help", include_in_schema=False)
    @app.get("/", include_in_schema=False)
    def home() -> FileResponse:
        return FileResponse(STATIC_INDEX)

    @app.get("/api/v1/health", response_model=HealthResponse, tags=["系统"])
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            llm_configured=llm_client.configured,
            llm_enabled=settings.enable_llm,
            model=settings.openai_model,
            knowledge_documents=len(knowledge_base.documents),
        )

    @app.post(
        "/api/v1/anomaly/analyze",
        response_model=AnomalyAnalysisResponse,
        tags=["数据异常检测"],
    )
    def analyze_anomaly(payload: AnomalyAnalyzeRequest) -> AnomalyAnalysisResponse:
        try:
            return anomaly_detector.analyze(
                payload.experiment_id, payload.raw_measurements, payload.metadata
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post(
        "/api/v1/anomaly/import",
        response_model=AnomalyImportResponse,
        tags=["数据异常检测"],
    )
    def import_anomaly_data(payload: AnomalyImportRequest) -> AnomalyImportResponse:
        try:
            return AnomalyImportResponse(
                runs=parse_tabular_upload(payload.filename, payload.content_base64)
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post(
        "/api/v1/materials/analyze",
        response_model=MaterialAnalysisResponse,
        tags=["实验材料解析"],
    )
    def analyze_material(payload: MaterialAnalyzeRequest) -> MaterialAnalysisResponse:
        """Run PC and AD evidence generation on one uploaded Ohm's-law run."""

        try:
            runs = parse_tabular_upload(payload.filename, payload.content_base64)
            if not runs:
                raise ValueError("文件中没有可分析的实验组。")
            selected = next((run for run in runs if run["run_id"] == payload.run_id), None)
            if payload.run_id and selected is None:
                raise ValueError(f"未找到实验组“{payload.run_id}”。")
            selected = selected or runs[0]
            if len(selected["voltage_V"]) < 2:
                raise ValueError("每个实验组至少需要两组电压、电流数据。")
            anomaly = anomaly_detector.analyze(
                "ohms_law",
                {"voltage_V": selected["voltage_V"], "current_mA": selected["current_mA"]},
                selected["metadata"],
            )
            consistency, mathematics, charts = analyze_ohms_law_material(
                selected["voltage_V"],
                selected["current_mA"],
                selected["metadata"],
                payload.student_result,
                payload.tolerance_percent,
            )
            return MaterialAnalysisResponse(
                run_id=selected["run_id"],
                anomaly=anomaly,
                consistency=consistency,
                mathematics=mathematics,
                charts=charts,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.post(
        "/api/v1/sessions",
        response_model=SessionCreated,
        status_code=status.HTTP_201_CREATED,
        tags=["诊断流程"],
    )
    def create_session(payload: SessionCreate, request: Request) -> SessionCreated:
        record = repository.create_session(payload)
        classroom.bind_session(request, record.session_id)
        return record

    @app.get("/api/v1/sessions", response_model=SessionList, tags=["诊断流程"])
    def list_sessions(
        request: Request,
        student_id: str | None = Query(default=None, min_length=1, max_length=100),
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0),
    ) -> SessionList:
        return repository.list_sessions(student_id=student_id, limit=limit, offset=offset, owner_id=request.state.lab_actor['owner_id'])

    @app.post(
        "/api/v1/sessions/{session_id}/attempts",
        response_model=AttemptResponse,
        status_code=status.HTTP_201_CREATED,
        tags=["诊断流程"],
    )
    def create_attempt(session_id: str, payload: AttemptCreate, request: Request) -> AttemptResponse:
        try:
            classroom.own_session(request, session_id)
            return service.process_attempt(session_id, payload,
                model_guard=lambda: tutor.legacy_model_guard(request, session_id))
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post(
        "/api/v1/attempts/{attempt_id}/outcome",
        response_model=OutcomeRecorded,
        status_code=status.HTTP_201_CREATED,
        tags=["诊断流程"],
    )
    def record_outcome(
        attempt_id: str, payload: OutcomeCreate, request: Request
    ) -> OutcomeRecorded:
        try:
            with database.connect() as con:
                row = con.execute('SELECT session_id FROM attempts WHERE attempt_id=?', (attempt_id,)).fetchone()
            if not row:
                raise HTTPException(404, '找不到这轮诊断。')
            classroom.own_session(request, row['session_id'])
            return repository.record_outcome(attempt_id, payload)
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ConflictError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @app.get(
        "/api/v1/sessions/{session_id}/history",
        response_model=dict,
        tags=["诊断流程"],
    )
    def get_history(session_id: str, request: Request) -> dict[str, object]:
        try:
            classroom.own_session(request, session_id)
            return repository.session_history(session_id)
        except NotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.get(
        "/api/v1/knowledge/documents",
        response_model=list[KnowledgeDocument],
        tags=["知识库"],
    )
    def list_knowledge_documents(
        experiment_id: str | None = Query(default=None, min_length=1, max_length=100),
    ) -> list[KnowledgeDocument]:
        return knowledge_base.list_documents(experiment_id)

    @app.get(
        "/api/v1/knowledge/search",
        response_model=list[KnowledgeMatch],
        tags=["知识库"],
    )
    def search_knowledge(
        q: str = Query(min_length=1),
        experiment_id: str = Query(default="generic"),
        top_k: int = Query(default=3, ge=1, le=10),
    ) -> list[KnowledgeMatch]:
        return knowledge_base.search(q, experiment_id, top_k)

    @app.post("/api/v1/knowledge/reload", tags=["知识库"])
    def reload_knowledge() -> dict[str, int | str]:
        try:
            count = knowledge_base.reload()
        except (OSError, ValueError) as exc:
            raise HTTPException(
                status_code=422, detail=f"知识库加载失败：{exc}"
            ) from exc
        return {"status": "ok", "document_count": count}

    return app


app = create_app()
