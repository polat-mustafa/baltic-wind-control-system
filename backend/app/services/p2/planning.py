"""
Planning & Power-to-X — two studies on the 510 MW farm.

1. Export technology vs distance (HVAC 220 kV vs VSC-HVDC ±320 kV)
   HVAC: 2 × 1000 mm² 220 kV circuits (the farm's export cable). The cable
   charging current Ic = ωC·L·U/√3 flows whether or not power is sent;
   compensated equally at both ends, the worst-case current at a cable end is
   √(Ip² + (Ic/2)²) ≤ Imax, so the active power a circuit can carry falls with
   length:  P_max = √3·U·√(Imax² − (Ic/2)²).
   Losses: conductor I²R with the mean of Ic(x)² along the cable = Ic²/12,
   plus dielectric loss Q·tan δ (XLPE tan δ = 0.001, IEC 60287-1-1 Table 3).
   HVDC: symmetric monopole, two 1200 mm² Cu cables at 70 °C, I = P/(2·Udc),
   no charging current; converter losses ≈ 1 % per station (assumption,
   typical MMC figure). Shunt reactor, STATCOM and transformer losses are
   left out of both options.

2. Electrolyser on the energy above a grid connection limit
   The farm's output duration curve: Weibull A from v̄ = 9.3 m/s, k = 2.2
   as in P1, through a multi-turbine power curve — the V236 curve averaged
   over a Gaussian spread of wind speed across the farm (σ = 1 m/s,
   Nørgaard & Holttinen 2004) — times 97 % availability (both assumptions).
   A single-turbine curve would hold all 34 turbines at exactly 510 MW for
   ~2 800 h a year, which overstates the energy above any limit.
   If the connection is smaller than 510 MW, the energy above it is lost
   unless an electrolyser absorbs it. That energy costs nothing, but an
   electrolyser sized beyond the bulk of the surplus runs fewer full-load
   hours, and its capital cost then dominates the levelised cost of
   hydrogen (LCOH).

All cost inputs are assumptions shown as such; no cost claim is sourced.
"""

from __future__ import annotations

import math
from functools import lru_cache
from typing import Any

import numpy as np

from app.services.p1.farm_comparison import weibull_scale_from_mean
from app.services.p1.wake_model import get_v236_power_curve_kw
from app.services.p2.network_model import (
    ALPHA_CU_PER_K,
    EXPORT_CABLE_1000,
    EXPORT_CABLE_LENGTH_KM,
    NUM_EXPORT_CABLES,
    TOTAL_CAPACITY_MW,
)

HOURS = 8760
OMEGA = 2 * math.pi * 50.0
SITE_MEAN_MS = 9.3  # P1 default site
SITE_K = 2.2
FARM_SPREAD_MS = 1.0  # σ of wind speed across the farm — assumption
AVAILABILITY = 0.97  # assumption

# HVAC — the farm's export cable
U_AC_KV = 220.0
TAN_DELTA_XLPE = 0.001  # IEC 60287-1-1 Table 3, XLPE unfilled, U0 > 18 kV
# HVDC — ±320 kV symmetric monopole, 1200 mm² Cu (IEC 60228 R20 = 0.0151 Ω/km)
U_DC_KV = 320.0
R_DC_OHM_PER_KM = 0.0151 * (1 + ALPHA_CU_PER_K * (70.0 - 20.0))
CONVERTER_LOSS = 0.01  # per station, fraction of power — assumption

# Electrolyser (PEM) — assumptions
SEC_KWH_PER_KG = 53.0  # system specific energy incl. balance of plant
H2_LHV_KWH_PER_KG = 33.33  # physical constant
MIN_LOAD = 0.10  # fraction of rated
OPEX_FRACTION = 0.03  # of CAPEX per year
WACC = 0.07
LIFETIME_Y = 20
REPOWER_EFFICIENCY = 0.50  # H2 back to power (fuel cell / H2 turbine) — assumption


