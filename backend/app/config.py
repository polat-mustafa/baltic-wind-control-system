"""
Application configuration via environment variables.

Uses Pydantic Settings to load from .env files or environment variables.
All secrets (DB passwords, API keys) come from environment — never hardcoded.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/.env, wherever uvicorn is started from (a bare ".env" is resolved
# against the working directory, so starting from the repo root lost every key).
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "OffshoreForge"
    debug: bool = False

    # Database (PostgreSQL + TimescaleDB)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Live AIS (aisstream.io, free key) — optional; without it the map shows no traffic
    aisstream_api_key: str | None = None

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]


settings = Settings()
