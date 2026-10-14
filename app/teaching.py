from __future__ import annotations

from app.models import Diagnosis, HintLevel, IssueType, TeachingIntervention


LEVEL_NAMES = {
    HintLevel.MODULE_LOCATION: "模块定位",
    HintLevel.SOCRATIC_QUESTION: "启发提问",
    HintLevel.CONCRETE_CHECK: "具体检查",
    HintLevel.FULL_EXPLANATION: "完整解释",
}


class TeachingPolicy:
    """AT5/AT6: select and render progressive teaching interventions."""

    def select_level(self, previous_attempts: int, diagnosis: Diagnosis) -> HintLevel:
        # Every new attempt escalates one step. A high-confidence mixed error may start
        # at level 2 because merely naming one module would be misleading.
        level = min(4, previous_attempts + 1)
        if (
            previous_attempts == 0
            and diagnosis.issue_type == IssueType.MIXED
            and diagnosis.confidence >= 0.8
        ):
            level = 2
        return HintLevel(level)

    def render(self, level: HintLevel, diagnosis: Diagnosis) -> TeachingIntervention:
        plan = diagnosis.teaching_plan
        if level == HintLevel.MODULE_LOCATION:
            content = plan.module_location
            checklist: list[str] = []
        elif level == HintLevel.SOCRATIC_QUESTION:
            content = plan.socratic_question
            checklist = []
        elif level == HintLevel.CONCRETE_CHECK:
            content = "请按以下顺序检查，不要跳步。"
            checklist = plan.concrete_checks
        else:
            content = plan.full_explanation
            checklist = plan.concrete_checks

        return TeachingIntervention(
            level=level,
            level_name=LEVEL_NAMES[level],
            content=content,
            checklist=checklist,
            escalation_rule="若本轮修改后仍未解决，下一次诊断自动提升一级；第 4 级后保持完整解释。",
        )