@lru_cache(maxsize=1)
def farm_duration_mw() -> np.ndarray:
    """Farm output for each of the 8760 hours, sorted high to low [MW].

    Hour h has wind exceeded with probability (h + ½)/8760 under the site
    Weibull: v = A·(−ln q)^(1/k). Farm curve = turbine curve averaged over
    v + δ, δ ~ N(0, σ), times availability.
    """
    a = weibull_scale_from_mean(SITE_MEAN_MS, SITE_K)
    q = (np.arange(HOURS) + 0.5) / HOURS
    v = a * (-np.log(q)) ** (1 / SITE_K)
    z = np.linspace(-3.0, 3.0, 25)
    w = np.exp(-(z**2) / 2) / np.exp(-(z**2) / 2).sum()
    curve = np.asarray(
        get_v236_power_curve_kw(np.maximum(v[:, None] + FARM_SPREAD_MS * z, 0.0)), dtype=float
    )
    p = AVAILABILITY * (curve @ w) / 15_000.0
    return np.sort(np.clip(p, 0.0, 1.0) * TOTAL_CAPACITY_MW)[::-1]


def _crf(rate: float = WACC, years: int = LIFETIME_Y) -> float:
    return rate * (1 + rate) ** years / ((1 + rate) ** years - 1)


# ── 1. Export technology vs distance ──────────────────────────────


def export_comparison(design_length_km: float = EXPORT_CABLE_LENGTH_KM) -> dict[str, Any]:
    """HVAC capacity, compensation and annual losses vs HVDC over 10–200 km."""
    p_mw = farm_duration_mw()
    e_year_mwh = float(p_mw.sum())
    p2_sum = float((p_mw**2).sum())  # Σ P² [MW²·h]

    n = NUM_EXPORT_CABLES
    u = U_AC_KV * 1e3
    r_ac = EXPORT_CABLE_1000.r_ac_ohm_per_km
    wc = OMEGA * EXPORT_CABLE_1000.c_nf_per_km * 1e-9  # S/km
    i_max = EXPORT_CABLE_1000.max_i_ka * 1e3

    def hvac(length: float) -> dict[str, float]:
        ic = wc * length * u / math.sqrt(3)  # charging current per circuit [A]
        q = n * wc * length * u**2 / 1e6  # Mvar
        r = r_ac * length
        usable = max(i_max**2 - (ic / 2) ** 2, 0.0)
        cap = n * math.sqrt(3) * u * math.sqrt(usable) / 1e6
        k_load = 3 * r / n / (3 * u**2) * 1e6  # loss [MW] = k_load · P[MW]²
        fixed = n * 3 * r * ic**2 / 12 / 1e6 + q * TAN_DELTA_XLPE  # MW, all year
        return {
            "capacity_mw": cap,
            "charging_mvar": q,
            "loss_rated_mw": k_load * TOTAL_CAPACITY_MW**2 + fixed,
            "loss_gwh": (k_load * p2_sum + fixed * HOURS) / 1e3,
        }

    def hvdc(length: float) -> dict[str, float]:
        k_cable = 2 * R_DC_OHM_PER_KM * length / (2 * U_DC_KV * 1e3) ** 2 * 1e6
        return {
            "loss_rated_mw": k_cable * TOTAL_CAPACITY_MW**2
            + 2 * CONVERTER_LOSS * TOTAL_CAPACITY_MW,
            "loss_gwh": (k_cable * p2_sum + 2 * CONVERTER_LOSS * e_year_mwh) / 1e3,
        }

    rows = []
    for length in np.arange(10.0, 201.0, 5.0):
        ac, dc = hvac(float(length)), hvdc(float(length))
        rows.append(
            {
                "length_km": float(length),
                "hvac_capacity_mw": round(ac["capacity_mw"], 1),
                "hvac_charging_mvar": round(ac["charging_mvar"], 1),
                "hvac_loss_gwh": round(ac["loss_gwh"], 2),
                "hvdc_loss_gwh": round(dc["loss_gwh"], 2),
            }
        )

    capacity_limit = next(
        (r["length_km"] for r in rows if r["hvac_capacity_mw"] < TOTAL_CAPACITY_MW), None
    )
    loss_crossover = next(
        (r["length_km"] for r in rows if r["hvdc_loss_gwh"] < r["hvac_loss_gwh"]), None
    )
    ac, dc = hvac(design_length_km), hvdc(design_length_km)
    return {
        "design_length_km": design_length_km,
        "annual_energy_gwh": round(e_year_mwh / 1e3, 1),
        "capacity_factor": round(e_year_mwh / (TOTAL_CAPACITY_MW * HOURS), 3),
        "hvac": {k: round(v, 2) for k, v in ac.items()},
        "hvdc": {k: round(v, 2) for k, v in dc.items()},
        "hvac_capacity_limit_km": capacity_limit,
        "loss_crossover_km": loss_crossover,
        "sweep": rows,
    }


