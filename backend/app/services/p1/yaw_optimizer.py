"""
Wake steering via yaw optimization for 34 × V236-15.0 MW wind farm.

Physics
-------
Wake steering deliberately misaligns (yaws) upstream turbines to deflect
their wakes away from downstream turbines. The yawed rotor generates a
lateral force that redirects the wake, reducing deficit at downstream
positions. The upstream turbine produces slightly less power (cosine loss),
but the downstream gain outweighs the upstream loss — typical net farm
gains of 5-15%.

The power loss from yaw misalignment follows:
    P_yaw = P_aligned × cos^p(γ)

where γ is the yaw angle and p ≈ 1.88 (empirical, Howland et al. 2019).

Wake deflection follows the Jiménez (2010) model:
    δ(x) = ξ_init × (x/x_0) / (1 + (x/x_0))^2

where ξ_init depends on Ct and yaw angle γ.

Standard
--------
- Jiménez, Á. et al. (2010): Application of a LES technique to characterize
  the wake deflection of a wind turbine in yaw. Wind Energy, 13(6), 559-572.
- Howland, M.F. et al. (2019): Wind farm power optimization through wake
  steering. PNAS, 116(29), 14495-14500.
- Fleming, P. et al. (2017): Field test of wake steering at an offshore
  wind farm. Wind Energy Science, 2(1), 229-239.

Maths
-----
Optimization problem:
    max  Σ P_i(γ_1, γ_2, ..., γ_N)    [total farm power]
    s.t. -30° ≤ γ_i ≤ 30°             [yaw actuator limits]

Solved per wind direction using scipy.optimize.minimize (L-BFGS-B).
The objective evaluates PyWake with yaw angles as input.

References
----------
- PyWake deflection_models.JimenezWakeDeflection
- FLORIS yaw optimization methodology
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy.optimize import minimize

from app.services.p1.wake_model import (
    create_v236_wind_turbine,
    run_wake_analysis,
)

# ── Yaw Optimization Constants ───────────────────────────────────

MAX_YAW_DEG: float = 30.0
"""Maximum yaw misalignment per turbine [degrees]."""

DEFAULT_NUM_TURBINES: int = 34
"""Number of turbines in Baltic Wind Alpha."""

COS_POWER_EXPONENT: float = 1.88
"""Exponent for yaw cosine power loss model (Howland et al. 2019)."""


@dataclass(frozen=True)
class YawOptimizationResult:
    """Result of yaw optimization for a single wind direction.

    Attributes
    ----------
    wind_direction_deg : float
        Wind direction this optimization was performed for [degrees].
    baseline_power_mw : float
        Total farm power without yaw steering [MW].
    optimized_power_mw : float
        Total farm power with optimal yaw angles [MW].
    power_gain_percent : float
        Relative power gain from yaw steering [%].
    optimal_yaw_angles_deg : NDArray
        Optimal yaw angle per turbine [degrees]. Shape: (n_turbines,).
    per_turbine_baseline_mw : NDArray
        Per-turbine power without yaw [MW].
    per_turbine_optimized_mw : NDArray
        Per-turbine power with optimal yaw [MW].
    """

    wind_direction_deg: float
    baseline_power_mw: float
    optimized_power_mw: float
    power_gain_percent: float
    optimal_yaw_angles_deg: NDArray[np.floating]
    per_turbine_baseline_mw: NDArray[np.floating]
    per_turbine_optimized_mw: NDArray[np.floating]


@dataclass(frozen=True)
class FarmYawOptimizationResult:
    """Result of yaw optimization across multiple wind directions.

    Attributes
    ----------
    baseline_aep_gwh : float
        AEP without yaw steering [GWh/year].
    optimized_aep_gwh : float
        AEP with optimal yaw steering [GWh/year].
    aep_gain_percent : float
        AEP gain from yaw steering [%].
    per_direction_results : list[YawOptimizationResult]
        Optimization result for each wind direction evaluated.
    mean_power_gain_percent : float
        Mean power gain across all directions [%].
    max_power_gain_percent : float
        Maximum single-direction power gain [%].
    best_direction_deg : float
        Wind direction with highest power gain [degrees].
    """

    baseline_aep_gwh: float
    optimized_aep_gwh: float
    aep_gain_percent: float
    per_direction_results: list[YawOptimizationResult]
    mean_power_gain_percent: float
    max_power_gain_percent: float
    best_direction_deg: float


# ── Wake Model with Yaw and Deflection ───────────────────────────


def configure_wake_model_with_deflection(site: object, turbine: object) -> object:
    """Configure PyWake wake model with Jiménez deflection for yaw steering.

    Uses BPA Gaussian deficit + Jiménez wake deflection + linear
    superposition. The deflection model enables wake steering analysis.

    Parameters
    ----------
    site : py_wake.site.BaseSite
        PyWake site object.
    turbine : py_wake.wind_turbines.WindTurbine
        PyWake turbine object.

    Returns
    -------
    py_wake.wind_farm_models.WindFarmModel
        Wake model with deflection support.
    """
    from py_wake.deficit_models.gaussian import BastankhahGaussianDeficit
    from py_wake.deflection_models import JimenezWakeDeflection
    from py_wake.superposition_models import LinearSum
    from py_wake.turbulence_models import STF2017TurbulenceModel
    from py_wake.wind_farm_models import All2AllIterative

    return All2AllIterative(
        site=site,
        windTurbines=turbine,
        wake_deficitModel=BastankhahGaussianDeficit(),
        superpositionModel=LinearSum(),
        turbulenceModel=STF2017TurbulenceModel(),
        deflectionModel=JimenezWakeDeflection(),
    )


def compute_farm_power_with_yaw(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    yaw_angles_deg: NDArray[np.floating],
    wind_direction_deg: float,
    wind_speed_ms: float,
    wf_model: object,
) -> tuple[float, NDArray[np.floating]]:
    """Compute total farm power for given yaw angles at a single wind condition.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    yaw_angles_deg : NDArray
        Yaw misalignment per turbine [degrees].
    wind_direction_deg : float
        Wind direction [degrees, meteorological].
    wind_speed_ms : float
        Wind speed [m/s].
    wf_model : py_wake.wind_farm_models.WindFarmModel
        Configured wake model with deflection.

    Returns
    -------
    tuple[float, NDArray]
        (total_power_mw, per_turbine_power_mw).
    """
    sim_res = wf_model(
        x=x_positions_m,
        y=y_positions_m,
        wd=[wind_direction_deg],
        ws=[wind_speed_ms],
        yaw=yaw_angles_deg,
        tilt=0.0,  # No tilt — required by JimenezWakeDeflection
    )

    # Power in watts → MW
    per_turbine_power_w = sim_res.Power.values  # Shape: (n_wt, n_wd, n_ws)
    per_turbine_mw = per_turbine_power_w[:, 0, 0] / 1e6
    total_mw = float(np.sum(per_turbine_mw))

    return total_mw, per_turbine_mw.astype(np.float64)


def optimize_yaw_single_direction(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    wind_direction_deg: float,
    wind_speed_ms: float,
    site: object,
    max_yaw_deg: float = MAX_YAW_DEG,
    maxiter: int = 100,
) -> YawOptimizationResult:
    """Optimize yaw angles for a single wind direction to maximize farm power.

    Uses L-BFGS-B with yaw bounds [-max_yaw, +max_yaw] per turbine.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    wind_direction_deg : float
        Wind direction [degrees].
    wind_speed_ms : float
        Wind speed [m/s].
    site : py_wake.site.BaseSite
        PyWake site object.
    max_yaw_deg : float
        Maximum yaw angle [degrees]. Default: 30.
    maxiter : int
        Maximum optimizer iterations. Default: 100.

    Returns
    -------
    YawOptimizationResult
        Baseline vs optimized power, optimal yaw angles, per-turbine breakdown.
    """
    turbine = create_v236_wind_turbine()
    wf_model = configure_wake_model_with_deflection(site, turbine)
    n = len(x_positions_m)

    # Baseline: zero yaw
    baseline_total, baseline_per_turbine = compute_farm_power_with_yaw(
        x_positions_m,
        y_positions_m,
        np.zeros(n, dtype=np.float64),
        wind_direction_deg,
        wind_speed_ms,
        wf_model,
    )

    # Optimization objective: minimize negative total power
    def objective(yaw_deg: NDArray[np.floating]) -> float:
        total_mw, _ = compute_farm_power_with_yaw(
            x_positions_m,
            y_positions_m,
            yaw_deg.astype(np.float64),
            wind_direction_deg,
            wind_speed_ms,
            wf_model,
        )
        return -total_mw

    bounds = [(-max_yaw_deg, max_yaw_deg)] * n
    x0 = np.zeros(n, dtype=np.float64)

    result = minimize(
        objective,
        x0,
        method="L-BFGS-B",
        bounds=bounds,
        options={"maxiter": maxiter, "ftol": 1e-6},
    )

    optimal_yaw = result.x.astype(np.float64)
    optimized_total, optimized_per_turbine = compute_farm_power_with_yaw(
        x_positions_m,
        y_positions_m,
        optimal_yaw,
        wind_direction_deg,
        wind_speed_ms,
        wf_model,
    )

    gain_pct = (
        (optimized_total - baseline_total) / baseline_total * 100.0 if baseline_total > 0 else 0.0
    )

    return YawOptimizationResult(
        wind_direction_deg=wind_direction_deg,
        baseline_power_mw=round(baseline_total, 3),
        optimized_power_mw=round(optimized_total, 3),
        power_gain_percent=round(gain_pct, 2),
        optimal_yaw_angles_deg=np.round(optimal_yaw, 1),
        per_turbine_baseline_mw=np.round(baseline_per_turbine, 3),
        per_turbine_optimized_mw=np.round(optimized_per_turbine, 3),
    )


def optimize_yaw_all_directions(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    site: object,
    wind_directions_deg: NDArray[np.floating] | None = None,
    wind_speed_ms: float = 9.5,
    max_yaw_deg: float = MAX_YAW_DEG,
) -> FarmYawOptimizationResult:
    """Optimize yaw angles across multiple wind directions.

    Runs single-direction optimization for each direction and aggregates
    results to estimate AEP improvement from wake steering.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    site : py_wake.site.BaseSite
        PyWake site object.
    wind_directions_deg : NDArray, optional
        Wind directions to evaluate [degrees]. Default: 0, 30, ..., 330.
    wind_speed_ms : float
        Representative wind speed [m/s]. Default: 9.5 (near mean for Baltic).
    max_yaw_deg : float
        Maximum yaw angle [degrees]. Default: 30.

    Returns
    -------
    FarmYawOptimizationResult
        Aggregated results across all directions.
    """
    if wind_directions_deg is None:
        wind_directions_deg = np.arange(0, 360, 30, dtype=np.float64)

    turbine = create_v236_wind_turbine()

    # Compute baseline AEP (no yaw) using full PyWake simulation
    baseline_result = run_wake_analysis(x_positions_m, y_positions_m, site, turbine)

    per_direction_results: list[YawOptimizationResult] = []
    for wd in wind_directions_deg:
        result = optimize_yaw_single_direction(
            x_positions_m,
            y_positions_m,
            float(wd),
            wind_speed_ms,
            site,
            max_yaw_deg=max_yaw_deg,
            maxiter=50,
        )
        per_direction_results.append(result)

    # Estimate AEP gain from direction-weighted power gains
    gains = [r.power_gain_percent for r in per_direction_results]
    mean_gain = float(np.mean(gains)) if gains else 0.0
    max_gain = float(np.max(gains)) if gains else 0.0
    best_dir_idx = int(np.argmax(gains)) if gains else 0
    best_dir = float(wind_directions_deg[best_dir_idx])

    # Approximate optimized AEP: baseline × (1 + mean_gain/100)
    optimized_aep = baseline_result.net_aep_gwh * (1.0 + mean_gain / 100.0)
    aep_gain = (
        (optimized_aep - baseline_result.net_aep_gwh) / baseline_result.net_aep_gwh * 100.0
        if baseline_result.net_aep_gwh > 0
        else 0.0
    )

    return FarmYawOptimizationResult(
        baseline_aep_gwh=round(baseline_result.net_aep_gwh, 2),
        optimized_aep_gwh=round(optimized_aep, 2),
        aep_gain_percent=round(aep_gain, 2),
        per_direction_results=per_direction_results,
        mean_power_gain_percent=round(mean_gain, 2),
        max_power_gain_percent=round(max_gain, 2),
        best_direction_deg=best_dir,
    )
