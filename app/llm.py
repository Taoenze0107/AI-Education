from __future__ import annotations

import json
from dataclasses import dataclass

from openai import OpenAI

from app.config import Settings
from app.knowledge import format_knowledge_context
from app.models import (
    AttemptCreate,
    Diagnosis,
    EvidenceAssessment,
    IssueType,
    KnowledgeMatch,
    TeachingPlan,
    Severity,
)


SYSTEM_PROMPT = """你是大学实验课的诊断与自适应教学引擎。
你的任务是依据已经过规则检查的三路证据和检索到的课程知识，判断学生的主要问题，并生成由弱到强的四级教学干预。

必须遵守：
1. 区分 data_error、calculation_error、concept_misunderstanding、mixed 和 no_error。
2. 不得编造输入中不存在的测量值、操作步骤或知识库事实。
3. evidence_basis 只写可追溯到输入的依据；证据冲突时降低 confidence。
4. 第一级只定位出错模块，不给答案；第二级使用启发式问题；第三级给具体检查清单；第四级才给完整解释。
5. 使用简洁、友善、可执行的中文，适合学生直接阅读。
6. 若规则检查已经给出数值结果，必须保持一致。
"""


@dataclass(frozen=True, slots=True)
class DiagnosisResult:
    diagnosis: Diagnosis
    mode: str
    message: str


class LLMClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: OpenAI | None = None
        if settings.enable_llm and settings.openai_api_key:
            client_kwargs: dict[str, object] = {
                "api_key": settings.openai_api_key,
                "timeout": settings.llm_timeout_seconds,
                "max_retries": 0,
            }
            if settings.openai_base_url:
                client_kwargs["base_url"] = settings.openai_base_url
            self._client = OpenAI(**client_kwargs)

    @property
    def configured(self) -> bool:
        return self._client is not None

    def diagnose(
        self,
        experiment_id: str,
        attempt: AttemptCreate,
        assessment: EvidenceAssessment,
        knowledge_matches: list[KnowledgeMatch],
    ) -> DiagnosisResult:
        if not self.settings.enable_llm:
            return DiagnosisResult(
                diagnosis=_fallback_diagnosis(attempt, assessment, knowledge_matches),
                mode="rules_only",
                message="ENABLE_LLM=false，已使用确定性规则引擎。",
            )
        if self._client is None:
            return DiagnosisResult(
                diagnosis=_fallback_diagnosis(attempt, assessment, knowledge_matches),
                mode="rules_fallback",
                message="未配置 OPENAI_API_KEY，已使用确定性规则回退。",
            )

        user_payload = {
            "experiment_id": experiment_id,
            "student_evidence": attempt.model_dump(mode="json"),
            "rule_assessment": assessment.model_dump(mode="json"),
            "retrieved_knowledge": format_knowledge_context(knowledge_matches),
        }
        try:
            response = self._client.responses.parse(
                model=self.settings.openai_model,
                input=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": json.dumps(user_payload, ensure_ascii=False),
                    },
                ],
                text_format=Diagnosis,
                max_output_tokens=3000,
                store=False,
            )
            parsed = response.output_parsed
            if parsed is None:
                raise RuntimeError("模型没有返回可解析的结构化诊断")
            return enforce_rule_constraints(DiagnosisResult(
                diagnosis=parsed,
                mode="openai",
                message=f"已使用 {self.settings.openai_model} 完成结构化诊断。",
            ), attempt, assessment, knowledge_matches)
        except Exception as exc:  # API/network failures must not break the lesson flow.
            return DiagnosisResult(
                diagnosis=_fallback_diagnosis(attempt, assessment, knowledge_matches),
                mode="rules_fallback",
                message=f"模型调用失败，已安全回退到规则引擎：{type(exc).__name__}",
            )

    def rules_result(self, attempt, assessment, knowledge_matches, *, message,
                     mode="rules_fallback") -> DiagnosisResult:
        """No-network diagnosis when model permission or budget is unavailable."""
        return enforce_rule_constraints(DiagnosisResult(
            diagnosis=_fallback_diagnosis(attempt, assessment, knowledge_matches),
            mode=mode, message=message,
        ), attempt, assessment, knowledge_matches)


