"""
Pydantic schemas for multi-farm comparison API — M04.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

# ── Farm configuration ────────────────────────────────────────────


class FarmConfigCreate(BaseModel):
    """Request body to create a new farm configuration."""

    name: str = Field(description="Configuration name", min_length=3, max_length=100)
    turbine_model: str = Field(default="V236-15.0", description="Turbine model designation")
    turbine_count: int = Field(default=34, ge=1, le=200)
    turbine_rated_mw: float = Field(default=15.0, ge=0.5, le=20.0)
    array_voltage_kv: float = Field(default=66.0, ge=33.0, le=132.0)
    export_voltage_kv: float = Field(default=220.0, ge=66.0, le=400.0)
    export_length_km: float = Field(default=76.5, ge=1.0, le=300.0)
    turbine_spacing_d: float = Field(
        default=7.0, ge=4.0, le=12.0, description="Grid spacing in rotor diameters [D]"
    )
    mean_wind_speed_ms: float = Field(
        default=9.5, ge=5.0, le=14.0, description="Hub-height mean wind speed [m/s]"
    )
    weibull_k: float = Field(default=2.2, ge=1.5, le=3.5, description="Weibull shape parameter")
    availability_pct: float = Field(default=95.0, ge=70.0, le=99.9)
    capex_m_eur_per_mw: float = Field(
        default=3.2, ge=1.0, le=6.0, description="CAPEX [M€/MW] — 2024–25 EU offshore ≈ 3–4"
    )
    opex_k_eur_per_mw_year: float = Field(
        default=75.0, ge=20.0, le=200.0, description="Annual OPEX [k€/MW/year]"
    )
    discount_rate_pct: float = Field(default=6.0, ge=2.0, le=15.0, description="WACC [%]")
    lifetime_years: int = Field(default=25, ge=10, le=35)
    description: str = Field(default="")
    created_by: str = Field(default="user")


class FarmConfigResponse(BaseModel):
    """Stored farm configuration with computed summary metrics."""

    id: uuid.UUID
    name: str
    turbine_model: str
    turbine_count: int
    turbine_rated_mw: float
    installed_mw: float = Field(description="turbine_count x turbine_rated_mw")
    array_voltage_kv: float
    export_voltage_kv: float
    export_length_km: float
    turbine_spacing_d: float
    mean_wind_speed_ms: float
    weibull_k: float
    availability_pct: float
    capex_m_eur_per_mw: float
    opex_k_eur_per_mw_year: float
    discount_rate_pct: float
    lifetime_years: int
    description: str
    created_by: str
    created_at: datetime


# ── Comparison results ────────────────────────────────────────────


class AEPResult(BaseModel):
    """AEP metrics for one farm configuration."""

    farm_id: uuid.UUID
    farm_name: str
    installed_mw: float
    weibull_a_ms: float = Field(description="Weibull scale A = mean / Γ(1+1/k) [m/s]")
    gross_gwh: float = Field(description="Gross AEP (no losses) [GWh/year]")
    net_gwh: float = Field(description="Net AEP (all losses applied) [GWh/year]")
    p50_gwh: float = Field(description="P50 AEP (50% exceedance) [GWh/year]")
    p90_gwh: float = Field(description="P90 AEP (90% exceedance, conservative) [GWh/year]")
    capacity_factor_pct: float = Field(description="Net capacity factor [%]")
    wake_loss_pct: float = Field(description="Wake loss, PyWake BPA Gaussian [%]")
    blockage_loss_pct: float = Field(description="Blockage loss, Nygaard (2020) [%]")
    electrical_loss_pct: float = Field(description="Annual (energy-weighted) electrical loss [%]")
    availability_loss_pct: float = Field(description="Availability loss [%]")
    total_loss_pct: float = Field(description="All losses combined [%]")


class LCOEResult(BaseModel):
    """LCOE and financial metrics for one farm configuration."""

    farm_id: uuid.UUID
    farm_name: str
    lcoe_eur_per_mwh: float = Field(description="Levelised Cost of Energy [€/MWh]")
    capex_meur: float = Field(description="Total CAPEX [M€]")
    opex_meur_year: float = Field(description="Annual OPEX [M€/year]")
    annual_revenue_meur: float = Field(description="Annual revenue at P50 [M€/year]")
    lifetime_revenue_meur: float = Field(description="Undiscounted lifetime revenue [M€]")
    simple_payback_years: float = Field(description="CAPEX / (annual revenue - OPEX)")
    irr_pct: float = Field(description="Approximate Internal Rate of Return [%]")


class GridResult(BaseModel):
    """Grid integration metrics for one farm configuration."""

    farm_id: uuid.UUID
    farm_name: str
    installed_mw: float
    export_circuits: int = Field(description="Parallel 1000 mm² export circuits needed (thermal)")
    export_cable_losses_pct: float = Field(description="Export cable I²R loss at rated power [%]")
    array_cable_losses_pct: float = Field(description="Array cable I²R loss at rated power [%]")
    transformer_losses_pct: float = Field(description="Transformer copper loss at rated [%]")
    total_electrical_losses_pct: float = Field(description="Electrical loss at rated power [%]")
    annual_electrical_loss_pct: float = Field(
        description="Energy-weighted annual electrical loss = rated loss × LLF + iron [%]"
    )
    loss_load_factor: float = Field(description="E[P²] / (P_rated · E[P]) [-]")
    cable_charging_mvar: float = Field(
        description="Export cable charging Q = ωCU²L × circuits (capacitive, positive) [MVAr]"
    )
    export_utilization_pct: float = Field(
        description="Export current at rated output / installed circuit rating [%]"
    )


class FarmComparisonRequest(BaseModel):
    """Request to run a multi-farm comparison."""

    farm_ids: list[uuid.UUID] | None = Field(
        default=None,
        min_length=2,
        max_length=4,
        description="2-4 stored farm configuration IDs to compare",
    )
    farms: list[FarmConfigCreate] | None = Field(
        default=None,
        min_length=2,
        max_length=4,
        description="2-4 inline farm configurations (not stored) — alternative to farm_ids",
    )
    electricity_price_eur_mwh: float = Field(
        default=70.0,
        ge=20.0,
        le=300.0,
        description="Assumed electricity price for revenue calculation [€/MWh]",
    )

    @model_validator(mode="after")
    def _one_source(self) -> FarmComparisonRequest:
        if (self.farm_ids is None) == (self.farms is None):
            raise ValueError("Provide exactly one of farm_ids or farms")
        return self


class FarmComparisonResponse(BaseModel):
    """Multi-farm comparison result."""

    comparison_id: uuid.UUID
    farms: list[FarmConfigResponse]
    aep: list[AEPResult]
    lcoe: list[LCOEResult]
    grid: list[GridResult]
    best_aep_farm: str = Field(description="Name of farm with highest net AEP")
    best_lcoe_farm: str = Field(description="Name of farm with lowest LCOE")
    best_cf_farm: str = Field(description="Name of farm with highest capacity factor")
    electricity_price_eur_mwh: float
    summary: str = Field(description="Natural-language comparison summary")
    created_at: datetime
