"""
Application configuration via environment variables.

Uses Pydantic Settings to load from .env files or environment variables.
All secrets (DB passwords, API keys) come from environment — never hardcoded.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "Baltic Wind HV Control Platform"
    debug: bool = False

    # Database (PostgreSQL + TimescaleDB)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/balticwind"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]


settings = Settings()
