"""
Market Integration service — M11 (TGE day-ahead, ancillary services).

Physics/economics layers
------------------------
1. Day-ahead optimisation
   Revenue = sum(P_t * price_t * dt) for t = 0..23
   Optimal bid: produce when price > marginal cost (~0 for wind)
   Curtailment decision: curtail when price < 0 (avoid imbalance penalty)

2. BESS arbitrage (price spread exploitation)
   Charge during N cheapest hours: delta_SOC = P_charge * eta * dt / E_rated
   Discharge during M most expensive hours: delta_SOC = -P_discharge * dt / E_rated
   Arbitrage value = sum(price_sell * E_sell - price_buy * E_buy) * eta

3. Imbalance settlement (PSE two-price model)
   Long imbalance (actual > forecast): settled at settlement_price < DA_price
   Short imbalance (actual < forecast): settled at settlement_price > DA_price
   Cost = sum(|deviation_t| * |imbalance_price_t - DA_price_t|)

4. Ancillary services (ENTSO-E / PSE products)
   FCR-N (±200 mHz, 30s): ~4-8 EUR/MW/h (symmetric, continuous activation)
   FCR-D (49.5 Hz, 5s):   ~2-5 EUR/MW/h (downward frequency only)
   aFRR: ~6-12 EUR/MW/h (automatic, 5-minute activation)
   mFRR: ~3-8 EUR/MW/h  (manual, 12-minute activation window)
   RR (Replacement Reserve): ~1-3 EUR/MW/h

5. Contract for Difference (CfD)
   If market_price < strike: TSO pays (strike - market) per MWh
   If market_price > strike: developer pays back (market - strike) per MWh
   Net revenue = market_price + max(0, strike - market) - max(0, market - strike)
              = max(strike, market) for long-only position
   Polish OZMB 2024: ~350 PLN/MWh ≈ 80 EUR/MWh @ 1 PLN = 0.23 EUR

References
----------
TGE (Polish Power Exchange) — www.tge.pl  (market rules, settlement)
PSE SA (Polskie Sieci Elektroenergetyczne) — IRiESP Section 9 (balancing)
ENTSO-E — Network Code on Load-Frequency Control and Reserves (FC/FRR)
Regulation EU 2019/943 — Internal electricity market
"""

from __future__ import annotations

import statistics
from typing import Any

# ── Market constants ──────────────────────────────────────────────────────────

RATED_MW = 510.0  # Baltic Wind total rated power
BESS_RATED_MW = 50.0
BESS_RATED_MWH = 200.0
BESS_ETA = 0.92  # round-trip efficiency
LCOE_EUR_MWH = 52.0  # Baltic Wind LCOE (P50 scenario, from P1 calculation)

# TGE market parameters (2024 averages)
TGE_AVG_DA_PRICE_2024 = 75.0  # EUR/MWh
TGE_PRICE_FLOOR = -50.0  # Negative prices possible during high wind
TGE_PRICE_CAP = 400.0  # ENTSO-E market price cap

# PSE imbalance settlement prices (simplified)
IMBALANCE_LONG_FACTOR = 0.85  # overproduction settled at 85% of DA price
IMBALANCE_SHORT_FACTOR = 1.15  # underproduction settled at 115% of DA price

# BSP ancillary service prices (EUR/MW/h, 2024 Polish market)
_ANCILLARY_PRICES = {
    "FCR-N": {"availability": 6.5, "activation": 0.0},  # symmetric, no energy payment
    "FCR-D": {"availability": 3.5, "activation": 0.0},  # downward only
    "aFRR": {"availability": 9.0, "activation": 5.0},  # automatic, energy paid
    "mFRR": {"availability": 5.5, "activation": 8.0},  # manual, high energy price
    "RR": {"availability": 2.0, "activation": 12.0},  # replacement reserve
}


