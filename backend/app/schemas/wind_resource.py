"""
Pydantic schemas for wind resource data and AEP results.

Covers ERA5 preprocessed data, Weibull parameters, and
AEP exceedance probabilities (P50/P75/P90).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── Wind Resource ──────────────────────────────────────────────────


class WindResourceRecord(BaseModel):
    """Single ERA5 preprocessed wind record at hub height."""

    model_config = {"from_attributes": True}

    time: datetime
    wind_speed_ms: float = Field(description="Wind speed at hub height [m/s]")
    wind_direction_deg: float = Field(description="Wind direction [deg, meteorological]")
    hub_height_m: float


class WindResourceSummary(BaseModel):
    """Statistical summary of wind resource data for a farm."""

    wind_farm_id: uuid.UUID
    record_count: int
    mean_wind_speed_ms: float = Field(description="Mean wind speed at hub height [m/s]")
    std_wind_speed_ms: float = Field(description="Standard deviation of wind speed [m/s]")
    weibull_a_ms: float = Field(description="Weibull scale parameter A [m/s]")
    weibull_k: float = Field(description="Weibull shape parameter k [-]")
    data_start: datetime
    data_end: datetime


# ── AEP Results ────────────────────────────────────────────────────


class AEPResponse(BaseModel):
    """AEP result with P50/P75/P90 exceedance and uncertainty.

    Engineering Rule 10: uncertainty is mandatory in all AEP outputs.
    """

    model_config = {"from_attributes": True}

    id: uuid.UUID
    wind_farm_id: uuid.UUID
    aep_p50_gwh: float = Field(description="P50 (median) AEP [GWh]")
    aep_p75_gwh: float = Field(description="P75 exceedance AEP [GWh]")
    aep_p90_gwh: float = Field(description="P90 exceedance AEP [GWh]")
    uncertainty_percent: float = Field(description="Combined RSS uncertainty [%]")
    wake_loss_percent: float = Field(description="Wake-induced energy loss [%]")
    blockage_loss_percent: float = Field(description="Blockage effect loss [%]")
    calculated_at: datetime


class PerTurbineAEPResponse(BaseModel):
    """Per-turbine AEP breakdown showing wake deficit impact."""

    model_config = {"from_attributes": True}

    turbine_position_id: uuid.UUID
    aep_gwh: float = Field(description="Individual turbine AEP [GWh]")
    wake_deficit_percent: float = Field(description="Wake deficit at this turbine [%]")
