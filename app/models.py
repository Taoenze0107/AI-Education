from __future__ import annotations

from datetime import datetime
from enum import Enum, IntEnum
import math
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class IssueType(str, Enum):
    DATA_ERROR = "data_error"
    CALCULATION_ERROR = "calculation_error"
    CONCEPT_MISUNDERSTANDING = "concept_misunderstanding"
    MIXED = "mixed"
    NO_ERROR = "no_error"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class HintLevel(IntEnum):
    MODULE_LOCATION = 1
    SOCRATIC_QUESTION = 2
    CONCRETE_CHECK = 3
    FULL_EXPLANATION = 4


class AttemptStatus(str, Enum):
    NEEDS_MORE_EVIDENCE = "needs_more_evidence"
    TEACHING_INTERVENTION = "teaching_intervention"
    COMPLETED = "completed"


class AnomalyEvidence(StrictModel):
    status: Literal["normal", "anomalous", "uncertain"]
    predicted_issue: IssueType | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    observed_features: list[str] = Field(default_factory=list)
    summary: str | None = None
    model_version: str | None = None


class AnomalyLocation(StrictModel):
    channel: str = Field(min_length=1)
    point_index: int | None = Field(default=None, ge=1)
    value: float | None = None
    reason: str = Field(min_length=1)


class AnomalyDetails(StrictModel):
    anomaly_type: Literal[
        "normal", "outlier", "missing", "noise", "drift", "unit_error", "mixed", "uncertain"
    ]
    anomaly_score: float = Field(ge=0.0, le=1.0)
    locations: list[AnomalyLocation] = Field(default_factory=list)
    diagnostic_basis: list[str] = Field(default_factory=list)
    features: dict[str, float] = Field(default_factory=dict)


class AnomalyAnalyzeRequest(StrictModel):
    experiment_id: str = Field(min_length=1, max_length=100)
    raw_measurements: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("raw_measurements", "metadata")
    @classmethod
    def reject_nonfinite_nested_values(cls, value: dict[str, Any]) -> dict[str, Any]:
        def validate(item: Any) -> None:
            if isinstance(item, float) and not math.isfinite(item):
                raise ValueError("数值必须是有限数（不能为 NaN 或 Infinity）。")
            if isinstance(item, dict):
                for child in item.values():
                    validate(child)
            elif isinstance(item, list):
                for child in item:
                    validate(child)

        validate(value)
        return value


class AnomalyAnalysisResponse(StrictModel):
    anomaly: AnomalyEvidence
    details: AnomalyDetails


class AnomalyImportRequest(StrictModel):
    filename: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1, max_length=3_000_000)


class ImportedMeasurementRun(StrictModel):
    run_id: str
    voltage_V: list[float]
    current_mA: list[float | None]
    metadata: dict[str, float] = Field(default_factory=dict)


class AnomalyImportResponse(StrictModel):
    runs: list[ImportedMeasurementRun]


class ConsistencyCheck(StrictModel):
    name: str = Field(min_length=1)
    passed: bool | None
    observed: str | float | int | None = None
    expected: str | float | int | None = None
    deviation_percent: float | None = None
    note: str | None = None


class ConsistencyEvidence(StrictModel):
    checks: list[ConsistencyCheck] = Field(default_factory=list)


class MathEvidence(StrictModel):
    formula: str | None = None
    variables: dict[str, float] = Field(default_factory=dict)
    student_result: float | None = None
    reference_result: float | None = None
    tolerance_percent: float = Field(default=5.0, ge=0.0, le=100.0)
    unit: str | None = None
    student_steps: list[str] = Field(default_factory=list)

    @field_validator("variables")
    @classmethod
    def validate_variable_names(cls, value: dict[str, float]) -> dict[str, float]:
        for name in value:
            if not name.isidentifier():
                raise ValueError(f"变量名必须是合法 Python 标识符：{name}")
        return value


class MaterialAnalyzeRequest(AnomalyImportRequest):
    run_id: str | None = Field(default=None, max_length=200)
    student_result: float | None = None
    tolerance_percent: float = Field(default=5.0, ge=0.0, le=100.0)


class ChartPoint(StrictModel):
    x: float
    y: float


class MaterialAnalysisResponse(StrictModel):
    run_id: str
    anomaly: AnomalyAnalysisResponse
    consistency: ConsistencyEvidence
    mathematics: MathEvidence
    charts: dict[str, list[ChartPoint]]


