"""
Synthetic NWP (Numerical Weather Prediction) data generator for ML forecasting.

Generates ECMWF HRES-like forecast fields aligned to 10-minute SCADA timestamps,
providing additional weather features for XGBoost and LSTM power forecasting models.

Physics — NWP Models and Wind Power Forecasting
--------------------------------------------------
Numerical Weather Prediction models solve the primitive atmospheric equations
(Navier-Stokes + thermodynamics + moisture) on a discrete grid:

  ∂u/∂t + u·∇u = -∇p/ρ + f×u + F_turb  (momentum)
  ∂T/∂t + u·∇T = Q/cp + (g/cp)·w        (thermodynamics)
  ∂q/∂t + u·∇q = E - C                    (moisture)

ECMWF HRES (High-Resolution forecast) runs at ~9 km horizontal resolution,
137 vertical levels, and produces forecasts out to 10 days with 1-hour
temporal resolution.

Hub-height wind speed extraction uses the power-law wind profile:
  v(z) = v(z_ref) × (z / z_ref)^α

where α ≈ 0.11 for offshore (IEC 61400-1 Ed.4), z = 140 m (V236 hub height),
and z_ref = 100 m (typical NWP output level).

Standard — ECMWF HRES Forecast Variables
------------------------------------------
Key NWP variables for wind power forecasting:
  - 100 m wind speed [m/s] — primary predictor
  - 100 m wind direction [°] — wake and yaw effects
  - 2 m temperature [°C] — air density correction
  - Mean sea level pressure [Pa] — air density via ρ = P/(R·T)
  - Boundary layer height [m] — turbulence regime indicator

Forecast skill degrades with lead time. For offshore wind, typical RMSE:
  - 0-6 h: 1.0-1.5 m/s (persistence competitive)
  - 6-24 h: 1.5-2.5 m/s (NWP adds value)
  - 24-72 h: 2.5-4.0 m/s (ensemble spread increases)
  - >72 h: 4.0+ m/s (low predictability events dominate)

Maths — Synthetic NWP with Correlated Forecast Error
------------------------------------------------------
We generate NWP wind speed correlated with SCADA "truth" but with
Gaussian noise that increases with lead time:

  v_nwp(t) = v_scada(t) + ε(t)
  ε(t) ~ N(0, σ_base + σ_growth × lead_hour(t))

where σ_base = 0.5 m/s (analysis error) and σ_growth = 0.1 m/s/hour
(forecast degradation rate).

References
----------
- ECMWF IFS documentation: https://www.ecmwf.int/en/forecasts
- IEC 61400-1 Ed.4: Design requirements, wind profile models
- Roadmap §5.6: NWP data integration pipeline
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

# ── Constants ─────────────────────────────────────────────────────

NWP_FEATURE_NAMES: list[str] = [
    "nwp_wind_speed_100m_ms",
    "nwp_wind_direction_100m_deg",
    "nwp_temperature_2m_c",
    "nwp_pressure_msl_pa",
    "nwp_boundary_layer_height_m",
]

OFFSHORE_WIND_SHEAR_ALPHA: float = 0.11  # IEC 61400-1 Ed.4 offshore
NWP_REF_HEIGHT_M: float = 100.0
HUB_HEIGHT_M: float = 140.0
SECONDS_PER_10MIN: int = 600


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class NWPConfig:
    """Configuration for synthetic NWP data generation.

    Attributes
    ----------
    num_timesteps : int
        Number of 10-minute intervals (must match SCADA timestamps).
    sigma_base_ms : float
        Base forecast error standard deviation [m/s].
        Represents analysis/initialization error.
    sigma_growth_ms_per_hour : float
        Forecast error growth rate [m/s per hour].
        Simulates NWP skill degradation with lead time.
    forecast_horizon_hours : float
        Maximum lead time for the NWP forecast [hours].
    mean_temperature_c : float
        Mean 2 m temperature [°C] for Baltic Sea.
    mean_pressure_pa : float
        Mean sea-level pressure [Pa].
    mean_blh_m : float
        Mean boundary layer height [m].
    seed : int | None
        Random seed for reproducibility.
    """

    num_timesteps: int = 52_560
    sigma_base_ms: float = 0.5
    sigma_growth_ms_per_hour: float = 0.1
    forecast_horizon_hours: float = 48.0
    mean_temperature_c: float = 8.0
    mean_pressure_pa: float = 101_325.0
    mean_blh_m: float = 800.0
    seed: int | None = 42


@dataclass(frozen=True)
class NWPDataset:
    """Synthetic NWP forecast dataset aligned to SCADA timestamps.

    All arrays have shape (num_timesteps,).

    Attributes
    ----------
    wind_speed_100m_ms : NDArray[np.float64]
        NWP 100 m wind speed forecast [m/s].
    wind_direction_100m_deg : NDArray[np.float64]
        NWP 100 m wind direction forecast [0, 360) degrees.
    temperature_2m_c : NDArray[np.float64]
        NWP 2 m temperature forecast [°C].
    pressure_msl_pa : NDArray[np.float64]
        NWP mean sea-level pressure forecast [Pa].
    boundary_layer_height_m : NDArray[np.float64]
        NWP boundary layer height forecast [m].
    timestamps_utc : NDArray[np.int64]
        Unix timestamps matching SCADA timestamps.
    """

    wind_speed_100m_ms: NDArray[np.float64]
    wind_direction_100m_deg: NDArray[np.float64]
    temperature_2m_c: NDArray[np.float64]
    pressure_msl_pa: NDArray[np.float64]
    boundary_layer_height_m: NDArray[np.float64]
    timestamps_utc: NDArray[np.int64]


# ── Generator Functions ───────────────────────────────────────────


def _generate_nwp_wind_speed(
    rng: np.random.Generator,
    scada_wind_ms: NDArray[np.float64],
    config: NWPConfig,
) -> NDArray[np.float64]:
    """Generate NWP wind speed with correlated forecast error.

    The NWP forecast tracks the SCADA "truth" but with increasing
    Gaussian noise that simulates real NWP skill degradation.
    """
    n = len(scada_wind_ms)

    # Simulate lead-time-dependent error
    # Cycle through forecast horizons (NWP issued every 6 h → 36 steps)
    steps_per_cycle = int(config.forecast_horizon_hours * 6)  # 6 steps/hour
    if steps_per_cycle < 1:
        steps_per_cycle = 1

    lead_hours = np.zeros(n, dtype=np.float64)
    for t in range(n):
        step_in_cycle = t % steps_per_cycle
        lead_hours[t] = step_in_cycle / 6.0  # Convert steps to hours

    # Error grows with lead time: σ(t) = σ_base + σ_growth × lead_hour
    sigma = config.sigma_base_ms + config.sigma_growth_ms_per_hour * lead_hours
    noise = rng.normal(0.0, sigma)

    nwp_wind = scada_wind_ms + noise
    return np.maximum(nwp_wind, 0.0)


def _generate_nwp_wind_direction(
    rng: np.random.Generator,
    num_timesteps: int,
) -> NDArray[np.float64]:
    """Generate NWP wind direction forecast.

    Uses the same approach as SCADA direction: predominant WSW (240°)
    with slow drift and small forecast perturbation.
    """
    direction = np.zeros(num_timesteps, dtype=np.float64)
    direction[0] = 240.0

    for t in range(1, num_timesteps):
        drift = rng.normal(0, 2.5)
        direction[t] = (direction[t - 1] + drift) % 360.0

    return direction


def _generate_nwp_temperature(
    rng: np.random.Generator,
    num_timesteps: int,
    mean_temp: float,
) -> NDArray[np.float64]:
    """Generate NWP 2 m temperature forecast with seasonal cycle."""
    t_frac = np.arange(num_timesteps, dtype=np.float64) / num_timesteps
    seasonal = mean_temp + 12.0 * np.sin(2.0 * np.pi * (t_frac - 0.25))
    noise = rng.normal(0, 2.0, size=num_timesteps)
    return seasonal + noise


def _generate_nwp_pressure(
    rng: np.random.Generator,
    num_timesteps: int,
    mean_pressure: float,
) -> NDArray[np.float64]:
    """Generate NWP mean sea-level pressure with weather-system variation."""
    t_frac = np.arange(num_timesteps, dtype=np.float64) / num_timesteps
    weather_systems = 2000.0 * np.sin(2.0 * np.pi * 5.0 * t_frac)
    noise = rng.normal(0, 400.0, size=num_timesteps)
    return mean_pressure + weather_systems + noise


def _generate_nwp_blh(
    rng: np.random.Generator,
    num_timesteps: int,
    mean_blh: float,
) -> NDArray[np.float64]:
    """Generate NWP boundary layer height with diurnal cycle.

    BLH is typically higher during daytime (convective mixing) and
    lower at night (stable boundary layer). Offshore BLH shows less
    diurnal variation than onshore due to thermal inertia of water.
    """
    t_frac = np.arange(num_timesteps, dtype=np.float64) / num_timesteps
    # Weak diurnal cycle (offshore) + seasonal variation
    hours = (np.arange(num_timesteps) % 144) / 6.0  # 144 steps = 1 day
    diurnal = 200.0 * np.sin(2.0 * np.pi * hours / 24.0)
    seasonal = 300.0 * np.sin(2.0 * np.pi * (t_frac - 0.25))
    noise = rng.normal(0, 100.0, size=num_timesteps)
    blh = mean_blh + diurnal + seasonal + noise
    return np.maximum(blh, 50.0)  # BLH never below 50 m


# ── Public API ────────────────────────────────────────────────────


def generate_nwp_dataset(
    config: NWPConfig | None = None,
    scada_wind_ms: NDArray[np.float64] | None = None,
    timestamps: NDArray[np.int64] | None = None,
) -> NWPDataset:
    """Generate a complete synthetic NWP forecast dataset.

    If scada_wind_ms is provided, the NWP wind speed is generated with
    correlation to the SCADA measurement (plus forecast error). If not
    provided, an independent wind time series is generated.

    Parameters
    ----------
    config : NWPConfig, optional
        Generation parameters. Defaults to Baltic Sea reference case.
    scada_wind_ms : NDArray[np.float64], optional
        Reference SCADA wind speed for one turbine, shape (timesteps,).
        Used to create correlated NWP forecasts.
    timestamps : NDArray[np.int64], optional
        Unix timestamps. If None, generates from 2024-01-01.

    Returns
    -------
    NWPDataset
        Complete NWP forecast dataset.
    """
    if config is None:
        config = NWPConfig()

    rng = np.random.default_rng(config.seed)

    # Generate timestamps if not provided
    if timestamps is None:
        start_epoch = 1_704_067_200  # 2024-01-01T00:00:00Z
        timestamps = np.arange(
            start_epoch,
            start_epoch + config.num_timesteps * SECONDS_PER_10MIN,
            SECONDS_PER_10MIN,
            dtype=np.int64,
        )

    n = len(timestamps)

    # Generate NWP wind speed
    if scada_wind_ms is not None:
        wind_speed = _generate_nwp_wind_speed(rng, scada_wind_ms[:n], config)
    else:
        # Independent generation: Weibull + noise
        base = rng.weibull(2.2, size=n) * 10.5
        wind_speed = np.maximum(base, 0.0)

    wind_direction = _generate_nwp_wind_direction(rng, n)
    temperature = _generate_nwp_temperature(rng, n, config.mean_temperature_c)
    pressure = _generate_nwp_pressure(rng, n, config.mean_pressure_pa)
    blh = _generate_nwp_blh(rng, n, config.mean_blh_m)

    return NWPDataset(
        wind_speed_100m_ms=wind_speed,
        wind_direction_100m_deg=wind_direction,
        temperature_2m_c=temperature,
        pressure_msl_pa=pressure,
        boundary_layer_height_m=blh,
        timestamps_utc=timestamps,
    )


def merge_nwp_features(
    scada_features: NDArray[np.float64],
    nwp_dataset: NWPDataset,
    valid_indices: int | None = None,
) -> NDArray[np.float64]:
    """Merge NWP features into the SCADA feature matrix.

    Appends 5 NWP columns to the right side of the existing SCADA
    feature matrix. The NWP arrays are trimmed to match the number
    of valid SCADA rows (after quality filtering + feature engineering).

    Parameters
    ----------
    scada_features : NDArray[np.float64]
        SCADA feature matrix, shape (valid_timesteps, num_scada_features).
    nwp_dataset : NWPDataset
        NWP dataset (full length — will be trimmed from the end).
    valid_indices : int, optional
        Number of valid SCADA timesteps. If None, uses scada_features rows.

    Returns
    -------
    NDArray[np.float64]
        Combined feature matrix, shape (valid_timesteps, num_scada + 5).
    """
    n_rows = scada_features.shape[0]

    # Take the LAST n_rows from NWP (SCADA drops early rows due to lags)
    offset = len(nwp_dataset.wind_speed_100m_ms) - n_rows
    if offset < 0:
        msg = (
            f"NWP dataset ({len(nwp_dataset.wind_speed_100m_ms)} steps) is shorter "
            f"than SCADA features ({n_rows} rows)"
        )
        raise ValueError(msg)

    nwp_columns = np.column_stack(
        [
            nwp_dataset.wind_speed_100m_ms[offset : offset + n_rows],
            nwp_dataset.wind_direction_100m_deg[offset : offset + n_rows],
            nwp_dataset.temperature_2m_c[offset : offset + n_rows],
            nwp_dataset.pressure_msl_pa[offset : offset + n_rows],
            nwp_dataset.boundary_layer_height_m[offset : offset + n_rows],
        ]
    )

    merged: NDArray[np.float64] = np.hstack([scada_features, nwp_columns])
    return merged
