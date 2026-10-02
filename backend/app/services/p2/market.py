"""
Market — one trading day of the 510 MW farm on the Polish market (M11).

Day-ahead (TGE, coupled in SDAC)
    The farm offers its forecast for each period at a price of 0; in periods
    with a negative price it offers nothing and curtails in real time.
    Periods are hourly here for readability — SDAC has traded 15-minute
    products since delivery day 1 Oct 2025. Harmonised clearing limits
    −500 / +4 000 €/MWh.

Imbalance (PSE, since the 14 Jun 2024 balancing-market reform)
    15-minute settlement at a single imbalance price (CEN) for long and short
    positions. Settled on deviation = metered − scheduled:
        cash = dev · CEN
    Neighbouring wind farms err the same way as this one, so the system tends
    to be short when the farm is short: CEN rises against the farm. Modelled
    as CEN = DA − λ·dev (λ an assumption), so the cost of forecast error
    against selling at DA is λ·Σdev² — it grows with the square of the error.

Two-sided CfD (Polish Offshore Wind Act, 2020)
    Settled on metered energy against the day-ahead price of each period:
        settlement = E · (strike − DA)    (> 0 paid to the farm, < 0 paid back)
    Phase II auction (17 Dec 2025): 476.88–492.32 PLN/MWh, 25 years.
    No support in negative-price periods (EU CEEAG 2022 §122), which is why
    the farm curtails there.

BESS (50 MW / 200 MWh, constants from the BESS tab)
    Price arbitrage on the day-ahead curve, solved as a linear programme with
    perfect price foresight — an upper bound on what a real trader earns.
    Storage is not eligible for the CfD.

Synthetic inputs (labelled as such): the price shapes, the hub-height wind of
each scenario and the forecast error are illustrative, not TGE or ERA5 data.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy.optimize import linprog

from app.services.p1.wake_model import get_v236_power_curve_kw
from app.services.p2.bess import (
    RATED_ENERGY_MWH,
    RATED_POWER_MW,
    ROUNDTRIP_EFFICIENCY_PCT,
    SOC_MAX_PCT,
    SOC_MIN_PCT,
)

N_TURBINES = 34
RATED_MW = 510.0
LOSS_FACTOR = 0.90  # wake + electrical losses, assumption (P1 computes the real wake loss)
LAMBDA_PLN_PER_MWH2 = 0.25  # CEN shift per MWh of farm deviation, assumption
SEED = 7

# Illustrative day shapes: day-ahead price [PLN/MWh] and hub-height wind [m/s].
SCENARIOS: dict[str, dict[str, Any]] = {
    "windy_spring_sunday": {
        "label": "Windy spring Sunday — solar pushes midday prices below zero",
        "price": [380, 360, 340, 330, 330, 340, 330, 250, 120, 20, -40, -80,
                  -120, -100, -50, 20, 150, 320, 450, 520, 480, 430, 400, 380],
        "wind": [12.5, 12.8, 13.0, 13.2, 13.0, 12.6, 12.2, 11.8, 11.5, 11.0, 10.6, 10.2,
                 10.0, 10.1, 10.4, 10.8, 11.2, 11.6, 12.0, 12.3, 12.5, 12.6, 12.4, 12.2],
    },
    "winter_weekday": {
        "label": "Winter weekday — moderate wind, morning and evening peaks",
        "price": [380, 360, 350, 345, 355, 420, 560, 680, 700, 650, 600, 570,
                  550, 540, 560, 620, 720, 820, 850, 780, 650, 540, 460, 410],
        "wind": [8.6, 8.9, 9.2, 9.4, 9.3, 9.0, 8.6, 8.2, 7.8, 7.5, 7.3, 7.2,
                 7.4, 7.8, 8.3, 8.8, 9.2, 9.5, 9.6, 9.4, 9.1, 8.8, 8.5, 8.3],
    },
    "calm_summer_day": {
        "label": "Calm summer day — little wind, a deep solar dip",
        "price": [400, 380, 370, 360, 360, 380, 420, 380, 250, 150, 80, 40,
                  20, 30, 90, 200, 380, 520, 650, 700, 620, 520, 460, 420],
        "wind": [6.2, 6.0, 5.7, 5.4, 5.1, 4.8, 4.5, 4.3, 4.2, 4.4, 4.7, 5.0,
                 5.3, 5.6, 5.9, 6.2, 6.5, 6.8, 7.0, 7.1, 7.0, 6.8, 6.6, 6.4],
    },
}  # fmt: skip


def farm_mw(wind_ms: np.ndarray) -> np.ndarray:
    """Farm output [MW] from hub-height wind: 34 × V236 curve × losses, 0 ≤ P ≤ 510."""
    p = N_TURBINES * get_v236_power_curve_kw(wind_ms) / 1000.0 * LOSS_FACTOR
    return np.clip(p, 0.0, RATED_MW)


def bess_arbitrage(price: np.ndarray) -> tuple[np.ndarray, np.ndarray, float]:
    """
    Charge c_t / discharge d_t [MW, 1 h periods] maximising Σ price·(d − c).

    SOC [MWh]: s_t = s_0 + Σ(η·c − d) within 10–90 %, starting and ending at 50 %
    (η = 92 % on the charge side, the BESS-tab convention).
    Returns (net battery power, + = discharge, MW), SOC [%] after each period,
    and the day's arbitrage margin [PLN].
    """
    n = len(price)
    eta = ROUNDTRIP_EFFICIENCY_PCT / 100.0
    s0 = RATED_ENERGY_MWH / 2
    lower = np.tril(np.ones((n, n)))  # cumulative sum
    a_soc = np.hstack([eta * lower, -lower])  # s_t − s_0 for x = [c, d]
    a_ub = np.vstack([a_soc, -a_soc])
    b_ub = np.concatenate(
        [
            np.full(n, RATED_ENERGY_MWH * SOC_MAX_PCT / 100 - s0),
            np.full(n, s0 - RATED_ENERGY_MWH * SOC_MIN_PCT / 100),
        ]
    )
    res = linprog(
        c=np.concatenate([price, -price]),
        A_ub=a_ub,
        b_ub=b_ub,
        A_eq=a_soc[-1:],  # end where it started
        b_eq=[0.0],
        bounds=[(0.0, RATED_POWER_MW)] * (2 * n),
        method="highs",
    )
    charge, discharge = res.x[:n], res.x[n:]
    soc = 100.0 * (s0 + lower @ (eta * charge - discharge)) / RATED_ENERGY_MWH
    return discharge - charge, soc, float(-res.fun)


def simulate_day(
    scenario: str = "windy_spring_sunday",
    strike_pln_mwh: float = 489.0,
    forecast_sigma_ms: float = 1.0,
    include_cfd: bool = True,
    include_bess: bool = True,
) -> dict[str, Any]:
    """
    Schedule, settle and sum one day: day-ahead sales, imbalance at CEN,
    CfD settlement and BESS arbitrage. All money in PLN, energy in MWh
    (1 h periods, so MW and MWh/period are numerically equal).
    """
    sc = SCENARIOS[scenario]
    price = np.array(sc["price"], dtype=float)
    wind_fc = np.array(sc["wind"], dtype=float)

    # Day-ahead wind-speed error: AR(1), φ = 0.8, stationary σ = forecast_sigma_ms.
    rng = np.random.default_rng(SEED)
    err = np.zeros(24)
    for t in range(24):
        prev = err[t - 1] if t else 0.0
        err[t] = 0.8 * prev + forecast_sigma_ms * np.sqrt(1 - 0.8**2) * rng.standard_normal()
    forecast = farm_mw(wind_fc)
    available = farm_mw(np.maximum(wind_fc + err, 0.0))

    negative = price < 0
    bid = np.where(negative, 0.0, forecast)
    metered = np.where(negative, 0.0, available)  # curtailed to the zero schedule
    dev = metered - bid
    cen = price - LAMBDA_PLN_PER_MWH2 * dev

    energy_value = float(metered @ price)
    imbalance = float(dev @ (cen - price))  # = −λ·Σdev², ≤ 0
    cfd = float(metered @ (strike_pln_mwh - price)) if include_cfd else 0.0
    bess_mw, soc, bess = bess_arbitrage(price) if include_bess else (np.zeros(24), None, 0.0)
    total = energy_value + imbalance + cfd + bess

    e_total = float(metered.sum())
    captured = energy_value / e_total if e_total else 0.0
    farm_per_mwh = (energy_value + imbalance + cfd) / e_total if e_total else 0.0
    curtailed = float(available[negative].sum())

    if include_cfd:
        assessment = (
            f"The CfD fixes the price: {farm_per_mwh:.0f} PLN/MWh earned against a "
            f"{strike_pln_mwh:.0f} strike; the gap is the imbalance cost."
        )
    elif captured < price.mean():
        assessment = (
            f"Merchant: the farm captures {captured:.0f} PLN/MWh against a "
            f"{price.mean():.0f} PLN/MWh day average — wind sells most when power is cheap."
        )
    else:
        assessment = (
            f"Merchant: {captured:.0f} PLN/MWh captured, above the {price.mean():.0f} PLN/MWh "
            "day average, because the negative-price hours are curtailed."
        )

    return {
        "scenario": scenario,
        "scenario_label": sc["label"],
        "hours": [
            {
                "hour": h,
                "da_price_pln_mwh": round(float(price[h]), 1),
                "cen_pln_mwh": round(float(cen[h]), 1),
                "wind_forecast_ms": round(float(wind_fc[h]), 2),
                "wind_actual_ms": round(float(max(wind_fc[h] + err[h], 0.0)), 2),
                "forecast_mwh": round(float(forecast[h]), 1),
                "bid_mwh": round(float(bid[h]), 1),
                "metered_mwh": round(float(metered[h]), 1),
                "curtailed_mwh": round(float(available[h]) if negative[h] else 0.0, 1),
                "deviation_mwh": round(float(dev[h]), 1),
                "bess_mw": round(float(bess_mw[h]), 1),
                "bess_soc_pct": None if soc is None else round(float(soc[h]), 1),
            }
            for h in range(24)
        ],
        "energy_mwh": round(e_total, 1),
        "curtailed_mwh": round(curtailed, 1),
        "negative_hours": int(negative.sum()),
        "rmse_mwh": round(float(np.sqrt(np.mean(dev**2))), 1),
        "day_average_price_pln_mwh": round(float(price.mean()), 1),
        "captured_price_pln_mwh": round(captured, 1),
        "capture_rate_pct": round(100.0 * captured / float(price.mean()), 1),
        "farm_price_pln_mwh": round(farm_per_mwh, 1),
        "energy_value_pln": round(energy_value),
        "imbalance_pln": round(imbalance),
        "cfd_settlement_pln": round(cfd),
        "bess_arbitrage_pln": round(bess),
        "total_pln": round(total),
        "assessment": assessment,
    }
