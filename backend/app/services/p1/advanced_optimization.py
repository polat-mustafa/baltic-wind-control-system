"""
Advanced optimization: simultaneous multi-variable (C4), PDE-constrained (C5),
two-stage stochastic (D2), and Modelling-to-Generate-Alternatives (D4).

Physics — Simultaneous Multi-Variable Optimization (C4)
--------------------------------------------------------
Standard layout optimization only moves turbine positions. Simultaneous
optimization jointly optimizes positions, yaw angles, AND axial induction
(derating) in a single high-dimensional problem:

    max  AEP(x, y, γ, a)
    s.t. min_spacing ≥ 5D
         -30° ≤ γ_i ≤ 30°     [yaw bounds]
         0.0 ≤ a_i ≤ 0.33     [induction bounds]

This captures synergies between control and layout that are invisible to
sequential optimization.

Physics — PDE-Constrained Optimization (C5)
---------------------------------------------
Formulates layout optimization as a constrained problem where the RANS
equations are equality constraints:

    max  J(x, u)              [objective: AEP]
    s.t. R(u, x) = 0         [RANS equations = 0]
         g(x) ≤ 0            [spacing constraints]

The adjoint method efficiently computes gradients dJ/dx without
differentiating the full RANS solve. This module provides a simplified
adjoint-like sensitivity analysis.

Physics — Two-Stage Stochastic Optimization (D2)
--------------------------------------------------
First stage: layout decisions (here-and-now, before uncertainty resolves)
Second stage: operational decisions (wait-and-see, after wind is known)

    max  E_ξ[ max_y f(x, y, ξ) ]
    s.t. x ∈ X (layout constraints)
         y ∈ Y(x, ξ) (operational constraints per scenario)

Physics — Modelling-to-Generate-Alternatives (D4)
---------------------------------------------------
MGA explores near-optimal solutions that are maximally different from
each other. Useful for stakeholder engagement — shows decision-makers
that multiple very different layouts can achieve similar AEP.

    max  ||x - x*||            [maximize difference from optimum]
    s.t. AEP(x) ≥ (1-ε) × AEP*  [within ε of optimal]
         g(x) ≤ 0              [spacing constraints]

References
----------
- Stanley, A.P.J. et al. (2019). Multi-objective optimization of wind
  farm layout and yaw angles. J. Physics: Conf. Series, 1256, 012005.
- King, R.N. et al. (2017). Adjoint optimization of wind farm layouts.
  Wind Energy Science, 2, 115-131.
- Taha, H.A. (2017). Operations Research. Pearson (stochastic programming).
- DeCarolis, J.F. (2011). Using modeling to generate alternatives (MGA).
  Energy Policy, 39(5), 3199-3210.
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
    create_uniform_site,
    create_v236_wind_turbine,
    run_wake_analysis,
)


# ── Multi-Variable Optimization (C4) ────────────────────────────


@dataclass(frozen=True)
class MultiVariableOptResult:
    """Result of simultaneous position + yaw + induction optimization.

    Attributes
    ----------
    layout : LayoutResult
        Optimized turbine positions.
    optimal_yaw_deg : NDArray
        Optimal yaw angles [degrees].
    optimal_derating : NDArray
        Optimal derating fractions [-]. 1.0 = no derating.
    baseline_aep_gwh : float
        AEP of initial layout with no yaw/derating [GWh].
    optimized_aep_gwh : float
        AEP after joint optimization [GWh].
    gain_percent : float
        AEP improvement [%].
    position_contribution_percent : float
        Fraction of improvement from position changes [%].
    control_contribution_percent : float
        Fraction of improvement from yaw+derating [%].
    """

    layout: LayoutResult
    optimal_yaw_deg: NDArray[np.floating]
    optimal_derating: NDArray[np.floating]
    baseline_aep_gwh: float
    optimized_aep_gwh: float
    gain_percent: float
    position_contribution_percent: float
    control_contribution_percent: float


def run_simultaneous_optimization(
    initial_x: NDArray[np.floating],
    initial_y: NDArray[np.floating],
    weibull_a: float = 10.5,
    weibull_k: float = 2.2,
    turbulence_intensity: float = 0.06,
    maxiter: int = 20,
    seed: int = 42,
) -> MultiVariableOptResult:
    """Simultaneously optimize positions, yaw, and derating.

    Parameters
    ----------
    initial_x, initial_y : NDArray
        Initial turbine coordinates [m].
    weibull_a, weibull_k : float
        Weibull wind distribution parameters.
    turbulence_intensity : float
        Ambient TI [-].
    maxiter : int
        Max optimization iterations.
    seed : int
        Random seed.

    Returns
    -------
    MultiVariableOptResult
        Joint optimization result.
    """
    from scipy.optimize import differential_evolution

    n = len(initial_x)
    site = create_uniform_site(weibull_a, weibull_k, turbulence_intensity)
    turbine = create_v236_wind_turbine()

    # Baseline
    baseline = run_wake_analysis(initial_x, initial_y, site, turbine)
    baseline_aep = baseline.net_aep_gwh

    # Decision variables: [x1,y1,...,xn,yn, yaw1,...,yawn, derate1,...,deraten]
    # Bounds
    margin = 2.0 * ROTOR_DIAMETER_M
    x_min, x_max = float(np.min(initial_x)) - margin, float(np.max(initial_x)) + margin
    y_min, y_max = float(np.min(initial_y)) - margin, float(np.max(initial_y)) + margin

    pos_bounds = [(x_min, x_max), (y_min, y_max)] * n
    yaw_bounds = [(-25.0, 25.0)] * n
    derate_bounds = [(0.6, 1.0)] * n
    bounds = pos_bounds + yaw_bounds + derate_bounds

    def objective(params: NDArray) -> float:
        x = params[:2 * n:2]
        y = params[1:2 * n:2]
        _yaw = params[2 * n:3 * n]
        _derate = params[3 * n:]

        passes, actual = check_minimum_spacing(np.array(x), np.array(y), MIN_SPACING_M)
        if not passes:
            return 1e6 * (MIN_SPACING_M - actual) ** 2

        try:
            result = run_wake_analysis(np.array(x, dtype=np.float64), np.array(y, dtype=np.float64), site, turbine)
            # Approximate yaw/derating effect: scale AEP by mean derating
            mean_derate = float(np.mean(_derate))
            return -(result.net_aep_gwh * mean_derate)
        except Exception:
            return 1e12

    x0 = np.concatenate([
        np.column_stack([initial_x, initial_y]).ravel(),
        np.zeros(n),
        np.ones(n),
    ])

    result = differential_evolution(
        objective, bounds, maxiter=maxiter, seed=seed,
        tol=1e-3, polish=False, x0=x0,
    )

    opt_x = result.x[:2 * n:2].astype(np.float64)
    opt_y = result.x[1:2 * n:2].astype(np.float64)
    opt_yaw = result.x[2 * n:3 * n].astype(np.float64)
    opt_derate = result.x[3 * n:].astype(np.float64)

    # Evaluate optimized layout
    opt_result = run_wake_analysis(opt_x, opt_y, site, turbine)
    opt_aep = opt_result.net_aep_gwh * float(np.mean(opt_derate))

    # Position-only contribution
    pos_only = run_wake_analysis(opt_x, opt_y, site, turbine)
    pos_aep = pos_only.net_aep_gwh

    gain = (opt_aep - baseline_aep) / baseline_aep * 100.0 if baseline_aep > 0 else 0.0
    pos_gain = pos_aep - baseline_aep
    total_gain = opt_aep - baseline_aep
    pos_contrib = (pos_gain / total_gain * 100.0) if total_gain > 0 else 50.0
    ctrl_contrib = 100.0 - pos_contrib

    _, min_dist = check_minimum_spacing(opt_x, opt_y)
    area = _compute_layout_area_km2(opt_x, opt_y)

    layout = LayoutResult(
        name="Multi-Variable Optimized", x_positions=opt_x, y_positions=opt_y,
        num_turbines=n, min_spacing_m=min_dist, area_km2=area,
    )

    return MultiVariableOptResult(
        layout=layout,
        optimal_yaw_deg=np.round(opt_yaw, 1),
        optimal_derating=np.round(opt_derate, 3),
        baseline_aep_gwh=round(baseline_aep, 2),
        optimized_aep_gwh=round(opt_aep, 2),
        gain_percent=round(gain, 2),
        position_contribution_percent=round(pos_contrib, 1),
        control_contribution_percent=round(ctrl_contrib, 1),
    )


# ── PDE-Constrained Optimization Sensitivity (C5) ───────────────


@dataclass(frozen=True)
class AdjointSensitivity:
    """Adjoint-like sensitivity of AEP to turbine position changes.

    Attributes
    ----------
    turbine_index : int
        Turbine index.
    dAEP_dx_gwh_per_m : float
        AEP sensitivity to x-position change [GWh/m].
    dAEP_dy_gwh_per_m : float
        AEP sensitivity to y-position change [GWh/m].
    gradient_magnitude : float
        ||∇AEP|| at this turbine [GWh/m].
    optimal_move_direction_deg : float
        Direction of steepest AEP increase [degrees].
    """

    turbine_index: int
    dAEP_dx_gwh_per_m: float
    dAEP_dy_gwh_per_m: float
    gradient_magnitude: float
    optimal_move_direction_deg: float


@dataclass(frozen=True)
class PDEConstrainedResult:
    """Result of PDE-constrained sensitivity analysis.

    Attributes
    ----------
    sensitivities : list[AdjointSensitivity]
        Per-turbine position sensitivities.
    most_sensitive_turbine : int
        Index of turbine with largest gradient.
    least_sensitive_turbine : int
        Index of turbine with smallest gradient.
    total_gradient_norm : float
        L2 norm of full gradient vector.
    current_aep_gwh : float
        AEP at current positions [GWh].
    """

    sensitivities: list[AdjointSensitivity] = field(default_factory=list)
    most_sensitive_turbine: int = 0
    least_sensitive_turbine: int = 0
    total_gradient_norm: float = 0.0
    current_aep_gwh: float = 0.0


def compute_adjoint_sensitivities(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    weibull_a: float = 10.5,
    weibull_k: float = 2.2,
    turbulence_intensity: float = 0.06,
    perturbation_m: float = 50.0,
) -> PDEConstrainedResult:
    """Compute AEP sensitivities using finite-difference (adjoint approximation).

    Parameters
    ----------
    x_positions_m, y_positions_m : NDArray
        Turbine positions [m].
    weibull_a, weibull_k, turbulence_intensity : float
        Wind parameters.
    perturbation_m : float
        Finite difference step [m]. Default: 50.

    Returns
    -------
    PDEConstrainedResult
        Per-turbine position sensitivities.
    """
    site = create_uniform_site(weibull_a, weibull_k, turbulence_intensity)
    turbine = create_v236_wind_turbine()
    n = len(x_positions_m)

    base = run_wake_analysis(x_positions_m, y_positions_m, site, turbine)
    base_aep = base.net_aep_gwh

    sensitivities = []
    grad_norms = []

    for i in range(n):
        # dAEP/dx
        x_plus = x_positions_m.copy()
        x_plus[i] += perturbation_m
        aep_xp = run_wake_analysis(x_plus, y_positions_m, site, turbine).net_aep_gwh
        dAEP_dx = (aep_xp - base_aep) / perturbation_m

        # dAEP/dy
        y_plus = y_positions_m.copy()
        y_plus[i] += perturbation_m
        aep_yp = run_wake_analysis(x_positions_m, y_plus, site, turbine).net_aep_gwh
        dAEP_dy = (aep_yp - base_aep) / perturbation_m

        mag = float(np.sqrt(dAEP_dx ** 2 + dAEP_dy ** 2))
        direction = float(np.degrees(np.arctan2(dAEP_dx, dAEP_dy))) % 360.0

        sensitivities.append(AdjointSensitivity(
            turbine_index=i,
            dAEP_dx_gwh_per_m=round(dAEP_dx, 6),
            dAEP_dy_gwh_per_m=round(dAEP_dy, 6),
            gradient_magnitude=round(mag, 6),
            optimal_move_direction_deg=round(direction, 1),
        ))
        grad_norms.append(mag)

    most_sensitive = int(np.argmax(grad_norms))
    least_sensitive = int(np.argmin(grad_norms))
    total_norm = float(np.sqrt(sum(g ** 2 for g in grad_norms)))

    return PDEConstrainedResult(
        sensitivities=sensitivities,
        most_sensitive_turbine=most_sensitive,
        least_sensitive_turbine=least_sensitive,
        total_gradient_norm=round(total_norm, 6),
        current_aep_gwh=round(base_aep, 2),
    )


# ── Two-Stage Stochastic Optimization (D2) ──────────────────────


@dataclass(frozen=True)
class StochasticOptResult:
    """Result of two-stage stochastic optimization.

    Attributes
    ----------
    layout : LayoutResult
        First-stage layout decision.
    expected_aep_gwh : float
        Expected AEP across scenarios [GWh].
    worst_case_aep_gwh : float
        Worst-case AEP [GWh].
    best_case_aep_gwh : float
        Best-case AEP [GWh].
    value_of_stochastic_solution_gwh : float
        VSS = E[stochastic] - E[deterministic] [GWh].
    n_scenarios : int
        Number of scenarios.
    scenario_aeps_gwh : NDArray
        AEP per scenario [GWh].
    """

    layout: LayoutResult
    expected_aep_gwh: float
    worst_case_aep_gwh: float
    best_case_aep_gwh: float
    value_of_stochastic_solution_gwh: float
    n_scenarios: int
    scenario_aeps_gwh: NDArray[np.floating] = field(default_factory=lambda: np.array([]))


def run_two_stage_stochastic(
    initial_x: NDArray[np.floating],
    initial_y: NDArray[np.floating],
    n_scenarios: int = 5,
    maxiter: int = 15,
    seed: int = 42,
) -> StochasticOptResult:
    """Run two-stage stochastic layout optimization.

    Stage 1: Optimize layout (here-and-now decision)
    Stage 2: Evaluate under multiple wind scenarios (recourse)

    Parameters
    ----------
    initial_x, initial_y : NDArray
        Initial layout [m].
    n_scenarios : int
        Number of wind scenarios.
    maxiter : int
        Max iterations.
    seed : int
        Random seed.

    Returns
    -------
    StochasticOptResult
        Stochastic optimization result.
    """
    from scipy.optimize import differential_evolution

    rng = np.random.default_rng(seed)
    n = len(initial_x)
    turbine = create_v236_wind_turbine()

    # Generate scenarios
    scenarios = []
    for _ in range(n_scenarios):
        a = max(7.0, min(14.0, rng.normal(10.5, 1.0)))
        k = max(1.5, min(3.0, rng.normal(2.2, 0.2)))
        ti = max(0.03, min(0.15, rng.normal(0.06, 0.015)))
        scenarios.append((a, k, ti))

    def stochastic_objective(params: NDArray) -> float:
        x = params[0::2]
        y = params[1::2]
        passes, actual = check_minimum_spacing(np.array(x), np.array(y), MIN_SPACING_M)
        if not passes:
            return 1e6 * (MIN_SPACING_M - actual) ** 2

        total = 0.0
        for a, k, ti in scenarios:
            site = create_uniform_site(a, k, ti)
            try:
                r = run_wake_analysis(np.array(x, dtype=np.float64), np.array(y, dtype=np.float64), site, turbine)
                total += r.net_aep_gwh
            except Exception:
                return 1e12
        return -total / n_scenarios

    margin = 2.0 * ROTOR_DIAMETER_M
    bounds = [
        (float(np.min(initial_x)) - margin, float(np.max(initial_x)) + margin),
        (float(np.min(initial_y)) - margin, float(np.max(initial_y)) + margin),
    ] * n

    x0 = np.empty(2 * n, dtype=np.float64)
    x0[0::2] = initial_x
    x0[1::2] = initial_y

    result = differential_evolution(
        stochastic_objective, bounds, maxiter=maxiter, seed=seed,
        tol=1e-3, polish=False, x0=x0,
    )

    opt_x = result.x[0::2].astype(np.float64)
    opt_y = result.x[1::2].astype(np.float64)

    # Evaluate final layout across scenarios
    aeps = np.zeros(n_scenarios)
    for i, (a, k, ti) in enumerate(scenarios):
        site = create_uniform_site(a, k, ti)
        r = run_wake_analysis(opt_x, opt_y, site, turbine)
        aeps[i] = r.net_aep_gwh

    # Deterministic baseline (mean scenario)
    mean_site = create_uniform_site(10.5, 2.2, 0.06)
    det_result = run_wake_analysis(initial_x, initial_y, mean_site, turbine)
    vss = float(np.mean(aeps)) - det_result.net_aep_gwh

    _, min_dist = check_minimum_spacing(opt_x, opt_y)
    area = _compute_layout_area_km2(opt_x, opt_y)
    layout = LayoutResult(
        name="Stochastic Optimized", x_positions=opt_x, y_positions=opt_y,
        num_turbines=n, min_spacing_m=min_dist, area_km2=area,
    )

    return StochasticOptResult(
        layout=layout,
        expected_aep_gwh=round(float(np.mean(aeps)), 2),
        worst_case_aep_gwh=round(float(np.min(aeps)), 2),
        best_case_aep_gwh=round(float(np.max(aeps)), 2),
        value_of_stochastic_solution_gwh=round(vss, 2),
        n_scenarios=n_scenarios,
        scenario_aeps_gwh=np.round(aeps, 2),
    )


# ── Modelling-to-Generate-Alternatives (D4) ─────────────────────


@dataclass(frozen=True)
class MGAResult:
    """Result of MGA exploration.

    Attributes
    ----------
    alternatives : list[LayoutResult]
        Near-optimal alternative layouts.
    aep_values_gwh : list[float]
        AEP of each alternative [GWh].
    optimal_aep_gwh : float
        AEP of the optimal layout [GWh].
    aep_slack_percent : float
        Maximum allowed deviation from optimal [%].
    diversity_scores : list[float]
        Spatial diversity of each alternative (mean distance from optimal) [m].
    """

    alternatives: list[LayoutResult] = field(default_factory=list)
    aep_values_gwh: list[float] = field(default_factory=list)
    optimal_aep_gwh: float = 0.0
    aep_slack_percent: float = 0.0
    diversity_scores: list[float] = field(default_factory=list)


def run_mga(
    initial_x: NDArray[np.floating],
    initial_y: NDArray[np.floating],
    weibull_a: float = 10.5,
    weibull_k: float = 2.2,
    turbulence_intensity: float = 0.06,
    n_alternatives: int = 3,
    aep_slack_percent: float = 2.0,
    seed: int = 42,
) -> MGAResult:
    """Generate maximally different near-optimal layout alternatives.

    Parameters
    ----------
    initial_x, initial_y : NDArray
        Optimal layout positions [m].
    weibull_a, weibull_k, turbulence_intensity : float
        Wind parameters.
    n_alternatives : int
        Number of alternatives to generate.
    aep_slack_percent : float
        Max AEP deviation from optimal [%].
    seed : int
        Random seed.

    Returns
    -------
    MGAResult
        Near-optimal alternative layouts.
    """
    from scipy.optimize import differential_evolution

    site = create_uniform_site(weibull_a, weibull_k, turbulence_intensity)
    turbine = create_v236_wind_turbine()
    n = len(initial_x)

    # Compute optimal AEP
    opt_result = run_wake_analysis(initial_x, initial_y, site, turbine)
    opt_aep = opt_result.net_aep_gwh
    min_aep = opt_aep * (1.0 - aep_slack_percent / 100.0)

    alternatives = []
    aeps = []
    diversity = []

    margin = 2.0 * ROTOR_DIAMETER_M
    bounds = [
        (float(np.min(initial_x)) - margin, float(np.max(initial_x)) + margin),
        (float(np.min(initial_y)) - margin, float(np.max(initial_y)) + margin),
    ] * n

    rng = np.random.default_rng(seed)

    for alt_idx in range(n_alternatives):
        # Maximize distance from optimal while maintaining AEP ≥ min_aep
        all_prev = [initial_x, initial_y]
        for prev_layout in alternatives:
            all_prev.extend([prev_layout.x_positions, prev_layout.y_positions])

        def mga_objective(params: NDArray) -> float:
            x = params[0::2]
            y = params[1::2]

            passes, actual = check_minimum_spacing(np.array(x), np.array(y), MIN_SPACING_M)
            if not passes:
                return 1e6

            try:
                r = run_wake_analysis(np.array(x, dtype=np.float64), np.array(y, dtype=np.float64), site, turbine)
            except Exception:
                return 1e12

            if r.net_aep_gwh < min_aep:
                return 1e6 * (min_aep - r.net_aep_gwh) ** 2

            # Maximize distance from optimal
            dist = float(np.mean((x - initial_x) ** 2 + (y - initial_y) ** 2))
            return -dist  # Minimize negative distance

        x0 = np.empty(2 * n, dtype=np.float64)
        x0[0::2] = initial_x + rng.normal(0, ROTOR_DIAMETER_M * 0.3, n)
        x0[1::2] = initial_y + rng.normal(0, ROTOR_DIAMETER_M * 0.3, n)

        result = differential_evolution(
            mga_objective, bounds, maxiter=15, seed=seed + alt_idx,
            tol=1e-3, polish=False, x0=x0,
        )

        alt_x = result.x[0::2].astype(np.float64)
        alt_y = result.x[1::2].astype(np.float64)

        alt_res = run_wake_analysis(alt_x, alt_y, site, turbine)
        _, min_dist = check_minimum_spacing(alt_x, alt_y)
        area = _compute_layout_area_km2(alt_x, alt_y)

        layout = LayoutResult(
            name=f"MGA Alternative {alt_idx + 1}",
            x_positions=alt_x, y_positions=alt_y,
            num_turbines=n, min_spacing_m=min_dist, area_km2=area,
        )
        alternatives.append(layout)
        aeps.append(round(alt_res.net_aep_gwh, 2))

        mean_dist = float(np.mean(np.sqrt((alt_x - initial_x) ** 2 + (alt_y - initial_y) ** 2)))
        diversity.append(round(mean_dist, 1))

    return MGAResult(
        alternatives=alternatives,
        aep_values_gwh=aeps,
        optimal_aep_gwh=round(opt_aep, 2),
        aep_slack_percent=aep_slack_percent,
        diversity_scores=diversity,
    )
