"""
Market Integration API endpoints — M11 (TGE day-ahead, ancillary services).

Endpoints
---------
POST   /api/v1/grid/market/da-bid          — Day-ahead bid optimisation
POST   /api/v1/grid/market/imbalance       — Imbalance settlement calculation
POST   /api/v1/grid/market/ancillary       — Ancillary services revenue estimate
POST   /api/v1/grid/market/revenue         — Annual revenue simulation

Market: TGE (Polish Power Exchange) day-ahead, PSE balancing, ENTSO-E ancillary.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.market import (
    AncillaryServicesRequest,
    AncillaryServicesResponse,
    DABidRequest,
    DABidResponse,
    ImbalanceRequest,
    ImbalanceResponse,
    RevenueSimulationRequest,
    RevenueSimulationResponse,
)
from app.services.p2 import market as svc

router = APIRouter(tags=["M11 Market Integration"])


@router.post(
    "/market/da-bid",
    response_model=DABidResponse,
    summary="Day-ahead market bid optimisation (TGE)",
)
async def optimise_da_bid(body: DABidRequest) -> DABidResponse:
    """
    Optimise the 24-hour day-ahead bid for Baltic Wind.

    **How electricity markets work:**

    Every afternoon, generators submit 24-hour production bids for the following day
    to the day-ahead market (Poland: TGE). The market clears at a single price per
    hour — the System Marginal Price (SMP). Generators receive SMP for all energy
    below their bid.

    **Wind farm bidding strategy:**

    Since wind fuel cost = 0, the optimal bid is always:
    - Bid **100%** of forecast when price ≥ 0 (earn money for every MWh)
    - Bid **0%** when price < 0 (negative prices = you pay to produce)

    Negative prices occur when wind + nuclear + hydro exceed grid demand.
    In Poland, this happens mainly at night in spring/autumn. The correct
    response is curtailment or BESS charging — not feeding into a negative market.

    **BESS arbitrage overlay:**

    The BESS charges during the 6 cheapest hours (e.g., 00:00-06:00 at 50-60 EUR/MWh)
    and discharges during the 6 most expensive hours (e.g., 17:00-21:00 at 110-130 EUR/MWh).

    Arbitrage value = (avg_discharge_price - avg_charge_price) * BESS_energy * eta

    For Baltic Wind: daily spread ~50 EUR/MWh, BESS ~140 MWh throughput,
    daily arbitrage ~3,200 EUR = ~1.2 M EUR/year.

    **Example: winter evening peak**
    Price at 18:00 = 150 EUR/MWh, wind = 510 MWh → revenue = 76,500 EUR in 1 hour.
    Same farm in summer midday at -10 EUR/MWh → curtail or charge BESS.
    """
    result = svc.optimise_da_bid(
        body.wind_forecast_mwh,
        body.da_price_eur_mwh,
        body.include_bess_arbitrage,
        body.bess_soc_initial_pct,
    )
    return DABidResponse(**result)


@router.post(
    "/market/imbalance",
    response_model=ImbalanceResponse,
    summary="Imbalance settlement — forecast error cost analysis",
)
async def calculate_imbalance(body: ImbalanceRequest) -> ImbalanceResponse:
    """
    Calculate imbalance settlement cost for a 24-hour period.

    **Why imbalance matters:**

    In electricity markets, you must deliver what you commit to in the DA bid.
    If your actual production deviates from your bid:

    - **Short** (actual < forecast): You failed to deliver. The system operator had to
      buy balancing energy at higher cost. You pay a penalty:
      Settlement = missing_MWh * DA_price * 1.15 (typical PSE factor)

    - **Long** (actual > forecast): You over-produced. The system operator had to curtail
      or export. You receive less than DA price:
      Settlement = extra_MWh * DA_price * 0.85

    **Why offshore wind has low imbalance:**

    - V236-15.0 MW is a large rotor — smooths individual turbine variations
    - 34 turbines: portfolio effect reduces farm-level variability
    - AI forecasting (P4 models) achieves ~7-10% MAPE at 24h horizon
    - Offshore wind is more predictable than onshore (stable flow, less turbulence)

    **Baltic Wind typical performance:**
    MAPE ~8-10% → annual imbalance cost ~2-3% of DA revenue = ~3-5 M EUR/year.
    This is why P4 XGBoost/LSTM/TFT models directly impact bottom-line revenue.

    A 1% MAPE improvement on 1.85 TWh at 75 EUR/MWh and 15% penalty:
    = 1.85e9 * 0.01 * 75 * 0.15 = ~2 M EUR/year saved.
    """
    result = svc.calculate_imbalance(
        body.forecast_mwh,
        body.actual_mwh,
        body.da_price_eur_mwh,
        body.imbalance_penalty_factor,
    )
    return ImbalanceResponse(**result)


@router.post(
    "/market/ancillary",
    response_model=AncillaryServicesResponse,
    summary="Ancillary services portfolio and BSP revenue estimate",
)
async def estimate_ancillary_services(body: AncillaryServicesRequest) -> AncillaryServicesResponse:
    """
    Estimate annual revenue from ancillary services (BSP contract).

    **What are ancillary services?**

    Grid operators (PSE, Elia, National Grid) pay generators and storage to be
    available to respond to frequency deviations and voltage events. This
    "availability payment" is revenue even if you're never actually activated.

    **ENTSO-E reserve product hierarchy:**

    | Product | Response time | Duration | Trigger |
    |---------|---------------|----------|---------|
    | FCR-N | 30 seconds | Continuous | ±200 mHz |
    | FCR-D | 5 seconds | 30 min | ≤ 49.5 Hz (down) |
    | aFRR | 5 minutes | 15 min | Automatic signal |
    | mFRR | 12 minutes | 1 hour | Manual PSE instruction |
    | RR | 30 minutes | ≥2 hours | Slow re-dispatch |

    **Baltic Wind BESS participation (50 MW / 200 MWh):**

    FCR-N is the primary product: symmetric ±50 MW within 30 seconds.
    BESS must maintain 30-70% SOC to deliver symmetric FCR-N.
    Availability payment: ~6.5 EUR/MW/h = 2.85 M EUR/year for full 50 MW.

    **WTG delta control for aFRR/mFRR:**

    WTGs withhold 5% (25 MW) below rated output, ready to ramp up on signal.
    At 9 EUR/MW/h availability: 25 MW * 9 * 8760 = 2.0 M EUR/year — for doing
    essentially nothing (just running 5% below maximum output).

    **Total BSP portfolio value:**
    FCR-N + FCR-D + aFRR + mFRR ≈ 3.5-5.0 M EUR/year — significant compared to
    total OPEX of ~25 M EUR/year.
    """
    result = svc.estimate_ancillary_services(
        body.bess_power_mw,
        body.wtg_available_mw,
        body.reserve_soc_pct,
    )
    return AncillaryServicesResponse(**result)


@router.post(
    "/market/revenue",
    response_model=RevenueSimulationResponse,
    summary="Annual revenue simulation — all income streams",
)
async def simulate_annual_revenue(body: RevenueSimulationRequest) -> RevenueSimulationResponse:
    """
    Simulate Baltic Wind annual revenue across all income streams.

    **Revenue stack (top to bottom):**

    ```
    1. Energy sales (DA market)       ~139 M EUR/year  [75 EUR/MWh * 1.85 TWh]
    2. CfD support (if below strike)  ~10-20 M EUR     [OZMB 2024: 80 EUR/MWh strike]
    3. BSP ancillary services         ~3.5 M EUR/year  [FCR + aFRR + mFRR]
    4. BESS arbitrage                 ~1.5 M EUR/year  [price spread exploitation]
    5. Less: Imbalance settlement     -3 M EUR/year    [~2% of DA revenue]
    ─────────────────────────────────────────────────
       Total gross revenue:          ~151 M EUR/year
    6. Less: O&M cost                -25.5 M EUR/year
    ─────────────────────────────────────────────────
       EBITDA:                       ~125 M EUR/year
    ```

    **Contract for Difference (CfD) — OZMB mechanism:**

    Poland's renewable support scheme for offshore wind:
    - Strike price fixed at ~350 PLN/MWh ≈ 80 EUR/MWh
    - If DA market < 80 EUR: government pays difference → predictable revenue
    - If DA market > 80 EUR: developer pays back difference → price cap

    CfD removes price risk — makes projects bankable at lower WACC (7% vs 10%).
    LCOE impact: lower WACC → lower FCR → ~5-10 EUR/MWh lower LCOE.

    **Without CfD (merchant):**
    Revenue tracks spot market — higher upside but also higher risk.
    Lenders require higher equity ratio → reduces project IRR.

    **Key metric: Revenue per MWh vs LCOE (52 EUR/MWh for Baltic Wind P50):**
    - At 75 EUR/MWh DA: margin = 23 EUR/MWh → healthy
    - At 45 EUR/MWh DA: margin = -7 EUR/MWh → project losses money
    - CfD at 80 EUR/MWh: guaranteed minimum 28 EUR/MWh margin above LCOE
    """
    result = svc.simulate_annual_revenue(
        body.annual_aep_mwh,
        body.avg_da_price_eur_mwh,
        body.price_volatility_pct,
        body.capacity_factor_pct,
        body.cfd_strike_price_eur_mwh,
        body.o_and_m_cost_m_eur_year,
    )
    return RevenueSimulationResponse(**result)
