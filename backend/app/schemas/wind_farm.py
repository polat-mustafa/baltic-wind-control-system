"""
Pydantic schemas for wind farm configuration and turbine positions.

Request models validate input from API clients.
Response models serialize database records for JSON output.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

# ── Turbine Position ───────────────────────────────────────────────


class TurbinePositionCreate(BaseModel):
    """Request schema to create a turbine position."""

    turbine_id: str = Field(
        max_length=20,
        examples=["WTG_01"],
        description="Turbine identifier, e.g. WTG_01",
    )
    x_m: float = Field(description="Easting from farm origin [m]")
    y_m: float = Field(description="Northing from farm origin [m]")
    hub_height_m: float = Field(
        default=150.0,
        ge=50.0,
        le=300.0,
        description="Hub height above sea level [m]",
    )


class TurbinePositionResponse(BaseModel):
    """Response schema for a turbine position."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    wind_farm_id: uuid.UUID
    turbine_id: str
    x_m: float
    y_m: float
    hub_height_m: float


# ── Wind Farm ──────────────────────────────────────────────────────


class WindFarmCreate(BaseModel):
    """Request schema to create a wind farm configuration."""

    name: str = Field(max_length=100, examples=["Baltic Wind Alpha"])
    latitude: float = Field(ge=-90, le=90, description="Farm centre latitude [deg]")
    longitude: float = Field(ge=-180, le=180, description="Farm centre longitude [deg]")
    capacity_mw: float = Field(ge=0, le=2000, description="Total installed capacity [MW]")
    num_turbines: int = Field(ge=1, le=200)
    turbine_model: str = Field(
        max_length=100,
        default="Vestas V236-15.0 MW",
        examples=["Vestas V236-15.0 MW"],
    )
    turbine_positions: list[TurbinePositionCreate] = Field(default_factory=list)


class WindFarmResponse(BaseModel):
    """Response schema for a wind farm with its turbine positions."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    latitude: float
    longitude: float
    capacity_mw: float
    num_turbines: int
    turbine_model: str
    created_at: datetime
    turbine_positions: list[TurbinePositionResponse] = Field(default_factory=list)


class WindFarmSummary(BaseModel):
    """Lightweight response schema for listing wind farms (no positions)."""

    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    capacity_mw: float
    num_turbines: int
    turbine_model: str
    created_at: datetime
