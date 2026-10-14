from pathlib import Path

from app.config import Settings


def test_default_paths_work_outside_package_directory(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    for name in ("DATABASE_PATH", "KNOWLEDGE_BASE_PATH", "OPENAI_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    settings = Settings.from_env()
    assert settings.database_path == tmp_path / "data" / "adaptive_tutor.db"
    assert settings.knowledge_base_path.is_file()
    assert settings.knowledge_base_path.parent.name == "data"
    assert settings.knowledge_base_path.parent.parent.name == "app"


def test_env_and_relative_custom_paths_resolve_from_working_directory(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    for name in ("DATABASE_PATH", "KNOWLEDGE_BASE_PATH", "ENABLE_LLM"):
        monkeypatch.delenv(name, raising=False)
    (tmp_path / ".env").write_text(
        "DATABASE_PATH=custom/tutor.db\nKNOWLEDGE_BASE_PATH=custom/knowledge.json\nENABLE_LLM=false\n",
        encoding="utf-8",
    )
    settings = Settings.from_env()
    assert settings.database_path == tmp_path / "custom" / "tutor.db"
    assert settings.knowledge_base_path == tmp_path / "custom" / "knowledge.json"
    assert settings.enable_llm is False
