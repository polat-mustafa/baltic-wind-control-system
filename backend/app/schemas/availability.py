"""
Pydantic schemas for Availability Tracking — M13 (IEC 61400-26).

IEC 61400-26:2019 defines standardised downtime categories for wind turbines:

Category hierarchy (simplified):
  Turbine available
  Turbine standby
  Turbine unavailable:
    - Technical standby (grid unavailability)
    - Scheduled maintenance
    - Unscheduled maintenance (fault/breakdown)
    - Force majeure (icing, lightning, grid curtailment)
    - External influence (operator request, noise curtailment)

Three KPIs (IEC 61400-26):
  TBA — Time-Based Availability: operational hours / total hours
  EBA — Energy-Based Availability: actual / potential energy production
  PBA — Production-Based Availability: normalised for wind resource
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class DowntimeCategory(str, Enum):  # noqa: UP042
    """IEC 61400-26-1:2019 Table 1 downtime categories."""

    PRODUCING = "PRODUCING"  # Turbine operating normally
    TECHNICAL_STANDBY = "TECHNICAL_STANDBY"  # Available but grid unavailable
    SCHEDULED_MAINTENANCE = "SCHEDULED_MAINTENANCE"
    UNSCHEDULED_MAINTENANCE = "UNSCHEDULED_MAINTENANCE"  # Fault / breakdown
    FORCE_MAJEURE = "FORCE_MAJEURE"  # Icing, extreme weather, lightning
    GRID_CURTAILMENT = "GRID_CURTAILMENT"  # TSO/operator curtailment request
    NOISE_CURTAILMENT = "NOISE_CURTAILMENT"  # Noise or shadow restrictions
    TESTING = "TESTING"  # Commissioning / performance test
    UNKNOWN = "UNKNOWN"  # Not yet classified


class DowntimeEventCreate(BaseModel):
    """Create a new downtime event for a turbine."""

    turbine_id: str = Field(
        description="Turbine identifier (e.g., WTG-01 to WTG-34)",
        pattern=r"WTG-\d{2}",
    )
    category: DowntimeCategory
    start_utc: str = Field(description="Start time in ISO 8601 UTC format")
    end_utc: str | None = Field(
        default=None,
        description="End time (None if event still ongoing)",
    )
    alarm_code: str | None = Field(
        default=None,
        description="SCADA alarm code that triggered this event (links to SOE/alarm log)",
    )
    description: str = Field(default="", description="Free-text description")
    energy_loss_mwh: float = Field(
        default=0.0,
        ge=0.0,
        description=(
            "Estimated energy loss during downtime [MWh]. "
            "For fault events: calculated from P50 wind during outage period."
        ),
    )


class DowntimeEventResponse(DowntimeEventCreate):
    """Downtime event with computed fields."""

    id: str
    duration_hours: float = Field(description="Event duration [hours]")
    lost_revenue_eur: float = Field(description="Revenue lost at average DA price [EUR]")


# ── Availability KPIs ─────────────────────────────────────────────────────────


class TurbineAvailabilityKPI(BaseModel):
    """IEC 61400-26 availability KPIs for one turbine."""

    turbine_id: str
    period_hours: float = Field(description="Analysis period duration [hours]")
    tba_pct: float = Field(
        description=(
            "Time-Based Availability [%] = hours_producing / total_hours * 100. Target: >= 97%"
        )
    )
    eba_pct: float = Field(
        description=(
            "Energy-Based Availability [%] = "
            "actual_AEP / theoretical_AEP * 100. "
            "Penalises downtime during high wind periods."
        )
    )
    pba_pct: float = Field(
        description=(
            "Production-Based Availability [%] = "
            "weighted availability accounting for wind resource distribution. "
            "Most representative for investor reporting."
        )
    )
    hours_producing: float
    hours_scheduled_maintenance: float
    hours_unscheduled_maintenance: float
    hours_force_majeure: float
    hours_curtailment: float
    hours_unknown: float
    energy_loss_mwh: float
    mtbf_hours: float = Field(description="Mean Time Between Failures [hours]")
    mttr_hours: float = Field(description="Mean Time To Repair [hours]")
    fault_count: int


class FarmAvailabilityResponse(BaseModel):
    """Fleet-level availability report for Baltic Wind (34 WTGs)."""

    period_start: str
    period_end: str
    turbines: list[TurbineAvailabilityKPI]
    fleet_tba_pct: float = Field(description="Fleet weighted TBA [%]")
    fleet_eba_pct: float = Field(description="Fleet weighted EBA [%]")
    fleet_pba_pct: float = Field(description="Fleet weighted PBA [%]")
    total_energy_loss_mwh: float
    total_revenue_loss_eur: float
    worst_turbine: str = Field(description="Turbine ID with lowest EBA")
    best_turbine: str = Field(description="Turbine ID with highest EBA")
    fleet_mtbf_hours: float
    fleet_mttr_hours: float
    assessment: str


# ── Downtime analysis ─────────────────────────────────────────────────────────


class DowntimeCategoryBreakdown(BaseModel):
    """Hours and percentage per IEC 61400-26 category."""

    category: DowntimeCategory
    hours: float
    share_pct: float
    energy_loss_mwh: float
    revenue_loss_eur: float


class DowntimeBreakdownResponse(BaseModel):
    """IEC 61400-26 downtime category breakdown for fleet or turbine."""

    scope: str = Field(description="'FLEET' or turbine ID (e.g., 'WTG-01')")
    period_hours: float
    categories: list[DowntimeCategoryBreakdown]
    dominant_category: DowntimeCategory
    controllable_loss_pct: float = Field(
        description=(
            "Percentage of downtime from controllable causes "
            "(scheduled + unscheduled maintenance). "
            "Target: < 2% of annual hours."
        )
    )
    assessment: str


# ── LOTO integration ──────────────────────────────────────────────────────────


class LOTOAvailabilityLink(BaseModel):
    """Links a LOTO permit (P5) to an availability downtime record."""

    permit_id: str
    turbine_id: str
    downtime_category: DowntimeCategory
    scheduled: bool = Field(description="True = planned maintenance; False = corrective")
    duration_hours: float
    crew_size: int
    work_description: str
