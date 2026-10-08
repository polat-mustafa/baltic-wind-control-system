"""
Saved projects (``/api/v1/projects``): the whole "own project" a learner builds
— site, layout, cost and lifecycle inputs — stored as one JSON document.

JSON keys are camelCase (the frontend's ``.offshoreforge.json`` export, schema 2).
Coordinates are WGS84 degrees [lon, lat]. No personal data is asked for; the
project id in the link is the only key.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.p1.turbine_models import DEFAULT_TURBINE_ID, turbine_models

MAX_TURBINES = 150
MAX_BODY_BYTES = 512 * 1024

Lon = Annotated[float, Field(ge=-180.0, le=180.0, allow_inf_nan=False)]
Lat = Annotated[float, Field(ge=-90.0, le=90.0, allow_inf_nan=False)]
Name = Annotated[str, Field(max_length=40)]


class _Doc(BaseModel):
    """Part of the project document: unknown keys are rejected."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ProjectTurbine(_Doc):
    id: str = Field(min_length=1, max_length=20)
    lon: Lon
    lat: Lat


class ProjectSite(_Doc):
    polygon: list[tuple[Lon, Lat]] | None = Field(None, min_length=3, max_length=64)
    stage: Name = "screening"
    done: list[Name] = Field(default_factory=list, max_length=20)
    grid_node: str | None = Field(None, alias="gridNode", max_length=120)


class ProjectData(_Doc):
    """Project document, schema 2 (schema 1 = the layout-only file, upgraded by the frontend)."""

    schema_version: Literal[2] = Field(2, alias="schema")
    app: Literal["OffshoreForge"] = "OffshoreForge"
    name: str = Field("Untitled project", min_length=1, max_length=100)
    turbine_model: str = Field(DEFAULT_TURBINE_ID, alias="turbineModel")
    site: ProjectSite = Field(default_factory=ProjectSite)
    turbines: list[ProjectTurbine] = Field(default_factory=list, max_length=MAX_TURBINES)
    oss: tuple[Lon, Lat] | None = None
    costs: dict[Name, Annotated[float, Field(ge=0.0, allow_inf_nan=False)]] = Field(
        default_factory=dict, max_length=30
    )
    #: Construction / decommissioning campaign inputs (frontend lifecycleStore), opaque here.
    lifecycle: dict[Name, Any] | None = None

    @field_validator("turbine_model")
    @classmethod
    def _known_model(cls, v: str) -> str:
        if v not in turbine_models():
            raise ValueError(f"unknown turbine model {v!r}")
        return v

    @field_validator("turbines")
    @classmethod
    def _unique_ids(cls, v: list[ProjectTurbine]) -> list[ProjectTurbine]:
        if len({t.id for t in v}) != len(v):
            raise ValueError("turbine ids must be unique")
        return v


class ProjectUpdate(BaseModel):
    revision: int = Field(ge=1, description="Revision the edit is based on (409 if stale)")
    data: ProjectData


class ProjectOut(BaseModel):
    id: str
    revision: int
    is_reference: bool
    updated_at: datetime
    data: ProjectData | None = Field(description="None for the reference farm (frontend constants)")


class AEPRunRequest(BaseModel):
    """Wind for a stored-layout PyWake run (as in /wind/wake-analysis-custom).

    Without ``weibull_a``/``weibull_k`` the site climate at the turbines is used
    (region pack, services/site_assessment/wind_climate.py).
    """

    weibull_a: float | None = Field(None, ge=5.0, le=20.0)
    weibull_k: float | None = Field(None, ge=1.0, le=4.0)
    sector_frequencies: list[float] | None = Field(None, min_length=12, max_length=12)


class AEPRunOut(BaseModel):
    """One stored PyWake run, GWh/yr. ``net`` is after wake loss only; the
    P-values follow the P1 loss cascade (aep_calculator.compute_aep_cascade)."""

    id: str
    revision: int | None = Field(description="Project revision the run was computed for")
    calculated_at: datetime
    gross_aep_gwh: float
    net_aep_gwh: float
    wake_loss_percent: float
    capacity_factor: float
    p50_gwh: float
    p75_gwh: float
    p90_gwh: float
    uncertainty_percent: float
    turbine_ids: list[str]
    per_turbine_aep_gwh: list[float]
    per_turbine_wake_loss_percent: list[float]
