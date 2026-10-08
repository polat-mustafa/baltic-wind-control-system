"""
Synthetic SCADA data generator for SB-510: 34 × 15 MW "V236 class" turbines
(IEA 15 MW reference turbine) at the MSP energy basin PZP_44, Polish Baltic.

Generates one year of 10-minute SCADA records with realistic anomalies,
providing the training dataset for all P4 ML models (XGBoost, LSTM, TFT).

Physics — Wind Speed Statistics in the Baltic Sea
---------------------------------------------------
Offshore wind speeds follow a Weibull distribution:

  f(v) = (k/a) × (v/a)^(k-1) × exp(-(v/a)^k)

where:
  a = scale parameter [m/s] — related to mean wind speed
  k = shape parameter [-] — describes distribution spread

At SB-510, 150 m hub height (region pack, ``sb510_wind()``): NEWA mean 9.57 m/s,
k = 2.04 → a = 10.80 m/s; direction rose from ERA5 100 m 2020–2024 (peak 270°).

Persistence: a Gaussian process z(t) carries the time correlation and is mapped
through the Weibull quantile function, so the marginal distribution stays exactly
Weibull (an AR(1) filter on Weibull samples would shrink the spread to
√((1−φ)/(1+φ)) of it):
  z(t) = φ·z(t−1) + √(1−φ²)·ε(t),   v = a·(−ln(1 − Φ(z)))^(1/k)
φ is fitted to ERA5 at the site: 0.9572 per hour (lags 1–24 h) = 0.99274 per
10 minutes. Wind direction follows the rose through a two-stage filtered Gaussian
process (0.985 and 0.70 per hour) fitted to the ERA5 direction changes: median
|Δθ| 4° in 1 h, 17° in 6 h, 39° in 24 h. Power uses the air density of each
record (IEC 61400-12-1 wind-speed normalisation, ``build_power_curve``).

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
- Site climate: NEWA (Hahmann et al. 2020, Dörenkämper et al. 2020) and ERA5
  (Hersbach et al. 2020) via ``site_assessment.wind_climate``
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray
from scipy.signal import lfilter
from scipy.special import ndtr

from app.services.p1.turbine_models import get_turbine
from app.services.p4.turbine_power_curve import (
    R_DRY,
    STANDARD_AIR_DENSITY,
    get_turbine_spec,
)
from app.services.site_assessment.wind_climate import SB510_PERSISTENCE_1H, sb510_wind

# ── Constants ─────────────────────────────────────────────────────

MINUTES_PER_YEAR: int = 525_600  # 365.25 × 24 × 60
STEPS_PER_YEAR: int = MINUTES_PER_YEAR // 10  # 52,560 ten-minute intervals
HOURS_PER_YEAR: float = 8_766.0  # 365.25 × 24
STEPS_PER_HOUR: int = 6
#: Two-stage filter of the direction process, per hour, fitted to ERA5 at SB-510
#: (median |Δθ| 1 h 4.0°, 6 h 17°, 24 h 39°; model 3.7°, 16.8°, 40.4°).
DIRECTION_FILTER_1H: tuple[float, float] = (0.985, 0.70)
#: Turbulence intensity offshore (as the windIO export and PyWake runs) and the IEC
#: 61400-1 longitudinal integral scale above 60 m [m]: the sampling error of 10-min means.
TI_OFFSHORE: float = 0.06
LAMBDA_1_M: float = 42.0


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
        10-minute AR(1) coefficient of the Gaussian persistence process [0, 1).
    rose : tuple[float, ...]
        12-sector direction frequencies (wind FROM, centres 0°, 30°, …), sum 1.
    turbine_perturbation : float
        Persistent turbine-to-turbine wind deviation (1σ, fraction of the farm wind) —
        assumption of the order of the per-turbine wake-loss spread.
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
    weibull_a: float = field(default_factory=lambda: sb510_wind().a_ms)
    weibull_k: float = field(default_factory=lambda: sb510_wind().k)
    ar1_phi: float = SB510_PERSISTENCE_1H ** (1.0 / STEPS_PER_HOUR)
    rose: tuple[float, ...] = field(
        default_factory=lambda: sb510_wind().frequencies or (1.0 / 12,) * 12
    )
    turbine_perturbation: float = 0.05
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


def _gaussian_ar(rng: np.random.Generator, n: int, phis: tuple[float, ...]) -> NDArray[np.float64]:
    """Unit-variance Gaussian series: white noise through first-order filters ``phis``."""
    x = rng.standard_normal(n + 2000)  # 2000-step spin-up, then dropped
    for phi in phis:
        x = lfilter([1.0 - phi], [1.0, -phi], x)
    z = x[2000:]
    return np.asarray((z - z.mean()) / z.std(), dtype=np.float64)


def _generate_base_wind(
    rng: np.random.Generator,
    config: SCADAConfig,
) -> NDArray[np.float64]:
    """Farm wind speed with the site Weibull marginal and ERA5 persistence.

    z(t) is a Gaussian AR(1) process (10-minute coefficient ``ar1_phi``) and
    v = a·(−ln(1 − Φ(z)))^(1/k) its Weibull quantile — the long-term distribution is
    exactly Weibull(a, k), the time correlation that of z.
    """
    z = _gaussian_ar(rng, config.num_timesteps, (config.ar1_phi,))
    u = np.clip(ndtr(z), 1e-12, 1.0 - 1e-12)
    wind: NDArray[np.float64] = config.weibull_a * (-np.log1p(-u)) ** (1.0 / config.weibull_k)
    return wind


def _perturb_wind_per_turbine(
    rng: np.random.Generator,
    base_wind: NDArray[np.float64],
    config: SCADAConfig,
) -> NDArray[np.float64]:
    """Turbine wind = farm wind × (1 + persistent deviation + 10-minute sampling error).

    - Persistent deviation (σ = ``turbine_perturbation``): wake and siting differences,
      which change with the wind direction, so they carry the direction's persistence
      (``DIRECTION_FILTER_1H``). Not a wake model — wake losses are computed in P1.
    - Sampling error of a 10-minute mean: σ_u·√(2·T/600 s) with σ_u = TI·v (TI 0.06
      offshore) and T = Λ₁/v (IEC 61400-1: Λ₁ = 42 m above 60 m) → 0.73 % at 9.5 m/s.
    """
    num_t = config.num_timesteps
    num_turb = config.num_turbines
    wind_farm = np.zeros((num_t, num_turb), dtype=np.float64)
    phis = tuple(p ** (1.0 / STEPS_PER_HOUR) for p in DIRECTION_FILTER_1H)

    for turb in range(num_turb):
        site = config.turbine_perturbation * _gaussian_ar(rng, num_t, phis)
        sampling = (
            TI_OFFSHORE
            * np.sqrt(2.0 * LAMBDA_1_M / np.maximum(base_wind, 1.0) / 600.0)
            * rng.standard_normal(num_t)
        )
        wind_farm[:, turb] = base_wind * (1.0 + site + sampling)

    return np.maximum(wind_farm, 0.0)


def _generate_wind_direction(
    rng: np.random.Generator,
    num_timesteps: int,
    num_turbines: int,
    rose: tuple[float, ...] | None = None,
) -> NDArray[np.float64]:
    """Wind direction [deg, FROM] with the site rose as marginal and ERA5 persistence.

    A smooth Gaussian process (two first-order filters, ``DIRECTION_FILTER_1H``
    per hour) is mapped through the circular quantile function of the 12-sector
    rose; each turbine's vane adds ±3° (1σ).
    """
    f = np.asarray(rose if rose is not None else sb510_wind().frequencies, dtype=np.float64)
    f = f / f.sum()
    edges = np.arange(len(f) + 1) * (360.0 / len(f)) - 180.0 / len(f)
    cdf = np.concatenate(([0.0], np.cumsum(f)))
    phis = tuple(p ** (1.0 / STEPS_PER_HOUR) for p in DIRECTION_FILTER_1H)
    z = _gaussian_ar(rng, num_timesteps, phis)
    base_dir = np.interp(ndtr(z), cdf, edges) % 360.0

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
    spec = get_turbine_spec()

    for turb in range(num_turb):
        # Curtailment: power forced to 0 while wind > cut-in (vectorized)
        n_curtail = int(num_t * config.curtailment_rate)
        curtail_indices = rng.choice(num_t, size=n_curtail, replace=False)
        valid = curtail_indices[wind_speed[curtail_indices, turb] > spec.cut_in_speed_ms]
        power[valid, turb] = 0.0
        status[valid, turb] = "curtailed"

        # Maintenance: multi-hour blocks (12-48 consecutive timesteps).
        # Honour rate=0 exactly (previously a max(1, ...) guard forced at least
        # one maintenance block per turbine, which made "healthy" scenarios
        # contain forced zero-power stretches). When rate > 0 but truncation
        # yields 0, keep at least one event so small nonzero rates still inject.
        n_maint_events = int(num_t * config.maintenance_rate / 24)
        if config.maintenance_rate > 0 and n_maint_events == 0:
            n_maint_events = 1
        for _ in range(n_maint_events):
            if num_t <= 48:
                break
            start = rng.integers(0, num_t - 48)
            duration = rng.integers(12, 48)
            end = min(start + duration, num_t)
            power[start:end, turb] = 0.0
            status[start:end, turb] = "maintenance"

        # Frozen anemometer: constant wind reading for > 1 hour.
        # Same rate=0 semantics as maintenance above.
        n_frozen = int(num_t * config.frozen_anemometer_rate / 12)
        if config.frozen_anemometer_rate > 0 and n_frozen == 0:
            n_frozen = 1
        for _ in range(n_frozen):
            if num_t <= 12:
                break
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

    # 3. Ambient conditions (they set the air density of each record)
    temperature, humidity, pressure = _generate_ambient_conditions(
        rng, config.num_timesteps, config.num_turbines
    )

    # 4. Power from the official table at the density-normalised wind speed
    #    v·(ρ/ρ₀)^(1/3) (IEC 61400-12-1 §9.1.5); cut-in / cut-out on the measured wind
    spec = get_turbine_spec()
    model = get_turbine(spec.model_id)
    rho = pressure / (R_DRY * (temperature + 273.15))
    v_norm = wind_speed * (rho / STANDARD_AIR_DENSITY) ** (1.0 / 3.0)
    power = np.interp(v_norm, model.ws_ms, model.power_kw) / 1e3
    running = (wind_speed >= spec.cut_in_speed_ms) & (wind_speed <= spec.cut_out_speed_ms)
    power = np.where(running, np.clip(power, 0.0, spec.rated_power_mw), 0.0)

    # Measurement noise (±2 %, 1σ)
    power_noise = rng.normal(1.0, 0.02, size=power.shape)
    power = power * power_noise
    power = np.maximum(power, 0.0)

    # 5. Wind direction
    wind_direction = _generate_wind_direction(
        rng, config.num_timesteps, config.num_turbines, config.rose
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
