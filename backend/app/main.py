"""
Baltic Wind HV Control Platform — FastAPI Application

Minimal entry point for the 510 MW Baltic Sea offshore wind farm
simulation platform. Provides a health endpoint for Docker and CI
readiness checks.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

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


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Liveness probe for Docker and Kubernetes."""
    return {"status": "ok"}
