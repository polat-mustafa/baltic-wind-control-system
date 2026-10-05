"""
Pydantic schemas for the market day — M11.

One trading day of the 510 MW farm: TGE day-ahead (SDAC), PSE imbalance at
the single price CEN, two-sided CfD, BESS arbitrage. Money in PLN, energy in
MWh per 1 h period.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Scenario = Literal["windy_spring_sunday", "winter_weekday", "calm_summer_day"]


class MarketDayRequest(BaseModel):
    scenario: Scenario = "windy_spring_sunday"
    strike_pln_mwh: float = Field(
        default=489.0, ge=0.0, le=1000.0, description="CfD strike [PLN/MWh]"
    )
    forecast_sigma_ms: float = Field(
        default=1.0, ge=0.0, le=4.0, description="Day-ahead wind-speed error, 1σ [m/s]"
    )
    include_cfd: bool = True
    include_bess: bool = True


class MarketHour(BaseModel):
    hour: int
    da_price_pln_mwh: float
    cen_pln_mwh: float = Field(description="Imbalance price [PLN/MWh]")
    wind_forecast_ms: float
    wind_actual_ms: float
    forecast_mwh: float
    bid_mwh: float = Field(description="Day-ahead schedule [MWh]")
    metered_mwh: float
    curtailed_mwh: float = Field(description="Available energy not produced (negative price)")
    deviation_mwh: float = Field(description="Metered − scheduled; + long, − short")
    bess_mw: float = Field(description="+ discharge, − charge [MW]")
    bess_soc_pct: float | None


class MarketDayResponse(BaseModel):
    scenario: Scenario
    scenario_label: str
    hours: list[MarketHour]
    energy_mwh: float
    curtailed_mwh: float
    negative_hours: int
    rmse_mwh: float = Field(description="RMS deviation from schedule [MWh]")
    day_average_price_pln_mwh: float
    captured_price_pln_mwh: float = Field(description="Energy-weighted DA price [PLN/MWh]")
    capture_rate_pct: float
    farm_price_pln_mwh: float = Field(description="(DA + imbalance + CfD) per MWh metered")
    energy_value_pln: float = Field(description="Metered energy at the DA price")
    imbalance_pln: float = Field(description="Deviations at CEN instead of DA; ≤ 0")
    cfd_settlement_pln: float = Field(description="> 0 paid to the farm, < 0 paid back")
    bess_arbitrage_pln: float
    total_pln: float
    assessment: str
