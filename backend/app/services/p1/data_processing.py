"""
ERA5 wind data preprocessing: u/v decomposition, shear extrapolation, Weibull fitting.

This module implements the physics pipeline that converts raw ERA5 reanalysis
data (u/v wind components at 100m) into hub-height wind statistics for AEP
calculation.

Physics Pipeline
----------------
1. Compute wind speed from u/v components:  ws = sqrt(u² + v²)
2. Compute wind direction (met. convention): wd = atan2(-u, -v) × 180/π + 180
3. Calculate shear exponent from two heights: α = ln(ws₁/ws₂) / ln(h₁/h₂)
4. Extrapolate to hub height (power law):    ws_hub = ws_ref × (h_hub/h_ref)^α
5. Fit Weibull distribution:                 f(v) = (k/A)(v/A)^(k-1) exp(-(v/A)^k)

References
----------
- IEC 61400-12-1: Wind turbine power performance measurement
- ECMWF ERA5: Hourly data on single levels (u100, v100, u10, v10)
- Justus, C.G. et al. (1978): Weibull wind speed distributions

Constants (Baltic Wind Alpha)
-----------------------------
- Hub height: 150 m
- ERA5 reference heights: 10 m, 100 m
- Expected offshore shear exponent: 0.06–0.12
- Expected Baltic Weibull: A ≈ 10.5 m/s, k ≈ 2.2
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
        k ≈ 2.0 is Rayleigh. Baltic offshore typically k ≈ 2.2.
    """

    scale_a_ms: float
    shape_k: float

    @property
    def mean_wind_speed_ms(self) -> float:
        """Mean wind speed from Weibull: E[v] = A × Γ(1 + 1/k)."""
        return float(self.scale_a_ms * gamma(1.0 + 1.0 / self.shape_k))


def compute_wind_speed_ms(
    u_component_ms: NDArray[np.floating],
    v_component_ms: NDArray[np.floating],
) -> NDArray[np.floating]:
    """
    Compute wind speed magnitude from u and v components.

    The ERA5 dataset provides wind as east-west (u) and north-south (v)
    vector components. Wind speed is the magnitude of this vector.

    Parameters
    ----------
    u_component_ms : NDArray
        East-west wind component [m/s]. Positive = westerly (from west).
    v_component_ms : NDArray
        North-south wind component [m/s]. Positive = southerly (from south).

    Returns
    -------
    NDArray
        Wind speed magnitude [m/s]. Always non-negative.
    """
    result: NDArray[np.floating] = np.hypot(u_component_ms, v_component_ms)
    return result


def compute_wind_direction_deg(
    u_component_ms: NDArray[np.floating],
    v_component_ms: NDArray[np.floating],
) -> NDArray[np.floating]:
    """
    Compute meteorological wind direction from u and v components.

    Meteorological convention: direction the wind is coming FROM,
    measured clockwise from north.
    - North wind (from north) = 0°/360°
    - East wind (from east) = 90°
    - South wind (from south) = 180°
    - West wind (from west) = 270°

    Parameters
    ----------
    u_component_ms : NDArray
        East-west wind component [m/s].
    v_component_ms : NDArray
        North-south wind component [m/s].

    Returns
    -------
    NDArray
        Wind direction [deg], 0–360 meteorological convention.
    """
    direction_deg: NDArray[np.floating] = (
        np.degrees(np.arctan2(-u_component_ms, -v_component_ms)) % 360.0
    )
    return direction_deg


def calculate_shear_exponent(
    wind_speed_upper_ms: float,
    wind_speed_lower_ms: float,
    height_upper_m: float = 100.0,
    height_lower_m: float = 10.0,
) -> float:
    """
    Calculate wind shear exponent from two-height wind speed measurements.

    The power law wind profile assumes:
        v(h) = v_ref × (h / h_ref)^α

    Solving for α:
        α = ln(v_upper / v_lower) / ln(h_upper / h_lower)

    Parameters
    ----------
    wind_speed_upper_ms : float
        Wind speed at upper height [m/s]. Must be > 0.
    wind_speed_lower_ms : float
        Wind speed at lower height [m/s]. Must be > 0.
    height_upper_m : float
        Upper measurement height [m]. Default: 100 m (ERA5).
    height_lower_m : float
        Lower measurement height [m]. Default: 10 m (ERA5).

    Returns
    -------
    float
        Shear exponent α [-].
        Typical offshore values: 0.06–0.12.
        Typical onshore values: 0.14–0.25.

    Raises
    ------
    ValueError
        If wind speeds are not positive or heights are invalid.

    References
    ----------
    IEC 61400-12-1, Annex G (Wind shear assessment)
    """
    if wind_speed_upper_ms <= 0 or wind_speed_lower_ms <= 0:
        msg = (
            f"Wind speeds must be positive: "
            f"upper={wind_speed_upper_ms}, lower={wind_speed_lower_ms}"
        )
        raise ValueError(msg)
    if height_upper_m <= height_lower_m:
        msg = f"Upper height ({height_upper_m}) must exceed lower height ({height_lower_m})"
        raise ValueError(msg)

    alpha = np.log(wind_speed_upper_ms / wind_speed_lower_ms) / np.log(
        height_upper_m / height_lower_m
    )
    return float(alpha)