class AttemptCreate(StrictModel):
    anomaly: AnomalyEvidence | None = None
    consistency: ConsistencyEvidence | None = None
    mathematics: MathEvidence | None = None
    raw_measurements: dict[str, Any] = Field(default_factory=dict)
    student_explanation: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("raw_measurements", "metadata")
    @classmethod
    def reject_nonfinite_nested_values(cls, value: dict[str, Any]) -> dict[str, Any]:
        def validate(item: Any) -> None:
            if isinstance(item, float) and not math.isfinite(item):
                raise ValueError("数值必须是有限数（不能为 NaN 或 Infinity）。")
            if isinstance(item, dict):
                for child in item.values():
                    validate(child)
            elif isinstance(item, list):
                for child in item:
                    validate(child)

        validate(value)
        return value


class SessionCreate(StrictModel):
    student_id: str = Field(min_length=1, max_length=100)
    experiment_id: str = Field(min_length=1, max_length=100)
    course_id: str | None = Field(default=None, max_length=100)

    @field_validator("student_id", "experiment_id", mode="before")
    @classmethod
    def trim_required_ids(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("course_id", mode="before")
    @classmethod
    def trim_optional_course(cls, value: Any) -> Any:
        return (value.strip() or None) if isinstance(value, str) else value


class SessionCreated(StrictModel):
    session_id: str
    student_id: str
    experiment_id: str
    course_id: str | None
    created_at: datetime


class SessionSummary(SessionCreated):
    attempt_count: int
    modification_count: int
    latest_status: AttemptStatus | None
    latest_result: str | None


class SessionList(StrictModel):
    sessions: list[SessionSummary]
    total: int
    limit: int
    offset: int


class RuleFinding(StrictModel):
    code: str
    category: IssueType
    severity: Severity
    message: str
    evidence_reference: str


class EvidenceAssessment(StrictModel):
    completeness_score: float = Field(ge=0.0, le=1.0)
    sufficient: bool
    ready_sources: list[str]
    missing_fields: list[str]
    conflicts: list[str]
    findings: list[RuleFinding]
    computed_math_result: float | None = None
    math_relative_error_percent: float | None = None
    support_by_issue: dict[str, int] = Field(default_factory=dict)


class KnowledgeSource(StrictModel):
    title: str
    url: str = Field(pattern=r"^https://[^\s]+$")


class KnowledgeMatch(StrictModel):
    document_id: str
    title: str
    experiment_id: str
    score: float
    principles: list[str]
    data_standards: list[str]
    typical_errors: list[str]
    check_questions: list[str] = Field(default_factory=list)
    sources: list[KnowledgeSource] = Field(default_factory=list)


class TeachingPlan(StrictModel):
    module_location: str
    socratic_question: str
    concrete_checks: list[str]
    full_explanation: str


class Diagnosis(StrictModel):
    issue_type: IssueType
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    evidence_basis: list[str]
    knowledge_gaps: list[str]
    recommended_level: int = Field(ge=1, le=4)
    teaching_plan: TeachingPlan


class FollowUpRequest(StrictModel):
    message: str
    questions: list[str]


class TeachingIntervention(StrictModel):
    level: HintLevel
    level_name: str
    content: str
    checklist: list[str] = Field(default_factory=list)
    escalation_rule: str


class AttemptResponse(StrictModel):
    attempt_id: str
    session_id: str
    attempt_number: int
    status: AttemptStatus
    evidence_assessment: EvidenceAssessment
    knowledge_matches: list[KnowledgeMatch]
    diagnosis: Diagnosis | None = None
    follow_up: FollowUpRequest | None = None
    intervention: TeachingIntervention | None = None
    engine_mode: Literal["openai", "rules_fallback", "rules_only"]
    engine_message: str
    created_at: datetime


class OutcomeCreate(StrictModel):
    result: Literal["corrected", "partially_corrected", "unchanged", "abandoned"]
    student_revision: str = Field(min_length=1)
    final_result: str | None = None
    self_check_notes: str | None = None

    @field_validator("student_revision", mode="before")
    @classmethod
    def trim_required_revision(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class OutcomeRecorded(StrictModel):
    outcome_id: str
    attempt_id: str
    result: str
    recorded_at: datetime


class HealthResponse(StrictModel):
    status: Literal["ok"]
    llm_configured: bool
    llm_enabled: bool
    model: str
    knowledge_documents: int
