"""
Gross-to-Net AEP cascade with uncertainty analysis and exceedance values.

Physics
-------
A wind farm's Annual Energy Production (AEP) is reduced from gross to net
by a series of loss factors. These losses are sequential and multiplicative
— each factor acts on what remains after the previous loss:

    Net AEP = Gross × (1 - wake) × (1 - blockage) × (1 - electrical)
                    × (1 - availability) × (1 - environmental)

This is called the "loss cascade" or "waterfall". Using multiplicative
(not additive) losses is critical because each loss acts on the already-
reduced energy, not on the original gross value.

Standard
--------
- IEC 61400-15 (draft): Assessment of wind resource, energy yield, and
  site suitability for wind power plants
- DNV-RP-0003: Energy assessment of offshore wind farms
- Recommended practice: Industry-standard P50/P75/P90 exceedance framework

Maths
-----
**RSS Uncertainty:**
    sigma_total = sqrt(sum(sigma_i^2))

Components (``uncertainty_components``), each a standard deviation of the AEP [%]:
    Wind resource   NEWA mesoscale model, no on-site measurement: mean-speed spread
                    0.54 m/s (Dörenkämper et al. 2020) × S / v̄
    Long-term       ERA5 interannual variability 4.20 % (30 years) / √30 × S
    Future          same IAV / √(lifetime years) × S
    Wake, blockage  25 % of the modelled loss (Walker et al. 2016)
    Turbine         4.0 % — median of the turbine-performance values in Lee & Fields
                    (2021) Table B6 (reference power curve, no warranted curve)
    Non-wake        2.7 % — median of the non-wake plant-performance values, ibid.
with S = d ln AEP / d ln v, the AEP sensitivity to the wind speed, computed from
the power curve and the Weibull wind (Lee & Fields 2021 quote ≈ 1.5–3 for land
sites; SB-510's 9.6 m/s mean is close to the 10.66 m/s rated speed, so S ≈ 0.98).
SB-510: 7.7 % in total, P90 = 0.90 × P50 (Lee & Fields: totals typically 6–11 %).
``DEFAULT_UNCERTAINTY_SOURCES`` (6.89 %) is the old fixed set, kept only for
explicit overrides.

**Exceedance (P-values):**
    P_xx = P50 × (1 - z_xx × sigma/100)

    z_75 = 0.674 (75th percentile)
    z_90 = 1.282 (90th percentile)
    z_99 = 2.326 (99th percentile)

P50 = median estimate (50% chance of exceedance)
P90 = conservative estimate (90% chance of exceedance) — used for financing

**Revenue:**
    Revenue_M€ = AEP_GWh × 1000 × price_€/MWh / 1e6
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

# ── Z-scores for exceedance percentiles ───────────────────────────
Z_75: float = 0.674
Z_90: float = 1.282
Z_99: float = 2.326

# ── Default electricity price ─────────────────────────────────────
DEFAULT_PRICE_EUR_MWH: float = 72.0

# ── Default loss factors ──────────────────────────────────────────
DEFAULT_ELECTRICAL_LOSS: float = 0.02  # 2.0%
DEFAULT_AVAILABILITY_LOSS: float = 0.05  # 5.0%
DEFAULT_ENVIRONMENTAL_LOSS: float = 0.01  # 1.0%
DEFAULT_CURTAILMENT_LOSS: float = 0.0  # not assessed without a price / redispatch series

#: Horizons of the exceedance values [years]: 1 and 10 years (debt sizing), and the lifetime.
P_HORIZONS_YEARS: tuple[int, ...] = (1, 10)

# Provenance of each cascade step: (quality, source). Quality is one of
# official | measured | literature | approximation | illustrative (frontend SourceBadge).
ORCA = "Beiter et al. 2016, NREL/TP-6A20-66579"
LOSS_SOURCES: dict[str, tuple[str, str]] = {
    "wake": ("literature", "PyWake Gaussian wake (Niayifar & Porté-Agel 2016) on this layout"),
    "blockage": (
        "approximation",
        "Engineering scaling (array density × Ct, calibrated to the 1–4 % band of "
        "Bleeg et al. 2018) — not a published model",
    ),
    "electrical": (
        "approximation",
        "Typical annual value, used when no electrical design matches the layout; the P2 "
        "load flow of SB-510 loses 17 MW (3.4 %, incl. 1 MW auxiliary) at 510 MW and "
        "≈ 3.9 % of the year's energy (p2.annual_losses)",
    ),
    "curtailment": (
        "illustrative",
        "Not assessed: needs an hourly day-ahead price and PSE redispatch series (the farm "
        "offers nothing at negative prices, see the Market tab); enter your own value",
    ),
    "availability": (
        "approximation",
        f"Typical planning value (95 % availability); {ORCA} model it against distance to port",
    ),
    "environmental": (
        "approximation",
        f"{ORCA} assume 2 % for temperature shutdown, icing, hysteresis and lightning; "
        "this default keeps 1 %",
    ),
}

# ── Uncertainty components (sources in the module docstring) ─────────
NEWA_SPREAD_MS = 0.54  # NEWA WRF mean-speed spread, low-RIX masts (Dörenkämper et al. 2020)
NEWA_YEARS = 30  # NEWA mesoscale atlas period 1989–2018
ERA5_IAV_PCT = 4.20  # scripts/fetch_wind_climate.py --iav: ERA5 100 m, 1995–2024, SB-510
LIFETIME_YEARS = 25
WAKE_REL_UNCERTAINTY = 0.25  # Walker et al. 2016, Wind Energy 19:979
TURBINE_PERF_PCT = 4.0  # Lee & Fields 2021, Table B6 median (11 values)
NONWAKE_PCT = 2.7  # Lee & Fields 2021, Table B6 median (5 values)
LEE_FIELDS = "Lee & Fields 2021, Wind Energ. Sci. 6, 311, Table B6"


@dataclass(frozen=True)
class UncertaintyComponent:
    name: str
    sigma_percent: float
    quality: str  # SourceBadge quality
    source: str


def aep_sensitivity(weibull_a: float, weibull_k: float, turbine_model: str | None = None) -> float:
    """d ln AEP / d ln v: AEP change per relative change of the wind speed (Weibull scale)."""
    from app.services.p1.turbine_models import get_turbine

    t = get_turbine(turbine_model)
    v = np.arange(0.0, 35.0, 0.05)
    p = t.power_curve_kw(v)

    def aep(a: float) -> float:
        f = (weibull_k / a) * (v / a) ** (weibull_k - 1) * np.exp(-((v / a) ** weibull_k))
        return float(np.trapezoid(p * f, v))

    return math.log(aep(weibull_a * 1.01) / aep(weibull_a)) / math.log(1.01)


def uncertainty_components(
    weibull_a: float,
    weibull_k: float,
    wake_loss_percent: float,
    blockage_loss_percent: float = 0.0,
    turbine_model: str | None = None,
    lifetime_years: int = LIFETIME_YEARS,
) -> list[UncertaintyComponent]:
    """The AEP uncertainty of this farm, component by component (module docstring)."""
    s = aep_sensitivity(weibull_a, weibull_k, turbine_model)
    mean = weibull_a * math.gamma(1 + 1 / weibull_k)
    return [
        UncertaintyComponent(
            "Wind resource (NEWA model, no measurement)",
            s * 100 * NEWA_SPREAD_MS / mean,
            "literature",
            f"NEWA mean-speed spread {NEWA_SPREAD_MS} m/s (Dörenkämper et al. 2020) on "
            f"{mean:.2f} m/s, × AEP sensitivity {s:.2f}",
        ),
        UncertaintyComponent(
            "Long-term period (30-year atlas)",
            s * ERA5_IAV_PCT / math.sqrt(NEWA_YEARS),
            "measured",
            f"ERA5 interannual variability {ERA5_IAV_PCT} % / √{NEWA_YEARS}, × {s:.2f}",
        ),
        UncertaintyComponent(
            f"Future variability ({lifetime_years} years)",
            s * ERA5_IAV_PCT / math.sqrt(lifetime_years),
            "measured",
            f"ERA5 interannual variability {ERA5_IAV_PCT} % / √{lifetime_years}, × {s:.2f}",
        ),
        UncertaintyComponent(
            "Wake and blockage model",
            WAKE_REL_UNCERTAINTY * (wake_loss_percent + blockage_loss_percent),
            "literature",
            "25 % of the modelled loss (Walker et al. 2016, Wind Energy 19:979)",
        ),
        UncertaintyComponent(
            "Turbine performance (reference power curve)",
            TURBINE_PERF_PCT,
            "literature",
            f"{LEE_FIELDS}, median of the turbine-performance values",
        ),
        UncertaintyComponent(
            "Plant non-wake losses",
            NONWAKE_PCT,
            "literature",
            f"{LEE_FIELDS}, median of the non-wake plant-performance values",
        ),
    ]


#: The old fixed set (6.89 %); only used when a caller passes it explicitly.
DEFAULT_UNCERTAINTY_SOURCES: dict[str, float] = {
    "wind_resource": 4.0,
    "wake_model": 3.0,
    "long_term_correction": 3.0,
    "wind_shear": 2.0,
    "power_curve": 1.5,
    "electrical": 1.0,
    "availability": 2.0,
    "environmental": 1.5,
}


@dataclass(frozen=True)
class LossFactor:
    """A single loss factor in the AEP cascade.

    Attributes
    ----------
    name : str
        Loss factor name (e.g., "wake", "blockage", "electrical").
    loss_percent : float
        Loss as percentage [%].
    uncertainty_percent : float
        Standard deviation of this loss [%]. 0 if not applicable.
    quality, source : str
        Provenance of the default (``LOSS_SOURCES``).
    """

    name: str
    loss_percent: float
    uncertainty_percent: float = 0.0
    quality: str = "illustrative"
    source: str = ""


@dataclass(frozen=True)
class ExceedanceHorizon:
    """P-values for an averaging period: P90 over 1 year (debt sizing, the full
    interannual variability), 10 years, or the lifetime."""

    years: int
    sigma_percent: float
    p75_gwh: float
    p90_gwh: float
    p99_gwh: float


@dataclass(frozen=True)
class AEPCascadeResult:
    """Complete gross-to-net AEP cascade result with uncertainty.

    Attributes
    ----------
    gross_aep_gwh : float
        Gross AEP before any losses [GWh/year].
    net_aep_gwh : float
        Net AEP after all losses (P50 estimate) [GWh/year].
    p50_gwh : float
        P50 exceedance value = net AEP [GWh/year].
    p75_gwh : float
        P75 exceedance value [GWh/year].
    p90_gwh : float
        P90 exceedance value [GWh/year].
    p99_gwh : float
        P99 exceedance value [GWh/year].
    total_loss_percent : float
        Total loss from gross to net [%].
    combined_uncertainty_percent : float
        RSS combined uncertainty [%].
    capacity_factor : float
        Net capacity factor [-].
    revenue_meur : float
        Annual revenue at P50 [M euros].
    loss_factors : list[LossFactor]
        Ordered list of applied loss factors.
    price_eur_mwh : float
        Electricity price used for revenue [euros/MWh].
    """

    gross_aep_gwh: float
    net_aep_gwh: float
    p50_gwh: float
    p75_gwh: float
    p90_gwh: float
    p99_gwh: float
    total_loss_percent: float
    combined_uncertainty_percent: float
    capacity_factor: float
    revenue_meur: float
    loss_factors: list[LossFactor] = field(default_factory=list)
    price_eur_mwh: float = DEFAULT_PRICE_EUR_MWH
    uncertainty: list[UncertaintyComponent] = field(default_factory=list)
    exceedance_by_horizon: list[ExceedanceHorizon] = field(default_factory=list)


@dataclass(frozen=True)
class LayoutComparisonResult:
    """Comparison of multiple layout AEP cascade results.

    Attributes
    ----------
    results : list[tuple[str, AEPCascadeResult]]
        List of (layout_name, cascade_result) pairs.
    best_layout : str
        Name of the layout with highest net AEP.
    improvement_percent : float
        Net AEP improvement of best layout over worst [%].
    """

    results: list[tuple[str, AEPCascadeResult]] = field(default_factory=list)
    best_layout: str = ""
    improvement_percent: float = 0.0


def compute_rss_uncertainty(
    sources: dict[str, float] | None = None,
) -> float:
    """Compute combined RSS (root-sum-of-squares) uncertainty.

    Parameters
    ----------
    sources : dict[str, float], optional
        Uncertainty sources as {name: sigma_%}. Uses defaults if None.

    Returns
    -------
    float
        Combined uncertainty [%].
    """
    if sources is None:
        sources = DEFAULT_UNCERTAINTY_SOURCES
    return math.sqrt(sum(s**2 for s in sources.values()))


def compute_exceedance_values(
    p50_gwh: float,
    uncertainty_percent: float,
) -> dict[str, float]:
    """Compute P50, P75, P90, P99 exceedance values.

    P_xx = P50 × (1 - z_xx × sigma/100)

    Higher P-values are more conservative (lower energy, higher confidence).

    Parameters
    ----------
    p50_gwh : float
        P50 (median) AEP estimate [GWh].
    uncertainty_percent : float
        Combined uncertainty [%].

    Returns
    -------
    dict[str, float]
        Exceedance values: {"P50": ..., "P75": ..., "P90": ..., "P99": ...}
    """
    sigma_frac = uncertainty_percent / 100.0
    return {
        "P50": p50_gwh,
        "P75": p50_gwh * (1.0 - Z_75 * sigma_frac),
        "P90": p50_gwh * (1.0 - Z_90 * sigma_frac),
        "P99": p50_gwh * (1.0 - Z_99 * sigma_frac),
    }


def apply_loss_cascade(
    gross_aep_gwh: float,
    wake_loss_fraction: float,
    blockage_loss_fraction: float,
    electrical_loss_fraction: float = DEFAULT_ELECTRICAL_LOSS,
    availability_loss_fraction: float = DEFAULT_AVAILABILITY_LOSS,
    environmental_loss_fraction: float = DEFAULT_ENVIRONMENTAL_LOSS,
    curtailment_loss_fraction: float = DEFAULT_CURTAILMENT_LOSS,
    provenance: dict[str, tuple[str, str]] | None = None,
) -> tuple[float, list[LossFactor]]:
    """Apply sequential multiplicative loss cascade to gross AEP.

    IMPORTANT: Losses are multiplicative, not additive.
    Net = Gross × (1-wake) × (1-blockage) × (1-elec) × (1-avail) × (1-env)

    Parameters
    ----------
    gross_aep_gwh : float
        Gross AEP [GWh].
    wake_loss_fraction : float
        Wake loss fraction (e.g., 0.087 for 8.7%).
    blockage_loss_fraction : float
        Blockage loss fraction (e.g., 0.02 for 2.0%).
    electrical_loss_fraction : float
        Electrical loss fraction. Default: 0.02 (2.0%).
    availability_loss_fraction : float
        Availability loss fraction. Default: 0.05 (5.0%).
    environmental_loss_fraction : float
        Environmental loss fraction. Default: 0.01 (1.0%).
    curtailment_loss_fraction : float
        Market / grid curtailment fraction. Default: 0 (not assessed).
    provenance : dict | None
        (quality, source) per step that replaces ``LOSS_SOURCES`` — e.g. the electrical
        loss computed from the P2 load flow, the availability from failure rates.

    Returns
    -------
    tuple[float, list[LossFactor]]
        (net_aep_gwh, list of LossFactor entries)
    """

    given = provenance or {}

    def step(name: str, fraction: float, sigma: float, default: float | None = None) -> LossFactor:
        quality, source = LOSS_SOURCES[name]
        if name in given:
            quality, source = given[name]
        elif default is not None and not np.isclose(fraction, default):
            quality, source = "illustrative", "Your input"
        return LossFactor(name, fraction * 100.0, sigma, quality, source)

    losses = [
        step("wake", wake_loss_fraction, 3.0),
        step("blockage", blockage_loss_fraction, 0.0),
        step("electrical", electrical_loss_fraction, 1.0, DEFAULT_ELECTRICAL_LOSS),
        step("availability", availability_loss_fraction, 2.0, DEFAULT_AVAILABILITY_LOSS),
        step("environmental", environmental_loss_fraction, 1.5, DEFAULT_ENVIRONMENTAL_LOSS),
        step("curtailment", curtailment_loss_fraction, 0.0, DEFAULT_CURTAILMENT_LOSS),
    ]

    net = gross_aep_gwh
    for lf in losses:
        net *= 1.0 - lf.loss_percent / 100.0

    return net, losses


def compute_aep_cascade(
    gross_aep_gwh: float,
    wake_loss_fraction: float,
    blockage_loss_fraction: float,
    electrical_loss_fraction: float = DEFAULT_ELECTRICAL_LOSS,
    availability_loss_fraction: float = DEFAULT_AVAILABILITY_LOSS,
    environmental_loss_fraction: float = DEFAULT_ENVIRONMENTAL_LOSS,
    num_turbines: int = 34,
    rated_power_kw: float = 15_000.0,
    price_eur_mwh: float = DEFAULT_PRICE_EUR_MWH,
    uncertainty_sources: dict[str, float] | None = None,
    weibull_a: float | None = None,
    weibull_k: float | None = None,
    turbine_model: str | None = None,
    curtailment_loss_fraction: float = DEFAULT_CURTAILMENT_LOSS,
    provenance: dict[str, tuple[str, str]] | None = None,
    lifetime_years: int = LIFETIME_YEARS,
) -> AEPCascadeResult:
    """Compute full gross-to-net AEP cascade with uncertainty and revenue.

    Parameters
    ----------
    gross_aep_gwh : float
        Gross AEP [GWh/year].
    wake_loss_fraction : float
        Wake loss as fraction (e.g., 0.087 for 8.7%).
    blockage_loss_fraction : float
        Blockage loss as fraction (e.g., 0.02 for 2.0%).
    electrical_loss_fraction : float
        Electrical loss fraction. Default: 0.02.
    availability_loss_fraction : float
        Availability loss fraction. Default: 0.05.
    environmental_loss_fraction : float
        Environmental loss fraction. Default: 0.01.
    num_turbines : int
        Number of turbines. Default: 34.
    rated_power_kw : float
        Rated power per turbine [kW]. Default: 15,000.
    price_eur_mwh : float
        Electricity price [EUR/MWh]. Default: 72.0.
    uncertainty_sources : dict[str, float], optional
        Fixed uncertainty sources {name: σ %}; None = ``uncertainty_components``.
    weibull_a, weibull_k, turbine_model : optional
        Wind and turbine of the farm for the components (default: SB-510).
    curtailment_loss_fraction : float
        Market / grid curtailment fraction. Default: 0 (not assessed).
    provenance : dict | None
        (quality, source) per loss step for computed values (``apply_loss_cascade``).
    lifetime_years : int
        Horizon of the main P-values; ``exceedance_by_horizon`` adds 1 and 10 years.

    Returns
    -------
    AEPCascadeResult
        Complete cascade result with P-values, CF, and revenue.
    """
    # Apply loss cascade
    net_aep, loss_factors = apply_loss_cascade(
        gross_aep_gwh,
        wake_loss_fraction,
        blockage_loss_fraction,
        electrical_loss_fraction,
        availability_loss_fraction,
        environmental_loss_fraction,
        curtailment_loss_fraction,
        provenance,
    )

    # Total loss
    total_loss_pct = (1.0 - net_aep / gross_aep_gwh) * 100.0 if gross_aep_gwh > 0 else 0.0

    # Uncertainty: the farm's components, unless fixed sources are given
    components: list[UncertaintyComponent] = []
    horizons: list[ExceedanceHorizon] = []
    if uncertainty_sources is None:
        from app.services.site_assessment.wind_climate import SB510_WEIBULL_A, SB510_WEIBULL_K

        def comps(years: int) -> list[UncertaintyComponent]:
            return uncertainty_components(
                weibull_a if weibull_a is not None else SB510_WEIBULL_A,
                weibull_k if weibull_k is not None else SB510_WEIBULL_K,
                100.0 * wake_loss_fraction,
                100.0 * blockage_loss_fraction,
                turbine_model,
                years,
            )

        components = comps(lifetime_years)
        uncertainty_sources = {c.name: c.sigma_percent for c in components}
        # The future-variability component shrinks with the averaging period: a single
        # year carries the full interannual variability, the lifetime only IAV/√N.
        for years in (*P_HORIZONS_YEARS, lifetime_years):
            sigma = compute_rss_uncertainty({c.name: c.sigma_percent for c in comps(years)})
            pv = compute_exceedance_values(net_aep, sigma)
            horizons.append(ExceedanceHorizon(years, sigma, pv["P75"], pv["P90"], pv["P99"]))
    combined_unc = compute_rss_uncertainty(uncertainty_sources)

    # Exceedance values (P50 = net AEP)
    p_values = compute_exceedance_values(net_aep, combined_unc)

    # Capacity factor: CF = net_AEP / (P_rated × 8760 × n_turbines)
    theoretical_gwh = rated_power_kw * 1e-6 * 8760.0 * num_turbines
    cf = net_aep / theoretical_gwh if theoretical_gwh > 0 else 0.0

    # Revenue: AEP_GWh × 1000 MWh/GWh × price_EUR/MWh / 1e6 = M€
    revenue = net_aep * 1000.0 * price_eur_mwh / 1e6

    return AEPCascadeResult(
        gross_aep_gwh=gross_aep_gwh,
        net_aep_gwh=net_aep,
        p50_gwh=p_values["P50"],
        p75_gwh=p_values["P75"],
        p90_gwh=p_values["P90"],
        p99_gwh=p_values["P99"],
        total_loss_percent=total_loss_pct,
        combined_uncertainty_percent=combined_unc,
        capacity_factor=cf,
        revenue_meur=revenue,
        loss_factors=loss_factors,
        price_eur_mwh=price_eur_mwh,
        uncertainty=components,
        exceedance_by_horizon=horizons,
    )


def compare_layouts(
    layouts: list[tuple[str, float, float, float]],
    num_turbines: int = 34,
    rated_power_kw: float = 15_000.0,
    price_eur_mwh: float = DEFAULT_PRICE_EUR_MWH,
) -> LayoutComparisonResult:
    """Compare multiple layouts by running AEP cascade for each.

    Parameters
    ----------
    layouts : list[tuple[str, float, float, float]]
        List of (name, gross_aep_gwh, wake_loss_fraction, blockage_loss_fraction).
    num_turbines : int
        Number of turbines. Default: 34.
    rated_power_kw : float
        Rated power per turbine [kW]. Default: 15,000.
    price_eur_mwh : float
        Electricity price [EUR/MWh]. Default: 72.0.

    Returns
    -------
    LayoutComparisonResult
        Comparison with best layout identified.
    """
    results: list[tuple[str, AEPCascadeResult]] = []

    for name, gross_aep, wake_loss, blockage_loss in layouts:
        cascade = compute_aep_cascade(
            gross_aep_gwh=gross_aep,
            wake_loss_fraction=wake_loss,
            blockage_loss_fraction=blockage_loss,
            num_turbines=num_turbines,
            rated_power_kw=rated_power_kw,
            price_eur_mwh=price_eur_mwh,
        )
        results.append((name, cascade))

    # Find best and worst by net AEP
    if not results:
        return LayoutComparisonResult()

    best_name, best_cascade = max(results, key=lambda r: r[1].net_aep_gwh)
    worst_cascade = min(results, key=lambda r: r[1].net_aep_gwh)[1]

    improvement = (
        (best_cascade.net_aep_gwh - worst_cascade.net_aep_gwh) / worst_cascade.net_aep_gwh * 100.0
        if worst_cascade.net_aep_gwh > 0
        else 0.0
    )

    return LayoutComparisonResult(
        results=results,
        best_layout=best_name,
        improvement_percent=improvement,
    )
