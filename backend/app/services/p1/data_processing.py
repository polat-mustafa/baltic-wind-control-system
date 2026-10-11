"""
Weibull fitting of hub-height wind speeds.

    f(v) = (k/A)(v/A)^(k-1) exp(-(v/A)^k),   E[v] = A·Γ(1 + 1/k)

Used by the wind rose (sector Weibull fits). The site wind itself comes from the
NEWA atlas at 150 m (``site_assessment.wind_climate``; SB-510: A ≈ 10.80 m/s,
k ≈ 2.04). (The ERA5 u/v and shear-extrapolation helpers had no caller and were
removed on 2026-10-11.)

References
----------
- IEC 61400-12-1: Wind turbine power performance measurement
- Justus, C.G. et al. (1978): Weibull wind speed distributions
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy.special import gamma
from scipy.stats import weibull_min


@dataclass(frozen=True)
class WeibullParameters:
    """Weibull distribution fit result.

    Attributes
    ----------
    scale_a_ms : float
        Scale parameter A [m/s]. Related to mean wind speed.
    shape_k : float
        Shape parameter k [-]. Higher k = narrower distribution.
        k ≈ 2.0 is Rayleigh (SB-510 site: 2.04).
    """

    scale_a_ms: float
    shape_k: float

    @property
    def mean_wind_speed_ms(self) -> float:
        """Mean wind speed from Weibull: E[v] = A × Γ(1 + 1/k)."""
        return float(self.scale_a_ms * gamma(1.0 + 1.0 / self.shape_k))


def fit_weibull(
    wind_speed_ms: NDArray[np.floating],
    min_speed_ms: float = 0.5,
) -> WeibullParameters:
    """
    Fit a two-parameter Weibull distribution to wind speed data.

    The Weibull PDF is:
        f(v) = (k/A) × (v/A)^(k-1) × exp(-(v/A)^k)

    where A is the scale parameter (related to mean speed) and k is
    the shape parameter (distribution width). For the Baltic Sea at
    150 m hub height, we expect A ≈ 10.5 m/s, k ≈ 2.2.

    Parameters
    ----------
    wind_speed_ms : NDArray
        Array of wind speed measurements [m/s].
    min_speed_ms : float
        Minimum speed threshold — calms below this are filtered.
        Default: 0.5 m/s.

    Returns
    -------
    WeibullParameters
        Fitted scale (A) and shape (k) parameters.

    Raises
    ------
    ValueError
        If insufficient data points after filtering.

    References
    ----------
    Justus, C.G. et al. (1978): Methods for estimating wind speed
    frequency distributions. Journal of Applied Meteorology, 17, 350–353.
    """
    # Filter calm periods (near-zero speeds distort the fit)
    valid_speeds = wind_speed_ms[wind_speed_ms >= min_speed_ms]

    if len(valid_speeds) < 100:
        msg = f"Insufficient data for Weibull fit: {len(valid_speeds)} points (need ≥ 100)"
        raise ValueError(msg)

    # scipy.stats.weibull_min uses the parameterisation:
    #   f(x, c, loc, scale) = c/scale × (x/scale)^(c-1) × exp(-(x/scale)^c)
    # where c = shape (k), scale = scale (A), loc = location (fix at 0)
    shape_k, _loc, scale_a = weibull_min.fit(valid_speeds, floc=0)

    return WeibullParameters(
        scale_a_ms=float(scale_a),
        shape_k=float(shape_k),
    )


def compute_weibull_pdf(
    wind_speed_bins_ms: NDArray[np.floating],
    weibull_params: WeibullParameters,
) -> NDArray[np.floating]:
    """
    Compute Weibull probability density at given wind speed bins.

    Parameters
    ----------
    wind_speed_bins_ms : NDArray
        Wind speed bin centres [m/s].
    weibull_params : WeibullParameters
        Fitted Weibull A and k parameters.

    Returns
    -------
    NDArray
        Probability density at each bin centre [1/(m/s)].
    """
    k = weibull_params.shape_k
    a = weibull_params.scale_a_ms
    result: NDArray[np.floating] = weibull_min.pdf(wind_speed_bins_ms, k, loc=0, scale=a)
    return result
