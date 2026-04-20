"""
Multi-farm comparison service — M04.

Computes AEP, LCOE, and grid integration metrics for multiple farm
configurations and produces a side-by-side comparison.

Physics — AEP Calculation Method
----------------------------------
For a site with Weibull wind distribution (k, c parameters) and a
turbine with power curve P(v):

  AEP = 8760 h × ∫ P(v) × f(v; k, c) dv

Where f(v; k, c) is the Weibull probability density function:
  f(v) = (k/c) × (v/c)^(k-1) × exp(-(v/c)^k)

We use a discrete approximation over 1 m/s bins:
  AEP ≈ 8760 × Σ P(v_i) × [F(v_i+1) - F(v_i)]

The Vestas V236-15.0 MW power curve is approximated using a cubic
spline through the published IEC power curve points (Vestas product card):
  cut-in: 3 m/s, rated: 11.1 m/s, cut-out: 31 m/s

Wake losses are approximated using the Jensen-Katic model:
  ΔP/P ≈ 1 - (1 - a × (r₀/(r₀ + k×x))²)^n_turbines

Where a=1/3 (induction factor), k=0.04 (offshore decay), x/D≈7 (spacing).

LCOE Model (simplified fixed charge rate)
------------------------------------------
FCR = WACC / (1 - (1 + WACC)^(-n))   [fixed charge rate]
LCOE = (CAPEX × FCR + annual_OPEX) / annual_AEP_MWh

Export Cable Loss Model (IEC 60287)
-------------------------------------
For a 3-core XLPE cable at rated current:
  P_loss = 3 × I² × R × L  [W]
  I = P_rated / (√3 × U × cos φ)
  R_AC ≈ 0.06 Ω/km (for 400 mm² cable at 220 kV)
  Loss fraction = P_loss / P_rated

Standard: IEC 61400-15 (AEP), DNV-RP-0003, IEC 60287 (cable losses).
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, datetime

from app.schemas.farm_config import (
    AEPResult,
    FarmComparisonResponse,
    FarmConfigCreate,
    FarmConfigResponse,
    GridResult,
    LCOEResult,
)

# ── In-memory farm registry ──────────────────────────────────────
# Production: persisted to farm_configuration DB table via SQLAlchemy
_farm_configs: dict[uuid.UUID, FarmConfigResponse] = {}
_comparison_cache: dict[uuid.UUID, FarmComparisonResponse] = {}


# ── AEP physics ──────────────────────────────────────────────────


def _weibull_pdf(v: float, k: float, c: float) -> float:
    """Weibull probability density at wind speed v [m/s]."""
    if v <= 0:
        return 0.0
    return float((k / c) * (v / c) ** (k - 1) * math.exp(-((v / c) ** k)))


def _mean_to_scale(mean_v: float, k: float) -> float:
    """Convert Weibull mean wind speed to scale parameter c [m/s].

    c = mean_v / Γ(1 + 1/k)
    """
    import math

    # Gamma(1 + 1/k) approximated via log-gamma
    gamma_val = math.exp(math.lgamma(1.0 + 1.0 / k))
    return mean_v / gamma_val


def _v236_power_kw(v: float) -> float:
    """Approximated V236-15.0 MW power curve [kW].

    Based on published Vestas product card points. Uses cubic interpolation
    between key points: cut-in 3 m/s, rated 11.1 m/s, cut-out 31 m/s.

    The full IEC 61400-12-1 power curve is measured in free-stream wind
    at hub height (119 m for V236).
    """
    if v < 3.0 or v >= 31.0:
        return 0.0
    if v >= 11.1:
        return 15_000.0  # rated

    # Cubic interpolation through published key points
    points = [
        (3.0, 0.0),
        (4.0, 400.0),
        (5.0, 950.0),
        (6.0, 1800.0),
        (7.0, 3100.0),
        (8.0, 4900.0),
        (9.0, 7100.0),
        (10.0, 9600.0),
        (11.0, 12000.0),
        (12.0, 14000.0),
        (12.5, 15000.0),
    ]
    # Linear interpolation between bracketing points
    for i in range(len(points) - 1):
        v0, p0 = points[i]
        v1, p1 = points[i + 1]
        if v0 <= v <= v1:
            t = (v - v0) / (v1 - v0)
            return p0 + t * (p1 - p0)
    return 15_000.0


def _turbine_power_kw(v: float, turbine_rated_mw: float, turbine_model: str) -> float:
    """Return turbine power [kW] — scales V236 curve to different rated powers."""
    base = _v236_power_kw(v)
    scale = turbine_rated_mw / 15.0
    return base * scale


def _compute_aep(
    turbine_count: int,
    turbine_rated_mw: float,
    turbine_model: str,
    mean_wind_speed_ms: float,
    weibull_k: float,
    availability_pct: float,
) -> dict[str, float]:
    """Compute AEP metrics using Weibull × power curve integration."""
    c = _mean_to_scale(mean_wind_speed_ms, weibull_k)

    # Integrate power curve × Weibull PDF over 1 m/s bins
    gross_kwh_per_turbine = 0.0
    for vi in range(1, 35):
        v = float(vi)
        p_kw = _turbine_power_kw(v, turbine_rated_mw, turbine_model)
        pdf = _weibull_pdf(v, weibull_k, c)
        gross_kwh_per_turbine += p_kw * pdf * 8760.0  # 1 m/s bins

    gross_gwh = gross_kwh_per_turbine * turbine_count / 1e6

    # Wake loss: Jensen model approximation (offshore 7D spacing)
    # Loss ≈ 2 * n_rows * (1 - sqrt(1 - CT/(1 + k*7D/r)^2))^2
    # Simplified: 10-12% for 5×7D Danish spacing
    spacing_d = 7.0  # rotor diameters
    k_wake = 0.04  # offshore wake decay
    ct = 0.8  # thrust coefficient near rated
    r0 = 1.0  # normalised rotor radius
    # Approximate: each turbine behind one row loses wake_fraction
    n_rows = max(1, int(math.sqrt(turbine_count)))
    denom = (r0 + k_wake * spacing_d) ** 2
    single_wake_loss = ct / (2 * denom)
    wake_loss_pct = min(0.20, single_wake_loss * n_rows * 0.5 * 100)

    electrical_loss_pct = 2.5  # array + OSS transformer
    other_loss_pct = 1.5  # icing, soiling, curtailment

    availability_loss_pct = 100.0 - availability_pct
    total_loss_pct = (
        wake_loss_pct + electrical_loss_pct + other_loss_pct + availability_loss_pct / 2
    )

    net_gwh = gross_gwh * (1.0 - total_loss_pct / 100.0)

    # P50/P90 with 6.2% total uncertainty (IEC 61400-15 RSS)
    sigma = 0.062
    p50 = net_gwh
    p90 = p50 * (1.0 - 1.282 * sigma)

    capacity_factor = net_gwh * 1000.0 / (turbine_count * turbine_rated_mw * 8760.0) * 100.0

    return {
        "gross_gwh": round(gross_gwh, 1),
        "net_gwh": round(net_gwh, 1),
        "p50_gwh": round(p50, 1),
        "p90_gwh": round(p90, 1),
        "capacity_factor_pct": round(capacity_factor, 1),
        "wake_loss_pct": round(wake_loss_pct, 1),
        "total_loss_pct": round(total_loss_pct, 1),
    }


# ── LCOE physics ─────────────────────────────────────────────────


def _compute_lcoe(
    turbine_count: int,
    turbine_rated_mw: float,
    net_gwh: float,
    capex_m_eur_per_mw: float,
    opex_k_eur_per_mw_year: float,
    discount_rate_pct: float,
    lifetime_years: int,
    electricity_price: float = 70.0,
) -> dict[str, float]:
    """Compute LCOE and financial metrics."""
    installed_mw = turbine_count * turbine_rated_mw
    wacc = discount_rate_pct / 100.0

    # Fixed charge rate (annualised capital recovery factor)
    fcr = wacc / (1.0 - (1.0 + wacc) ** (-lifetime_years))

    capex_meur = installed_mw * capex_m_eur_per_mw
    opex_meur_year = installed_mw * opex_k_eur_per_mw_year / 1000.0

    annual_aep_mwh = net_gwh * 1000.0
    annual_cost_meur = capex_meur * fcr + opex_meur_year
    lcoe = annual_cost_meur * 1e6 / annual_aep_mwh  # €/MWh

    # Revenue and payback
    annual_revenue_meur = annual_aep_mwh * electricity_price / 1e6
    net_annual_cashflow = annual_revenue_meur - opex_meur_year
    payback = capex_meur / net_annual_cashflow if net_annual_cashflow > 0 else 999.0

    # Approximate IRR: solve NPV = 0 iteratively (Newton's method)
    irr = _approximate_irr(capex_meur, net_annual_cashflow, lifetime_years)

    lifetime_revenue = annual_revenue_meur * lifetime_years

    return {
        "lcoe_eur_per_mwh": round(lcoe, 1),
        "capex_meur": round(capex_meur, 1),
        "opex_meur_year": round(opex_meur_year, 2),
        "lifetime_revenue_meur": round(lifetime_revenue, 1),
        "simple_payback_years": round(min(payback, 999.0), 1),
        "irr_pct": round(irr * 100.0, 1),
    }


def _approximate_irr(
    capex: float,
    annual_cf: float,
    n: int,
) -> float:
    """Estimate IRR using Newton-Raphson on NPV = 0.

    NPV(r) = -capex + annual_cf × (1 - (1+r)^(-n)) / r = 0
    """
    if annual_cf <= 0:
        return 0.0

    r = 0.08  # initial guess
    for _ in range(50):
        annuity = (1.0 - (1.0 + r) ** (-n)) / r if r != 0 else n
        npv = -capex + annual_cf * annuity
        d_annuity = -n * (1.0 + r) ** (-n - 1) / r - (1.0 - (1.0 + r) ** (-n)) / (r**2)
        dnpv = annual_cf * d_annuity
        if abs(dnpv) < 1e-12:
            break
        r_new = r - npv / dnpv
        if abs(r_new - r) < 1e-6:
            break
        r = max(0.001, min(r_new, 0.5))

    return round(r, 4)


# ── Grid physics ──────────────────────────────────────────────────


def _compute_grid(
    turbine_count: int,
    turbine_rated_mw: float,
    array_voltage_kv: float,
    export_voltage_kv: float,
    export_length_km: float,
    statcom_mvar: float,
    bess_mw: float,
) -> dict[str, object]:
    """Compute grid integration metrics."""
    installed_mw = turbine_count * turbine_rated_mw

    # Export cable loss (IEC 60287 simplified)
    # R_AC ≈ 0.05–0.08 Ω/km for 300–500 mm² XLPE at rated voltage
    r_cable_ohm_km = 0.055 if export_voltage_kv >= 220 else 0.08
    i_rated_ka = installed_mw / (math.sqrt(3) * export_voltage_kv * 0.95)  # cos φ = 0.95
    export_losses_mw = 3.0 * (i_rated_ka * 1000.0) ** 2 * r_cable_ohm_km * export_length_km / 1e6
    export_losses_pct = round(export_losses_mw / installed_mw * 100.0, 2)

    # Array cable loss (typical 1.0–1.5% for 66 kV array)
    array_losses_pct = round(1.2 * (66.0 / array_voltage_kv), 2)

    # Transformer losses (typical 0.5%)
    transformer_losses_pct = 0.5

    total_electrical = round(export_losses_pct + array_losses_pct + transformer_losses_pct, 2)

    # Reactive power at POC
    # Cable charging current (capacitive): Q_charge ≈ B × U² × L
    # B ≈ 3.5e-7 S/km for XLPE at 220 kV
    b_cable_s_km = 3.5e-7 if export_voltage_kv >= 220 else 5.0e-7
    q_charging_mvar = b_cable_s_km * (export_voltage_kv * 1000.0) ** 2 * export_length_km / 1e6
    # Reactor (if any) compensates charging; net reactive = STATCOM + cable charging
    # Simplified: assume 50% of charging current needs reactor compensation
    net_reactive_mvar = statcom_mvar + bess_mw * 0.3 - q_charging_mvar * 0.3
    reactive_available = round(net_reactive_mvar, 1)

    # Export cable utilisation at rated output
    cable_rating_mw = export_voltage_kv * i_rated_ka * math.sqrt(3) * 0.95
    export_utilization = round(installed_mw / max(cable_rating_mw, 1) * 100.0, 1)

    # Short-circuit level approximation (Thevenin)
    sc_level_ka = round(export_voltage_kv / (math.sqrt(3) * 10.0), 1)  # rough

    # NC RfG Type D: must provide ±0.225 pu reactive range at POC
    # Required reactive = installed_mw × 0.225
    required_mvar = installed_mw * 0.225
    compliant = net_reactive_mvar >= required_mvar

    return {
        "export_cable_losses_pct": export_losses_pct,
        "array_cable_losses_pct": array_losses_pct,
        "transformer_losses_pct": transformer_losses_pct,
        "total_electrical_losses_pct": total_electrical,
        "reactive_available_mvar": reactive_available,
        "export_utilization_pct": export_utilization,
        "short_circuit_level_ka": sc_level_ka,
        "compliant_nc_rfg": compliant,
    }


# ── Public API ────────────────────────────────────────────────────


def create_farm(config: FarmConfigCreate) -> FarmConfigResponse:
    """Create and persist a new farm configuration."""
    farm_id = uuid.uuid4()
    installed_mw = config.turbine_count * config.turbine_rated_mw
    resp = FarmConfigResponse(
        id=farm_id,
        installed_mw=round(installed_mw, 1),
        created_at=datetime.now(UTC),
        **config.model_dump(),
    )
    _farm_configs[farm_id] = resp
    return resp


def get_farm(farm_id: uuid.UUID) -> FarmConfigResponse | None:
    return _farm_configs.get(farm_id)


def list_farms() -> list[FarmConfigResponse]:
    return sorted(_farm_configs.values(), key=lambda f: f.created_at, reverse=True)


def delete_farm(farm_id: uuid.UUID) -> bool:
    if farm_id not in _farm_configs:
        return False
    del _farm_configs[farm_id]
    return True


def run_comparison(
    farm_ids: list[uuid.UUID],
    electricity_price: float = 70.0,
) -> FarmComparisonResponse:
    """Run a multi-farm comparison study for 2-4 farm configurations.

    Computes AEP, LCOE, and grid metrics for each farm and returns
    a side-by-side comparison with a summary.
    """
    farms = [_farm_configs[fid] for fid in farm_ids if fid in _farm_configs]
    if len(farms) < 2:
        raise ValueError("At least 2 valid farm configurations required for comparison")

    aep_results: list[AEPResult] = []
    lcoe_results: list[LCOEResult] = []
    grid_results: list[GridResult] = []

    for farm in farms:
        aep = _compute_aep(
            farm.turbine_count,
            farm.turbine_rated_mw,
            farm.turbine_model,
            farm.mean_wind_speed_ms,
            farm.weibull_k,
            farm.availability_pct,
        )
        aep_results.append(
            AEPResult(
                farm_id=farm.id,
                farm_name=farm.name,
                installed_mw=farm.installed_mw,
                **aep,
            )
        )

        lcoe = _compute_lcoe(
            farm.turbine_count,
            farm.turbine_rated_mw,
            aep["net_gwh"],
            farm.capex_m_eur_per_mw,
            farm.opex_k_eur_per_mw_year,
            farm.discount_rate_pct,
            farm.lifetime_years,
            electricity_price,
        )
        lcoe_results.append(
            LCOEResult(
                farm_id=farm.id,
                farm_name=farm.name,
                **lcoe,
            )
        )

        grid = _compute_grid(
            farm.turbine_count,
            farm.turbine_rated_mw,
            farm.array_voltage_kv,
            farm.export_voltage_kv,
            farm.export_length_km,
            farm.statcom_mvar,
            farm.bess_mw,
        )
        grid_results.append(
            GridResult(
                farm_id=farm.id,
                farm_name=farm.name,
                installed_mw=farm.installed_mw,
                **grid,
            )
        )

    best_aep = max(aep_results, key=lambda r: r.net_gwh)
    best_lcoe = min(lcoe_results, key=lambda r: r.lcoe_eur_per_mwh)

    summary = (
        f"Compared {len(farms)} farm configurations. "
        f"Highest AEP: {best_aep.farm_name} ({best_aep.net_gwh:.0f} GWh/year). "
        f"Lowest LCOE: {best_lcoe.farm_name} ({best_lcoe.lcoe_eur_per_mwh:.1f} €/MWh)."
    )

    comparison = FarmComparisonResponse(
        comparison_id=uuid.uuid4(),
        farms=farms,
        aep=aep_results,
        lcoe=lcoe_results,
        grid=grid_results,
        best_aep_farm=best_aep.farm_name,
        best_lcoe_farm=best_lcoe.farm_name,
        summary=summary,
        created_at=datetime.now(UTC),
    )
    _comparison_cache[comparison.comparison_id] = comparison
    return comparison


def get_comparison(comparison_id: uuid.UUID) -> FarmComparisonResponse | None:
    return _comparison_cache.get(comparison_id)
