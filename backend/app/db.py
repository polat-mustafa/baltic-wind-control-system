"""
Async database engine, session factory, and declarative base.

All database access in the platform goes through this module.
SQLAlchemy 2.0 async style with asyncpg driver for PostgreSQL + TimescaleDB.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=10,
    max_overflow=20,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all ORM models."""


async def get_session() -> AsyncGenerator[AsyncSession]:
    """FastAPI dependency — yields an async database session."""
    async with async_session_factory() as session:
        yield session
