"""
BESS (Battery Energy Storage System) API endpoints — M08.

Endpoints
---------
GET    /api/v1/grid/bess/status           — Current SOC, power, temperature, mode
POST   /api/v1/grid/bess/mode             — Set operating mode
POST   /api/v1/grid/bess/simulate/frequency-response  — FCR/FFR simulation
POST   /api/v1/grid/bess/simulate/ramp-smoothing      — Ramp smoothing simulation
POST   /api/v1/grid/bess/degradation      — 20-year degradation projection
POST   /api/v1/grid/ppc/bess-dispatch     — Enhanced WTG + BESS dispatch

System: 50 MW / 200 MWh LFP, collocated at Baltic Wind OSS (220 kV).
C-rate = 0.25 (4-hour discharge) — suitable for FCR, ramp smoothing, arbitrage.
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
    Return current BESS operating snapshot.

    **Physics — what SOC means for Baltic Wind:**

    State of Charge (SOC) = remaining energy / total capacity.
    For 50 MW / 200 MWh at SOC = 60%:
    - Stored energy: 120 MWh
    - Available to discharge: 120 - 20 MWh (SOC_min=10%) = 100 MWh
    - Discharge duration at rated power: 100 / 50 = 2 hours

    **Operating window 10-90% SOC:**
    LFP chemistry (LiFePO4) allows very deep cycling but limiting to 10-90%
    (80% DoD) extends cycle life significantly:
    - At 100% DoD: ~2000 cycles to 80% SOH
    - At 80% DoD: ~3000 cycles
    - At 60% DoD: ~5000 cycles

    For a 25-year farm lifetime, ~300 cycles/year x 25 = 7500 cycles.
    At 80% DoD, LFP achieves EOL in ~10 years — one replacement during farm life.

    **State of Health (SOH):**
    SOH = current capacity / nameplate capacity. EOL at 80% SOH (20% fade).
    Baltic Wind BESS at commissioning: SOH ≈ 99.5% (delivered slightly worn in).
    """
    result = svc.get_status()
    return BESSStatusResponse(**result)


@router.post(
    "/bess/mode",
    response_model=BESSModeResponse,
    summary="Set BESS operating mode",
)
async def set_bess_mode(body: BESSModeRequest) -> BESSModeResponse:
    """
    Change BESS operating mode with transition validation.

    **Mode descriptions:**

    | Mode | Description |
    |------|------------|
    | STANDBY | Zero power, SOC maintained |
    | CHARGE | Absorb power from wind surplus or grid |
    | DISCHARGE | Inject power to grid |
    | FREQUENCY_RESPONSE | Auto FCR/FFR (ENTSO-E Network Code) |
    | RAMP_SMOOTHING | Track WTG ramp and fill gaps |
    | ARBITRAGE | Optimise charge/discharge vs DA price forecast |
    | TEST | Commissioning mode — capacity test |

    **Transition constraints:**
    - CHARGE blocked if SOC >= 90%
    - DISCHARGE blocked if SOC <= 10%
    - FREQUENCY_RESPONSE requires SOC >= 20% (minimum reserve for FCR window)

    **FCR droop (ENTSO-E NC FCR):**
    At 5% droop, a 0.5 Hz frequency deviation (1% of 50 Hz) triggers 20% rated
    power: P_bess = 50 MW * (0.5 Hz / (50 Hz * 0.05)) = 10 MW discharge.
    Full activation at ±0.5 Hz: P_bess = ±50 MW within 30 seconds.
    """
    result = svc.set_mode(body.mode, body.power_setpoint_mw, body.soc_target_pct)
    return BESSModeResponse(**result)


@router.post(
    "/bess/simulate/frequency-response",
    response_model=FrequencyResponseResult,
    summary="FCR/FFR simulation — frequency event response",
)
async def simulate_frequency_response(
    body: FrequencyResponseRequest,
) -> FrequencyResponseResult:
    """
    Simulate BESS response to a grid frequency event (FCR + FFR).

    **Physics — why frequency response matters:**

    When a large generator trips on the synchronous grid, frequency drops
    (less generation than load). Under-frequency relays will shed load at:
    - 49.0 Hz — automatic load shedding (PSE requirement)
    - 48.5 Hz — mandatory trip of generators
    - 47.5 Hz — widespread blackout risk

    BESS provides two response layers:

    **FCR (Frequency Containment Reserve):**
    - Responds proportionally within ±200 mHz deadband to ±500 mHz
    - Fully activated at ±500 mHz (droop 5% = 20% Prated per % frequency deviation)
    - Purpose: slow down frequency fall, allow slower primary response (hydro, gas)

    **FFR (Fast Frequency Response):**
    - Activated below 49.7 Hz (configurable)
    - BESS responds at full rated power within 200 ms
    - Purpose: prevent nadir from falling below 49.0 Hz before conventional plants react
    - LFP BESS response time: 150-200 ms (inverter-limited, not chemistry-limited)

    **Baltic Wind BESS impact:**
    50 MW FFR injection into 2500 MVA system: Δf recovery ≈ 50/2500 * 50 = 1 Hz/s
    — significant mitigation of frequency decline rate (RoCoF).

    **Try this:** input [50.0, 49.95, 49.85, 49.7, 49.55, 49.45, 49.5, 49.6, 49.75, 49.9]
    to simulate a typical Nordic system frequency dip from generator trip.
    """
    result = svc.simulate_frequency_response(
        body.frequency_trace_hz,
        body.fcr_droop_pct,
        body.ffr_threshold_hz,
        body.initial_soc_pct,
    )
    return FrequencyResponseResult(**result)