def optimise_da_bid(
    wind_forecast_mwh: list[float],
    da_price_eur_mwh: list[float],
    include_bess_arbitrage: bool,
    bess_soc_initial_pct: float,
) -> dict[str, Any]:
    """
    Optimise day-ahead bid for a 24-hour horizon.

    Bidding strategy:
    - Bid 100% of wind forecast when price >= 0 (wind has zero marginal cost)
    - Bid 0 when price < 0 (curtailment to avoid imbalance penalty)
    - If BESS arbitrage: charge during N cheapest hours, discharge during M most expensive
      where N, M are chosen to maximise price spread * efficiency

    Parameters
    ----------
    wind_forecast_mwh : list[float]
        24-hour hourly wind energy forecast [MWh/h].
    da_price_eur_mwh : list[float]
        24-hour day-ahead price forecast [EUR/MWh].
    include_bess_arbitrage : bool
        Whether to include BESS charge/discharge schedule.
    bess_soc_initial_pct : float
        Initial BESS SOC [%].
    """
    hourly_schedule = []
    total_revenue = 0.0
    total_energy = 0.0
    curtailment_hours = 0
    curtailment_loss = 0.0
    curtailment_volume = 0.0

    for h in range(24):
        price = da_price_eur_mwh[h]
        energy = wind_forecast_mwh[h]

        if price < 0.0:
            # Curtail: avoid paying imbalance penalty for over-production into negative price
            curtailment_hours += 1
            curtailment_loss += abs(price) * energy  # opportunity cost
            curtailment_volume += energy
            bid_energy = 0.0
            revenue = 0.0
        else:
            bid_energy = energy
            revenue = price * energy

        hourly_schedule.append(
            {
                "hour": h,
                "price_eur_mwh": round(price, 2),
                "volume_mwh": round(bid_energy, 2),
                "revenue_eur": round(revenue, 2),
            }
        )
        total_revenue += revenue
        total_energy += bid_energy

    # BESS arbitrage (simplified: charge in 6 cheapest, discharge in 6 most expensive)
    bess_revenue = 0.0
    if include_bess_arbitrage:
        bess_revenue = _compute_bess_arbitrage(da_price_eur_mwh, bess_soc_initial_pct)

    weighted_avg = total_revenue / max(0.001, total_energy)

    if bess_revenue > 0:
        assessment = f"Optimal. BESS arbitrage adds {bess_revenue:.0f} EUR/day."
    elif curtailment_hours > 0:
        assessment = (
            f"Curtail {curtailment_hours}h of negative prices: save {curtailment_loss:.0f} EUR."
        )
    else:
        assessment = "Bid all production — all hours have positive DA price."

    return {
        "hourly_schedule": hourly_schedule,
        "total_revenue_eur": round(total_revenue + bess_revenue, 2),
        "total_energy_mwh": round(total_energy, 2),
        "weighted_avg_price_eur_mwh": round(weighted_avg, 2),
        "bess_arbitrage_revenue_eur": round(bess_revenue, 2),
        "curtailment_hours": curtailment_hours,
        "curtailment_loss_eur": round(curtailment_loss, 2),
        "optimal_curtailment_mwh": round(curtailment_volume, 2),
        "assessment": assessment,
    }


