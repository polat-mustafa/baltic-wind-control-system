"""Pydantic schemas for the lifecycle campaigns (/api/v1/lifecycle).

Times in days from the campaign start, Hs in m, wind speed in m/s, money in
M€ (k€ for day rates and mobilisation). Percentiles: P10 / P50 / P90 over
the simulated weather runs.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.services.lifecycle.campaign import SB510_INSTALL_PORT_KM

VesselId = Literal["HLV", "WTIV", "CLV", "CTV", "SURVEY"]


class VesselLimit(BaseModel):
    vessel: VesselId
    hs_m: float = Field(..., gt=0.2, le=6.0, description="Operational Hs limit OP_LIM [m]")
    wind_ms: float = Field(..., gt=2.0, le=30.0, description="Operational wind limit OP_LIM [m/s]")


class CampaignRequest(BaseModel):
    mode: Literal["install", "remove"] = "install"
    n_turbines: int = Field(34, ge=1, le=150)
    strings: list[int] | None = Field(
        None, description="Turbines per array string, in installation order; sum = n_turbines"
    )
    array_km: float | None = Field(
        None, gt=0, le=600, description="Total array cable length [km]; default 1.6 km per turbine"
    )
    export_km: float = Field(108.0, ge=1, le=300)
    port_km: float = Field(
        SB510_INSTALL_PORT_KM,
        ge=0,
        le=1000,
        description="Installation port to the site by sea [km] (site assessment); default SB-510",
    )
    foundation: Literal["monopile", "jacket"] = "monopile"
    start_date: date = date(2028, 4, 1)
    alpha: float | None = Field(
        0.8,
        ge=0.5,
        le=1.0,
        description="DNV alpha factor OP_WF = α · OP_LIM for every operation; null = the DNV "
        "table by each operation's reference period T_R and Hs limit",
    )
    contingency_fraction: float = Field(
        0.5, ge=0.0, le=2.0, description="Contingency T_C as a share of T_POP: T_R = T_POP + T_C"
    )
    runs: int = Field(200, ge=20, le=500)
    seed: int = Field(1, ge=0, le=2**31 - 1)
    remove_foundations: Literal["cut", "full"] = "cut"
    remove_array: bool = False
    remove_export: bool = False
    remove_scour: bool = False
    limits: list[VesselLimit] = Field(default_factory=list, max_length=5)

    @model_validator(mode="after")
    def _strings_match(self) -> CampaignRequest:
        if self.strings is not None:
            if not self.strings or any(n < 1 or n > 12 for n in self.strings):
                raise ValueError("every string carries 1–12 turbines")
            if sum(self.strings) != self.n_turbines:
                raise ValueError("the string sizes must add up to n_turbines")
        return self


class Percentiles(BaseModel):
    p10: float
    p50: float
    p90: float


class MilestoneSchema(BaseModel):
    id: str
    label: str
    days: Percentiles
    date_p50: str
    date_p90: str


class ActivitySchema(BaseModel):
    id: str
    name: str
    vessel: VesselId
    units: int
    op_hours: float
    trip_every: int
    trip_hours: float = Field(
        ..., description="Port round trip: loading + transit out and back [h]"
    )
    start_day: float = Field(..., description="Median run")
    end_day: float = Field(..., description="Median run")
    wow_days: float = Field(..., description="Waiting on weather in the median run")
    end_days: Percentiles
    wow_share_pct: float
    duration_days: Percentiles


class VesselSchema(BaseModel):
    id: VesselId
    name: str
    role: str
    hs_limit_m: float
    wind_limit_ms: float
    wind_reference: str
    day_rate_keur: float
    mobilisation_keur: float
    transit_kmh: float = Field(..., description="Transit speed [km/h] (NREL ORBIT / WOMBAT)")
    workable_pct_by_month: list[float | None]
    window_hours: float
    window_pct_by_month: list[float | None]
    charter_days: Percentiles
    wow_days: Percentiles
    cost_meur: Percentiles


class CampaignResponse(BaseModel):
    mode: Literal["install", "remove"]
    start_date: str
    alpha: float | None
    alpha_by_activity: dict[str, float] = Field(default_factory=dict)
    contingency_fraction: float = 0.5
    runs: int
    seed: int
    n_turbines: int
    strings: list[int]
    unfinished_runs: int
    total_days: Percentiles
    cost_meur: Percentiles
    milestones: list[MilestoneSchema]
    activities: list[ActivitySchema]
    vessels: list[VesselSchema]
    months: list[str]
    assumptions: list[str]


class OMYearRow(BaseModel):
    year: int
    time_based: float
    energy_based: float
    failures: int
    jackup_days: float
    jackup_mobilisations: int


class OMSimulationResponse(BaseModel):
    """Fleet O&M replay over the 30 hindcast years (services/lifecycle/om_simulation.py)."""

    mode: str
    n_ctv: int
    crews_per_ctv: int
    time_based_mean: float
    energy_based_mean: float
    energy_based_p90: float = Field(
        description="Energy-based availability exceeded in 90 % of years"
    )
    analytic_time_based: float = Field(description="availability_model: unlimited crews")
    mean_downtime_h: dict[str, float]
    cost_eur_per_year: dict[str, float]
    cost_eur_per_mw_year: float
    years: list[OMYearRow]
    source: str
