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

Sources and their standard deviations:
    Wind resource: 4.0%    Wake model: 3.0%     Long-term corr: 3.0%
    Wind shear: 2.0%       Power curve: 1.5%    Electrical: 1.0%
    Availability: 2.0%     Environmental: 1.5%

    sigma_total = sqrt(16 + 9 + 9 + 4 + 2.25 + 1 + 4 + 2.25) = 6.2%

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

# ── Z-scores for exceedance percentiles ───────────────────────────
Z_75: float = 0.674
Z_90: float = 1.282
Z_99: float = 2.326

# ── Default electricity price ─────────────────────────────────────
DEFAULT_PRICE_EUR_MWH: float = 72.0

# ── Default loss factors (from Roadmap Section 2.7) ───────────────
DEFAULT_ELECTRICAL_LOSS: float = 0.02  # 2.0%
DEFAULT_AVAILABILITY_LOSS: float = 0.05  # 5.0%
DEFAULT_ENVIRONMENTAL_LOSS: float = 0.01  # 1.0%

# ── Default uncertainty sources (sigma in %) ──────────────────────
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
    """

    name: str
    loss_percent: float
    uncertainty_percent: float = 0.0


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

    Returns
    -------
    tuple[float, list[LossFactor]]
        (net_aep_gwh, list of LossFactor entries)
    """
    losses = [
        LossFactor("wake", wake_loss_fraction * 100.0, uncertainty_percent=3.0),
        LossFactor("blockage", blockage_loss_fraction * 100.0),
        LossFactor("electrical", electrical_loss_fraction * 100.0, uncertainty_percent=1.0),
        LossFactor("availability", availability_loss_fraction * 100.0, uncertainty_percent=2.0),
        LossFactor("environmental", environmental_loss_fraction * 100.0, uncertainty_percent=1.5),
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
        Uncertainty sources. Uses defaults if None.

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
    )

    # Total loss
    total_loss_pct = (1.0 - net_aep / gross_aep_gwh) * 100.0 if gross_aep_gwh > 0 else 0.0

    # Uncertainty
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
