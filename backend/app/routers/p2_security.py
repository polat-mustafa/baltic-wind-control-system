"""
N-1 security API.

POST /api/v1/grid/security/n1 — base case and every single outage of the
contingency list (6 string feeders, 1 export circuit, 1 OSS and 1 onshore
transformer), with the corrective PPC runback where a limit is exceeded.
POST /api/v1/grid/dynamics/andes — RMS simulation (ANDES, WECC REGCA1/REECA1/
REPCA1) of an over-frequency event (LFSM-O) or a fault at the POC (FRT).
"""

from __future__ import annotations

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.schemas.n1_security import DynamicsRequest, DynamicsResponse, N1Request, N1Response
from app.services.p2.andes_dynamics import run_event
from app.services.p2.n1_security import run_n1_security

router = APIRouter(tags=["P2 N-1 Security"])


@router.post("/security/n1", response_model=N1Response, summary="N-1 security study")
async def n1_security(body: N1Request) -> N1Response:
    """AC load flows with STATCOM re-dispatch; corrective runback by bisection (~3 s, cached)."""
    result = await run_in_threadpool(
        run_n1_security, round(body.generation_fraction, 2), body.grid_ssc_mva
    )
    return N1Response(**result)


@router.post("/dynamics/andes", response_model=DynamicsResponse, summary="ANDES RMS event")
async def andes_dynamics(body: DynamicsRequest) -> DynamicsResponse:
    """WECC generic plant model against an over-frequency or a POC fault (4–12 s, cached)."""
    result = await run_in_threadpool(
        run_event,
        body.event,
        round(body.load_trip_mw, -2),
        round(body.retained_voltage_pu, 2),
    )
    return DynamicsResponse(**result)
