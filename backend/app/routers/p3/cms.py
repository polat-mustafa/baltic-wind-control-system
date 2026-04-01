"""
Condition Monitoring System (CMS) API endpoints — M12.

Endpoints
---------
GET  /api/v1/scada/cms/fleet/overview               — 34-turbine health map
GET  /api/v1/scada/cms/turbines/{id}/health         — Per-component health index
GET  /api/v1/scada/cms/turbines/{id}/vibration      — FFT vibration spectrum
GET  /api/v1/scada/cms/turbines/{id}/oil-analysis   — Gearbox oil quality trend
GET  /api/v1/scada/cms/alerts                       — Active CMS alerts
POST /api/v1/scada/cms/turbines/{id}/simulate-fault — Inject degradation scenario

CMS is the primary tool for preventing unplanned offshore failures.
An unplanned main bearing failure on a 15 MW turbine costs €280k–€800k;
a planned replacement enabled by CMS costs ~€80k.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Path, Query

from app.schemas.cms import (
    CMSAlertResponse,
    FaultInjectionRequest,
    FaultInjectionResponse,
    FleetHealthResponse,
    OilAnalysisResponse,
    TurbineHealthResponse,
    VibrationSpectrumResponse,
)
from app.services.p3 import cms as svc

router = APIRouter(tags=["M12 Condition Monitoring"])

_VALID_COMPONENTS = {"MAIN_BEARING", "GEARBOX", "GENERATOR", "PITCH", "YAW"}


def _validate_turbine(turbine_id: str) -> str:
    """Validate turbine ID format WTG-01 to WTG-34."""
    # Accept WTG-01..WTG-34 and WTG01..WTG34
    tid = turbine_id.upper().replace("WTG", "WTG-").replace("--", "-")
    try:
        num = int(tid.split("-")[-1])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=f"Turbine '{turbine_id}' not found") from e
    if num < 1 or num > 34:
        raise HTTPException(status_code=404, detail=f"Turbine '{turbine_id}' not found")
    return f"WTG-{num:02d}"


@router.get(
    "/cms/fleet/overview",
    response_model=FleetHealthResponse,
    summary="Fleet CMS health overview",
)
async def get_fleet_overview() -> FleetHealthResponse:
    """Return health status for all 34 turbines.

    Provides a compact summary per turbine:
    - Overall health index (worst component dominates)
    - Alert level (GREEN / YELLOW / AMBER / RED / CRITICAL)
    - Worst component name (drives the overall status)
    - Number of active alerts

    Use this to populate the 34-turbine fleet grid coloured by
    health status. Drill into individual turbines for component detail.

    Physics: A single degraded main bearing pulling HI to 25 (RED)
    makes the whole turbine RED even if all other 4 components are GREEN.
    The 'worst component' field tells the operator exactly what to inspect.
    """
    return svc.get_fleet_health()


@router.get(
    "/cms/turbines/{turbine_id}/health",
    response_model=TurbineHealthResponse,
    summary="Turbine CMS health — all components",
)
async def get_turbine_health(
    turbine_id: str = Path(description="Turbine ID, e.g. 'WTG-01' or 'WTG01'"),
) -> TurbineHealthResponse:
    """Return per-component health index and vibration for one turbine.

    Returns health data for all 5 monitored components:
    - MAIN_BEARING : main shaft bearing (most failure-critical)
    - GEARBOX      : 3-stage gearbox (oil analysis included)
    - GENERATOR    : DFIG/PMSG windings + bearings
    - PITCH        : pitch actuator and blade bearing
    - YAW          : yaw drive motor and slew ring

    Each component shows:
    - Health Index (0–100)
    - ISO 10816-21 vibration zone (A–D)
    - Temperature vs baseline
    - Remaining Useful Life estimate [days]
    - Alert level recommendation

    ISO 10816-21:2015 defines vibration severity zones for wind turbines
    up to 15 MW (Class I: rigid tower, remote offshore site).
    """
    tid = _validate_turbine(turbine_id)
    return svc.get_turbine_health(tid)


@router.get(
    "/cms/turbines/{turbine_id}/vibration",
    response_model=VibrationSpectrumResponse,
    summary="Turbine vibration FFT spectrum",
)
async def get_vibration_spectrum(
    turbine_id: str = Path(description="Turbine ID, e.g. 'WTG-01'"),
    component: str = Query(
        default="MAIN_BEARING",
        description="Component: MAIN_BEARING / GEARBOX / GENERATOR / PITCH / YAW",
    ),
) -> VibrationSpectrumResponse:
    """Return FFT vibration spectrum for one component (0–500 Hz, 200 points).

    The spectrum enables expert identification of fault modes:

    Main bearing faults (BPFO/BPFI):
    - Outer race defect (BPFO): isolated peak at ~1.24 Hz + harmonics
    - Inner race defect (BPFI): modulated sidebands at ~1.85 Hz

    Gearbox faults:
    - Gear mesh frequency (GMF): peak at ~76 Hz
    - Sidebands at GMF ± shaft speed indicate eccentricity or wear

    Generator faults:
    - Electrical asymmetry: peaks at 100 Hz (2× supply frequency)
    - Rotor eccentricity: sidebands at 100 ± f_shaft

    Use Plotly log-log axes: x = frequency [Hz], y = amplitude [mm/s].
    Fault markers are included for BPFO, BPFI, GMF, and 100 Hz.
    """
    tid = _validate_turbine(turbine_id)
    comp = component.upper()
    if comp not in _VALID_COMPONENTS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid component '{component}'. Must be one of: {sorted(_VALID_COMPONENTS)}",
        )
    return svc.get_vibration_spectrum(tid, comp)


@router.get(
    "/cms/turbines/{turbine_id}/oil-analysis",
    response_model=OilAnalysisResponse,
    summary="Gearbox oil analysis trend",
)
async def get_oil_analysis(
    turbine_id: str = Path(description="Turbine ID, e.g. 'WTG-01'"),
) -> OilAnalysisResponse:
    """Return 12-month gearbox oil analysis trend.

    ISO 4406 oil cleanliness codes track contamination over time:
    - Target for wind turbine gearbox: <= 16/14/11
    - Watch level: 17/15/12 — schedule oil change
    - Alert level: 18/16/13 or worse — immediate oil change + analysis

    ISO 4406 code '18/16/13' means:
    - >1000 particles ≥ 4 µm per mL (first number = 2^17 to 2^18)
    - >250 particles ≥ 6 µm per mL
    - >40 particles ≥ 14 µm per mL

    Large particles ≥ 14 µm are the most damaging to bearing surfaces.
    Water content > 200 ppm accelerates oxidation and corrosion.
    """
    tid = _validate_turbine(turbine_id)
    return svc.get_oil_analysis(tid)


@router.get(
    "/cms/alerts",
    response_model=list[CMSAlertResponse],
    summary="Active CMS alerts",
)
async def get_active_alerts(
    min_level: str = Query(
        default="AMBER",
        description="Minimum alert level to return: YELLOW / AMBER / RED / CRITICAL",
    ),
) -> list[CMSAlertResponse]:
    """Return all active CMS degradation alerts.

    Filters to alerts at or above the specified minimum level:
    - YELLOW   : watch — schedule inspection at next service visit
    - AMBER    : inspect within 30 days
    - RED      : inspect within 7 days — arrange vessel and parts now
    - CRITICAL : immediate action — shutdown recommended

    In normal operation the fleet should have zero RED or CRITICAL alerts.
    Any alert at RED or CRITICAL warrants immediate escalation to the
    O&M manager and maintenance crew booking.
    """
    min_levels = {
        "YELLOW": {"YELLOW", "AMBER", "RED", "CRITICAL"},
        "AMBER": {"AMBER", "RED", "CRITICAL"},
        "RED": {"RED", "CRITICAL"},
        "CRITICAL": {"CRITICAL"},
    }
    allowed = min_levels.get(min_level.upper(), {"AMBER", "RED", "CRITICAL"})
    all_alerts = svc.get_active_alerts()
    return [a for a in all_alerts if a.alert_level in allowed]


@router.post(
    "/cms/turbines/{turbine_id}/simulate-fault",
    response_model=FaultInjectionResponse,
    summary="Inject a CMS degradation scenario",
)
async def simulate_fault(
    turbine_id: Annotated[str, Path(description="Turbine ID, e.g. 'WTG-01'")],
    body: Annotated[FaultInjectionRequest, Body()],
) -> FaultInjectionResponse:
    """Inject a simulated component degradation for training scenarios.

    Sets the specified component on an accelerated degradation trajectory.
    The health index will decrease at the specified rate, causing the
    component to progress through YELLOW → AMBER → RED → CRITICAL over
    hours to days depending on the severity.

    Degradation rates:
    - MINOR    : 0.5 HI/day — months to failure (early-stage wear)
    - MODERATE : 2.0 HI/day — weeks to failure (developing fault)
    - SEVERE   : 5.0 HI/day — days to failure (advanced fault)

    The injected fault persists until the server restarts. Use this endpoint
    in training scenarios to demonstrate:
    1. How CMS health index changes before failure is visible
    2. RUL estimation accuracy at different degradation stages
    3. Alert escalation from YELLOW → AMBER → RED → CRITICAL
    4. Weather window and maintenance scheduling response (M14)

    Physics: Real offshore bearing failures often progress from first
    detectable vibration signature to catastrophic failure in 6–18 months
    (MINOR), 2–6 months (MODERATE), or 2–6 weeks (SEVERE).
    """
    tid = _validate_turbine(turbine_id)
    comp = body.component.upper()
    if comp not in _VALID_COMPONENTS:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid component '{comp}'. Must be one of: {sorted(_VALID_COMPONENTS)}",
        )
    return svc.inject_degradation(
        tid,
        FaultInjectionRequest(
            component=comp,
            severity=body.severity,
            degradation_rate=body.degradation_rate,
        ),
    )
