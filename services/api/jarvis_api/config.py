"""Runtime configuration, loaded from environment variables / .env.

Secrets (API keys, database passwords) live ONLY here on the backend.
They are never sent to the frontend.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

API_ROOT = Path(__file__).resolve().parent.parent  # services/api
REPO_ROOT = API_ROOT.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(API_ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Storage -----------------------------------------------------------
    # Default: local SQLite file (works offline, single machine).
    # For cloud sync, point this at Supabase Postgres, e.g.
    # postgresql+psycopg://postgres.<ref>:<password>@<host>:5432/postgres
    database_url: str = ""
    data_dir: str = str(REPO_ROOT / "data")

    # --- Access control ----------------------------------------------------
    # When set, every /api request must send `Authorization: Bearer <token>`.
    # Strongly recommended whenever the app is reachable from other devices.
    jarvis_access_token: str = ""
    # Single-user for v0.1; kept on every row so multi-user/Supabase auth slots in later.
    jarvis_user_id: str = "local-user"

    # --- AI providers ------------------------------------------------------
    # "auto" picks anthropic if ANTHROPIC_API_KEY is set, else openai if configured.
    jarvis_ai_provider: str = "auto"  # auto | anthropic | openai | none
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-5-5"
    anthropic_effort: str = "medium"  # low | medium | high | xhigh | max
    anthropic_fallbacks: bool = True  # server-side refusal fallback
    openai_api_key: str = ""
    openai_model: str = ""  # must be set explicitly to use OpenAI
    openai_base_url: str = "https://api.openai.com/v1"

    # --- Uploads -----------------------------------------------------------
    max_upload_mb: int = 8

    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        Path(self.data_dir).mkdir(parents=True, exist_ok=True)
        return f"sqlite:///{Path(self.data_dir) / 'jarvis.db'}"

    @property
    def uploads_dir(self) -> Path:
        p = Path(self.data_dir) / "uploads"
        p.mkdir(parents=True, exist_ok=True)
        return p


@lru_cache
def get_settings() -> Settings:
    return Settings()
