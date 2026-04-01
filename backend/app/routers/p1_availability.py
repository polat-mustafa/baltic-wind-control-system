"""
Availability Tracking API endpoints — M13 (IEC 61400-26).

Endpoints
---------
GET    /api/v1/wind/availability/fleet            — Fleet TBA/EBA/PBA KPIs
GET    /api/v1/wind/availability/turbine/{id}     — Single turbine KPIs
GET    /api/v1/wind/availability/breakdown/{scope} — IEC 61400-26 category breakdown

Standards
---------
IEC 61400-26-1:2019 — Time-based availability
IEC 61400-26-2:2014 — Production-based availability
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.availability import (
    DowntimeBreakdownResponse,
    FarmAvailabilityResponse,
    TurbineAvailabilityKPI,
)
from app.services.p1 import availability as svc

router = APIRouter(tags=["M13 Availability Tracking IEC 61400-26"])


@router.get(
    "/availability/fleet",
    response_model=FarmAvailabilityResponse,
    summary="Fleet availability KPIs (IEC 61400-26 TBA/EBA/PBA)",
)
async def get_fleet_availability(period_hours: float = 8760.0) -> FarmAvailabilityResponse:
    """
    Return IEC 61400-26 availability KPIs for all 34 Baltic Wind turbines.

    **Three availability KPIs (why three? each answers a different question):**

    **TBA — Time-Based Availability:**
    "How many hours was the turbine available?"
    TBA = producing_hours / total_hours

    Simple to calculate, but misleading in high-wind periods:
    A 24h outage during a 15 m/s storm (max power) counts the same as
    a 24h outage during calm weather. TBA = 97% even if all downtime hits
    the best wind periods.

    **EBA — Energy-Based Availability:**
    "How much energy could we have produced if we hadn't had downtime?"
    EBA = actual_energy / theoretical_energy_without_downtime

    Better metric: weights downtime by how much wind was blowing.
    A fault during a windstorm reduces EBA much more than the same fault
    in calm weather. Typical offshore EBA < TBA by 0.5-1.5%.

    **PBA — Production-Based Availability:**
    "What fraction of potential production was actually delivered?"
    PBA = 1 - avoidable_energy_loss / theoretical_energy

    Excludes force majeure (icing, extreme weather) and grid curtailment
    from the denominator — these are not the operator's fault.
    PBA is the most meaningful KPI for lender/investor availability guarantees.

    **Baltic Wind targets (PSE connection agreement):**
    TBA >= 97%, EBA >= 95%, PBA >= 94%.
    Failure to meet these triggers availability warranty payments from the EPC contractor.

    **Worst vs best turbine:**
    Significant spread is normal (± 2% TBA). Consistent underperformers
    warrant CMS investigation (M12) — vibration, oil analysis, rotor imbalance.
    """
    result = svc.get_fleet_availability(period_hours)
    return FarmAvailabilityResponse(**result)


@router.get(
    "/availability/turbine/{turbine_id}",
    response_model=TurbineAvailabilityKPI,
    summary="Single turbine availability KPIs",
)
async def get_turbine_availability(
    turbine_id: str,
    period_hours: float = 8760.0,
) -> TurbineAvailabilityKPI:
    """
    Return IEC 61400-26 availability KPIs for a specific turbine.

    **Turbine IDs:** WTG-01 through WTG-34.

    **MTBF and MTTR — reliability engineering KPIs:**

    MTBF (Mean Time Between Failures) = total_hours / fault_count
    - V236-15.0 MW target: > 1200 hours (~50 days between faults)
    - Industry average offshore: 700-1500 hours MTBF

    MTTR (Mean Time To Repair) = total_repair_time / fault_count
    - Offshore turbine: 8-24 hours (weather window dependency)
    - Onshore benchmark: 4-8 hours (no vessel/helicopter required)

    **Why offshore MTTR is 2-3x onshore:**
    - Jack-up vessel mobilisation: 2-7 days waiting for weather window
    - Helicopter access: only < 12 m/s wind, < 2m wave height
    - Crane operations: only < 8 m/s wind
    - Spare parts in Rotterdam warehouse → logistics chain

    This is why Condition Monitoring (M12) is critical offshore:
    Predictive maintenance plans the work during a weather window,
    dramatically reducing MTTR and crane call-out costs.

    **Fault types:**
    Most offshore faults (55%) are electrical: converter, pitch drive, transformer.
    Mechanical (25%): gearbox, main bearing, yaw drive.
    Control/sensor (20%): anemometer, encoders, blade sensors.
    """
    result = svc.get_turbine_availability(turbine_id, period_hours)
    return TurbineAvailabilityKPI(**result)


@router.get(
    "/availability/breakdown/{scope}",
    response_model=DowntimeBreakdownResponse,
    summary="IEC 61400-26 downtime category breakdown",
)
async def get_downtime_breakdown(
    scope: str,
    period_hours: float = 8760.0,
) -> DowntimeBreakdownResponse:
    """
    Return downtime hours by IEC 61400-26 category for fleet or specific turbine.

    **Scope:** 'FLEET' (all 34 turbines) or turbine ID (e.g., 'WTG-01').

    **IEC 61400-26-1 downtime categories:**

    | Category | Description | Typical % |
    |----------|-------------|-----------|
    | PRODUCING | Normal operation | 96-98% |
    | SCHEDULED_MAINTENANCE | Planned service | 1-2% |
    | UNSCHEDULED_MAINTENANCE | Fault/breakdown | 0.5-1% |
    | FORCE_MAJEURE | Icing, extreme weather | 0.1-0.5% |
    | GRID_CURTAILMENT | TSO/PSE constraint | 0.5-1% |
    | NOISE_CURTAILMENT | Residential noise | < 0.1% |
    | TECHNICAL_STANDBY | Grid unavailable | < 0.1% |

    **Controllable vs uncontrollable downtime:**
    IEC 61400-26 distinguishes what the operator can influence:
    - Controllable: scheduled + unscheduled maintenance
    - Uncontrollable: force majeure, grid curtailment (external)

    Target: controllable downtime < 2% of total operating hours.
    Above 4%: O&M process investigation required.

    **Why PSE needs this breakdown:**
    PSE connection agreement requires annual availability report with
    IEC 61400-26 category breakdown. Grid curtailment hours are excluded
    from PBA calculation — PSE cannot penalise the developer for hours
    it ordered the farm to curtail.
    """
    result = svc.get_downtime_breakdown(scope, period_hours)
    return DowntimeBreakdownResponse(**result)
