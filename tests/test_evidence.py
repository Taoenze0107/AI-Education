import json
from pathlib import Path

import pytest

from app.evidence import EvidenceAnalyzer, build_follow_up_questions
from app.models import AttemptCreate, IssueType


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_example(name: str) -> AttemptCreate:
    content = json.loads((PROJECT_ROOT / "examples" / name).read_text(encoding="utf-8"))
    return AttemptCreate.model_validate(content)


def test_three_channel_calculation_error_is_sufficient() -> None:
    assessment = EvidenceAnalyzer().analyze(
        load_example("sufficient_calculation_error.json")
    )
    assert assessment.sufficient is True
    assert assessment.computed_math_result == pytest.approx(250.0)
    assert assessment.math_relative_error_percent == pytest.approx(90.0)
    assert assessment.support_by_issue[IssueType.CALCULATION_ERROR.value] == 2


def test_missing_channels_request_more_evidence() -> None:
    assessment = EvidenceAnalyzer().analyze(load_example("insufficient_evidence.json"))
    questions = build_follow_up_questions(assessment)
    assert assessment.sufficient is False
    assert assessment.completeness_score == pytest.approx(1 / 3, abs=1e-4)
    assert any("一致性" in question for question in questions)
    assert any("计算" in question for question in questions)


def test_zero_reference_mismatch_remains_json_serializable() -> None:
    payload = AttemptCreate.model_validate({
        "anomaly": {"status": "anomalous", "predicted_issue": "calculation_error", "confidence": 0.9},
        "mathematics": {"reference_result": 0, "student_result": 1},
    })
    assessment = EvidenceAnalyzer().analyze(payload)
    assert assessment.sufficient
    assert assessment.math_relative_error_percent is None
    assert assessment.support_by_issue[IssueType.CALCULATION_ERROR.value] == 2
    assert "参考值为零" in assessment.findings[-1].message
    json.dumps(assessment.model_dump(mode="json"), allow_nan=False)

@pytest.mark.parametrize('reference',[1.602176634e-19,6.62607015e-34])
def test_quantum_scale_wrong_result_is_reported(reference):
    payload=AttemptCreate.model_validate({'anomaly':{'status':'anomalous','predicted_issue':'calculation_error','confidence':.9},
        'mathematics':{'reference_result':reference,'student_result':2*reference,'tolerance_percent':5}})
    assessment=EvidenceAnalyzer().analyze(payload)
    assert assessment.math_relative_error_percent==pytest.approx(100)
    assert any(f.code=='MATH_RESULT_MISMATCH' for f in assessment.findings)


def test_failed_check_reference_points_to_original_position() -> None:
    payload = AttemptCreate.model_validate({"consistency": {"checks": [
        {"name": "正常", "passed": True},
        {"name": "异常", "passed": False},
    ]}})
    assessment = EvidenceAnalyzer().analyze(payload)
    assert assessment.findings[0].evidence_reference == "consistency.checks[1]"


def test_undefined_formula_requests_repair_instead_of_crashing() -> None:
    payload = AttemptCreate.model_validate({"mathematics": {
        "formula": "x ** 0.5", "variables": {"x": -1}, "student_result": 0,
    }})
    assessment = EvidenceAnalyzer().analyze(payload)
    assert not assessment.sufficient
    assert any("无法计算" in field for field in assessment.missing_fields)
