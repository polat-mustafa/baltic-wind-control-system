"""
Baltic Wind HV Control Platform — FastAPI Application

Entry point for the 510 MW Baltic Sea offshore wind farm simulation
platform. Manages application lifespan (Redis init, DB seed, shutdown)
and provides an enhanced health endpoint for Docker/CI readiness checks.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.core.cache import close_redis, init_redis, redis_ping
from app.core.exceptions import register_exception_handlers
from app.core.middleware import RequestLoggingMiddleware
from app.db import async_session_factory, engine
from app.routers.digital_twin import router as digital_twin_router
from app.routers.p1 import router as p1_router
from app.routers.p2 import router as p2_router
from app.routers.p3 import router as p3_router
from app.routers.p4 import router as p4_router
from app.routers.p5 import router as p5_router
from app.routers.turbine_physics import router as turbine_physics_router
from app.seed import seed_default_farm

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Application startup and shutdown lifecycle.

    Startup:
    1. Initialise Redis connection (graceful if unavailable)
    2. Seed the reference wind farm (idempotent)

    Shutdown:
    1. Close Redis connection
    2. Dispose SQLAlchemy engine (close all DB connections)
    """
    # ── Startup ──────────────────────────────────────────────────
    await init_redis()

    try:
        await seed_default_farm()
    except Exception:
        logger.warning("Seed failed — database may not be migrated yet")

    yield

    # ── Shutdown ─────────────────────────────────────────────────
    await close_redis()
    await engine.dispose()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Baltic Wind HV Control Platform",
    description="510 MW Baltic Sea Offshore Wind Farm Simulation",
    version="0.1.0",
    lifespan=lifespan,
)

register_exception_handlers(app)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(p1_router)
app.include_router(p2_router)
app.include_router(p3_router)
app.include_router(p4_router)
app.include_router(p5_router)
app.include_router(turbine_physics_router)
app.include_router(digital_twin_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Enhanced health check — probes DB and Redis.

    Returns ``{"status": "ok"}`` if all services are reachable,
    ``{"status": "degraded"}`` if some are down. Individual service
    status is included for observability.
    """
    # Database check
    db_ok = False
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        pass

    # Redis check
    redis_ok = await redis_ping()

    overall = "ok" if (db_ok and redis_ok) else "degraded"

    return {
        "status": overall,
        "database": "ok" if db_ok else "unavailable",
        "redis": "ok" if redis_ok else "unavailable",
    }
