from __future__ import annotations

from uuid import uuid4

from app.evidence import EvidenceAnalyzer, build_follow_up_questions
from app.knowledge import KnowledgeBase, build_retrieval_query
from app.llm import LLMClient, enforce_rule_constraints
from app.ai_budget import AIBudgetDenied
from app.models import (
    AttemptCreate,
    AttemptResponse,
    AttemptStatus,
    FollowUpRequest,
    IssueType,
)
from app.repository import Repository, utc_now
from app.teaching import TeachingPolicy


class DiagnosticService:
    def __init__(
        self,
        repository: Repository,
        evidence_analyzer: EvidenceAnalyzer,
        knowledge_base: KnowledgeBase,
        llm_client: LLMClient,
        teaching_policy: TeachingPolicy,
    ) -> None:
        self.repository = repository
        self.evidence_analyzer = evidence_analyzer
        self.knowledge_base = knowledge_base
        self.llm_client = llm_client
        self.teaching_policy = teaching_policy

    def process_attempt(
        self, session_id: str, payload: AttemptCreate, *, model_guard=None
    ) -> AttemptResponse:
        session = self.repository.get_session(session_id)
        previous_attempts = self.repository.count_attempts(session_id)
        attempt_number = previous_attempts + 1
        assessment = self.evidence_analyzer.analyze(payload)
        retrieval_query = build_retrieval_query(
            session.experiment_id, payload, assessment
        )
        matches = self.knowledge_base.search(
            query=retrieval_query,
            experiment_id=session.experiment_id,
            top_k=3,
        )

        base = {
            "attempt_id": str(uuid4()),
            "session_id": session_id,
            "attempt_number": attempt_number,
            "evidence_assessment": assessment,
            "knowledge_matches": matches,
            "created_at": utc_now(),
        }

        if not assessment.sufficient:
            response = AttemptResponse(
                **base,
                status=AttemptStatus.NEEDS_MORE_EVIDENCE,
                follow_up=FollowUpRequest(
                    message="当前证据不足，暂不输出可能误导学生的教学答案。",
                    questions=build_follow_up_questions(assessment),
                ),
                engine_mode="rules_only",
                engine_message="已完成证据充分性检查；等待补充数据后再调用大模型。",
            )
            return self.repository.save_attempt(payload, response)

        if self.llm_client.settings.enable_llm and self.llm_client.configured:
            try:
                if model_guard is None:
                    raise AIBudgetDenied("此诊断未取得 AI 调用授权，已使用规则诊断。")
                with model_guard():
                    llm_result = self.llm_client.diagnose(
                        experiment_id=session.experiment_id, attempt=payload,
                        assessment=assessment, knowledge_matches=matches,
                    )
            except AIBudgetDenied as exc:
                llm_result = self.llm_client.rules_result(
                    payload, assessment, matches, message=str(exc),
                )
        else:
            llm_result = self.llm_client.diagnose(
                experiment_id=session.experiment_id, attempt=payload,
                assessment=assessment, knowledge_matches=matches,
            )
        llm_result = enforce_rule_constraints(llm_result, payload, assessment, matches)
        diagnosis = llm_result.diagnosis

        if diagnosis.issue_type == IssueType.NO_ERROR:
            response = AttemptResponse(
                **base,
                status=AttemptStatus.COMPLETED,
                diagnosis=diagnosis,
                engine_mode=llm_result.mode,
                engine_message=llm_result.message,
            )
            return self.repository.save_attempt(payload, response)

        level = self.teaching_policy.select_level(previous_attempts, diagnosis)
        intervention = self.teaching_policy.render(level, diagnosis)
        response = AttemptResponse(
            **base,
            status=AttemptStatus.TEACHING_INTERVENTION,
            diagnosis=diagnosis,
            intervention=intervention,
            engine_mode=llm_result.mode,
            engine_message=llm_result.message,
        )
        return self.repository.save_attempt(payload, response)

