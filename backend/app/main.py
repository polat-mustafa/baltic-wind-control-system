"""
Baltic Wind HV Control Platform — FastAPI Application

Minimal entry point for the 510 MW Baltic Sea offshore wind farm
simulation platform. Provides a health endpoint for Docker and CI
readiness checks.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.p3 import router as p3_router
from app.routers.p4 import router as p4_router

app = FastAPI(
    title="Baltic Wind HV Control Platform",
    description="510 MW Baltic Sea Offshore Wind Farm Simulation",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(p3_router)
app.include_router(p4_router)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness probe for Docker and Kubernetes."""
    return {"status": "ok"}
