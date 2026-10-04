"""
N-1 security API.

POST /api/v1/grid/security/n1 — base case and every single outage of the
contingency list (6 string feeders, 1 export circuit, 1 OSS and 1 onshore
transformer), with the corrective PPC runback where a limit is exceeded.
"""

from __future__ import annotations

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.schemas.n1_security import N1Request, N1Response
from app.services.p2.n1_security import run_n1_security

router = APIRouter(tags=["P2 N-1 Security"])


@router.post("/security/n1", response_model=N1Response, summary="N-1 security study")
async def n1_security(body: N1Request) -> N1Response:
    """AC load flows with STATCOM re-dispatch; corrective runback by bisection (~3 s, cached)."""
    result = await run_in_threadpool(
        run_n1_security, round(body.generation_fraction, 2), body.grid_ssc_mva
    )
    return N1Response(**result)
