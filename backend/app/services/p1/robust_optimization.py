"""
Robust layout optimization under input uncertainties.

Physics — Robust Optimization
-------------------------------
Standard layout optimization maximizes AEP for fixed wind conditions. But
real wind conditions are uncertain — Weibull parameters, TI, and wind
direction distribution all have measurement/model uncertainty.

Robust optimization finds a layout that performs well across the range of
plausible inputs, not just the nominal case. The objective becomes:

    max  E[AEP(x, ξ)] - λ × σ[AEP(x, ξ)]

where:
    x = layout decision variables (positions)
    ξ = uncertain parameters (Weibull A, k, TI)
    E[·] = expected value over uncertainties
    σ[·] = standard deviation (risk measure)
    λ = risk aversion parameter (0 = risk-neutral, >0 = risk-averse)

This trades off expected performance for reduced variability. A risk-averse
wind farm developer (λ > 0) prefers layouts that are less sensitive to
wind condition uncertainty, even if mean AEP is slightly lower.

Implementation
---------------
Uses sample-average approximation (SAA):
1. Generate N scenarios from the uncertainty distributions
2. Evaluate AEP for each scenario at the current layout
3. Optimize the mean-risk objective using differential evolution

References
----------
- Pérez, J. et al. (2013). Robust wind farm layout optimization.
  Renewable Energy, 53, 237-243.
- Padrón, A.S. et al. (2019). Polynomial chaos expansion for robust design.
  Wind Energy Science, 4, 673-690.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p1.layout_optimizer import (
    MIN_SPACING_M,
    LayoutResult,
    _compute_layout_area_km2,
    check_minimum_spacing,
)
from app.services.p1.wake_model import (
    ROTOR_DIAMETER_M,
    WakeAnalysisResult,
    create_uniform_site,
    create_v236_wind_turbine,
    run_wake_analysis,
)


@dataclass(frozen=True)
class RobustOptimizationResult:
    """Result of robust layout optimization.

    Attributes
    ----------
    layout : LayoutResult
        Optimized layout positions.
    mean_aep_gwh : float
        Mean AEP across scenarios [GWh/year].
    std_aep_gwh : float
        Standard deviation of AEP [GWh/year].
    cov_percent : float
        Coefficient of variation [%].
    worst_case_aep_gwh : float
        Worst-case (minimum) AEP across scenarios [GWh/year].
    best_case_aep_gwh : float
        Best-case (maximum) AEP [GWh/year].
    risk_aversion : float
        Risk aversion parameter λ used.
    n_scenarios : int
        Number of uncertainty scenarios evaluated.
    scenario_aeps_gwh : NDArray
        AEP for each scenario [GWh/year].
    nominal_layout_mean_aep_gwh : float
        Mean AEP of the initial (non-robust) layout [GWh/year].
    nominal_layout_std_aep_gwh : float
        Std AEP of the initial layout [GWh/year].
    robustness_improvement_percent : float
        Reduction in AEP variability vs nominal layout [%].
    """

    layout: LayoutResult
    mean_aep_gwh: float
    std_aep_gwh: float
    cov_percent: float
    worst_case_aep_gwh: float
    best_case_aep_gwh: float
    risk_aversion: float
    n_scenarios: int
    scenario_aeps_gwh: NDArray[np.floating] = field(default_factory=lambda: np.array([]))
    nominal_layout_mean_aep_gwh: float = 0.0
    nominal_layout_std_aep_gwh: float = 0.0
    robustness_improvement_percent: float = 0.0


def _evaluate_layout_scenarios(
    x: NDArray[np.floating],
    y: NDArray[np.floating],
    scenarios: list[dict[str, float]],
) -> NDArray[np.floating]:
    """Evaluate AEP at a layout for multiple wind condition scenarios.

    Parameters
    ----------
    x, y : NDArray
        Turbine coordinates [m].
    scenarios : list[dict]
        Each dict has weibull_a, weibull_k, turbulence_intensity.

    Returns
    -------
    NDArray
        AEP values [GWh/year]. Shape: (n_scenarios,).
    """
    turbine = create_v236_wind_turbine()
    aeps = np.zeros(len(scenarios))

    for i, scen in enumerate(scenarios):
        site = create_uniform_site(
            weibull_a_ms=scen["weibull_a"],
            weibull_k=scen["weibull_k"],
            turbulence_intensity=scen["turbulence_intensity"],
        )
        try:
            wake_result: WakeAnalysisResult = run_wake_analysis(x, y, site, turbine)
            aeps[i] = wake_result.net_aep_gwh
        except Exception:
            aeps[i] = 0.0

    return aeps


def _generate_scenarios(
    n_scenarios: int = 20,
    weibull_a_mean: float = 10.5,
    weibull_a_std: float = 0.5,
    weibull_k_mean: float = 2.2,
    weibull_k_std: float = 0.15,
    ti_mean: float = 0.06,
    ti_std: float = 0.01,
    seed: int = 42,
) -> list[dict[str, float]]:
    """Generate uncertainty scenarios using Latin Hypercube Sampling.

    Parameters
    ----------
    n_scenarios : int
        Number of scenarios.
    weibull_a_mean, weibull_a_std : float
        Weibull A parameter statistics.
    weibull_k_mean, weibull_k_std : float
        Weibull k parameter statistics.
    ti_mean, ti_std : float
        Turbulence intensity statistics.
    seed : int
        Random seed.

    Returns
    -------
    list[dict]
        Scenario parameter sets.
    """
    rng = np.random.default_rng(seed)
    scenarios = []

    for _ in range(n_scenarios):
        a = max(5.0, min(20.0, rng.normal(weibull_a_mean, weibull_a_std)))
        k = max(1.2, min(3.5, rng.normal(weibull_k_mean, weibull_k_std)))
        ti = max(0.02, min(0.20, rng.normal(ti_mean, ti_std)))
        scenarios.append(
            {
                "weibull_a": a,
                "weibull_k": k,
                "turbulence_intensity": ti,
            }
        )

    return scenarios


def run_robust_optimization(
    initial_x: NDArray[np.floating],
    initial_y: NDArray[np.floating],
    risk_aversion: float = 1.0,
    n_scenarios: int = 10,
    maxiter: int = 20,
    seed: int = 42,
) -> RobustOptimizationResult:
    """Run robust layout optimization with uncertainty scenarios.

    Parameters
    ----------
    initial_x, initial_y : NDArray
        Initial turbine coordinates [m].
    risk_aversion : float
        Risk aversion λ. 0=risk-neutral, >0=risk-averse. Default: 1.0.
    n_scenarios : int
        Number of uncertainty scenarios. Default: 10.
    maxiter : int
        Maximum optimization iterations. Default: 20.
    seed : int
        Random seed. Default: 42.

    Returns
    -------
    RobustOptimizationResult
        Robust layout with statistics.
    """
    from scipy.optimize import differential_evolution

    n = len(initial_x)
    scenarios = _generate_scenarios(n_scenarios, seed=seed)

    # Evaluate nominal layout
    nominal_aeps = _evaluate_layout_scenarios(initial_x, initial_y, scenarios)
    nominal_mean = float(np.mean(nominal_aeps))
    nominal_std = float(np.std(nominal_aeps))

    # Objective: maximize mean AEP - λ × std AEP → minimize -(mean - λ×std)
    def robust_objective(params: NDArray[np.floating]) -> float:
        x = params[0::2]
        y = params[1::2]

        # Spacing constraint
        passes, actual_min = check_minimum_spacing(np.array(x), np.array(y), MIN_SPACING_M)
        if not passes:
            violation = MIN_SPACING_M - actual_min
            return 1e6 * violation**2

        aeps = _evaluate_layout_scenarios(
            np.array(x, dtype=np.float64),
            np.array(y, dtype=np.float64),
            scenarios,
        )

        mean_aep = float(np.mean(aeps))
        std_aep = float(np.std(aeps))

        # Negative because we minimize
        return -(mean_aep - risk_aversion * std_aep)

    # Bounds
    margin = 2.0 * ROTOR_DIAMETER_M
    x_min = float(np.min(initial_x)) - margin
    x_max = float(np.max(initial_x)) + margin
    y_min = float(np.min(initial_y)) - margin
    y_max = float(np.max(initial_y)) + margin
    bounds = [(x_min, x_max), (y_min, y_max)] * n

    x0 = np.empty(2 * n, dtype=np.float64)
    x0[0::2] = initial_x
    x0[1::2] = initial_y

    result = differential_evolution(
        robust_objective,
        bounds=bounds,
        maxiter=maxiter,
        seed=seed,
        init="sobol",
        tol=1e-3,
        polish=False,
        x0=x0,
    )

    opt_x = result.x[0::2].astype(np.float64)
    opt_y = result.x[1::2].astype(np.float64)

    # Evaluate robust layout
    robust_aeps = _evaluate_layout_scenarios(opt_x, opt_y, scenarios)
    robust_mean = float(np.mean(robust_aeps))
    robust_std = float(np.std(robust_aeps))
    cov = robust_std / robust_mean * 100.0 if robust_mean > 0 else 0.0

    _, min_dist = check_minimum_spacing(opt_x, opt_y)
    area = _compute_layout_area_km2(opt_x, opt_y)

    layout = LayoutResult(
        name="Robust Optimized",
        x_positions=opt_x,
        y_positions=opt_y,
        num_turbines=n,
        min_spacing_m=min_dist,
        area_km2=area,
    )

    # Robustness improvement = reduction in CoV
    nominal_cov = nominal_std / nominal_mean * 100.0 if nominal_mean > 0 else 0.0
    robustness_improvement = (nominal_cov - cov) / nominal_cov * 100.0 if nominal_cov > 0 else 0.0

    return RobustOptimizationResult(
        layout=layout,
        mean_aep_gwh=round(robust_mean, 2),
        std_aep_gwh=round(robust_std, 2),
        cov_percent=round(cov, 2),
        worst_case_aep_gwh=round(float(np.min(robust_aeps)), 2),
        best_case_aep_gwh=round(float(np.max(robust_aeps)), 2),
        risk_aversion=risk_aversion,
        n_scenarios=n_scenarios,
        scenario_aeps_gwh=np.round(robust_aeps, 2),
        nominal_layout_mean_aep_gwh=round(nominal_mean, 2),
        nominal_layout_std_aep_gwh=round(nominal_std, 2),
        robustness_improvement_percent=round(robustness_improvement, 2),
    )
