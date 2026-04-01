"""
Pydantic schemas for Weather Window & O&M Logistics — M14.

Vessel access limits (Baltic Sea industry practice):
  CTV  (Crew Transfer Vessel): Hs ≤ 1.5 m, Vw ≤ 10 m/s
  SOV  (Service Operation Vessel): Hs ≤ 2.5 m, Vw ≤ 15 m/s
  Jack-up (crane operations): Hs ≤ 2.0 m, Vw ≤ 8 m/s
  Helicopter: Vw ≤ 12 m/s, no fog/icing

O&M cost drivers:
  Call-out (unplanned): vessel mobilisation 1-5 days
  Planned maintenance: scheduled during weather window → lower cost
  Heavy lift: main bearing / blade replacement requires jack-up
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class VesselType(str, Enum):  # noqa: UP042
    """Offshore access vessel categories."""

    CTV = "CTV"  # Crew Transfer Vessel — routine O&M, 6-12 technicians
    SOV = "SOV"  # Service Operation Vessel — extended campaigns
    JACK_UP = "JACK_UP"  # Crane vessel — heavy lift (blade, main bearing)
    HELICOPTER = "HELICOPTER"  # Emergency / fast response


class AccessProbabilityResponse(BaseModel):
    """Monthly vessel access probability for all vessel types."""

    location: str = Field(description="Wind farm location")
    vessel: VesselType
    monthly_access_pct: list[float] = Field(
        description="Access probability [%] for Jan-Dec (12 values)",
    )
    annual_average_pct: float = Field(
        description="Annual average access probability [%]",
    )
    limiting_parameter: str = Field(
        description="Wave height (Hs) or wind speed (Vw) — whichever limits more",
    )


class AllVesselAccessResponse(BaseModel):
    """Access probabilities for all vessel types — used for O&M planning matrix."""

    location: str
    year: int
    vessels: list[AccessProbabilityResponse]


class MaintenanceWindowRequest(BaseModel):
    """Find the next weather window for a repair job."""

    failure_date_iso: str = Field(
        description="Date of failure in ISO 8601 format (e.g., '2025-07-15')",
    )
    vessel_type: VesselType
    repair_duration_hours: float = Field(
        gt=0.0,
        le=720.0,
        description="Required uninterrupted work duration [hours]",
    )
    turbine_id: str = Field(description="Affected turbine (e.g., WTG-01)")


class MaintenanceWindowResponse(BaseModel):
    """Estimated next access window and cost."""

    turbine_id: str
    failure_date_iso: str
    vessel_type: VesselType
    repair_duration_hours: float
    estimated_window_start_iso: str = Field(
        description="Estimated start of next acceptable weather window",
    )
    wait_days: float = Field(description="Days waiting for window from failure date")
    total_downtime_days: float = Field(
        description="Wait days + repair duration converted to days",
    )
    access_probability_pct: float = Field(
        description="Month access probability for the window month [%]",
    )
    cost_estimate_eur: float = Field(
        description="Total repair cost estimate [EUR] including vessel and labour",
    )
    cost_breakdown: dict[str, float] = Field(
        description="Cost components: vessel_day_rate, mobilisation, labour, parts",
    )


class OAMCostRequest(BaseModel):
    """Parameters for annual O&M cost model."""

    n_turbines: int = Field(default=34, ge=1, le=200)
    turbine_rated_mw: float = Field(default=15.0, ge=1.0)
    planned_events_per_turbine: float = Field(
        default=1.0,
        description="Scheduled maintenance events per turbine per year",
    )
    unplanned_events_per_turbine: float = Field(
        default=6.0,
        description="Unscheduled fault events per turbine per year",
    )
    heavy_lift_events_per_year: float = Field(
        default=2.0,
        description="Major component replacements (jack-up) per year for whole fleet",
    )


class OAMCostBreakdown(BaseModel):
    """Annual O&M cost breakdown by activity type."""

    total_oam_eur: float = Field(description="Total annual O&M cost [EUR]")
    per_mw_eur: float = Field(description="O&M cost per MW installed [EUR/MW/year]")
    planned_maintenance_eur: float
    unplanned_maintenance_eur: float
    vessel_charter_eur: float
    heavy_lift_eur: float
    insurance_eur: float
    assessment: str = Field(
        description="Benchmark comparison (industry: 80-120 EUR/MW/year offshore)",
    )
