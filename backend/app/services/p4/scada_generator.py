"""
Synthetic SCADA data generator for 34 × V236-15.0 MW Baltic Sea wind farm.

Generates one year of 10-minute SCADA records with realistic anomalies,
providing the training dataset for all P4 ML models (XGBoost, LSTM, TFT).

Physics — Wind Speed Statistics in the Baltic Sea
---------------------------------------------------
Offshore wind speeds follow a Weibull distribution:

  f(v) = (k/a) × (v/a)^(k-1) × exp(-(v/a)^k)

where:
  a = scale parameter [m/s] — related to mean wind speed
  k = shape parameter [-] — describes distribution spread

For the Polish Baltic Sea at 140 m hub height:
  a ≈ 10.5 m/s (mean ≈ 9.3 m/s)
  k ≈ 2.2 (slightly more peaked than Rayleigh k=2)

Wind speed autocorrelation: consecutive 10-minute averages are highly
correlated (ρ ≈ 0.95). We model this with an AR(1) process:
  v(t) = φ × v(t-1) + (1-φ) × v_weibull(t)

Spatial correlation: turbines within the same farm see similar wind
but with perturbations (±5-10%) due to wake effects and local terrain.

Standard — IEC 61400-12-1 Recording Requirements
--------------------------------------------------
SCADA records follow IEC 61400-12-1:
  - 10-minute averaging period
  - Hub-height wind speed (anemometer on nacelle, corrected)
  - Active power output at turbine terminals
  - Ambient temperature, humidity, pressure
  - Wind direction (nacelle-mounted vane)
  - Turbine operational status

Maths — Anomaly Injection Rates
---------------------------------
Realistic SCADA datasets contain several types of anomalies:
  - Curtailment: ~2% of timesteps — P=0 despite sufficient wind
  - Maintenance: ~3% — multi-hour zero-power blocks
  - Frozen anemometer: ~0.5% — constant wind reading > 1 hour
  - Overpower: occasional P > P_rated × 1.05 (sensor calibration)
  - Icing: ~1% — power below curve at high humidity + low temperature

These anomalies must be detected and removed by the quality filters
(scada_quality_filters.py) before model training.

References
----------
- IEC 61400-12-1: Power performance measurements
- Carta et al., "A review of wind speed probability distributions"
- Weibull parameters for Baltic Sea: WindEurope site data
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy.signal import lfilter, lfilter_zi

from app.services.p4.turbine_power_curve import (
    build_power_curve,
    get_v236_spec,
    interpolate_power_mw,
)

# ── Constants ─────────────────────────────────────────────────────

MINUTES_PER_YEAR: int = 525_600  # 365.25 × 24 × 60
STEPS_PER_YEAR: int = MINUTES_PER_YEAR // 10  # 52,560 ten-minute intervals
HOURS_PER_YEAR: float = 8_766.0  # 365.25 × 24


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class SCADAConfig:
    """Configuration for synthetic SCADA data generation.

    Attributes
    ----------
    num_turbines : int
        Number of turbines in the farm.
    num_timesteps : int
        Number of 10-minute intervals to generate.
    weibull_a : float
        Weibull scale parameter [m/s].
    weibull_k : float
        Weibull shape parameter [-].
    ar1_phi : float
        AR(1) autocorrelation coefficient [0, 1).
    turbine_perturbation : float
        Turbine-to-turbine wind speed variation (fraction of mean).
    curtailment_rate : float
        Fraction of timesteps with curtailment events.
    maintenance_rate : float
        Fraction of timesteps under maintenance.
    frozen_anemometer_rate : float
        Fraction of timesteps with frozen anemometer.
    overpower_rate : float
        Fraction of timesteps with overpower readings.
    icing_rate : float
        Fraction of timesteps with icing events.
    seed : int | None
        Random seed for reproducibility.
    """

    num_turbines: int = 34
    num_timesteps: int = STEPS_PER_YEAR
    weibull_a: float = 10.5
    weibull_k: float = 2.2
    ar1_phi: float = 0.95
    turbine_perturbation: float = 0.08
    curtailment_rate: float = 0.02
    maintenance_rate: float = 0.03
    frozen_anemometer_rate: float = 0.005
    overpower_rate: float = 0.003
    icing_rate: float = 0.01
    seed: int | None = 42


@dataclass(frozen=True)
class SCADADataset:
    """Complete synthetic SCADA dataset for the wind farm.

    All arrays have shape (num_timesteps, num_turbines) unless noted.
    Timestamps array has shape (num_timesteps,).

    Attributes
    ----------
    timestamps : NDArray[np.int64]
        Unix timestamps (seconds) for each 10-minute interval.
    wind_speed_ms : NDArray[np.float64]
        Hub-height wind speed [m/s].
    power_mw : NDArray[np.float64]
        Active power output [MW].
    wind_direction_deg : NDArray[np.float64]
        Wind direction [0, 360) degrees.
    temperature_c : NDArray[np.float64]
        Ambient temperature [°C].
    humidity_pct : NDArray[np.float64]
        Relative humidity [0, 100] %.
    pressure_pa : NDArray[np.float64]
        Atmospheric pressure [Pa].
    status : NDArray[np.str_]
        Operational status per timestep per turbine.
    config : SCADAConfig
        Configuration used for generation.
    """

    timestamps: NDArray[np.int64]
    wind_speed_ms: NDArray[np.float64]
    power_mw: NDArray[np.float64]
    wind_direction_deg: NDArray[np.float64]
    temperature_c: NDArray[np.float64]
    humidity_pct: NDArray[np.float64]
    pressure_pa: NDArray[np.float64]
    status: NDArray[np.str_]
    config: SCADAConfig


# ── Generator Functions ───────────────────────────────────────────


def _generate_base_wind(
    rng: np.random.Generator,
    config: SCADAConfig,
) -> NDArray[np.float64]:
    """Generate temporally correlated wind speed using AR(1) + Weibull.

    The AR(1) process produces realistic autocorrelation between consecutive
    10-minute averages. The Weibull distribution ensures correct long-term
    wind speed statistics.
    """
    # Base Weibull samples
    weibull_raw = rng.weibull(config.weibull_k, size=config.num_timesteps)
    weibull_scaled = config.weibull_a * weibull_raw

    # AR(1) temporal smoothing via IIR filter:
    #   wind[t] = phi * wind[t-1] + (1 - phi) * weibull[t]
    # This is equivalent to: y = lfilter(b=[1-phi], a=[1, -phi], x=weibull)
    phi = config.ar1_phi
    b = np.array([1.0 - phi])
    a = np.array([1.0, -phi])
    zi = lfilter_zi(b, a) * weibull_scaled[0]
    wind, _ = lfilter(b, a, weibull_scaled, zi=zi)

    # Ensure non-negative
    wind_clamped: NDArray[np.float64] = np.maximum(wind, 0.0)
    return wind_clamped


def _perturb_wind_per_turbine(
    rng: np.random.Generator,
    base_wind: NDArray[np.float64],
    config: SCADAConfig,
) -> NDArray[np.float64]:
    """Add turbine-to-turbine wind speed variation.

    Each turbine sees slightly different wind due to wake effects,
    micro-siting, and local atmospheric conditions.
    """
    num_t = config.num_timesteps
    num_turb = config.num_turbines
    wind_farm = np.zeros((num_t, num_turb), dtype=np.float64)

    for turb in range(num_turb):
        perturbation = 1.0 + rng.normal(0, config.turbine_perturbation, size=num_t)
        wind_farm[:, turb] = base_wind * perturbation

    return np.maximum(wind_farm, 0.0)


def _generate_wind_direction(
    rng: np.random.Generator,
    num_timesteps: int,
    num_turbines: int,
) -> NDArray[np.float64]:
    """Generate wind direction with realistic temporal persistence.

    Baltic Sea predominant wind: ~240° (WSW) with seasonal variation.
    """
    # Base direction with slow drift — vectorized via cumulative sum
    drifts = rng.normal(0, 2.0, size=num_timesteps)
    base_dir = (240.0 + np.concatenate([[0.0], np.cumsum(drifts[:-1])])) % 360.0

    # Small per-turbine variation
    wd = np.zeros((num_timesteps, num_turbines), dtype=np.float64)
    for turb in range(num_turbines):
        offset = rng.normal(0, 3.0, size=num_timesteps)
        wd[:, turb] = (base_dir + offset) % 360.0

    return wd


def _generate_ambient_conditions(
    rng: np.random.Generator,
    num_timesteps: int,
    num_turbines: int,
) -> tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.float64]]:
    """Generate temperature, humidity, and pressure time series.

    Baltic Sea annual cycle:
      - Temperature: mean 8°C, seasonal ±12°C amplitude
      - Humidity: mean 80%, higher in winter
      - Pressure: mean 101325 Pa, weather-system variation ±2000 Pa
    """
    # Time fraction through the year [0, 1]
    t_frac = np.arange(num_timesteps, dtype=np.float64) / num_timesteps

    # Temperature: seasonal cycle + weather noise
    temp_seasonal = 8.0 + 12.0 * np.sin(2.0 * np.pi * (t_frac - 0.25))
    temp_noise = rng.normal(0, 3.0, size=num_timesteps)
    temp_base = temp_seasonal + temp_noise

    # Expand to per-turbine (same ambient for all, tiny variation)
    temperature = np.broadcast_to(temp_base[:, np.newaxis], (num_timesteps, num_turbines)).copy()
    temperature += rng.normal(0, 0.5, size=(num_timesteps, num_turbines))

    # Humidity: higher in cold months
    humid_base = 80.0 - 15.0 * np.sin(2.0 * np.pi * (t_frac - 0.25))
    humid_noise = rng.normal(0, 5.0, size=num_timesteps)
    humidity = np.broadcast_to(
        (humid_base + humid_noise)[:, np.newaxis], (num_timesteps, num_turbines)
    ).copy()
    humidity = np.clip(humidity, 0.0, 100.0)

    # Pressure: slow weather-system variation
    pressure_base = (
        101_325.0
        + 2000.0 * np.sin(2.0 * np.pi * 5.0 * t_frac)
        + rng.normal(0, 500.0, size=num_timesteps)
    )
    pressure = np.broadcast_to(pressure_base[:, np.newaxis], (num_timesteps, num_turbines)).copy()

    return temperature, humidity, pressure


def _inject_anomalies(
    rng: np.random.Generator,
    wind_speed: NDArray[np.float64],
    power: NDArray[np.float64],
    temperature: NDArray[np.float64],
    humidity: NDArray[np.float64],
    status: NDArray[np.str_],
    config: SCADAConfig,
) -> None:
    """Inject realistic SCADA anomalies in-place.

    Anomalies are injected per-turbine with rates matching real-world
    operational data. Each anomaly type is independently applied.
    """
    num_t, num_turb = power.shape
    spec = get_v236_spec()

    for turb in range(num_turb):
        # Curtailment: power forced to 0 while wind > cut-in (vectorized)
        n_curtail = int(num_t * config.curtailment_rate)
        curtail_indices = rng.choice(num_t, size=n_curtail, replace=False)
        valid = curtail_indices[wind_speed[curtail_indices, turb] > spec.cut_in_speed_ms]
        power[valid, turb] = 0.0
        status[valid, turb] = "curtailed"

        # Maintenance: multi-hour blocks (12-48 consecutive timesteps)
        n_maint_events = max(1, int(num_t * config.maintenance_rate / 24))
        for _ in range(n_maint_events):
            start = rng.integers(0, num_t - 48)
            duration = rng.integers(12, 48)
            end = min(start + duration, num_t)
            power[start:end, turb] = 0.0
            status[start:end, turb] = "maintenance"

        # Frozen anemometer: constant wind reading for > 1 hour
        n_frozen = max(1, int(num_t * config.frozen_anemometer_rate / 12))
        for _ in range(n_frozen):
            start = rng.integers(0, num_t - 12)
            duration = rng.integers(7, 18)  # 70-180 minutes
            end = min(start + duration, num_t)
            frozen_val = wind_speed[start, turb]
            wind_speed[start:end, turb] = frozen_val
            status[start:end, turb] = "sensor_fault"

        # Overpower: occasional readings > P_rated × 1.05 (vectorized)
        n_overpower = int(num_t * config.overpower_rate)
        overpower_indices = rng.choice(num_t, size=n_overpower, replace=False)
        high = overpower_indices[power[overpower_indices, turb] > spec.rated_power_mw * 0.8]
        power[high, turb] = spec.rated_power_mw * rng.uniform(1.05, 1.12, size=len(high))

        # Icing: power below curve when cold and humid (vectorized)
        n_icing = int(num_t * config.icing_rate)
        icing_candidates = np.where((temperature[:, turb] < 2.0) & (humidity[:, turb] > 90.0))[0]
        if len(icing_candidates) > 0:
            n_actual = min(n_icing, len(icing_candidates))
            icing_indices = rng.choice(icing_candidates, size=n_actual, replace=False)
            power[icing_indices, turb] *= rng.uniform(0.1, 0.4, size=len(icing_indices))
            status[icing_indices, turb] = "icing"


def generate_scada_dataset(config: SCADAConfig | None = None) -> SCADADataset:
    """Generate a complete synthetic SCADA dataset for the wind farm.

    Produces 1 year of 10-minute data for all turbines, with realistic
    wind statistics, power curve response, and injected anomalies.

    Parameters
    ----------
    config : SCADAConfig, optional
        Generation parameters. Defaults to Baltic Sea reference case.

    Returns
    -------
    SCADADataset
        Complete dataset ready for quality filtering and feature engineering.
    """
    if config is None:
        config = SCADAConfig()

    rng = np.random.default_rng(config.seed)

    # 1. Generate base wind speed (temporal correlation)
    base_wind = _generate_base_wind(rng, config)

    # 2. Perturb per turbine (spatial variation)
    wind_speed = _perturb_wind_per_turbine(rng, base_wind, config)

    # 3. Compute power from power curve
    curve = build_power_curve()
    power = np.zeros_like(wind_speed)
    for turb in range(config.num_turbines):
        power[:, turb] = interpolate_power_mw(wind_speed[:, turb], curve)

    # Add realistic noise to power (±2% measurement noise)
    power_noise = rng.normal(1.0, 0.02, size=power.shape)
    power = power * power_noise
    power = np.maximum(power, 0.0)

    # 4. Wind direction
    wind_direction = _generate_wind_direction(rng, config.num_timesteps, config.num_turbines)

    # 5. Ambient conditions
    temperature, humidity, pressure = _generate_ambient_conditions(
        rng, config.num_timesteps, config.num_turbines
    )

    # 6. Initialize status
    status = np.full((config.num_timesteps, config.num_turbines), "running", dtype="U20")

    # 7. Inject anomalies
    _inject_anomalies(rng, wind_speed, power, temperature, humidity, status, config)

    # 8. Generate timestamps (2024-01-01 00:00 UTC start, 600s intervals)
    start_epoch = 1_704_067_200  # 2024-01-01T00:00:00Z
    timestamps = np.arange(
        start_epoch,
        start_epoch + config.num_timesteps * 600,
        600,
        dtype=np.int64,
    )

    return SCADADataset(
        timestamps=timestamps,
        wind_speed_ms=wind_speed,
        power_mw=power,
        wind_direction_deg=wind_direction,
        temperature_c=temperature,
        humidity_pct=humidity,
        pressure_pa=pressure,
        status=status,
        config=config,
    )
