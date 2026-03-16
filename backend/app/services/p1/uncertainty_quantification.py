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

where ξ are standardised random variables, Ψ_α are multivariate orthogonal
polynomials (Hermite for Gaussian inputs, Legendre for uniform), and c_α are
the expansion coefficients.

Statistics from PCE coefficients (exact, no sampling needed):
    E[Y] = c_0                              (mean)
    Var[Y] = Σ_{α≠0} c_α²                 (variance)
    Sobol indices: S_i = Σ_{α∈A_i} c_α² / Var[Y]  (sensitivity)

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
    create_v236_wind_turbine,
    run_wake_analysis,
)

# ── PCE Constants ───────────────────────────────────────────────

DEFAULT_PCE_ORDER: int = 3
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
    r_squared : float
        PCE fit quality (coefficient of determination).
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
    r_squared: float = 0.0
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


def _build_polynomial_basis(
    samples_normalised: NDArray[np.floating],
    order: int,
) -> NDArray[np.floating]:
    """Build multivariate polynomial basis matrix (Legendre polynomials).

    Parameters
    ----------
    samples_normalised : NDArray
        Normalised samples in [-1, 1]. Shape: (n_samples, n_params).
    order : int
        Maximum polynomial order.

    Returns
    -------
    NDArray
        Basis matrix. Shape: (n_samples, n_terms).
    """
    n_samples, n_params = samples_normalised.shape

    # Generate multi-index set for total-degree polynomial
    from itertools import product as iter_product

    indices = []
    for combo in iter_product(range(order + 1), repeat=n_params):
        if sum(combo) <= order:
            indices.append(combo)

    n_terms = len(indices)
    basis = np.ones((n_samples, n_terms))

    for t, idx in enumerate(indices):
        for p, deg in enumerate(idx):
            if deg > 0:
                # Legendre polynomial of degree `deg`
                x = samples_normalised[:, p]
                basis[:, t] *= np.polynomial.legendre.legval(x, [0] * deg + [1])

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
    # Default uncertain parameters
    if parameters is None:
        parameters = [
            UncertainParameter("weibull_a", 10.5, 0.5, "gaussian"),
            UncertainParameter("weibull_k", 2.2, 0.15, "gaussian"),
            UncertainParameter("turbulence_intensity", 0.06, 0.01, "gaussian"),
        ]

    n_params = len(parameters)

    # Generate LHS samples
    samples = _generate_lhs_samples(parameters, n_samples, seed)

    # Evaluate model at each sample point
    turbine = create_v236_wind_turbine()
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
            weibull_a_ms=param_dict.get("weibull_a", 10.5),
            weibull_k=param_dict.get("weibull_k", 2.2),
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

    # Normalise samples to [-1, 1]
    samples_norm = np.zeros_like(samples_valid)
    for j, param in enumerate(parameters):
        center = param.nominal
        scale = max(param.std_dev * 2.0, 1e-10)
        samples_norm[:, j] = (samples_valid[:, j] - center) / scale

    # Build polynomial basis
    basis = _build_polynomial_basis(samples_norm, pce_order)

    # Fit PCE coefficients via least squares
    coeffs, _residuals, _, _ = np.linalg.lstsq(basis, aep_valid, rcond=None)

    # PCE statistics
    mean_aep = float(coeffs[0])
    variance = float(np.sum(coeffs[1:] ** 2))
    std_aep = float(np.sqrt(max(0.0, variance)))

    # R² fit quality
    predictions = basis @ coeffs
    ss_res = float(np.sum((aep_valid - predictions) ** 2))
    ss_tot = float(np.sum((aep_valid - np.mean(aep_valid)) ** 2))
    r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    # Compute first-order Sobol indices
    # For each parameter, sum squared coefficients of terms involving only that parameter
    from itertools import product as iter_product

    indices_list = []
    for combo in iter_product(range(pce_order + 1), repeat=n_params):
        if sum(combo) <= pce_order:
            indices_list.append(combo)

    sobol_indices: list[SobolIndex] = []
    for p_idx, param in enumerate(parameters):
        param_var = 0.0
        for t, idx in enumerate(indices_list):
            if t == 0:
                continue  # Skip constant term
            # First-order: only p_idx is nonzero in this multi-index
            is_first_order = idx[p_idx] > 0 and all(
                idx[k] == 0 for k in range(n_params) if k != p_idx
            )
            if is_first_order:
                param_var += coeffs[t] ** 2

        sobol_first = param_var / variance if variance > 0 else 0.0
        sobol_indices.append(
            SobolIndex(
                parameter=param.name,
                first_order=round(sobol_first, 4),
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
        r_squared=round(r_squared, 4),
        sample_aep_values_gwh=np.round(aep_values, 2),
    )
