from __future__ import annotations

import json
import math
import re
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

from app.models import AttemptCreate, EvidenceAssessment, KnowledgeMatch, KnowledgeSource


class KnowledgeDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    experiment_id: str
    title: str
    keywords: list[str] = Field(default_factory=list)
    principles: list[str] = Field(default_factory=list)
    data_standards: list[str] = Field(default_factory=list)
    typical_errors: list[str] = Field(default_factory=list)
    check_questions: list[str] = Field(default_factory=list)
    sources: list[KnowledgeSource] = Field(default_factory=list)


def _tokens(text: str) -> set[str]:
    lowered = text.lower()
    latin = set(re.findall(r"[a-z][a-z0-9_+-]*|\d+(?:\.\d+)?", lowered))
    cjk_runs = re.findall(r"[\u3400-\u9fff]+", lowered)
    cjk: set[str] = set()
    for run in cjk_runs:
        cjk.update(run)
        cjk.update(run[index : index + 2] for index in range(len(run) - 1))
    return latin | cjk


class KnowledgeBase:
    """AT2: retrieve experiment principles, standards and typical errors."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.documents: list[KnowledgeDocument] = []
        self._document_tokens: dict[str, set[str]] = {}
        self.reload()

    def reload(self) -> int:
        raw = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            raise ValueError("知识库必须是文档数组。")
        documents = [KnowledgeDocument.model_validate(item) for item in raw]
        if len({document.document_id for document in documents}) != len(documents):
            raise ValueError("知识库文档 ID 不能重复。")
        document_tokens = {
            document.document_id: _tokens(
                " ".join(
                    [
                        document.title,
                        document.experiment_id,
                        *document.keywords,
                        *document.principles,
                        *document.data_standards,
                        *document.typical_errors,
                        *document.check_questions,
                    ]
                )
            )
            for document in documents
        }
        # Publish only after every document and index entry passes validation.
        self.documents = documents
        self._document_tokens = document_tokens
        return len(self.documents)

    def list_documents(self, experiment_id: str | None = None) -> list[KnowledgeDocument]:
        return [
            document
            for document in self.documents
            if experiment_id is None or document.experiment_id in {experiment_id, "generic"}
        ]

    def search(
        self, query: str, experiment_id: str, top_k: int = 3
    ) -> list[KnowledgeMatch]:
        query_tokens = _tokens(query)
        scored: list[tuple[float, KnowledgeDocument]] = []
        for document in self.documents:
            if experiment_id != "generic" and document.experiment_id not in {experiment_id, "generic"}:
                continue
            document_tokens = self._document_tokens[document.document_id]
            overlap = len(query_tokens & document_tokens)
            lexical_score = overlap / math.sqrt(max(1, len(document_tokens)))
            experiment_bonus = 4.0 if document.experiment_id == experiment_id else 0.0
            generic_bonus = 0.7 if document.experiment_id == "generic" else 0.0
            score = lexical_score + experiment_bonus + generic_bonus
            if score > 0:
                scored.append((score, document))

        scored.sort(key=lambda item: (-item[0], item[1].document_id))
        return [
            KnowledgeMatch(
                document_id=document.document_id,
                title=document.title,
                experiment_id=document.experiment_id,
                score=round(score, 4),
                principles=document.principles,
                data_standards=document.data_standards,
                typical_errors=document.typical_errors,
                check_questions=document.check_questions,
                sources=document.sources,
            )
            for score, document in scored[:top_k]
        ]


def build_retrieval_query(
    experiment_id: str,
    attempt: AttemptCreate,
    assessment: EvidenceAssessment,
) -> str:
    parts = [experiment_id, attempt.student_explanation or ""]
    if attempt.anomaly:
        parts.extend(
            [
                attempt.anomaly.predicted_issue.value
                if attempt.anomaly.predicted_issue
                else "",
                attempt.anomaly.summary or "",
                *attempt.anomaly.observed_features,
            ]
        )
    if attempt.consistency:
        for check in attempt.consistency.checks:
            parts.extend([check.name, check.note or ""])
    if attempt.mathematics:
        parts.extend([attempt.mathematics.formula or "", *attempt.mathematics.student_steps])
    parts.extend(finding.message for finding in assessment.findings)
    return " ".join(part for part in parts if part)


def format_knowledge_context(matches: list[KnowledgeMatch]) -> str:
    if not matches:
        return "未检索到专门条目；只能基于通用实验规范进行诊断。"
    sections: list[str] = []
    for match in matches:
        sections.append(
            "\n".join(
                [
                    f"[{match.document_id}] {match.title}",
                    "实验原理：" + "；".join(match.principles),
                    "数据规范：" + "；".join(match.data_standards),
                    "典型错误：" + "；".join(match.typical_errors),
                    "自查问题：" + "；".join(match.check_questions),
                    "参考来源：" + "；".join(f"{source.title} {source.url}" for source in match.sources),
                ]
            )
        )
    return "\n\n".join(sections)