def _hard_rule_issues(assessment: EvidenceAssessment) -> set[IssueType]:
    # Probabilistic anomaly predictions alone are not a deterministic constraint.
    issues = set()
    for finding in assessment.findings:
        if finding.severity != Severity.ERROR:
            continue
        if finding.code == "MATH_RESULT_MISMATCH":
            issues.add(IssueType.CALCULATION_ERROR)
        elif finding.code.startswith("CONSISTENCY_CHECK_FAILED_"):
            issues.add(IssueType.DATA_ERROR)
    return issues


def enforce_rule_constraints(result: DiagnosisResult, attempt: AttemptCreate,
                             assessment: EvidenceAssessment,
                             knowledge_matches: list[KnowledgeMatch]) -> DiagnosisResult:
    """The server, rather than an untrusted model classification, decides completion."""
    required = _hard_rule_issues(assessment)
    if not required:
        return result
    covered = ({IssueType.CALCULATION_ERROR, IssueType.DATA_ERROR}
               if result.diagnosis.issue_type == IssueType.MIXED
               else {result.diagnosis.issue_type})
    if required <= covered:
        return result
    deterministic = _fallback_diagnosis(attempt, assessment, knowledge_matches)
    covered_fallback = ({IssueType.CALCULATION_ERROR, IssueType.DATA_ERROR}
                        if deterministic.issue_type == IssueType.MIXED
                        else {deterministic.issue_type})
    if not required <= covered_fallback:
        # Preserve every confirmed error when another signal dominates the vote.
        deterministic = _fallback_diagnosis(attempt, assessment, knowledge_matches,
                                           required_issue=IssueType.MIXED)
    return DiagnosisResult(
        diagnosis=deterministic,
        mode="rules_fallback",
        message="模型判断与已确认的规则检查不一致，已保留规则诊断；请先核对列出的计算或实验条件问题。",
    )


def _dominant_issue(assessment: EvidenceAssessment) -> IssueType:
    counts = {
        IssueType(key): value
        for key, value in assessment.support_by_issue.items()
        if key not in {IssueType.NO_ERROR.value, IssueType.INSUFFICIENT_EVIDENCE.value}
        and value > 0
    }
    if not counts:
        return IssueType.NO_ERROR
    maximum = max(counts.values())
    leaders = [issue for issue, count in counts.items() if count == maximum]
    if len(leaders) > 1:
        return IssueType.MIXED
    return leaders[0]


def _fallback_diagnosis(
    attempt: AttemptCreate,
    assessment: EvidenceAssessment,
    knowledge_matches: list[KnowledgeMatch],
    required_issue: IssueType | None = None,
) -> Diagnosis:
    issue = required_issue or _dominant_issue(assessment)
    bases = [finding.message for finding in assessment.findings]
    if not bases:
        bases = ["异常模型、一致性检查与数学判断中至少两路未发现明显矛盾。"]

    relevant_errors = [
        error for match in knowledge_matches for error in match.typical_errors
    ][:3]
    knowledge_gaps = relevant_errors or ["需结合本实验原理检查变量、单位与适用条件。"]
    plans = _fallback_teaching_plans(knowledge_matches)
    plan = plans[issue]

    labels = {
        IssueType.DATA_ERROR: "证据主要指向原始数据或实验操作问题。",
        IssueType.CALCULATION_ERROR: "证据主要指向计算过程或单位换算问题。",
        IssueType.CONCEPT_MISUNDERSTANDING: "证据主要指向实验概念或公式适用条件的误解。",
        IssueType.MIXED: "数据与计算/概念层面均出现问题，需要分步排查。",
        IssueType.NO_ERROR: "当前证据未显示需要纠正的错误。",
    }
    strongest = max(assessment.support_by_issue.values(), default=1)
    confidence = min(0.95, 0.55 + 0.15 * strongest)
    if assessment.conflicts:
        confidence = max(0.5, confidence - 0.15)

    return Diagnosis(
        issue_type=issue,
        confidence=round(confidence, 2),
        summary=labels[issue],
        evidence_basis=bases,
        knowledge_gaps=knowledge_gaps,
        recommended_level=1,
        teaching_plan=plan,
    )


