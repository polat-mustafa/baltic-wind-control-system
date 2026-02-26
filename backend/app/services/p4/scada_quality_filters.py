"""
SCADA data quality filters for wind farm operational data.

Implements 5 quality filters per Roadmap §5.3. Clean data is essential —
"data quality is more important than model complexity." This module is the
most interview-relevant in the entire P4 pipeline.

Physics — Why Filtering Matters
---------------------------------
Raw SCADA data contains periods where the power-wind relationship is
not representative of normal turbine operation:
  - Curtailment: grid operator limits output, breaking the power curve
  - Maintenance: turbine offline, P=0 regardless of wind
  - Sensor faults: anemometer frozen or power sensor miscalibrated
  - Power curve outliers: transient events distort the P(v) relationship
  - Icing: ice on blades reduces aerodynamic efficiency by 20-50%

Training an ML model on unfiltered data teaches it to predict anomalies
rather than normal operation. Filtering typically removes 8-15% of data.

Standard — IEC 61400-12-1 Data Filtering
------------------------------------------
IEC 61400-12-1 Annex A specifies data exclusion criteria:
  - Remove data where turbine was not in normal operation
  - Remove data with known curtailment or power limitation
  - Remove data with identified sensor malfunctions
  - Apply statistical outlier detection per wind speed bin

Our 5-filter pipeline extends the standard with ML-specific checks:
  Filter 1: Curtailment detection (grid-imposed power limits)
  Filter 2: Maintenance periods (planned/unplanned outages)
  Filter 3: Sensor faults (frozen anemometer + overpower)
  Filter 4: Power curve outliers (IQR per wind speed bin)
  Filter 5: Icing detection (meteorological + performance)

Maths — Filter Thresholds
---------------------------
Filter 3 — Frozen anemometer:
  σ(v) < 0.01 m/s over 6 consecutive timesteps (1 hour)
  Normal 10-min wind speed variation: σ ≈ 0.5-2.0 m/s

Filter 4 — Power curve outlier (IQR method):
  For each 1 m/s wind speed bin:
    Q1 = 25th percentile of power
    Q3 = 75th percentile of power
    IQR = Q3 - Q1
    Valid range: [Q1 - 1.5×IQR, Q3 + 1.5×IQR]

Filter 5 — Icing:
  P_actual < 0.5 × P_expected AND humidity > 95% AND temp < 2°C

References
----------
- IEC 61400-12-1: Power performance measurements (Annex A)
- Roadmap §5.3: Five quality filters
- Staffell & Green, "How does wind farm performance decline with age?"
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum

import numpy as np
from numpy.typing import NDArray

from app.services.p4.turbine_power_curve import (
    build_power_curve,
    get_v236_spec,
    interpolate_power_mw,
)

# ── Enums ─────────────────────────────────────────────────────────


class FilterType(StrEnum):
    """Quality filter categories per Roadmap §5.3."""

    CURTAILMENT = "curtailment"
    MAINTENANCE = "maintenance"
    SENSOR_FAULT = "sensor_fault"
    POWER_CURVE_OUTLIER = "power_curve_outlier"
    ICING = "icing"


# ── Data Classes ──────────────────────────────────────────────────


@dataclass(frozen=True)
class QualityFlag:
    """A single quality flag on a SCADA data point.

    Attributes
    ----------
    filter_type : FilterType
        Which filter flagged this point.
    turbine_index : int
        Turbine column index [0, num_turbines).
    timestep_index : int
        Timestep row index.
    reason : str
        Human-readable explanation of why this point was flagged.
    """

    filter_type: FilterType
    turbine_index: int
    timestep_index: int
    reason: str


@dataclass(frozen=True)
class FilterResult:
    """Result of applying all quality filters to a SCADA dataset.

    Attributes
    ----------
    clean_mask : NDArray[np.bool_]
        Boolean mask, shape (timesteps, turbines). True = clean data.
    flags : list[QualityFlag]
        All individual quality flags raised.
    counts_by_filter : dict[str, int]
        Number of flagged points per filter type.
    total_flagged : int
        Total number of flagged data points.
    total_points : int
        Total number of data points in the dataset.
    availability_pct : float
        Percentage of clean data points (target: 85-92%).
    """

    clean_mask: NDArray[np.bool_]
    flags: list[QualityFlag]
    counts_by_filter: dict[str, int]
    total_flagged: int
    total_points: int
    availability_pct: float


# ── Individual Filter Functions ───────────────────────────────────


def detect_curtailment(
    wind_speed: NDArray[np.float64],
    power: NDArray[np.float64],
    status: NDArray[np.str_],
    cut_in_ms: float = 3.0,
) -> NDArray[np.bool_]:
    """Detect curtailment: P ≈ 0 but wind > cut-in and status ≠ maintenance.

    Curtailment occurs when the grid operator instructs the turbine to
    reduce output despite sufficient wind. The turbine is technically
    operational but not producing power.

    Returns mask where True = flagged as curtailed.
    """
    is_curtailed = (
        (power < 0.1)  # Near-zero power
        & (wind_speed > cut_in_ms)  # Sufficient wind
        & (status != "maintenance")  # Not in maintenance
        & (status != "sensor_fault")  # Not a sensor issue
    )
    return is_curtailed


def detect_maintenance(
    status: NDArray[np.str_],
) -> NDArray[np.bool_]:
    """Detect maintenance periods: status ≠ 'running'.

    Maintenance periods include planned outages, unplanned repairs,
    and any period where the turbine is not in normal operation.

    Returns mask where True = flagged as maintenance.
    """
    return status != "running"


def detect_sensor_faults(
    wind_speed: NDArray[np.float64],
    power: NDArray[np.float64],
    window_size: int = 6,
    std_threshold: float = 0.01,
    overpower_factor: float = 1.05,
    rated_power_mw: float = 15.0,
) -> NDArray[np.bool_]:
    """Detect sensor faults: frozen anemometer OR overpower readings.

    Frozen anemometer: wind speed standard deviation < 0.01 over 6
    consecutive timesteps (1 hour). Normal offshore wind has σ > 0.5 m/s.

    Overpower: power > 105% of rated capacity indicates sensor
    calibration error or data transmission corruption.

    Returns mask where True = flagged as sensor fault.
    """
    num_t, num_turb = wind_speed.shape
    flagged = np.zeros((num_t, num_turb), dtype=np.bool_)

    # Frozen anemometer detection (rolling std < threshold)
    for turb in range(num_turb):
        for t in range(window_size - 1, num_t):
            window = wind_speed[t - window_size + 1 : t + 1, turb]
            if np.std(window) < std_threshold:
                flagged[t - window_size + 1 : t + 1, turb] = True

    # Overpower detection
    overpower = power > overpower_factor * rated_power_mw
    flagged |= overpower

    return flagged


def detect_power_curve_outliers(
    wind_speed: NDArray[np.float64],
    power: NDArray[np.float64],
    bin_width_ms: float = 1.0,
    iqr_multiplier: float = 1.5,
) -> NDArray[np.bool_]:
    """Detect power curve outliers using IQR per wind speed bin.

    Per IEC 61400-12-1 method of bins: group data into 1 m/s wind
    speed bins, compute Q1/Q3/IQR for power in each bin, flag points
    outside [Q1 - 1.5×IQR, Q3 + 1.5×IQR].

    This catches transient events and data corruption that falls
    outside the normal power curve scatter band.

    Returns mask where True = flagged as outlier.
    """
    num_t, num_turb = wind_speed.shape
    flagged = np.zeros((num_t, num_turb), dtype=np.bool_)

    spec = get_v236_spec()
    max_ws = spec.cut_out_speed_ms + 2.0
    bin_edges = np.arange(0.0, max_ws + bin_width_ms, bin_width_ms)

    for turb in range(num_turb):
        ws_col = wind_speed[:, turb]
        pwr_col = power[:, turb]

        for b in range(len(bin_edges) - 1):
            bin_mask = (ws_col >= bin_edges[b]) & (ws_col < bin_edges[b + 1])
            bin_indices = np.where(bin_mask)[0]

            if len(bin_indices) < 10:
                continue  # Skip sparse bins

            bin_power = pwr_col[bin_indices]
            q1 = np.percentile(bin_power, 25)
            q3 = np.percentile(bin_power, 75)
            iqr = q3 - q1

            lower = q1 - iqr_multiplier * iqr
            upper = q3 + iqr_multiplier * iqr

            outliers = (bin_power < lower) | (bin_power > upper)
            flagged[bin_indices[outliers], turb] = True

    return flagged


def detect_icing(
    power: NDArray[np.float64],
    wind_speed: NDArray[np.float64],
    temperature: NDArray[np.float64],
    humidity: NDArray[np.float64],
    expected_power_fraction: float = 0.5,
    temp_threshold_c: float = 2.0,
    humidity_threshold_pct: float = 95.0,
) -> NDArray[np.bool_]:
    """Detect icing events: low power + cold + high humidity.

    Ice accumulation on turbine blades reduces lift and increases drag,
    causing power output to drop 20-50% below the expected power curve.

    Conditions: P < 50% of expected AND humidity > 95% AND temp < 2°C

    Returns mask where True = flagged as icing.
    """
    curve = build_power_curve()
    num_t, num_turb = power.shape
    flagged = np.zeros((num_t, num_turb), dtype=np.bool_)

    for turb in range(num_turb):
        expected = interpolate_power_mw(wind_speed[:, turb], curve)
        # Avoid division issues — only check where we expect meaningful power
        meaningful = expected > 0.5  # At least 0.5 MW expected

        below_expected = power[:, turb] < expected_power_fraction * expected
        cold = temperature[:, turb] < temp_threshold_c
        humid = humidity[:, turb] > humidity_threshold_pct

        flagged[:, turb] = meaningful & below_expected & cold & humid

    return flagged


# ── Combined Filter Pipeline ─────────────────────────────────────


def apply_all_quality_filters(
    wind_speed: NDArray[np.float64],
    power: NDArray[np.float64],
    status: NDArray[np.str_],
    temperature: NDArray[np.float64],
    humidity: NDArray[np.float64],
) -> FilterResult:
    """Apply all 5 quality filters and produce a combined clean mask.

    Filters are applied independently and results are OR-combined.
    A data point flagged by any filter is excluded from the clean set.

    Target availability after filtering: 85-92%.

    Parameters
    ----------
    wind_speed : NDArray, shape (timesteps, turbines)
        Hub-height wind speed [m/s].
    power : NDArray, shape (timesteps, turbines)
        Active power output [MW].
    status : NDArray, shape (timesteps, turbines)
        Operational status strings.
    temperature : NDArray, shape (timesteps, turbines)
        Ambient temperature [°C].
    humidity : NDArray, shape (timesteps, turbines)
        Relative humidity [%].

    Returns
    -------
    FilterResult
        Combined result with clean_mask and per-filter statistics.
    """
    # Apply each filter independently
    curtailment_mask = detect_curtailment(wind_speed, power, status)
    maintenance_mask = detect_maintenance(status)
    sensor_mask = detect_sensor_faults(wind_speed, power)
    outlier_mask = detect_power_curve_outliers(wind_speed, power)
    icing_mask = detect_icing(power, wind_speed, temperature, humidity)

    # Combine: any flag → not clean
    any_flagged = curtailment_mask | maintenance_mask | sensor_mask | outlier_mask | icing_mask
    clean_mask = ~any_flagged

    # Build detailed flags list (sampled for memory efficiency)
    flags: list[QualityFlag] = []
    filter_masks = {
        FilterType.CURTAILMENT: curtailment_mask,
        FilterType.MAINTENANCE: maintenance_mask,
        FilterType.SENSOR_FAULT: sensor_mask,
        FilterType.POWER_CURVE_OUTLIER: outlier_mask,
        FilterType.ICING: icing_mask,
    }

    counts: dict[str, int] = {}
    for ftype, mask in filter_masks.items():
        count = int(np.sum(mask))
        counts[ftype.value] = count

        # Store first 100 flags per filter type (avoid memory explosion)
        indices = np.argwhere(mask)
        for idx in indices[:100]:
            flags.append(
                QualityFlag(
                    filter_type=ftype,
                    turbine_index=int(idx[1]),
                    timestep_index=int(idx[0]),
                    reason=f"{ftype.value} detected",
                )
            )

    total_points = wind_speed.shape[0] * wind_speed.shape[1]
    total_flagged = int(np.sum(any_flagged))
    availability = 100.0 * (1.0 - total_flagged / total_points) if total_points > 0 else 0.0

    return FilterResult(
        clean_mask=clean_mask,
        flags=flags,
        counts_by_filter=counts,
        total_flagged=total_flagged,
        total_points=total_points,
        availability_pct=round(availability, 2),
    )