# ── 2. Electrolyser on energy above the connection limit ─────────


def p2x_study(
    connection_mw: float = 400.0,
    electrolyser_mw: float = 60.0,
    capex_eur_per_kw: float = 2000.0,
) -> dict[str, Any]:
    """Energy above the connection limit, what an electrolyser absorbs, and its LCOH."""
    p = farm_duration_mw()
    surplus = np.clip(p - connection_mw, 0.0, None)
    absorbed = np.minimum(surplus, electrolyser_mw)
    absorbed[absorbed < MIN_LOAD * electrolyser_mw] = 0.0

    e_el = float(absorbed.sum())  # MWh
    h2_kg = e_el * 1e3 / SEC_KWH_PER_KG
    flh = e_el / electrolyser_mw if electrolyser_mw > 0 else 0.0
    annual_capital = capex_eur_per_kw * electrolyser_mw * 1e3 * (_crf() + OPEX_FRACTION)

    def lcoh(hours: np.ndarray | float, price_eur_mwh: float) -> np.ndarray | float:
        """€/kg at a given full-load-hour count and electricity price."""
        kg_per_mw_year = np.asarray(hours) * 1e3 / SEC_KWH_PER_KG
        capital = capex_eur_per_kw * 1e3 * (_crf() + OPEX_FRACTION) / kg_per_mw_year
        return capital + price_eur_mwh * SEC_KWH_PER_KG / 1e3

    flh_axis = np.arange(500.0, 8001.0, 250.0)
    return {
        "connection_mw": connection_mw,
        "electrolyser_mw": electrolyser_mw,
        "farm_energy_gwh": round(float(p.sum()) / 1e3, 1),
        "surplus_gwh": round(float(surplus.sum()) / 1e3, 2),
        "surplus_hours": int((surplus > 0).sum()),
        "absorbed_gwh": round(e_el / 1e3, 2),
        "still_lost_gwh": round(float(surplus.sum() - e_el) / 1e3, 2),
        "h2_tonnes": round(h2_kg / 1e3, 1),
        "full_load_hours": round(flh),
        "lcoh_eur_kg": round(annual_capital / h2_kg, 2) if h2_kg > 0 else None,
        "efficiency_lhv": round(H2_LHV_KWH_PER_KG / SEC_KWH_PER_KG, 3),
        "power_to_power": round(H2_LHV_KWH_PER_KG / SEC_KWH_PER_KG * REPOWER_EFFICIENCY, 3),
        "duration_step_h": 20,
        "duration_mw": [round(float(x), 1) for x in p[::20]],
        "lcoh_flh": flh_axis.tolist(),
        "lcoh_curves": [
            {"price_eur_mwh": price, "lcoh_eur_kg": np.round(lcoh(flh_axis, price), 2).tolist()}
            for price in (0, 50, 100)
        ],
    }
