"""
Physical feature engineering for wind power forecasting.

Transforms raw SCADA measurements into ML-ready features with
physical meaning. Every feature must be explainable to a domain expert.

Physics — Why Feature Engineering Matters
-------------------------------------------
Raw SCADA channels (wind speed, direction, temperature) are necessary
but not sufficient for accurate power forecasting. The key relationships:

  - Turbulence intensity (σ_v / μ_v) affects power extraction efficiency.
    High TI → more fatigue loads but also more energy at low speeds.
  - Air density (ρ = P/RT) varies ±10% seasonally in the Baltic,
    directly scaling available power: P ∝ ρ × v³.
  - Wind direction changes reduce power capture as the yaw system
    tracks the wind with a lag (typical yaw rate: 0.3-0.5 °/s).
  - Wake effects depend on wind direction relative to farm layout.

Standard — IEC 61400-1 Turbulence Intensity
----------------------------------------------
IEC 61400-1 defines turbulence intensity:
  TI = σ_1 / V_hub

where σ_1 is the standard deviation of wind speed over the averaging
period (10 minutes) and V_hub is the mean hub-height wind speed.

IEC 61400-1 Ed.4 turbulence classes:
  Class A: I_ref = 0.16 (high turbulence, complex terrain)
  Class B: I_ref = 0.14 (medium turbulence)
  Class C: I_ref = 0.12 (low turbulence, offshore)

Baltic offshore sites typically fall in Class C (I_ref ≈ 0.06-0.10).

Maths — Feature Formulas
--------------------------
Rolling statistics (window = 6 steps = 1 hour):
  ws_mean_1h = (1/6) × Σ v(t-5..t)
  ws_std_1h = std(v(t-5..t))

Turbulence intensity:
  TI = ws_std_1h / ws_mean_1h  (undefined when ws_mean → 0)

Wind direction change rate (with wrap-around):
  Δwd = wd(t) - wd(t-1), adjusted for 360°→0° wrap
  wd_change_rate = |Δwd| / Δt

Cyclical encoding (no discontinuity at boundaries):
  hour_sin = sin(2π × hour / 24)
  hour_cos = cos(2π × hour / 24)
  month_sin = sin(2π × month / 12)
  month_cos = cos(2π × month / 12)

Power lag features (autocorrelation):
  power_lag_k = P(t-k) for k ∈ {1, 2, 3, 4, 5, 6}

Wake direction indicator:
  wake_indicator = cos(wd - farm_alignment)
  farm_alignment ≈ 210° (typical Baltic array axis)

References
----------
- IEC 61400-1: Design requirements for wind turbines
- Roadmap §5.5: Feature engineering table
- Clifton et al., "Using machine learning for wind power forecasting"
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.p4.turbine_power_curve import R_DRY

# ── Constants ─────────────────────────────────────────────────────

DEFAULT_ROLLING_WINDOW: int = 6  # 6 × 10 min = 1 hour
DEFAULT_NUM_LAGS: int = 6
DEFAULT_FARM_ALIGNMENT_DEG: float = 210.0  # Typical Baltic array axis
SECONDS_PER_10MIN: int = 600


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class FeatureConfig:
    """Configuration for feature engineering pipeline.

    Attributes
    ----------
    rolling_window : int
        Number of timesteps for rolling statistics (default 6 = 1 hour).
    num_lags : int
        Number of power lag features to create.
    farm_alignment_deg : float
        Farm array alignment direction [degrees].
    """

    rolling_window: int = DEFAULT_ROLLING_WINDOW
    num_lags: int = DEFAULT_NUM_LAGS
    farm_alignment_deg: float = DEFAULT_FARM_ALIGNMENT_DEG


@dataclass(frozen=True)
class EngineeredFeatures:
    """Complete set of engineered features for one turbine.

    Attributes
    ----------
    feature_matrix : NDArray[np.float64]
        Shape (valid_timesteps, num_features). No NaN values.
    feature_names : list[str]
        Column names for the feature matrix.
    valid_timesteps : int
        Number of rows after dropping NaN from lag/rolling features.
    dropped_timesteps : int
        Number of rows dropped (start of series).
    """

    feature_matrix: NDArray[np.float64]
    feature_names: list[str]
    valid_timesteps: int
    dropped_timesteps: int


# ── Individual Feature Compute Functions ──────────────────────────


def compute_rolling_stats(
    values: NDArray[np.float64],
    window: int = DEFAULT_ROLLING_WINDOW,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Compute rolling mean and standard deviation.

    Returns arrays with NaN for the first (window-1) elements where
    the full window is not available. These NaN values propagate to
    the final feature matrix and are dropped (not filled).

    Parameters
    ----------
    values : NDArray
        Input time series, shape (timesteps,).
    window : int
        Rolling window size.

    Returns
    -------
    tuple of (rolling_mean, rolling_std)
        Both shape (timesteps,), with NaN for first (window-1) elements.
    """
    n = len(values)
    roll_mean = np.full(n, np.nan, dtype=np.float64)
    roll_std = np.full(n, np.nan, dtype=np.float64)

    for t in range(window - 1, n):
        w = values[t - window + 1 : t + 1]
        roll_mean[t] = np.mean(w)
        roll_std[t] = np.std(w, ddof=0)

    return roll_mean, roll_std


