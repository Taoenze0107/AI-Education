import json
from pathlib import Path
from types import SimpleNamespace

from app.config import Settings
from app.evidence import EvidenceAnalyzer
from app.knowledge import KnowledgeBase, build_retrieval_query
from app.llm import LLMClient
from app.models import AttemptCreate, Diagnosis, IssueType, TeachingPlan


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class FakeResponses:
    def __init__(self, diagnosis: Diagnosis) -> None:
        self.diagnosis = diagnosis
        self.call: dict | None = None

    def parse(self, **kwargs):
        self.call = kwargs
        return SimpleNamespace(output_parsed=self.diagnosis)


def test_openai_path_uses_structured_diagnosis_schema(tmp_path: Path) -> None:
    payload = AttemptCreate.model_validate(
        json.loads(
            (PROJECT_ROOT / "examples" / "sufficient_calculation_error.json").read_text(
                encoding="utf-8"
            )
        )
    )
    assessment = EvidenceAnalyzer().analyze(payload)
    knowledge_base = KnowledgeBase(PROJECT_ROOT / "app" / "data" / "knowledge_base.json")
    matches = knowledge_base.search(
        build_retrieval_query("ohms_law", payload, assessment), "ohms_law"
    )
    expected = Diagnosis(
        issue_type=IssueType.CALCULATION_ERROR,
        confidence=0.94,
        summary="单位换算导致计算结果错误。",
        evidence_basis=["学生结果与复算结果不一致。"],
        knowledge_gaps=["mA 必须先换算为 A。"],
        recommended_level=1,
        teaching_plan=TeachingPlan(
            module_location="检查单位换算模块。",
            socratic_question="20 mA 等于多少 A？",
            concrete_checks=["统一单位", "重新代入"],
            full_explanation="20 mA=0.02 A，再用 R=U/I 计算。",
        ),
    )
    fake_responses = FakeResponses(expected)
    settings = Settings(
        database_path=tmp_path / "unused.db",
        knowledge_base_path=PROJECT_ROOT / "app" / "data" / "knowledge_base.json",
        openai_api_key=None,
        openai_model="structured-test-model",
        enable_llm=True,
        llm_timeout_seconds=1,
    )
    llm = LLMClient(settings)
    llm._client = SimpleNamespace(responses=fake_responses)

    result = llm.diagnose("ohms_law", payload, assessment, matches)

    assert result.mode == "openai"
    assert result.diagnosis == expected
    assert fake_responses.call is not None
    assert fake_responses.call["model"] == "structured-test-model"
    assert fake_responses.call["text_format"] is Diagnosis

