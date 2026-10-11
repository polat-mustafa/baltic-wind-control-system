"""
Polynomial Chaos Expansion (PCE) uncertainty quantification for wind farm AEP.

Physics
-------
Wind farm AEP depends on uncertain inputs: wind speed distribution parameters,
turbulence intensity, wake model coefficients, and power curve deviations.
Traditional Monte Carlo simulation requires thousands of evaluations to
converge, which is expensive when each evaluation requires a full wake analysis.

Polynomial Chaos Expansion (PCE) replaces the expensive computational model
with a polynomial surrogate. Key steps:

1. Define uncertain input parameters and their distributions
2. Generate sample points using Latin Hypercube Sampling (LHS) or quadrature
3. Evaluate the model at sample points
4. Fit polynomial chaos coefficients via regression
5. Extract statistics analytically from the PCE coefficients

The PCE expansion:
    Y(ξ) = Σ_α c_α × Ψ_α(ξ)

where ξ are standardised random variables, Ψ_α are multivariate ORTHONORMAL
polynomials of their distribution (probabilists' Hermite He_n/√n! for Gaussian
inputs, √(2n+1)·P_n Legendre for uniform ones on [−1, 1]), and c_α are the
expansion coefficients. Only with an orthonormal basis of the input distribution
do the statistics follow from the coefficients:
    E[Y] = c_0                              (mean)
    Var[Y] = Σ_{α≠0} c_α²                 (variance)
    Sobol indices: S_i = Σ_{α∈A_i} c_α² / Var[Y]  (sensitivity)
Fit quality is the leave-one-out Q² (e_i / (1 − h_ii) from the hat matrix), not the
in-sample R², which reaches 1 whenever the basis has nearly as many terms as there
are samples. Scope: this is the AEP spread from the wind-climate inputs alone
(A, k, TI), not the bankable total uncertainty (``aep_calculator``).

References
----------
- Xiu, D. & Karniadakis, G. (2002). The Wiener-Askey polynomial chaos.
  SIAM J. Sci. Comput., 24(2), 619-644.
- Le Maître, O.P. & Knio, O.M. (2010). Spectral Methods for Uncertainty
  Quantification. Springer.
- Murcia, J.P. et al. (2018). Uncertainty propagation through an AEP model.
  Renewable Energy, 119, 94-108.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p1.wake_model import (
    RATED_POWER_KW,
    WakeAnalysisResult,
    create_uniform_site,
    create_wind_turbine,
    run_wake_analysis,
)

# ── PCE Constants ───────────────────────────────────────────────

DEFAULT_PCE_ORDER: int = 2
"""Default polynomial order for PCE."""

DEFAULT_NUM_SAMPLES: int = 50
"""Default number of LHS samples for PCE regression."""


@dataclass(frozen=True)
class UncertainParameter:
    """An uncertain input parameter for PCE analysis.

    Attributes
    ----------
    name : str
        Parameter name.
    nominal : float
        Nominal (central) value.
    std_dev : float
        Standard deviation of the uncertainty.
    distribution : str
        Distribution type: "gaussian" or "uniform".
    """

    name: str
    nominal: float
    std_dev: float
    distribution: str = "gaussian"


@dataclass(frozen=True)
class SobolIndex:
    """Sobol sensitivity index for a parameter.

    Attributes
    ----------
    parameter : str
        Parameter name.
    first_order : float
        First-order Sobol index S_i [-]. Fraction of variance due to this
        parameter alone.
    """

    parameter: str
    first_order: float


@dataclass(frozen=True)
class PCEResult:
    """Result of Polynomial Chaos Expansion uncertainty quantification.

    Attributes
    ----------
    mean_aep_gwh : float
        Mean AEP from PCE [GWh/year].
    std_aep_gwh : float
        Standard deviation of AEP [GWh/year].
    cov_percent : float
        Coefficient of variation [%].
    p50_gwh : float
        P50 exceedance value [GWh/year].
    p75_gwh : float
        P75 exceedance value [GWh/year].
    p90_gwh : float
        P90 exceedance value [GWh/year].
    sobol_indices : list[SobolIndex]
        First-order Sobol sensitivity indices per parameter.
    dominant_parameter : str
        Parameter with highest Sobol index.
    pce_order : int
        Polynomial chaos order used.
    num_samples : int
        Number of model evaluations.
    q2_loo : float
        Leave-one-out predictivity Q² of the surrogate (1 = perfect, < 0.9 = too few
        samples for this order).
    sample_aep_values_gwh : NDArray
        AEP values at sample points [GWh/year].
    """

    mean_aep_gwh: float
    std_aep_gwh: float
    cov_percent: float
    p50_gwh: float
    p75_gwh: float
    p90_gwh: float
    sobol_indices: list[SobolIndex] = field(default_factory=list)
    dominant_parameter: str = ""
    pce_order: int = DEFAULT_PCE_ORDER
    num_samples: int = DEFAULT_NUM_SAMPLES
    q2_loo: float = 0.0
    sample_aep_values_gwh: NDArray[np.floating] = field(default_factory=lambda: np.array([]))


def _generate_lhs_samples(
    parameters: list[UncertainParameter],
    n_samples: int,
    seed: int = 42,
) -> NDArray[np.floating]:
    """Generate Latin Hypercube Samples for the uncertain parameters.

    Parameters
    ----------
    parameters : list[UncertainParameter]
        Uncertain parameters with distributions.
    n_samples : int
        Number of samples.
    seed : int
        Random seed for reproducibility.

    Returns
    -------
    NDArray
        Sample matrix. Shape: (n_samples, n_parameters).
    """
    rng = np.random.default_rng(seed)
    n_params = len(parameters)
    samples = np.zeros((n_samples, n_params))

    for j, param in enumerate(parameters):
        # Latin hypercube: divide [0,1] into n equal strata, sample one from each
        intervals = np.linspace(0, 1, n_samples + 1)
        uniform_samples = np.array(
            [rng.uniform(intervals[i], intervals[i + 1]) for i in range(n_samples)]
        )
        rng.shuffle(uniform_samples)

        if param.distribution == "gaussian":
            from scipy.stats import norm

            samples[:, j] = norm.ppf(uniform_samples, loc=param.nominal, scale=param.std_dev)
        else:
            # Uniform: ±2σ range
            half_range = 2.0 * param.std_dev
            samples[:, j] = param.nominal - half_range + uniform_samples * 2.0 * half_range

    return samples


def _multi_indices(n_params: int, order: int) -> list[tuple[int, ...]]:
    """Total-degree multi-indices α with |α| ≤ order, the constant term first."""
    from itertools import product as iter_product

    return [c for c in iter_product(range(order + 1), repeat=n_params) if sum(c) <= order]


def _build_polynomial_basis(
    xi: NDArray[np.floating],
    order: int,
    distributions: list[str],
) -> NDArray[np.floating]:
    """Orthonormal multivariate polynomial basis Ψ_α(ξ).

    Parameters
    ----------
    xi : NDArray
        Standardised samples, shape (n_samples, n_params): ξ = (x − μ)/σ for a
        Gaussian input, ξ ∈ [−1, 1] for a uniform one.
    order : int
        Maximum total polynomial degree.
    distributions : list[str]
        "gaussian" (Hermite He_n/√n!) or "uniform" (√(2n+1)·P_n) per parameter.

    Returns
    -------
    NDArray
        Basis matrix, shape (n_samples, n_terms); E[Ψ_α Ψ_β] = δ_αβ.
    """
    from math import factorial, sqrt

    from numpy.polynomial import hermite_e, legendre

    indices = _multi_indices(xi.shape[1], order)
    basis = np.ones((xi.shape[0], len(indices)))
    for t, idx in enumerate(indices):
        for p, deg in enumerate(idx):
            if deg == 0:
                continue
            unit = [0] * deg + [1]
            if distributions[p] == "gaussian":
                basis[:, t] *= hermite_e.hermeval(xi[:, p], unit) / sqrt(factorial(deg))
            else:
                basis[:, t] *= legendre.legval(xi[:, p], unit) * sqrt(2 * deg + 1)
    return basis


def run_pce_uncertainty(
    x_positions_m: NDArray[np.floating],
    y_positions_m: NDArray[np.floating],
    parameters: list[UncertainParameter] | None = None,
    pce_order: int = DEFAULT_PCE_ORDER,
    n_samples: int = DEFAULT_NUM_SAMPLES,
    seed: int = 42,
) -> PCEResult:
    """Run Polynomial Chaos Expansion uncertainty quantification on AEP.

    Parameters
    ----------
    x_positions_m : NDArray
        Turbine x-coordinates [m].
    y_positions_m : NDArray
        Turbine y-coordinates [m].
    parameters : list[UncertainParameter], optional
        Uncertain parameters. Default: Weibull A, k, and TI.
    pce_order : int
        PCE polynomial order. Default: 3.
    n_samples : int
        Number of model evaluations. Default: 50.
    seed : int
        Random seed. Default: 42.

    Returns
    -------
    PCEResult
        PCE statistics, Sobol indices, and fit quality.
    """
    # Default uncertain parameters: SB-510's site Weibull (wind_climate) with the NEWA
    # mean-speed spread on A (0.54 m/s, as in aep_calculator), k ± 0.15, TI 6 ± 1 %
    if parameters is None:
        from app.services.site_assessment.wind_climate import SB510_WEIBULL_A, SB510_WEIBULL_K

        parameters = [
            UncertainParameter("weibull_a", SB510_WEIBULL_A, 0.54, "gaussian"),
            UncertainParameter("weibull_k", SB510_WEIBULL_K, 0.15, "gaussian"),
            UncertainParameter("turbulence_intensity", 0.06, 0.01, "gaussian"),
        ]

    n_params = len(parameters)

    # Generate LHS samples
    samples = _generate_lhs_samples(parameters, n_samples, seed)

    # Evaluate model at each sample point
    turbine = create_wind_turbine()
    aep_values = np.zeros(n_samples)

    for i in range(n_samples):
        # Extract parameter values for this sample
        param_dict = {}
        for j, param in enumerate(parameters):
            val = float(samples[i, j])
            # Clip to physically valid ranges
            if param.name == "weibull_a":
                val = max(5.0, min(20.0, val))
            elif param.name == "weibull_k":
                val = max(1.2, min(3.5, val))
            elif param.name == "turbulence_intensity":
                val = max(0.02, min(0.20, val))
            param_dict[param.name] = val

        site = create_uniform_site(
            weibull_a_ms=param_dict["weibull_a"],
            weibull_k=param_dict["weibull_k"],
            turbulence_intensity=param_dict.get("turbulence_intensity", 0.06),
        )

        try:
            wake_result: WakeAnalysisResult = run_wake_analysis(
                x_positions_m,
                y_positions_m,
                site,
                turbine,
            )
            aep_values[i] = wake_result.net_aep_gwh
        except Exception:
            aep_values[i] = np.nan

    # Remove failed evaluations
    valid = ~np.isnan(aep_values)
    samples_valid = samples[valid]
    aep_valid = aep_values[valid]

    if len(aep_valid) < 5:
        return PCEResult(
            mean_aep_gwh=0.0,
            std_aep_gwh=0.0,
            cov_percent=0.0,
            p50_gwh=0.0,
            p75_gwh=0.0,
            p90_gwh=0.0,
            pce_order=pce_order,
            num_samples=n_samples,
            sample_aep_values_gwh=aep_values,
        )

    # Standardise: ξ = (x − μ)/σ (Gaussian); uniform inputs span μ ± 2σ → ξ ∈ [−1, 1]
    dists = [p.distribution for p in parameters]
    xi = np.zeros_like(samples_valid)
    for j, param in enumerate(parameters):
        scale = param.std_dev if param.distribution == "gaussian" else 2.0 * param.std_dev
        xi[:, j] = (samples_valid[:, j] - param.nominal) / max(scale, 1e-12)

    basis = _build_polynomial_basis(xi, pce_order, dists)
    coeffs, _residuals, _, _ = np.linalg.lstsq(basis, aep_valid, rcond=None)

    # Orthonormal basis: mean = c_0, variance = Σ c_α² (α ≠ 0)
    mean_aep = float(coeffs[0])
    variance = float(np.sum(coeffs[1:] ** 2))
    std_aep = float(np.sqrt(max(0.0, variance)))

    # Leave-one-out Q²: e_i / (1 − h_ii), h = diag(A (AᵀA)⁻¹ Aᵀ)
    residuals = aep_valid - basis @ coeffs
    leverage = np.einsum("ij,ji->i", basis, np.linalg.pinv(basis))
    loo = residuals / np.clip(1.0 - leverage, 1e-9, None)
    ss_tot = float(np.sum((aep_valid - aep_valid.mean()) ** 2))
    q2_loo = 1.0 - float(np.sum(loo**2)) / ss_tot if ss_tot > 0 else 0.0

    # First-order Sobol indices: terms that involve parameter i only
    indices_list = _multi_indices(n_params, pce_order)
    sobol_indices: list[SobolIndex] = []
    for p_idx, param in enumerate(parameters):
        param_var = sum(
            float(coeffs[t] ** 2)
            for t, idx in enumerate(indices_list)
            if idx[p_idx] > 0 and all(idx[k] == 0 for k in range(n_params) if k != p_idx)
        )
        sobol_indices.append(
            SobolIndex(
                parameter=param.name,
                first_order=round(param_var / variance if variance > 0 else 0.0, 4),
            )
        )

    dominant = max(sobol_indices, key=lambda s: s.first_order).parameter if sobol_indices else ""

    # Exceedance values (assuming Gaussian distribution of AEP)
    z_75 = 0.674
    z_90 = 1.282
    p50 = mean_aep
    p75 = mean_aep - z_75 * std_aep
    p90 = mean_aep - z_90 * std_aep

    # Theoretical maximum AEP for sanity-checking PCE predictions
    n_turbines = len(x_positions_m)
    theoretical_max_gwh = RATED_POWER_KW * 1e-6 * 8760.0 * n_turbines
    # Clamp PCE mean to physical bounds
    mean_aep = min(mean_aep, theoretical_max_gwh)

    cov = std_aep / mean_aep * 100.0 if mean_aep > 0 else 0.0

    return PCEResult(
        mean_aep_gwh=round(mean_aep, 2),
        std_aep_gwh=round(std_aep, 2),
        cov_percent=round(cov, 2),
        p50_gwh=round(p50, 2),
        p75_gwh=round(p75, 2),
        p90_gwh=round(p90, 2),
        sobol_indices=sobol_indices,
        dominant_parameter=dominant,
        pce_order=pce_order,
        num_samples=n_samples,
        q2_loo=round(q2_loo, 4),
        sample_aep_values_gwh=np.round(aep_values, 2),
    )