def _fallback_teaching_plans(
    knowledge_matches: list[KnowledgeMatch],
) -> dict[IssueType, TeachingPlan]:
    standards = [
        item for match in knowledge_matches for item in match.data_standards
    ][:4]
    principles = [item for match in knowledge_matches for item in match.principles][:3]
    checks = standards or [
        "核对原始记录与录入值是否一致。",
        "统一全部变量的单位后重新计算。",
        "逐步复算并保留中间结果。",
    ]
    principle_text = "；".join(principles) or "先核对公式、变量含义与适用条件"

    return {
        IssueType.DATA_ERROR: TeachingPlan(
            module_location="问题更可能位于数据采集、记录或预处理模块。",
            socratic_question="如果暂时不做计算，哪一个原始读数最不符合实验趋势或量程？",
            concrete_checks=checks,
            full_explanation=(
                "请回到原始记录，依次检查接线/仪器设置、量程、单位、抄录和异常点。"
                "确认数据可靠后再重新执行计算；不要为了贴近期望值直接删除数据。"
            ),
        ),
        IssueType.CALCULATION_ERROR: TeachingPlan(
            module_location="原始证据基本可用，问题更可能位于公式代入、单位换算或运算模块。",
            socratic_question="把每个变量的单位写出来后，代入公式所得结果的数量级应该是多少？",
            concrete_checks=[
                "写出所用公式并标明每个变量。",
                "先把所有变量转换为同一单位制。",
                "逐步代入，检查括号、平方、斜率方向和中间舍入。",
                *checks[:2],
            ],
            full_explanation=(
                "应先写公式及适用条件，再统一单位，最后代入未经提前取整的数据。"
                f"本实验可参考：{principle_text}。将复算结果与规则引擎给出的参考值比较，"
                "差异应落在允许误差内。"
            ),
        ),
        IssueType.CONCEPT_MISUNDERSTANDING: TeachingPlan(
            module_location="问题更可能位于实验原理、变量含义或公式适用条件模块。",
            socratic_question="这个公式成立需要哪些条件？你的实验数据满足这些条件吗？",
            concrete_checks=[
                "用自己的话说明因变量、自变量及预期关系。",
                "列出公式的适用条件并逐项对照实验。",
                "预测一个变量增大时结果应如何变化，再与数据比较。",
            ],
            full_explanation=f"重新建立概念链：实验条件 → {principle_text} → 数据趋势 → 计算结论。",
        ),
        IssueType.MIXED: TeachingPlan(
            module_location="问题跨越数据质量与后续计算/概念模块，应先数据、后计算地排查。",
            socratic_question="如果只修正最早出现的一处错误，后面的结果会发生什么变化？",
            concrete_checks=[
                "先冻结原始记录并找出第一处异常。",
                "修正单位或录入后重新运行一致性检查。",
                "仅使用通过检查的数据重新计算。",
                "最后解释结果是否符合实验原理。",
            ],
            full_explanation="先修复上游数据，再从公式与单位开始完整复算，最后用物理趋势验证答案。",
        ),
        IssueType.NO_ERROR: TeachingPlan(
            module_location="三路证据目前未定位到明确错误。",
            socratic_question="你能用实验原理解释为什么当前结果的趋势与数量级合理吗？",
            concrete_checks=checks,
            full_explanation="当前结果在给定证据和容差内一致，可保留记录并进入下一实验步骤。",
        ),
        IssueType.INSUFFICIENT_EVIDENCE: TeachingPlan(
            module_location="当前证据不足，暂不能可靠定位模块。",
            socratic_question="你还能提供哪一项原始数据、计算步骤或人工检查结果？",
            concrete_checks=checks,
            full_explanation="补齐证据后再诊断，避免仅凭单一路信号给出结论。",
        ),
    }

