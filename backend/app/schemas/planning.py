"""
Pydantic schemas for the Planning & P2X studies.

Power in MW, energy in GWh, reactive power in Mvar, cost in EUR.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ExportRequest(BaseModel):
    design_length_km: float = Field(default=76.5, ge=10.0, le=200.0, description="Cable route [km]")


class ExportHVAC(BaseModel):
    capacity_mw: float
    charging_mvar: float
    loss_rated_mw: float
    loss_gwh: float


class ExportHVDC(BaseModel):
    loss_rated_mw: float
    loss_gwh: float


class ExportPoint(BaseModel):
    length_km: float
    hvac_capacity_mw: float
    hvac_charging_mvar: float
    hvac_loss_gwh: float
    hvdc_loss_gwh: float


class ExportResponse(BaseModel):
    design_length_km: float
    annual_energy_gwh: float
    capacity_factor: float
    hvac: ExportHVAC
    hvdc: ExportHVDC
    hvac_capacity_limit_km: float | None
    loss_crossover_km: float | None
    sweep: list[ExportPoint]


class P2XRequest(BaseModel):
    connection_mw: float = Field(
        default=400.0, ge=10.0, le=2250.0, description="Grid limit [MW] (below the farm rating)"
    )
    electrolyser_mw: float = Field(default=60.0, ge=5.0, le=250.0, description="Rating [MW]")
    capex_eur_per_kw: float = Field(default=2000.0, ge=500.0, le=4000.0, description="[EUR/kW]")


class LCOHCurve(BaseModel):
    price_eur_mwh: float
    lcoh_eur_kg: list[float]


class P2XResponse(BaseModel):
    connection_mw: float
    electrolyser_mw: float
    farm_energy_gwh: float
    surplus_gwh: float
    surplus_hours: int
    absorbed_gwh: float
    still_lost_gwh: float
    h2_tonnes: float
    full_load_hours: int
    lcoh_eur_kg: float | None
    efficiency_lhv: float
    power_to_power: float
    duration_step_h: int
    duration_mw: list[float]
    lcoh_flh: list[float]
    lcoh_curves: list[LCOHCurve]
