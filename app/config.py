from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


APP_ROOT = Path(__file__).resolve().parent


def _resolve_project_path(value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else Path.cwd() / path


def _as_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True, slots=True)
class Settings:
    database_path: Path
    knowledge_base_path: Path
    openai_api_key: str | None = None
    openai_model: str = "gpt-5-mini"
    openai_base_url: str | None = None
    enable_llm: bool = True
    llm_timeout_seconds: float = 45.0
    turso_database_url: str | None = None
    turso_auth_token: str | None = None
    require_persistent_database: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv(Path.cwd() / ".env")
        api_key = os.getenv("OPENAI_API_KEY", "").strip() or None
        base_url = os.getenv("OPENAI_BASE_URL", "").strip() or None
        return cls(
            database_path=_resolve_project_path(
                os.getenv("DATABASE_PATH", "data/adaptive_tutor.db")
            ),
            knowledge_base_path=_resolve_project_path(
                os.getenv("KNOWLEDGE_BASE_PATH", str(APP_ROOT / "data" / "knowledge_base.json"))
            ),
            openai_api_key=api_key,
            openai_model=os.getenv("OPENAI_MODEL", "gpt-5-mini").strip(),
            openai_base_url=base_url,
            enable_llm=_as_bool(os.getenv("ENABLE_LLM"), True),
            llm_timeout_seconds=float(os.getenv("LLM_TIMEOUT_SECONDS", "45")),
            turso_database_url=os.getenv("TURSO_DATABASE_URL", "").strip() or None,
            turso_auth_token=os.getenv("TURSO_AUTH_TOKEN", "").strip() or None,
            require_persistent_database=_as_bool(os.getenv("REQUIRE_PERSISTENT_DATABASE"), False),
        )
