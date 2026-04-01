"""
Pydantic schemas for Market Integration API — M11.

Covers:
- TGE (Polish Power Exchange) day-ahead market bidding
- Revenue simulation (Day-Ahead + Imbalance + Ancillary Services)
- BSP (Balancing Service Provider) contracts: FCR, aFRR, mFRR
- Curtailment cost analysis
- LCOE vs market price comparison
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Day-ahead market ──────────────────────────────────────────────────────────


class DAPricePoint(BaseModel):
    """Single hour in a day-ahead price profile."""

    hour: int = Field(ge=0, le=23, description="Hour of day [0-23]")
    price_eur_mwh: float = Field(description="Day-ahead electricity price [EUR/MWh]")
    volume_mwh: float = Field(description="Energy volume in this hour [MWh]")
    revenue_eur: float = Field(description="Revenue = price * volume [EUR]")


class DABidRequest(BaseModel):
    """Day-ahead market bid optimisation request."""

    wind_forecast_mwh: list[float] = Field(
        min_length=24,
        max_length=24,
        description=(
            "Hourly wind energy forecast for the next day [MWh per hour]. "
            "24 values required (one per hour). "
            "Example: typical summer day = 200-450 MWh/h; winter storm = 400-510 MWh/h."
        ),
        examples=[[350.0] * 8 + [450.0] * 8 + [380.0] * 8],
    )
    da_price_eur_mwh: list[float] = Field(
        min_length=24,
        max_length=24,
        description=(
            "Day-ahead electricity price forecast [EUR/MWh] for each hour. "
            "TGE 2024 range: 60-250 EUR/MWh (winter peak) / 30-90 EUR/MWh (summer). "
            "Negative prices occur during high wind + low demand (curtailment signal)."
        ),
        examples=[
            [
                65.0,
                60.0,
                55.0,
                52.0,
                58.0,
                75.0,
                95.0,
                110.0,
                105.0,
                100.0,
                90.0,
                85.0,
                82.0,
                80.0,
                85.0,
                95.0,
                115.0,
                130.0,
                125.0,
                110.0,
                95.0,
                85.0,
                75.0,
                68.0,
            ]
        ],
    )
    include_bess_arbitrage: bool = Field(
        default=True,
        description=(
            "If True, optimise BESS charge/discharge schedule alongside WTG bids "
            "to maximise revenue (charge during low-price hours, discharge during peak)."
        ),
    )
    bess_soc_initial_pct: float = Field(
        default=50.0,
        ge=10.0,
        le=90.0,
        description="Initial BESS SOC at start of bidding day [%]",
    )


class DABidResponse(BaseModel):
    """Day-ahead bid result — 24-hour schedule."""

    hourly_schedule: list[DAPricePoint]
    total_revenue_eur: float
    total_energy_mwh: float
    weighted_avg_price_eur_mwh: float
    bess_arbitrage_revenue_eur: float = Field(
        description="Additional revenue from BESS charge/discharge arbitrage [EUR]"
    )
    curtailment_hours: int = Field(
        description="Hours with negative prices where curtailment advised"
    )
    curtailment_loss_eur: float = Field(description="Revenue foregone due to curtailment [EUR]")
    optimal_curtailment_mwh: float = Field(description="Energy volume to curtail vs bid [MWh]")
    assessment: str


# ── Imbalance settlement ───────────────────────────────────────────────────────


class ImbalanceRequest(BaseModel):
    """Imbalance cost calculation request."""

    forecast_mwh: list[float] = Field(
        min_length=24,
        max_length=24,
        description="Forecast energy submitted in DA bid [MWh per hour]",
    )
    actual_mwh: list[float] = Field(
        min_length=24,
        max_length=24,
        description="Actual energy produced (measured) [MWh per hour]",
    )
    da_price_eur_mwh: list[float] = Field(
        min_length=24,
        max_length=24,
        description="DA price [EUR/MWh] per hour",
    )
    imbalance_penalty_factor: float = Field(
        default=1.15,
        ge=1.0,
        le=2.0,
        description=(
            "PSE imbalance price multiplier. "
            "Long imbalance (overproduction): settled at DA price * 0.85 (penalty). "
            "Short imbalance (underproduction): settled at DA price * 1.15 (penalty). "
            "Depends on system balance direction."
        ),
    )


class ImbalanceHourResult(BaseModel):
    """Imbalance for one settlement period."""

    hour: int
    forecast_mwh: float
    actual_mwh: float
    deviation_mwh: float = Field(description="Actual - Forecast [MWh]. Positive = surplus.")
    da_price: float
    imbalance_cost_eur: float = Field(description="Cost (negative = income from surplus)")
    direction: str = Field(description="LONG / SHORT / BALANCED")


class ImbalanceResponse(BaseModel):
    """24-hour imbalance settlement result."""

    hourly_results: list[ImbalanceHourResult]
    total_da_revenue_eur: float
    total_imbalance_cost_eur: float = Field(description="Total imbalance settlement cost [EUR]")
    net_revenue_eur: float = Field(description="DA revenue - imbalance cost [EUR]")
    mae_mwh: float = Field(description="Mean Absolute Error of forecast [MWh]")
    mape_pct: float = Field(description="Mean Absolute Percentage Error [%]")
    long_hours: int
    short_hours: int
    assessment: str


# ── Ancillary services ────────────────────────────────────────────────────────


class AncillaryServiceBid(BaseModel):
    """Single ancillary service capacity bid."""

    service: str = Field(description="FCR-N / FCR-D / aFRR / mFRR / RR")
    capacity_mw: float = Field(description="Offered capacity [MW]")
    availability_price_eur_mw_h: float = Field(description="Availability price [EUR/MW/h]")
    activation_price_eur_mwh: float = Field(
        default=0.0, description="Energy activation price [EUR/MWh]"
    )
    annual_revenue_eur: float = Field(description="Estimated annual revenue [EUR/year]")


class AncillaryServicesRequest(BaseModel):
    """Request for ancillary services revenue estimation."""

    bess_power_mw: float = Field(
        default=50.0,
        ge=0.0,
        le=50.0,
        description="BESS rated power available for ancillary services [MW]",
    )
    wtg_available_mw: float = Field(
        default=400.0,
        ge=0.0,
        le=510.0,
        description="Average available WTG power (used for delta control / mFRR) [MW]",
    )
    reserve_soc_pct: float = Field(
        default=30.0,
        ge=10.0,
        le=60.0,
        description="BESS SOC reserved for FCR (not available for arbitrage) [%]",
    )


class AncillaryServicesResponse(BaseModel):
    """Ancillary services portfolio and revenue estimate."""

    services: list[AncillaryServiceBid]
    total_annual_revenue_eur: float
    fcr_capacity_mw: float
    afrr_capacity_mw: float
    mfrr_capacity_mw: float
    bsp_contract_value_m_eur_year: float = Field(
        description="Total BSP contract value [M EUR/year]"
    )
    assessment: str


# ── Revenue summary ───────────────────────────────────────────────────────────


class RevenueSimulationRequest(BaseModel):
    """Annual revenue simulation parameters."""

    annual_aep_mwh: float = Field(
        default=1_850_000.0,
        ge=500_000.0,
        le=4_000_000.0,
        description=(
            "Annual Energy Production [MWh]. "
            "Baltic Wind P50: ~1.85 TWh/year (3628 full-load hours at 510 MW)."
        ),
    )
    avg_da_price_eur_mwh: float = Field(
        default=75.0,
        ge=10.0,
        le=300.0,
        description="Average day-ahead electricity price [EUR/MWh]",
    )
    price_volatility_pct: float = Field(
        default=30.0,
        ge=5.0,
        le=100.0,
        description="Price standard deviation as % of mean (TGE historical ~30%)",
    )
    capacity_factor_pct: float = Field(
        default=50.0,
        ge=20.0,
        le=70.0,
        description="Annual capacity factor [%]",
    )
    cfd_strike_price_eur_mwh: float = Field(
        default=0.0,
        ge=0.0,
        le=200.0,
        description=(
            "Contract for Difference strike price [EUR/MWh]. "
            "If 0: no CfD (merchant exposure). "
            "Polish offshore CfD (OZMB 2024): ~350 PLN/MWh ≈ 80 EUR/MWh."
        ),
    )
    o_and_m_cost_m_eur_year: float = Field(
        default=25.5,
        ge=5.0,
        le=100.0,
        description="O&M cost [M EUR/year]. Typical offshore: 50 EUR/MWh = ~92.5 M EUR/year",
    )


class RevenueBreakdownItem(BaseModel):
    """Single revenue line item."""

    category: str
    revenue_m_eur: float
    share_pct: float


class RevenueSimulationResponse(BaseModel):
    """Annual revenue simulation result."""

    gross_revenue_m_eur: float = Field(description="Energy sales at DA market price [M EUR]")
    cfd_support_m_eur: float = Field(description="CfD support payment (if strike > market) [M EUR]")
    ancillary_revenue_m_eur: float = Field(description="BSP ancillary services [M EUR]")
    imbalance_cost_m_eur: float = Field(description="Imbalance settlement cost [M EUR]")
    bess_arbitrage_m_eur: float = Field(description="BESS arbitrage revenue [M EUR]")
    total_revenue_m_eur: float
    ebitda_m_eur: float = Field(description="Revenue - O&M [M EUR]")
    revenue_per_mwh_eur: float = Field(description="Effective revenue per MWh produced [EUR/MWh]")
    breakdown: list[RevenueBreakdownItem]
    lcoe_comparison: str = Field(description="Revenue vs LCOE margin assessment")
    assessment: str