def compute_turbulence_intensity(
    ws_mean: NDArray[np.float64],
    ws_std: NDArray[np.float64],
    min_wind: float = 0.5,
) -> NDArray[np.float64]:
    """Compute IEC 61400-1 turbulence intensity: TI = σ / μ.

    When mean wind speed is near zero, TI is undefined. We set TI=0
    for ws_mean < min_wind to avoid division by zero.
    """
    ti = np.zeros_like(ws_mean)
    valid = ws_mean >= min_wind
    ti[valid] = ws_std[valid] / ws_mean[valid]
    # Preserve NaN from rolling stats
    nan_mask = np.isnan(ws_mean) | np.isnan(ws_std)
    ti[nan_mask] = np.nan
    return ti


def compute_wind_direction_change_rate(
    wind_direction_deg: NDArray[np.float64],
) -> NDArray[np.float64]:
    """Compute wind direction change rate with 360°→0° wrap-around.

    Uses the shortest angular distance between consecutive readings.
    First element is NaN (no previous direction available).

    Returns
    -------
    NDArray
        Absolute direction change rate [degrees per 10-min step].
    """
    n = len(wind_direction_deg)
    rate = np.full(n, np.nan, dtype=np.float64)

    for t in range(1, n):
        delta = wind_direction_deg[t] - wind_direction_deg[t - 1]
        # Wrap to [-180, 180]
        delta = (delta + 180.0) % 360.0 - 180.0
        rate[t] = abs(delta)

    return rate


def compute_air_density_array(
    pressure_pa: NDArray[np.float64],
    temperature_c: NDArray[np.float64],
) -> NDArray[np.float64]:
    """Compute air density array from pressure and temperature.

    ρ = P / (R_dry × T_K), where T_K = T_C + 273.15
    """
    temperature_k = temperature_c + 273.15
    # Guard against invalid temperatures
    temperature_k = np.maximum(temperature_k, 200.0)
    return pressure_pa / (R_DRY * temperature_k)


def compute_cyclical_time_features(
    timestamps: NDArray[np.int64],
) -> tuple[
    NDArray[np.float64],
    NDArray[np.float64],
    NDArray[np.float64],
    NDArray[np.float64],
]:
    """Compute cyclical hour and month encoding from Unix timestamps.

    Cyclical encoding prevents the ML model from seeing hour 23 and
    hour 0 as maximally distant. sin²(x) + cos²(x) = 1 always.

    Returns
    -------
    tuple of (hour_sin, hour_cos, month_sin, month_cos)
    """
    # Convert to datetime components
    # Hours: seconds since midnight / 3600
    seconds_in_day = timestamps % 86400
    hours = seconds_in_day / 3600.0

    # Approximate month from day-of-year
    # seconds since Jan 1 / seconds per day / 30.44 (avg days per month)
    day_of_year = (timestamps % (365 * 86400)) / 86400.0
    month_approx = day_of_year / 30.44  # [0, ~12)

    hour_sin = np.sin(2.0 * np.pi * hours / 24.0)
    hour_cos = np.cos(2.0 * np.pi * hours / 24.0)
    month_sin = np.sin(2.0 * np.pi * month_approx / 12.0)
    month_cos = np.cos(2.0 * np.pi * month_approx / 12.0)

    return hour_sin, hour_cos, month_sin, month_cos


def compute_power_lags(
    power: NDArray[np.float64],
    num_lags: int = DEFAULT_NUM_LAGS,
) -> NDArray[np.float64]:
    """Compute power lag features: P(t-1) through P(t-num_lags).

    Critical rule: No future leakage. Lag features create NaN at the
    start of the series. These NaN rows are dropped, not filled.

    Returns
    -------
    NDArray
        Shape (timesteps, num_lags). Column k contains P(t-k-1).
    """
    n = len(power)
    lags = np.full((n, num_lags), np.nan, dtype=np.float64)

    for k in range(num_lags):
        shift = k + 1
        lags[shift:, k] = power[:-shift]

    return lags


