from pathlib import Path

from app.knowledge import KnowledgeBase, format_knowledge_context
from app.models import KnowledgeMatch


def test_extended_knowledge_keeps_sources_in_retrieval_and_filters_experiments() -> None:
    base = KnowledgeBase(Path(__file__).parents[1] / "app/data/knowledge_base.json")
    assert len(base.documents) == 393
    assert all(document.sources and document.check_questions for document in base.documents)
    matches = base.search("图线斜率 mA/V 电阻 R=1000/k", "ohms_law", 10)
    assert any(m.document_id == "ohms-slope" for m in matches)
    assert all(m.experiment_id in {"ohms_law", "generic"} for m in matches)
    assert all(m.sources and m.check_questions for m in matches)
    context = format_knowledge_context(matches)
    assert "https://openstax.org/" in context
    assert "自查问题" in context


def test_older_saved_knowledge_matches_still_load() -> None:
    old = dict(document_id="old", title="Old result", experiment_id="generic", score=1,
               principles=[], data_standards=[], typical_errors=[])
    result = KnowledgeMatch.model_validate(old)
    assert result.sources == []
    assert result.check_questions == []