def extrapolate_wind_speed_ms(
    wind_speed_ref_ms: NDArray[np.floating],
    shear_exponent: float,
    target_height_m: float = 150.0,
    reference_height_m: float = 100.0,
) -> NDArray[np.floating]:
    """
    Extrapolate wind speed to target height using the power law.

    Power law profile:
        v(h_target) = v(h_ref) × (h_target / h_ref)^α

    For ERA5 → hub height: 100 m → 150 m with α ≈ 0.10 gives ~4% increase.

    Parameters
    ----------
    wind_speed_ref_ms : NDArray
        Wind speed at reference height [m/s].
    shear_exponent : float
        Wind shear exponent α [-].
    target_height_m : float
        Target extrapolation height [m]. Default: 150 m (V236 hub).
    reference_height_m : float
        Reference measurement height [m]. Default: 100 m (ERA5).

    Returns
    -------
    NDArray
        Extrapolated wind speed at target height [m/s].

    Raises
    ------
    ValueError
        If heights are not positive.
    """
    if target_height_m <= 0 or reference_height_m <= 0:
        msg = f"Heights must be positive: target={target_height_m}, ref={reference_height_m}"
        raise ValueError(msg)

    height_ratio = target_height_m / reference_height_m
    result: NDArray[np.floating] = wind_speed_ref_ms * np.power(height_ratio, shear_exponent)
    return result


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


def preprocess_era5_wind(
    u100_ms: NDArray[np.floating],
    v100_ms: NDArray[np.floating],
    u10_ms: NDArray[np.floating],
    v10_ms: NDArray[np.floating],
    hub_height_m: float = 150.0,
) -> tuple[NDArray[np.floating], NDArray[np.floating], float]:
    """
    Full ERA5 preprocessing pipeline: components → hub-height speed + direction.

    Steps
    -----
    1. Compute wind speed at 100 m and 10 m from u/v components
    2. Compute wind direction at 100 m (meteorological convention)
    3. Calculate mean shear exponent from 10 m / 100 m speeds
    4. Extrapolate 100 m speed to hub height using power law

    Parameters
    ----------
    u100_ms : NDArray
        ERA5 u-component at 100 m [m/s].
    v100_ms : NDArray
        ERA5 v-component at 100 m [m/s].
    u10_ms : NDArray
        ERA5 u-component at 10 m [m/s].
    v10_ms : NDArray
        ERA5 v-component at 10 m [m/s].
    hub_height_m : float
        Target hub height [m]. Default: 150 m.

    Returns
    -------
    wind_speed_hub_ms : NDArray
        Wind speed at hub height [m/s].
    wind_direction_deg : NDArray
        Wind direction at 100 m [deg, meteorological].
    shear_exponent : float
        Mean shear exponent used for extrapolation [-].
    """
    # Step 1: Compute speeds at both heights
    ws_100m = compute_wind_speed_ms(u100_ms, v100_ms)
    ws_10m = compute_wind_speed_ms(u10_ms, v10_ms)

    # Step 2: Wind direction from 100 m components
    wind_direction_deg = compute_wind_direction_deg(u100_ms, v100_ms)

    # Step 3: Mean shear exponent (filter out calm conditions)
    mask = (ws_100m > 1.0) & (ws_10m > 1.0)
    if mask.sum() < 100:
        msg = f"Insufficient non-calm records for shear calculation: {mask.sum()}"
        raise ValueError(msg)

    mean_ws_100m = float(np.mean(ws_100m[mask]))
    mean_ws_10m = float(np.mean(ws_10m[mask]))
    shear_exponent = calculate_shear_exponent(
        wind_speed_upper_ms=mean_ws_100m,
        wind_speed_lower_ms=mean_ws_10m,
        height_upper_m=100.0,
        height_lower_m=10.0,
    )

    # Step 4: Extrapolate to hub height
    wind_speed_hub_ms = extrapolate_wind_speed_ms(
        wind_speed_ref_ms=ws_100m,
        shear_exponent=shear_exponent,
        target_height_m=hub_height_m,
        reference_height_m=100.0,
    )

    return wind_speed_hub_ms, wind_direction_deg, shear_exponent