def compute_wake_direction_indicator(
    wind_direction_deg: NDArray[np.float64],
    farm_alignment_deg: float = DEFAULT_FARM_ALIGNMENT_DEG,
) -> NDArray[np.float64]:
    """Compute wake direction indicator: cos(wd - farm_alignment).

    When wind is aligned with the farm array (+1 or -1), wake effects
    are strongest. When perpendicular (0), wake effects are minimal.

    Returns
    -------
    NDArray
        Values in [-1, 1]. |value| near 1 = strong wake potential.
    """
    angle_diff_rad = np.radians(wind_direction_deg - farm_alignment_deg)
    result: NDArray[np.float64] = np.cos(angle_diff_rad)
    return result


# ── Main Feature Engineering Pipeline ─────────────────────────────


def engineer_features(
    wind_speed: NDArray[np.float64],
    power: NDArray[np.float64],
    wind_direction: NDArray[np.float64],
    temperature: NDArray[np.float64],
    pressure: NDArray[np.float64],
    humidity: NDArray[np.float64],
    timestamps: NDArray[np.int64],
    clean_mask: NDArray[np.bool_],
    turbine_index: int = 0,
    config: FeatureConfig | None = None,
) -> EngineeredFeatures:
    """Run the complete feature engineering pipeline for one turbine.

    Applies clean mask first, then computes all features, then drops
    rows with any NaN (from rolling/lag features at series start).

    Parameters
    ----------
    wind_speed : NDArray, shape (timesteps, turbines)
        Hub-height wind speed [m/s].
    power : NDArray, shape (timesteps, turbines)
        Active power [MW].
    wind_direction : NDArray, shape (timesteps, turbines)
        Wind direction [degrees].
    temperature : NDArray, shape (timesteps, turbines)
        Ambient temperature [°C].
    pressure : NDArray, shape (timesteps, turbines)
        Atmospheric pressure [Pa].
    humidity : NDArray, shape (timesteps, turbines)
        Relative humidity [%].
    timestamps : NDArray, shape (timesteps,)
        Unix timestamps.
    clean_mask : NDArray, shape (timesteps, turbines)
        Boolean mask from quality filters. True = clean.
    turbine_index : int
        Which turbine column to process.
    config : FeatureConfig, optional
        Feature engineering parameters.

    Returns
    -------
    EngineeredFeatures
        Feature matrix with no NaN values.
    """
    if config is None:
        config = FeatureConfig()

    # Extract single-turbine columns, filtered by clean mask
    mask = clean_mask[:, turbine_index]
    ws = wind_speed[mask, turbine_index]
    pwr = power[mask, turbine_index]
    wd = wind_direction[mask, turbine_index]
    temp = temperature[mask, turbine_index]
    press = pressure[mask, turbine_index]
    humid = humidity[mask, turbine_index]
    ts = timestamps[mask]

    # Compute all features
    ws_mean, ws_std = compute_rolling_stats(ws, config.rolling_window)
    ti = compute_turbulence_intensity(ws_mean, ws_std)
    wd_rate = compute_wind_direction_change_rate(wd)
    air_density = compute_air_density_array(press, temp)
    hour_sin, hour_cos, month_sin, month_cos = compute_cyclical_time_features(ts)
    power_lags = compute_power_lags(pwr, config.num_lags)
    wake_indicator = compute_wake_direction_indicator(wd, config.farm_alignment_deg)

    # Build feature names
    feature_names = [
        "wind_speed_ms",
        "ws_mean_1h",
        "ws_std_1h",
        "turbulence_intensity",
        "wind_direction_deg",
        "wd_change_rate",
        "air_density_kg_m3",
        "temperature_c",
        "humidity_pct",
        "hour_sin",
        "hour_cos",
        "month_sin",
        "month_cos",
        "wake_direction_indicator",
    ]
    for k in range(config.num_lags):
        feature_names.append(f"power_lag_{k + 1}")

    # Stack into feature matrix
    base_features = np.column_stack(
        [
            ws,
            ws_mean,
            ws_std,
            ti,
            wd,
            wd_rate,
            air_density,
            temp,
            humid,
            hour_sin,
            hour_cos,
            month_sin,
            month_cos,
            wake_indicator,
        ]
    )
    feature_matrix = np.hstack([base_features, power_lags])

    # Drop rows with any NaN (no future leakage — never fill)
    valid_rows = ~np.any(np.isnan(feature_matrix), axis=1)
    feature_matrix = feature_matrix[valid_rows]

    total_timesteps = len(ws)
    valid_count = feature_matrix.shape[0]

    return EngineeredFeatures(
        feature_matrix=feature_matrix,
        feature_names=feature_names,
        valid_timesteps=valid_count,
        dropped_timesteps=total_timesteps - valid_count,
    )
