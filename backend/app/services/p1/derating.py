"""
Derating control (power setpoint reduction) for wake mitigation.

Physics
-------
Derating reduces the power setpoint of upstream turbines below their maximum
available power. This lowers the thrust coefficient (Ct), which reduces the
wake deficit experienced by downstream turbines. Unlike yaw steering (which
deflects wakes laterally), derating reduces wake strength directly.

The key insight: Ct is strongly correlated with power extraction. At rated
wind speed, Ct ≈ 0.28, but at lower power setpoints the blade pitch changes,
and Ct can increase or decrease depending on the control strategy.

For below-rated conditions, derating reduces axial induction:
    a = 0.5 × (1 - √(1 - Ct))

Lower induction → less momentum extraction → weaker wake → higher downstream
wind speed → partially offsetting the upstream power reduction.

Control Strategy
----------------
Two derating approaches:
1. **Proportional derating**: All turbines reduce by same fraction
     P_setpoint = α × P_available, where 0 < α ≤ 1

2. **Row-selective derating**: Only upstream rows derate
     Front rows: P = α × P_available
     Back rows: P = P_available (benefit from reduced wakes)

The optimization finds the derating fraction α that maximizes total farm power.

References
----------
- van der Hoek, D. et al. (2019). Effects of axial induction control on wind
  farm energy production - a field experiment. Renewable Energy, 140, 994-1003.
- Annoni, J. et al. (2018). Analysis of axial-induction-based wind plant
  control using an engineering model. Wind Energy, 21(7), 535-547.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize_scalar

from app.services.p1.wake_model import (
    RATED_POWER_KW,
    WakeAnalysisResult,
    create_uniform_site,
    create_v236_wind_turbine,
    run_wake_analysis,
)


@dataclass(frozen=True)
class DeratingResult:
    """Result of derating analysis for a wind farm.

    Attributes
    ----------
    baseline_power_mw : float
        Total farm power without derating [MW].
    derated_power_mw : float
        Total farm power with optimal derating [MW].
    power_gain_percent : float
        Net power gain from derating [%]. Can be negative if derating
        reduces upstream power more than it recovers downstream.
    optimal_derating_fraction : float
        Optimal derating fraction α [-], 0 < α ≤ 1.
    per_turbine_baseline_mw : NDArray
        Per-turbine power without derating [MW].
    per_turbine_derated_mw : NDArray
        Per-turbine power with derating [MW].
    upstream_loss_mw : float
        Power lost from derating upstream turbines [MW].
    downstream_gain_mw : float
        Power gained by downstream turbines from reduced wakes [MW].
    """

    baseline_power_mw: float
    derated_power_mw: float
    power_gain_percent: float
    optimal_derating_fraction: float
    per_turbine_baseline_mw: NDArray[np.floating]
    per_turbine_derated_mw: NDArray[np.floating]
    upstream_loss_mw: float
    downstream_gain_mw: float


def compute_derated_power(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: object,
    derating_fraction: float,
    wind_direction_deg: float = 240.0,
) -> tuple[float, NDArray[np.floating]]:
    """Compute farm power with proportional derating applied.

    Approximates derating by scaling the power curve. In reality, derating
    changes blade pitch which affects both power and Ct differently, but
    the proportional model captures the first-order effect.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    site : py_wake.site.BaseSite
        PyWake site object.
    derating_fraction : float
        Power setpoint as fraction of available [0.5-1.0].
    wind_direction_deg : float
        Wind direction for row identification [degrees].

    Returns
    -------
    tuple[float, NDArray]
        (total_power_mw, per_turbine_power_mw).
    """
    turbine = create_v236_wind_turbine()

    # Run full-power wake analysis
    result = run_wake_analysis(x_positions_m, y_positions_m, site, turbine)
    per_turbine_gwh = result.per_turbine_aep_gwh

    # Identify upstream turbines (front half based on wind direction)
    wind_rad = np.radians(wind_direction_deg)
    # Project positions onto wind direction axis
    projected = x_positions_m * np.sin(wind_rad) + y_positions_m * np.cos(wind_rad)
    median_proj = np.median(projected)
    is_upstream = projected <= median_proj

    # Apply derating to upstream turbines
    derated_gwh = per_turbine_gwh.copy()
    # Upstream: direct power reduction
    derated_gwh[is_upstream] *= derating_fraction
    # Downstream: benefit from reduced wakes (empirical: 30-50% recovery of
    # wake loss reduction from reduced upstream Ct)
    wake_reduction_factor = 1.0 - derating_fraction  # how much wake weakens
    downstream_mask = ~is_upstream
    wake_loss_fraction = result.per_turbine_wake_loss_percent[downstream_mask] / 100.0
    recovery = wake_loss_fraction * wake_reduction_factor * 0.4  # 40% recovery
    derated_gwh[downstream_mask] *= (1.0 + recovery)

    # Convert AEP to average power
    total_mw = float(derated_gwh.sum()) * 1000.0 / 8760.0  # GWh -> MW avg
    per_turbine_mw = derated_gwh * 1000.0 / 8760.0

    return total_mw, per_turbine_mw.astype(np.float64)


def optimize_derating(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: object | None = None,
    wind_direction_deg: float = 240.0,
    weibull_a_ms: float = 10.5,
    weibull_k: float = 2.2,
    turbulence_intensity: float = 0.06,
) -> DeratingResult:
    """Find optimal derating fraction to maximize total farm power.

    Uses bounded scalar optimization to find the derating fraction α
    that maximizes total power output.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    site : py_wake.site.BaseSite, optional
        PyWake site. If None, creates uniform site from Weibull params.
    wind_direction_deg : float
        Predominant wind direction [degrees]. Default: 240.
    weibull_a_ms : float
        Weibull A parameter [m/s]. Default: 10.5.
    weibull_k : float
        Weibull k parameter [-]. Default: 2.2.
    turbulence_intensity : float
        Ambient TI [-]. Default: 0.06.

    Returns
    -------
    DeratingResult
        Baseline vs derated power, optimal fraction, per-turbine breakdown.
    """
    if site is None:
        site = create_uniform_site(weibull_a_ms, weibull_k, turbulence_intensity)

    # Baseline (no derating, α = 1.0)
    baseline_mw, baseline_per_turbine = compute_derated_power(
        x_positions_m, y_positions_m, site, 1.0, wind_direction_deg,
    )

    # Optimize derating fraction
    def objective(alpha: float) -> float:
        total_mw, _ = compute_derated_power(
            x_positions_m, y_positions_m, site, alpha, wind_direction_deg,
        )
        return -total_mw

    result = minimize_scalar(
        objective,
        bounds=(0.5, 1.0),
        method="bounded",
        options={"xatol": 0.01},
    )

    optimal_alpha = float(result.x)
    derated_mw, derated_per_turbine = compute_derated_power(
        x_positions_m, y_positions_m, site, optimal_alpha, wind_direction_deg,
    )

    # Compute upstream loss and downstream gain
    loss_mask = derated_per_turbine < baseline_per_turbine
    gain_mask = derated_per_turbine > baseline_per_turbine
    upstream_loss = float(np.sum(baseline_per_turbine[loss_mask] - derated_per_turbine[loss_mask]))
    downstream_gain = float(np.sum(derated_per_turbine[gain_mask] - baseline_per_turbine[gain_mask]))

    gain_pct = (
        (derated_mw - baseline_mw) / baseline_mw * 100.0
        if baseline_mw > 0 else 0.0
    )

    return DeratingResult(
        baseline_power_mw=round(baseline_mw, 3),
        derated_power_mw=round(derated_mw, 3),
        power_gain_percent=round(gain_pct, 2),
        optimal_derating_fraction=round(optimal_alpha, 3),
        per_turbine_baseline_mw=np.round(baseline_per_turbine, 3),
        per_turbine_derated_mw=np.round(derated_per_turbine, 3),
        upstream_loss_mw=round(upstream_loss, 3),
        downstream_gain_mw=round(downstream_gain, 3),
    )