def calculate_imbalance(
    forecast_mwh: list[float],
    actual_mwh: list[float],
    da_price_eur_mwh: list[float],
    imbalance_penalty_factor: float,
) -> dict[str, Any]:
    """
    Calculate imbalance settlement for a 24-hour period.

    PSE two-price model:
    - Short position (actual < forecast): buy back at penalty_factor * DA price
    - Long position (actual > forecast): sell surplus at (2 - penalty_factor) * DA price
    Simplified: all deviations settled at |deviation| * |penalty_factor * DA - DA|
    """
    hourly_results = []
    total_da_revenue = 0.0
    total_imbalance_cost = 0.0
    long_hours = 0
    short_hours = 0
    errors = []

    for h in range(24):
        forecast = forecast_mwh[h]
        actual = actual_mwh[h]
        price = da_price_eur_mwh[h]
        deviation = actual - forecast

        # DA revenue on forecast (what we committed to)
        da_revenue = forecast * max(0.0, price)
        total_da_revenue += da_revenue

        if abs(deviation) < 0.1:  # within 0.1 MWh tolerance
            direction = "BALANCED"
            imbalance_cost = 0.0
        elif deviation > 0:
            # Long (overproduction) — surplus settled at discounted rate
            direction = "LONG"
            settlement_price = price * (2.0 - imbalance_penalty_factor)  # < DA price
            long_revenue = (actual - forecast) * max(0.0, settlement_price)
            imbalance_cost = -(long_revenue)  # negative = income reduction
            total_imbalance_cost -= long_revenue
            long_hours += 1
        else:
            # Short (underproduction) — must buy back at penalty rate
            direction = "SHORT"
            shortage = abs(deviation)
            buyback_cost = shortage * max(0.0, price) * (imbalance_penalty_factor - 1.0)
            imbalance_cost = buyback_cost
            total_imbalance_cost += buyback_cost
            short_hours += 1

        errors.append(abs(deviation))
        hourly_results.append(
            {
                "hour": h,
                "forecast_mwh": round(forecast, 2),
                "actual_mwh": round(actual, 2),
                "deviation_mwh": round(deviation, 2),
                "da_price": round(price, 2),
                "imbalance_cost_eur": round(
                    imbalance_cost if direction == "SHORT" else -imbalance_cost, 2
                ),
                "direction": direction,
            }
        )

    mae = statistics.mean(errors)
    mape = 100.0 * mae / max(1.0, statistics.mean(forecast_mwh))
    net_revenue = total_da_revenue - total_imbalance_cost

    if mape < 5.0:
        assessment = "EXCELLENT forecast accuracy — imbalance costs minimal"
    elif mape < 15.0:
        assessment = "GOOD — typical wind forecast accuracy; imbalance within acceptable range"
    else:
        assessment = "REVIEW — high forecast error; consider ML model improvement (P4)"

    return {
        "hourly_results": hourly_results,
        "total_da_revenue_eur": round(total_da_revenue, 2),
        "total_imbalance_cost_eur": round(total_imbalance_cost, 2),
        "net_revenue_eur": round(net_revenue, 2),
        "mae_mwh": round(mae, 2),
        "mape_pct": round(mape, 2),
        "long_hours": long_hours,
        "short_hours": short_hours,
        "assessment": assessment,
    }


def estimate_ancillary_services(
    bess_power_mw: float,
    wtg_available_mw: float,
    reserve_soc_pct: float,
) -> dict[str, Any]:
    """
    Estimate ancillary services revenue portfolio.

    BESS capacity allocation:
    - FCR-N: requires symmetric response → BESS must maintain 30-70% SOC
      Available: bess_power_mw * reserve_soc_pct/100 (fraction maintained for FCR)
    - aFRR: BESS + WTG delta control (withhold 5% capacity headroom)
    - mFRR: WTG available capacity above minimum

    WTG contribution:
    - Delta control: WTGs run at P_target - delta, can ramp up on signal
      delta = min(P_avail * 0.05, 25 MW)  [5% headroom or 25 MW, whichever is less]
    """
    services = []
    total_revenue = 0.0

    # FCR-N: BESS reserves fraction of capacity
    fcr_capacity = bess_power_mw * (reserve_soc_pct / 100.0)
    fcr_revenue = (
        fcr_capacity * _ANCILLARY_PRICES["FCR-N"]["availability"] * 8760.0 / 1e6
    )  # M EUR/yr
    services.append(
        {
            "service": "FCR-N",
            "capacity_mw": round(fcr_capacity, 1),
            "availability_price_eur_mw_h": _ANCILLARY_PRICES["FCR-N"]["availability"],
            "activation_price_eur_mwh": 0.0,
            "annual_revenue_eur": round(fcr_revenue * 1e6, 0),
        }
    )
    total_revenue += fcr_revenue

    # FCR-D: remaining BESS capacity after FCR-N
    fcrd_capacity = max(0.0, bess_power_mw - fcr_capacity)
    fcrd_revenue = fcrd_capacity * _ANCILLARY_PRICES["FCR-D"]["availability"] * 8760.0 / 1e6
    if fcrd_capacity > 0.1:
        services.append(
            {
                "service": "FCR-D",
                "capacity_mw": round(fcrd_capacity, 1),
                "availability_price_eur_mw_h": _ANCILLARY_PRICES["FCR-D"]["availability"],
                "activation_price_eur_mwh": 0.0,
                "annual_revenue_eur": round(fcrd_revenue * 1e6, 0),
            }
        )
        total_revenue += fcrd_revenue

    # aFRR: WTG delta headroom (5% of available)
    afrr_capacity = min(25.0, wtg_available_mw * 0.05)
    afrr_revenue = afrr_capacity * _ANCILLARY_PRICES["aFRR"]["availability"] * 8760.0 / 1e6
    if afrr_capacity > 0.5:
        services.append(
            {
                "service": "aFRR",
                "capacity_mw": round(afrr_capacity, 1),
                "availability_price_eur_mw_h": _ANCILLARY_PRICES["aFRR"]["availability"],
                "activation_price_eur_mwh": _ANCILLARY_PRICES["aFRR"]["activation"],
                "annual_revenue_eur": round(afrr_revenue * 1e6, 0),
            }
        )
        total_revenue += afrr_revenue

    # mFRR: larger WTG headroom block (10% of available)
    mfrr_capacity = min(50.0, wtg_available_mw * 0.10)
    mfrr_revenue = mfrr_capacity * _ANCILLARY_PRICES["mFRR"]["availability"] * 8760.0 / 1e6
    if mfrr_capacity > 1.0:
        services.append(
            {
                "service": "mFRR",
                "capacity_mw": round(mfrr_capacity, 1),
                "availability_price_eur_mw_h": _ANCILLARY_PRICES["mFRR"]["availability"],
                "activation_price_eur_mwh": _ANCILLARY_PRICES["mFRR"]["activation"],
                "annual_revenue_eur": round(mfrr_revenue * 1e6, 0),
            }
        )
        total_revenue += mfrr_revenue

    if total_revenue >= 5.0:
        assessment = "EXCELLENT — BSP portfolio provides strong ancillary revenue"
    elif total_revenue >= 2.0:
        assessment = "GOOD — Ancillary services contribute meaningfully to revenue stack"
    else:
        assessment = (
            "LIMITED — Consider increasing BESS capacity for better ancillary participation"
        )

    return {
        "services": services,
        "total_annual_revenue_eur": round(total_revenue * 1e6, 0),
        "fcr_capacity_mw": round(fcr_capacity, 1),
        "afrr_capacity_mw": round(afrr_capacity, 1),
        "mfrr_capacity_mw": round(mfrr_capacity, 1),
        "bsp_contract_value_m_eur_year": round(total_revenue, 3),
        "assessment": assessment,
    }


