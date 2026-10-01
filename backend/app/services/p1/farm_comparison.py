"""
Multi-farm comparison service — M04.

Computes AEP, LCOE, and grid integration metrics for multiple farm
configurations and produces a side-by-side comparison.

Physics — AEP
-------------
Gross AEP and wake loss come from the same PyWake BPA Gaussian model the
main P1 analysis uses, run on a near-square grid at the configured spacing
(in rotor diameters) with an omnidirectional Weibull site:

  AEP_gross = 8760 h × Σ_turbines ∫ P(v) f(v; A, k) dv
  f(v) = (k/A)(v/A)^(k-1) exp(-(v/A)^k),   A = v̄ / Γ(1 + 1/k)

Turbines other than 15 MW are modelled as the V236 scaled at constant
specific power (P_rated / rotor area = 343 W/m²). Under that assumption the
power curve scales linearly with rating, the rated wind speed is unchanged,
and wake loss depends only on spacing in rotor diameters — so the V236 wake
fraction applies directly.

Gross → net follows the shared multiplicative cascade (aep_calculator):
  Net = Gross × (1-wake)(1-blockage)(1-electrical)(1-availability)(1-env)

Physics — Electrical losses
---------------------------
Series (I²R) losses scale with P², so the annual energy loss fraction is the
loss at rated power times the loss load factor:
  LLF = E[P²] / (P_rated × E[P])     (expectation over the Weibull PDF)
Transformer iron losses are constant whenever energised.

Export cable: 220 kV 1000 mm² Cu XLPE (same spec as the P2 network model),
  n_circuits = ceil(I_rated / I_max),  I_rated = P / (√3 U)   (unity pf at POC)
  P_loss = 3 I² R_ac L / n_circuits
  Q_charging = ω C U² L × n_circuits   (capacitive, positive — rule 7)

LCOE (fixed charge rate)
------------------------
  CRF  = r / (1 - (1+r)^-n)
  LCOE = (CAPEX × CRF + OPEX) / AEP_net

Standards: IEC 61400-15 (AEP), DNV-RP-0003, IEC 60287 (cable losses).
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime
from functools import lru_cache

import numpy as np

from app.schemas.farm_config import (
    AEPResult,
    FarmComparisonResponse,
    FarmConfigCreate,
    FarmConfigResponse,
    GridResult,
    LCOEResult,
)
from app.services.p1.aep_calculator import compute_aep_cascade
from app.services.p1.blockage import estimate_blockage_loss_percent
from app.services.p1.wake_model import (
    RATED_POWER_KW,
    ROTOR_DIAMETER_M,
    create_uniform_site,
    create_v236_wind_turbine,
    get_v236_power_curve_kw,
)
from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    TRAFO_66_220_MVA,
    TRAFO_66_220_PFE_KW,
    TRAFO_66_220_VKR_PERCENT,
    TRAFO_220_400_MVA,
    TRAFO_220_400_PFE_KW,
    TRAFO_220_400_VKR_PERCENT,
)

# ── In-memory farm registry ──────────────────────────────────────
# Production: persisted to farm_configuration DB table via SQLAlchemy
_farm_configs: dict[uuid.UUID, FarmConfigResponse] = {}
_comparison_cache: dict[uuid.UUID, FarmComparisonResponse] = {}

# Array cable loss at rated power for a 66 kV collection system [fraction].
# Typical 0.8–1.5 % at rated; scales with (66/U)² for a fixed conductor.
ARRAY_LOSS_AT_RATED_66KV = 0.010
OMEGA = 2.0 * math.pi * 50.0  # [rad/s]


# ── Wind / AEP physics ────────────────────────────────────────────


def weibull_scale_from_mean(mean_v: float, k: float) -> float:
    """Weibull scale A [m/s] from mean wind speed: A = v̄ / Γ(1 + 1/k)."""
    return mean_v / math.gamma(1.0 + 1.0 / k)


def loss_load_factor(weibull_a: float, weibull_k: float) -> float:
    """E[P²] / (P_rated · E[P]) for the V236 curve under Weibull(A, k) [-].

    Multiplying an I²R loss fraction at rated power by this gives the
    annual energy loss fraction.
    """
    v = np.linspace(0.0, 35.0, 1401)
    pdf = (
        (weibull_k / weibull_a)
        * (v / weibull_a) ** (weibull_k - 1)
        * np.exp(-((v / weibull_a) ** weibull_k))
    )
    p = get_v236_power_curve_kw(v) / RATED_POWER_KW  # per-unit
    return float(np.trapezoid(p**2 * pdf, v) / np.trapezoid(p * pdf, v))


def grid_layout_m(n: int, spacing_d: float) -> tuple[np.ndarray, np.ndarray]:
    """Near-square grid of n turbines at spacing_d rotor diameters [m]."""
    cols = math.ceil(math.sqrt(n))
    i = np.arange(n)
    step = spacing_d * ROTOR_DIAMETER_M
    return (i % cols) * step, (i // cols) * step


@lru_cache(maxsize=128)
def _wake_run(n: int, spacing_d: float, weibull_a: float, weibull_k: float) -> tuple[float, float]:
    """PyWake BPA Gaussian on a grid → (gross AEP of n × V236 [GWh], wake loss fraction).

    PropagateDownwind is equivalent to All2AllIterative without a blockage
    deficit model; 5° direction bins match 1° bins to 0.01 pp on a uniform rose.
    """
    from py_wake.deficit_models.gaussian import NiayifarGaussianDeficit
    from py_wake.superposition_models import LinearSum
    from py_wake.turbulence_models import STF2017TurbulenceModel
    from py_wake.wind_farm_models import PropagateDownwind

    x, y = grid_layout_m(n, spacing_d)
    model = PropagateDownwind(
        create_uniform_site(weibull_a, weibull_k),
        create_v236_wind_turbine(),
        wake_deficitModel=NiayifarGaussianDeficit(),
        superpositionModel=LinearSum(),
        turbulenceModel=STF2017TurbulenceModel(),
    )
    sim = model(x, y, wd=np.arange(0, 360, 5))
    gross = float(sim.aep(with_wake_loss=False).sum())
    net = float(sim.aep().sum())
    return gross, 1.0 - net / gross


# ── Grid physics ──────────────────────────────────────────────────


def compute_grid(farm: FarmConfigResponse, llf: float, gross_cf: float) -> dict[str, float | int]:
    """Electrical losses (at rated and annual), export sizing and cable charging."""
    p_mw = farm.installed_mw
    u_kv = farm.export_voltage_kv
    cable = EXPORT_CABLE_1000

    # Export cable: number of circuits from thermal rating, then I²R loss
    i_rated_ka = p_mw / (math.sqrt(3) * u_kv)
    n_circuits = max(1, math.ceil(i_rated_ka / cable.max_i_ka))
    export_loss_mw = (
        3.0 * (i_rated_ka * 1e3) ** 2 * cable.r_ac_ohm_per_km * farm.export_length_km / n_circuits
    ) / 1e6
    export_rated = export_loss_mw / p_mw

    array_rated = ARRAY_LOSS_AT_RATED_66KV * (66.0 / farm.array_voltage_kv) ** 2

    # Two transformer stages (66/220 offshore + 220/400 onshore): copper ≈ vkr at rated
    trafo_rated = (TRAFO_66_220_VKR_PERCENT + TRAFO_220_400_VKR_PERCENT) / 100.0
    iron_frac = (TRAFO_66_220_PFE_KW / 1e3 / TRAFO_66_220_MVA) + (
        TRAFO_220_400_PFE_KW / 1e3 / TRAFO_220_400_MVA
    )

    rated_total = export_rated + array_rated + trafo_rated
    # Energy-weighted: series losses × LLF; iron losses run 8760 h against gross energy
    annual = rated_total * llf + iron_frac / gross_cf

    q_charging_mvar = (
        OMEGA * cable.c_nf_per_km * 1e-9 * (u_kv * 1e3) ** 2 * farm.export_length_km * n_circuits
    ) / 1e6

    return {
        "export_circuits": n_circuits,
        "export_cable_losses_pct": round(export_rated * 100, 2),
        "array_cable_losses_pct": round(array_rated * 100, 2),
        "transformer_losses_pct": round(trafo_rated * 100, 2),
        "total_electrical_losses_pct": round(rated_total * 100, 2),
        "annual_electrical_loss_pct": round(annual * 100, 2),
        "loss_load_factor": round(llf, 3),
        "cable_charging_mvar": round(q_charging_mvar, 1),
        "export_utilization_pct": round(i_rated_ka / (n_circuits * cable.max_i_ka) * 100, 1),
    }


# ── LCOE ─────────────────────────────────────────────────────────


def compute_lcoe(
    farm: FarmConfigResponse, net_gwh: float, electricity_price: float
) -> dict[str, float]:
    """LCOE [€/MWh] by fixed charge rate, plus payback and IRR."""
    wacc = farm.discount_rate_pct / 100.0
    n = farm.lifetime_years
    crf = wacc / (1.0 - (1.0 + wacc) ** (-n))

    capex = farm.installed_mw * farm.capex_m_eur_per_mw  # M€
    opex = farm.installed_mw * farm.opex_k_eur_per_mw_year / 1000.0  # M€/yr
    mwh = net_gwh * 1000.0
    lcoe = (capex * crf + opex) * 1e6 / mwh

    revenue = mwh * electricity_price / 1e6  # M€/yr
    cashflow = revenue - opex
    payback = capex / cashflow if cashflow > 0 else 999.0

    return {
        "lcoe_eur_per_mwh": round(lcoe, 1),
        "capex_meur": round(capex, 1),
        "opex_meur_year": round(opex, 2),
        "annual_revenue_meur": round(revenue, 1),
        "lifetime_revenue_meur": round(revenue * n, 1),
        "simple_payback_years": round(min(payback, 999.0), 1),
        "irr_pct": round(project_irr(capex, cashflow, n) * 100.0, 1),
    }


def project_irr(capex: float, annual_cf: float, n: int) -> float:
    """IRR of −CAPEX then n equal cash flows, by bisection on NPV(r) = 0.

    Returns 0 when undiscounted cash flows don't recover CAPEX (IRR ≤ 0).
    NPV is monotonically decreasing in r, so bisection always converges.
    """
    if annual_cf * n <= capex:
        return 0.0
    lo, hi = 1e-9, 1.0
    for _ in range(100):
        r = (lo + hi) / 2
        npv = -capex + annual_cf * (1.0 - (1.0 + r) ** (-n)) / r
        lo, hi = (r, hi) if npv > 0 else (lo, r)
    return (lo + hi) / 2


# ── Public API ────────────────────────────────────────────────────


def _to_response(config: FarmConfigCreate) -> FarmConfigResponse:
    return FarmConfigResponse(
        id=uuid.uuid4(),
        installed_mw=round(config.turbine_count * config.turbine_rated_mw, 1),
        created_at=datetime.now(UTC),
        **config.model_dump(),
    )


def create_farm(config: FarmConfigCreate) -> FarmConfigResponse:
    """Create and persist a new farm configuration."""
    resp = _to_response(config)
    _farm_configs[resp.id] = resp
    return resp


def get_farm(farm_id: uuid.UUID) -> FarmConfigResponse | None:
    return _farm_configs.get(farm_id)


def list_farms() -> list[FarmConfigResponse]:
    return sorted(_farm_configs.values(), key=lambda f: f.created_at, reverse=True)


def delete_farm(farm_id: uuid.UUID) -> bool:
    return _farm_configs.pop(farm_id, None) is not None


def resolve_farms(
    farm_ids: list[uuid.UUID] | None, configs: list[FarmConfigCreate] | None
) -> list[FarmConfigResponse]:
    """Stored farms by id, or transient farms from inline configs (not stored)."""
    if configs:
        return [_to_response(c) for c in configs]
    missing = [str(f) for f in farm_ids or [] if f not in _farm_configs]
    if missing:
        raise ValueError(f"Unknown farm configuration id(s): {', '.join(missing)}")
    return [_farm_configs[f] for f in farm_ids or []]


def evaluate_farm(
    farm: FarmConfigResponse, electricity_price: float
) -> tuple[AEPResult, LCOEResult, GridResult]:
    """Full AEP → grid → LCOE evaluation for one farm."""
    a = weibull_scale_from_mean(farm.mean_wind_speed_ms, farm.weibull_k)
    a_key, k_key = round(a, 3), round(farm.weibull_k, 3)
    gross_v236, wake = _wake_run(farm.turbine_count, farm.turbine_spacing_d, a_key, k_key)
    gross = gross_v236 * farm.turbine_rated_mw / (RATED_POWER_KW / 1e3)
    gross_cf = gross * 1e3 / (farm.installed_mw * 8760.0)

    x, y = grid_layout_m(farm.turbine_count, farm.turbine_spacing_d)
    blockage = estimate_blockage_loss_percent(
        num_turbines=farm.turbine_count,
        x_positions=x,
        y_positions=y,
        mean_wind_speed_ms=farm.mean_wind_speed_ms,
        weibull_k=farm.weibull_k,
    ).blockage_loss_percent

    grid = compute_grid(farm, loss_load_factor(a_key, k_key), gross_cf)
    cascade = compute_aep_cascade(
        gross_aep_gwh=gross,
        wake_loss_fraction=wake,
        blockage_loss_fraction=blockage / 100.0,
        electrical_loss_fraction=float(grid["annual_electrical_loss_pct"]) / 100.0,
        availability_loss_fraction=1.0 - farm.availability_pct / 100.0,
        num_turbines=farm.turbine_count,
        rated_power_kw=farm.turbine_rated_mw * 1e3,
        price_eur_mwh=electricity_price,
    )

    aep = AEPResult(
        farm_id=farm.id,
        farm_name=farm.name,
        installed_mw=farm.installed_mw,
        weibull_a_ms=round(a, 2),
        gross_gwh=round(cascade.gross_aep_gwh, 1),
        net_gwh=round(cascade.net_aep_gwh, 1),
        p50_gwh=round(cascade.p50_gwh, 1),
        p90_gwh=round(cascade.p90_gwh, 1),
        capacity_factor_pct=round(cascade.capacity_factor * 100, 1),
        wake_loss_pct=round(wake * 100, 2),
        blockage_loss_pct=round(blockage, 2),
        electrical_loss_pct=float(grid["annual_electrical_loss_pct"]),
        availability_loss_pct=round(100.0 - farm.availability_pct, 2),
        total_loss_pct=round(cascade.total_loss_percent, 1),
    )
    lcoe = LCOEResult(
        farm_id=farm.id,
        farm_name=farm.name,
        **compute_lcoe(farm, cascade.net_aep_gwh, electricity_price),
    )
    return (
        aep,
        lcoe,
        GridResult(farm_id=farm.id, farm_name=farm.name, installed_mw=farm.installed_mw, **grid),
    )


def run_comparison(
    farms: list[FarmConfigResponse],
    electricity_price: float = 70.0,
) -> FarmComparisonResponse:
    """Side-by-side AEP / LCOE / grid comparison of 2–4 farms."""
    if len(farms) < 2:
        raise ValueError("At least 2 farm configurations required for comparison")

    rows = [evaluate_farm(f, electricity_price) for f in farms]
    aep_results = [r[0] for r in rows]
    lcoe_results = [r[1] for r in rows]

    best_aep = max(aep_results, key=lambda r: r.net_gwh)
    best_lcoe = min(lcoe_results, key=lambda r: r.lcoe_eur_per_mwh)
    best_cf = max(aep_results, key=lambda r: r.capacity_factor_pct)

    comparison = FarmComparisonResponse(
        comparison_id=uuid.uuid4(),
        farms=farms,
        aep=aep_results,
        lcoe=lcoe_results,
        grid=[r[2] for r in rows],
        best_aep_farm=best_aep.farm_name,
        best_lcoe_farm=best_lcoe.farm_name,
        best_cf_farm=best_cf.farm_name,
        electricity_price_eur_mwh=electricity_price,
        summary=(
            f"Compared {len(farms)} farm configurations. "
            f"Highest net AEP: {best_aep.farm_name} ({best_aep.net_gwh:.0f} GWh/yr). "
            f"Lowest LCOE: {best_lcoe.farm_name} ({best_lcoe.lcoe_eur_per_mwh:.1f} €/MWh). "
            f"Highest capacity factor: {best_cf.farm_name} ({best_cf.capacity_factor_pct:.1f} %)."
        ),
        created_at=datetime.now(UTC),
    )
    _comparison_cache[comparison.comparison_id] = comparison
    return comparison


def get_comparison(comparison_id: uuid.UUID) -> FarmComparisonResponse | None:
    return _comparison_cache.get(comparison_id)
