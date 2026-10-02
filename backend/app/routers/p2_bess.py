"""
BESS (Battery Energy Storage System) API endpoints — M08.

Endpoints
---------
GET    /api/v1/grid/bess/status                       — SOC, power, temperature, mode
POST   /api/v1/grid/bess/mode                         — set operating mode
POST   /api/v1/grid/bess/simulate/frequency-response  — FCR to a frequency trace
POST   /api/v1/grid/bess/simulate/ramp-smoothing      — ramp-limited POC output
POST   /api/v1/grid/bess/degradation                  — SOH projection
POST   /api/v1/grid/ppc/bess-dispatch                 — WTG + BESS dispatch

System: 50 MW / 200 MWh LFP at the OSS (C-rate 0.25, 4 h). Battery power is
positive when discharging (generator convention).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.bess import (
    BESSDispatchRequest,
    BESSDispatchResponse,
    BESSModeRequest,
    BESSModeResponse,
    BESSStatusResponse,
    DegradationRequest,
    DegradationResponse,
    FrequencyResponseRequest,
    FrequencyResponseResult,
    RampSmoothingRequest,
    RampSmoothingResult,
)
from app.services.p2 import bess as svc

router = APIRouter(tags=["M08 BESS Integration"])


@router.get(
    "/bess/status",
    response_model=BESSStatusResponse,
    summary="BESS operating state — SOC, power, mode",
)
async def get_bess_status() -> BESSStatusResponse:
    """
    Current BESS snapshot.

    At SOC 60 % the 200 MWh battery holds 120 MWh; above the 10 % floor
    100 MWh can be discharged — 2 h at 50 MW. SOH = present capacity /
    nameplate; end of life is taken at 80 % SOH.
    """
    return BESSStatusResponse(**svc.get_status())


@router.post("/bess/mode", response_model=BESSModeResponse, summary="Set BESS operating mode")
async def set_bess_mode(body: BESSModeRequest) -> BESSModeResponse:
    """
    Change the operating mode.

    - CHARGE is refused at SOC ≥ 90 %, DISCHARGE at SOC ≤ 10 %.
    - FREQUENCY_RESPONSE needs ≥ 15 min of full-power energy above the SOC
      floor — the lower bound of the limited-energy-reservoir time in SO GL
      Art. 156 (TSOs set 15–30 min).
    - In FREQUENCY_RESPONSE and RAMP_SMOOTHING the setpoint is automatic.
    """
    return BESSModeResponse(**svc.set_mode(body.mode, body.power_setpoint_mw, body.soc_target_pct))


@router.post(
    "/bess/simulate/frequency-response",
    response_model=FrequencyResponseResult,
    summary="FCR response to a frequency trace",
)
async def simulate_frequency_response(
    body: FrequencyResponseRequest,
) -> FrequencyResponseResult:
    """
    Battery response to a 1 s frequency trace.

    **FCR, Continental Europe (SO GL, EU 2017/1485):** linear characteristic,
    full capacity at ±200 mHz, measurement insensitivity ±10 mHz, full
    activation within 30 s: P = P_FCR · (50 − f) / 0.2 Hz, clamped to ±P_FCR.

    **Optional FFR step:** below `ffr_threshold_hz` the battery jumps to full
    discharge — an example of a fast product as procured by the Nordic TSOs,
    not a PSE service.

    The frequency trace is an input: 50 MW cannot move the frequency of the
    CE synchronous area, so the battery does not feed back into it.
    """
    return FrequencyResponseResult(
        **svc.simulate_frequency_response(
            body.frequency_trace_hz,
            body.fcr_capacity_mw,
            body.ffr_threshold_hz,
            body.initial_soc_pct,
        )
    )


@router.post(
    "/bess/simulate/ramp-smoothing",
    response_model=RampSmoothingResult,
    summary="BESS ramp smoothing at the POC",
)
async def simulate_ramp_smoothing(body: RampSmoothingRequest) -> RampSmoothingResult:
    """
    Keep the POC output within a ramp-rate limit (1 min steps).

    The limit is a plant setting agreed with the TSO — 51 MW/min (10 % of
    510 MW per minute) is used as an example. The POC follows a ramp-limited
    trajectory of the wind output and the battery supplies the difference:
    it charges while the wind rises faster than allowed and discharges while
    it falls. When the battery hits 50 MW or an SOC limit, the remaining
    violation is reported.
    """
    return RampSmoothingResult(
        **svc.simulate_ramp_smoothing(
            body.wind_power_trace_mw,
            body.max_ramp_rate_mw_per_min,
            body.initial_soc_pct,
        )
    )


@router.post(
    "/bess/degradation",
    response_model=DegradationResponse,
    summary="BESS state-of-health projection (LFP)",
)
async def project_degradation(body: DegradationRequest) -> DegradationResponse:
    """
    SOH over the years — an empirical LFP model with labelled assumptions.

    SOH = 100 % − cycle loss − calendar loss, with
    - cycle loss: 20 % after 3000 equivalent full cycles at 80 % DoD, the
      cycle count scaled by (80 % / DoD)^1.5;
    - calendar loss: 0.5 %/year.

    End of life at 80 % SOH. Replacement cost assumes 350 EUR/kWh; it is
    spread over the energy the battery discharges until then.
    """
    return DegradationResponse(
        **svc.calculate_degradation(body.years, body.annual_cycles, body.avg_dod_pct)
    )


@router.post(
    "/ppc/bess-dispatch",
    response_model=BESSDispatchResponse,
    summary="WTG + BESS combined dispatch",
)
async def bess_dispatch(body: BESSDispatchRequest) -> BESSDispatchResponse:
    """
    Meet the TSO setpoint at the POC with turbines and battery.

    - **Surplus** (P_target < P_available): instead of curtailing, the turbines
      produce P_target + P_charge and the battery stores P_charge; the POC
      stays on target.
    - **Deficit** (P_target > P_available): the turbines run at maximum and
      the battery discharges up to 50 MW; any shortfall is flagged.
    """
    return BESSDispatchResponse(
        **svc.dispatch_bess(body.p_target_mw, body.p_available_wtg_mw, body.current_soc_pct)
    )
