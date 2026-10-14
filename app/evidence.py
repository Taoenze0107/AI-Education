from __future__ import annotations

from collections import Counter
import math

from app.math_engine import (
    UnsafeExpressionError,
    evaluate_formula,
    relative_error_percent,
)
from app.models import (
    AttemptCreate,
    EvidenceAssessment,
    IssueType,
    RuleFinding,
    Severity,
)


class EvidenceAnalyzer:
    """AT1: aggregate three evidence channels and run deterministic checks."""

    def analyze(self, payload: AttemptCreate) -> EvidenceAssessment:
        ready_sources: list[str] = []
        missing_fields: list[str] = []
        conflicts: list[str] = []
        findings: list[RuleFinding] = []
        support: Counter[str] = Counter()

        anomaly_ready = payload.anomaly is not None
        if anomaly_ready:
            ready_sources.append("anomaly_model")
            anomaly = payload.anomaly
            if anomaly.status == "anomalous" and anomaly.predicted_issue:
                support[anomaly.predicted_issue.value] += 1
                findings.append(
                    RuleFinding(
                        code="ANOMALY_MODEL_SIGNAL",
                        category=anomaly.predicted_issue,
                        severity=(
                            Severity.ERROR if anomaly.confidence >= 0.75 else Severity.WARNING
                        ),
                        message=(
                            f"异常模型判断为 {anomaly.predicted_issue.value}，"
                            f"置信度 {anomaly.confidence:.0%}。"
                        ),
                        evidence_reference="anomaly",
                    )
                )
            elif anomaly.status == "normal" and anomaly.confidence >= 0.7:
                support[IssueType.NO_ERROR.value] += 1
        else:
            missing_fields.append("anomaly")

        failed_checks = []
        consistency_ready = bool(
            payload.consistency
            and payload.consistency.checks
            and any(check.passed is not None for check in payload.consistency.checks)
        )
        if consistency_ready and payload.consistency:
            ready_sources.append("consistency_checks")
            failed_checks = [
                check for check in payload.consistency.checks if check.passed is False
            ]
            if failed_checks:
                support[IssueType.DATA_ERROR.value] += 1
                for index, check in enumerate(payload.consistency.checks):
                    if check.passed is not False:
                        continue
                    detail = check.note or f"观测值 {check.observed}，预期值 {check.expected}"
                    findings.append(
                        RuleFinding(
                            code=f"CONSISTENCY_CHECK_FAILED_{index + 1}",
                            category=IssueType.DATA_ERROR,
                            severity=Severity.ERROR,
                            message=f"一致性检查“{check.name}”未通过：{detail}",
                            evidence_reference=f"consistency.checks[{index}]",
                        )
                    )
            else:
                support[IssueType.NO_ERROR.value] += 1
        else:
            missing_fields.append("consistency.checks（至少一项需有 passed 结果）")

        computed_result: float | None = None
        math_error_percent: float | None = None
        math_ready = False
        math_mismatch = False
        math_evidence = payload.mathematics
        if math_evidence and math_evidence.student_result is not None:
            reference = math_evidence.reference_result
            if reference is None and math_evidence.formula and math_evidence.variables:
                try:
                    computed_result = evaluate_formula(
                        math_evidence.formula, math_evidence.variables
                    )
                    reference = computed_result
                except UnsafeExpressionError as exc:
                    missing_fields.append(f"mathematics：{exc}")
            if reference is not None:
                math_ready = True
                ready_sources.append("mathematical_judgement")
                math_error_percent = relative_error_percent(
                    math_evidence.student_result, reference
                )
                math_mismatch = math_error_percent > math_evidence.tolerance_percent
                if math_mismatch:
                    support[IssueType.CALCULATION_ERROR.value] += 1
                    unit = f" {math_evidence.unit}" if math_evidence.unit else ""
                    error_description = (
                        f"为 {math_error_percent:.2f}%，"
                        if math.isfinite(math_error_percent)
                        else "无法用有限百分比表示（参考值为零或差异过大），"
                    )
                    findings.append(
                        RuleFinding(
                            code="MATH_RESULT_MISMATCH",
                            category=IssueType.CALCULATION_ERROR,
                            severity=Severity.ERROR,
                            message=(
                                f"学生结果 {math_evidence.student_result:g}{unit} 与参考结果 "
                                f"{reference:g}{unit} 的相对误差{error_description}"
                                f"超过容差 {math_evidence.tolerance_percent:g}%。"
                            ),
                            evidence_reference="mathematics.student_result",
                        )
                    )
                else:
                    support[IssueType.NO_ERROR.value] += 1
        if not math_ready:
            if not math_evidence:
                missing_fields.append("mathematics")
            elif math_evidence.student_result is None:
                missing_fields.append("mathematics.student_result")
            elif not (math_evidence.reference_result is not None or (
                math_evidence.formula and math_evidence.variables
            )):
                missing_fields.append(
                    "mathematics.reference_result 或 formula+variables"
                )

        if payload.anomaly:
            high_confidence = payload.anomaly.confidence >= 0.75
            other_channel_error = bool(failed_checks or math_mismatch)
            if payload.anomaly.status == "normal" and high_confidence and other_channel_error:
                conflicts.append("异常模型判断正常，但规则或数学检查发现明确错误。")
            if (
                payload.anomaly.status == "anomalous"
                and high_confidence
                and not failed_checks
                and math_ready
                and not math_mismatch
            ):
                conflicts.append("异常模型判断异常，但一致性与数学检查均通过。")

        ready_count = len(ready_sources)
        completeness = ready_count / 3.0
        strongest_error_support = max(
            (
                value
                for key, value in support.items()
                if key not in {IssueType.NO_ERROR.value, IssueType.INSUFFICIENT_EVIDENCE.value}
            ),
            default=0,
        )
        direct_decisive_check = math_mismatch or len(failed_checks) >= 2
        consensus = strongest_error_support >= 2 or support[IssueType.NO_ERROR.value] >= 2
        enough_sources = ready_count >= 2
        unresolved_two_source_conflict = bool(conflicts) and ready_count < 3
        sufficient = (
            enough_sources
            and (consensus or direct_decisive_check)
            and not unresolved_two_source_conflict
        )

        if not sufficient and not missing_fields and conflicts:
            missing_fields.append("用于消解冲突的复测数据或人工检查结论")

        return EvidenceAssessment(
            completeness_score=round(completeness, 4),
            sufficient=sufficient,
            ready_sources=ready_sources,
            missing_fields=list(dict.fromkeys(missing_fields)),
            conflicts=conflicts,
            findings=findings,
            computed_math_result=computed_result,
            math_relative_error_percent=(
                None if math_error_percent is None or not math.isfinite(math_error_percent)
                else round(math_error_percent, 6)
            ),
            support_by_issue=dict(support),
        )


def build_follow_up_questions(assessment: EvidenceAssessment) -> list[str]:
    questions: list[str] = []
    for missing in assessment.missing_fields:
        if missing == "anomaly":
            questions.append("请补充异常模型的标签、置信度和触发该判断的特征。")
        elif missing.startswith("consistency.checks"):
            questions.append("请补充量程、单位、范围或重复实验的一致性检查结果。")
        elif "student_result" in missing:
            questions.append("请补充学生最终计算结果以及所使用的单位。")
        elif "reference_result" in missing or "formula+variables" in missing:
            questions.append("请补充参考结果，或提供公式及全部变量数值。")
        elif missing == "mathematics":
            questions.append("请补充计算公式、变量、学生结果和允许误差。")
        elif "复测数据" in missing:
            questions.append("请复测关键数据，并说明人工检查支持哪一路判断。")
        else:
            questions.append(f"请补充：{missing}。")
    for conflict in assessment.conflicts:
        questions.append(f"当前证据存在冲突：{conflict}请补充复测或人工检查结果。")
    return list(dict.fromkeys(questions)) or [
        "请补充原始数据、完整计算过程或人工检查结果中的至少一项。"
    ]