@router.post(
    "/bess/simulate/ramp-smoothing",
    response_model=RampSmoothingResult,
    summary="BESS ramp smoothing — PSE IRiESP ramp rate compliance",
)
async def simulate_ramp_smoothing(body: RampSmoothingRequest) -> RampSmoothingResult:
    """
    Simulate BESS ramp smoothing to comply with PSE IRiESP ramp rate limit.

    **Regulation: PSE IRiESP Art. 6.3**
    Maximum active power ramp rate at the POC: **10% Pn per minute**.
    For 510 MW Baltic Wind: ramp limit = **51 MW/min**.

    Without BESS, a wind gust ramp of 200 MW/min would cause:
    - Grid voltage fluctuation (dV/dt stress on transformers)
    - Frequency deviation (delta_P into grid inertia)
    - Potential under/over-voltage tripping at 220 kV

    **BESS ramp smoothing algorithm:**
    1. Target POC follows a ramp-limited trajectory of the WTG output
    2. BESS provides the difference: P_bess = P_target_poc - P_wtg_actual
    3. During steep WTG ramp-up: BESS absorbs surplus (charging) to keep POC smooth
    4. During steep WTG ramp-down: BESS discharges to maintain POC level

    **Try this:** supply a wind trace with a 200 MW/min ramp:
    [100, 200, 350, 480, 510] — BESS absorbs the ramp, smoothed output stays ~51 MW/min.
    """
    result = svc.simulate_ramp_smoothing(
        body.wind_power_trace_mw,
        body.max_ramp_rate_mw_per_min,
        body.initial_soc_pct,
    )
    return RampSmoothingResult(**result)


@router.post(
    "/bess/degradation",
    response_model=DegradationResponse,
    summary="20-year BESS degradation projection (LFP model)",
)
async def project_degradation(body: DegradationRequest) -> DegradationResponse:
    """
    Project BESS State of Health (SOH) over the farm lifetime.

    **LFP degradation mechanisms:**

    1. **Cycle ageing:** each charge/discharge cycle consumes battery life.
       LFP is exceptionally durable: ~3000 cycles to 80% SOH at 80% DoD.
       Vs NMC: ~1500-2000 cycles (but higher energy density).
       For Baltic Wind: LFP chosen for safety + longevity in offshore environment.

    2. **Calendar ageing:** even without cycling, battery capacity fades.
       LFP calendar fade: ~0.5% SOH/year at 25°C ambient.
       For 20-year farm: calendar fade alone ~10% — significant but manageable.

    3. **DoD sensitivity:**
       N_effective = N_design * (DoD_ref / DoD)^1.5
       Reducing DoD from 80% to 60% extends cycle life by ~57%.
       This is why 10-90% SOC window (80% DoD) is carefully chosen.

    **Combined model:** SOH = 100% - max(cycle_loss, calendar_loss).

    **EOL criteria:** SOH < 80% (energy available = 0.8 * 200 MWh = 160 MWh).
    After EOL, BESS is replaced or repurposed for second-life applications.

    **Commercial note:**
    LFP replacement cost at EOL (~2036): ~200-250 EUR/kWh = 40-50 M EUR for 200 MWh.
    This cost must be included in the farm's LCOE calculation.
    """
    result = svc.calculate_degradation(
        body.years,
        body.annual_cycles,
        body.avg_dod_pct,
    )
    return DegradationResponse(**result)


@router.post(
    "/ppc/bess-dispatch",
    response_model=BESSDispatchResponse,
    summary="Enhanced WTG + BESS combined dispatch",
)
async def bess_dispatch(body: BESSDispatchRequest) -> BESSDispatchResponse:
    """
    Dispatch WTG + BESS together to meet grid operator power setpoint.

    **Extension of PPC pro-rata algorithm (M08 adds BESS layer):**

    The existing PPC (Power Plant Controller) dispatches WTGs pro-rata:
        P_i = P_target * (P_avail_i / sum(P_avail))

    With BESS, two scenarios:

    **Case 1: Wind curtailment (P_target < P_available_WTG)**
    - WTGs are curtailed to P_target
    - BESS can absorb surplus (charge) if SOC < 90%
    - Benefit: avoid WTG curtailment losses, store for later dispatch

    **Case 2: Wind deficit (P_target > P_available_WTG)**
    - WTGs run at maximum available
    - BESS discharges deficit up to 50 MW
    - Total POC = WTG_max + BESS_discharge
    - If deficit > 50 MW: shortfall reported (POC < target)

    **Why this matters commercially:**
    In a 24-hour period with variable wind, BESS allows:
    - Morning: charge from excess overnight wind (cheap)
    - Evening peak: discharge during high-price period
    - Frequency events: always maintain SOC > 30% for FCR reserve

    **PSE contractual value:**
    BSP (Balancing Service Provider) agreement allows selling FCR capacity:
    ~8 EUR/MW/h * 50 MW = 3.5 M EUR/year additional revenue.
    """
    result = svc.dispatch_bess(
        body.p_target_mw,
        body.p_available_wtg_mw,
        body.current_soc_pct,
    )
    return BESSDispatchResponse(**result)
