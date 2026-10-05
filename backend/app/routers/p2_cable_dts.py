"""
Cable DTS thermal monitoring API endpoints — M10.

Endpoints
---------
GET    /api/v1/grid/cable/dts/profile    — fibre reading + conductor estimate along 45 km
POST   /api/v1/grid/cable/dts/transient  — conductor temperature after a current step

One circuit of the 220 kV export cable; currents are per circuit.
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.schemas.cable_dts import DTSProfileResponse, DTSTransientRequest, DTSTransientResponse
from app.services.p2 import cable_dts as svc

router = APIRouter(prefix="/cable", tags=["M10 Cable DTS Thermal Monitoring"])


@router.get(
    "/dts/profile",
    response_model=DTSProfileResponse,
    summary="DTS profile and steady-state rating of one export circuit",
)
async def get_dts_profile(
    current_a: float = Query(730.0, ge=0.0, le=1600.0),
    ambient_temp_c: float = Query(15.0, ge=-5.0, le=35.0),
) -> DTSProfileResponse:
    """
    Steady-state temperature every 100 m along the 45 km route.

    DTS measures the fibre; the conductor temperature is estimated as
    fibre + (W_c + ½W_d)·T_int. Losses follow IEC 60287-1-1: R_AC rises with
    temperature, and the dielectric loss counts because U0 = 127 kV.

    The rating at the given ambient is the current that holds the worst zone
    at 90 °C; the OSS J-tube (cable in air) sets it. 950 A at 15 °C is the
    calibration point.
    """
    return DTSProfileResponse(**svc.simulate_dts(current_a, ambient_temp_c))


@router.post(
    "/dts/transient",
    response_model=DTSTransientResponse,
    summary="Emergency loading — conductor temperature after a current step",
)
async def simulate_transient(body: DTSTransientRequest) -> DTSTransientResponse:
    """
    Step from the pre-fault current to an emergency current — for example the
    surviving circuit after an N-1 trip (≈ 1 360 A at 510 MW) — and track the
    conductor temperature in each zone with a two-node thermal ladder.

    Above the steady-state rating the cable still has hours before 90 °C
    because of its thermal capacity; that time is what the operator has to
    curtail. Time constants are labelled assumptions.
    """
    return DTSTransientResponse(
        **svc.simulate_transient(
            body.prefault_current_a,
            body.emergency_current_a,
            body.ambient_temp_c,
            body.duration_h,
        )
    )