def simulate_annual_revenue(
    annual_aep_mwh: float,
    avg_da_price_eur_mwh: float,
    price_volatility_pct: float,
    capacity_factor_pct: float,
    cfd_strike_price_eur_mwh: float,
    o_and_m_cost_m_eur_year: float,
) -> dict[str, Any]:
    """
    Simulate annual revenue for Baltic Wind across all income streams.

    Revenue components:
    1. DA energy sales: AEP * avg_price (adjusted for BESS timing)
    2. CfD support: max(0, (strike - market) * AEP) if CfD in place
    3. BSP ancillary services: ~3.5 M EUR/year (from ancillary model)
    4. BESS arbitrage: ~1.5 M EUR/year (modelled from price spread)
    5. Less imbalance costs: ~1-3% of DA revenue (MAPE ~10%)
    """
    # 1. Energy revenue
    gross_energy_revenue = annual_aep_mwh * avg_da_price_eur_mwh / 1e6  # M EUR

    # 2. CfD support payment
    cfd_support = max(0.0, (cfd_strike_price_eur_mwh - avg_da_price_eur_mwh)) * annual_aep_mwh / 1e6

    # 3. Ancillary services (approximate — average from model)
    bsp_revenue = 3.5  # M EUR/year

    # 4. BESS arbitrage (price spread model)
    # Arbitrage value ~ (price_spread) * BESS_energy * efficiency * days
    # Price spread ≈ 2 * std_dev (sell high, buy low)
    price_std = avg_da_price_eur_mwh * (price_volatility_pct / 100.0)
    price_spread = 2.0 * price_std  # approx daily high-low spread
    bess_daily_throughput = BESS_RATED_MWH * 0.7  # 70% DoD per cycle
    bess_arbitrage = price_spread * bess_daily_throughput * BESS_ETA * 365.0 / 1e6

    # 5. Imbalance costs (simplified: ~2% of DA revenue, MAPE ~10%)
    imbalance_cost = gross_energy_revenue * 0.02

    total_revenue = (
        gross_energy_revenue + cfd_support + bsp_revenue + bess_arbitrage - imbalance_cost
    )
    ebitda = total_revenue - o_and_m_cost_m_eur_year
    revenue_per_mwh = (total_revenue * 1e6) / max(1.0, annual_aep_mwh)

    # Build breakdown
    total_positive = gross_energy_revenue + cfd_support + bsp_revenue + bess_arbitrage
    breakdown = [
        {
            "category": "Energy sales (DA market)",
            "revenue_m_eur": round(gross_energy_revenue, 2),
            "share_pct": round(100.0 * gross_energy_revenue / total_positive, 1),
        },
        {
            "category": "CfD support payment",
            "revenue_m_eur": round(cfd_support, 2),
            "share_pct": round(100.0 * cfd_support / total_positive, 1),
        },
        {
            "category": "BSP ancillary services",
            "revenue_m_eur": round(bsp_revenue, 2),
            "share_pct": round(100.0 * bsp_revenue / total_positive, 1),
        },
        {
            "category": "BESS arbitrage",
            "revenue_m_eur": round(bess_arbitrage, 2),
            "share_pct": round(100.0 * bess_arbitrage / total_positive, 1),
        },
        {
            "category": "Imbalance settlement (cost)",
            "revenue_m_eur": round(-imbalance_cost, 2),
            "share_pct": round(-100.0 * imbalance_cost / total_positive, 1),
        },
    ]

    lcoe_comparison = _lcoe_margin_assessment(revenue_per_mwh, LCOE_EUR_MWH)

    if ebitda > 50.0:
        assessment = "STRONG — EBITDA > 50 M EUR/year; project highly bankable"
    elif ebitda > 20.0:
        assessment = "HEALTHY — EBITDA > 20 M EUR/year; project bankable"
    elif ebitda > 0.0:
        assessment = "MARGINAL — Positive EBITDA but tight; review O&M costs or CfD strike"
    else:
        assessment = "UNVIABLE — Negative EBITDA; project not bankable at these prices"

    return {
        "gross_revenue_m_eur": round(gross_energy_revenue, 2),
        "cfd_support_m_eur": round(cfd_support, 2),
        "ancillary_revenue_m_eur": round(bsp_revenue, 2),
        "imbalance_cost_m_eur": round(imbalance_cost, 2),
        "bess_arbitrage_m_eur": round(bess_arbitrage, 2),
        "total_revenue_m_eur": round(total_revenue, 2),
        "ebitda_m_eur": round(ebitda, 2),
        "revenue_per_mwh_eur": round(revenue_per_mwh, 2),
        "breakdown": breakdown,
        "lcoe_comparison": lcoe_comparison,
        "assessment": assessment,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────


def _compute_bess_arbitrage(prices: list[float], initial_soc_pct: float) -> float:
    """
    Simple BESS price arbitrage: charge in 6 cheapest hours, discharge in 6 most expensive.

    Returns daily arbitrage revenue [EUR].
    """
    soc = initial_soc_pct
    soc_min = 10.0
    soc_max = 90.0
    eta = BESS_ETA
    e_rated = BESS_RATED_MWH
    p_rated = BESS_RATED_MW

    # Identify 6 cheapest (charge) and 6 most expensive (discharge) hours
    indexed = sorted(range(24), key=lambda i: prices[i])
    charge_hours = set(indexed[:6])
    discharge_hours = set(indexed[-6:])

    revenue = 0.0
    for h in range(24):
        price = prices[h]
        if h in charge_hours and soc < soc_max and price >= 0:
            energy = min(p_rated, e_rated * (soc_max - soc) / 100.0)  # MWh in 1h
            energy = min(energy, p_rated)
            soc += energy * eta / (e_rated / 100.0)
            revenue -= price * energy  # cost to charge
        elif h in discharge_hours and soc > soc_min:
            energy = min(p_rated, e_rated * (soc - soc_min) / 100.0)
            energy = min(energy, p_rated)
            soc -= energy / (e_rated / 100.0)
            revenue += price * energy  # income from discharge

    return max(0.0, revenue)


def _lcoe_margin_assessment(revenue_per_mwh: float, lcoe: float) -> str:
    margin = revenue_per_mwh - lcoe
    margin_pct = 100.0 * margin / lcoe if lcoe > 0 else 0.0
    base = f"Revenue {revenue_per_mwh:.1f} EUR/MWh vs LCOE {lcoe:.1f} EUR/MWh"
    if margin_pct >= 30.0:
        return f"{base} — margin {margin_pct:.0f}% above LCOE"
    if margin_pct >= 0.0:
        return f"{base} — positive but thin margin"
    return f"{base} — BELOW LCOE; project not viable at this price"
