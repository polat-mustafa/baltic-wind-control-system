"""
SCADA Historian service for 510 MW Baltic Sea OWF.

Generates deterministic time-series SCADA measurement data for the
Historian panel. In a real system, these values would be read from
TimescaleDB (PostgreSQL extension). Here, we synthesise realistic
waveforms using sinusoidal + stochastic models so the platform can
operate without a live database.

Physics — Why a Historian Matters
-----------------------------------
A SCADA historian is a time-series database that stores every
measurement at the configured scan rate (typically 1-10 seconds).
For a 510 MW offshore wind farm with ~34 turbines, the data volume is:

  Tags per turbine: ~150 (power, voltage, current, temperature, ...)
  Total tags:       ~5,100 (turbines + OSS + substation)
  Scan rate:        4 s (typical IEC 61400-25 report rate)
  Data rate:        ~1,275 points/second ≈ 110 M points/day

TimescaleDB handles this via:
  1. Automatic partitioning by time (hypertables)
  2. Native compression after configurable delay (7 days here)
  3. Continuous aggregates: pre-computed 1-min, 1-hr rollups for dashboards

Standard — IEC 61400-25 Report Rate
-------------------------------------
The IEC 61400-25 standard defines the wind turbine SCADA interface.
Report rates (configurable on the IED):

  Fast:   1 s  — protection, trip signals
  Normal: 4 s  — operational values (power, speed, voltage)
  Slow:   60 s — temperature, counters
  Event:  on-change — alarms, status changes (Boolean values)

Architecture — Tiered Storage
--------------------------------
Per section 4.10 of the Project Roadmap:

  Raw values:     90-day retention (at configured scan rate)
  1-min averages: 2-year retention (TimescaleDB continuous aggregate)
  1-hr averages:  Lifetime retention

Data Generation Model
-----------------------
Each tag uses a composition of:

  1. Slow trend:  sine wave with period 6-12 hours (weather front passing)
  2. Fast noise:  higher-frequency oscillation (turbulence, grid fluctuations)
  3. DC offset:   nominal operating point

  y(t) = offset + A_slow × sin(2π × t / T_slow + φ_slow)
                + A_fast × sin(2π × t / T_fast + φ_fast)
                + A_noise × N(0,1) × dt

The noise term is omitted here (deterministic for reproducibility).

References
----------
- IEC 61400-25: Communications for monitoring and control of wind power plants
- IEC 62443-3-3: Security requirements for control systems (historian access)
- TimescaleDB Documentation: timescaledb.io
- CIGRE TB 809 (2020): SCADA for large wind power plants
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import StrEnum

# ── Tag Registry ─────────────────────────────────────────────────────


class HistorianTag(StrEnum):
    """Available SCADA historian tags for the 510 MW Baltic Wind Alpha OWF.

    Tag naming follows IEC 61400-25 / IEC 61850-7-4 conventions:
      BWA = Baltic Wind Alpha (farm prefix)
      OSS = Offshore SubStation
      WTG = Wind Turbine Generator
      Logical node names: MMXU (measurement), WMET (meteorological), etc.
    """

    # ── OSS Power System Measurements ─────────────────────────────
    OSS_TOTAL_POWER_MW = "BWA.OSS.MMXU1.TotW"
    OSS_REACTIVE_POWER_MVAR = "BWA.OSS.MMXU1.TotVAr"
    OSS_FREQUENCY_HZ = "BWA.OSS.MMXU1.Hz"
    OSS_VOLTAGE_PU = "BWA.OSS.MMXU1.PhV.A"
    OSS_CURRENT_KA = "BWA.OSS.MMXU1.A.phsA"

    # ── STATCOM Measurements ───────────────────────────────────────
    STATCOM_Q_MVAR = "BWA.OSS.STATCOM1.TotVAr"
    STATCOM_UTIL_PCT = "BWA.OSS.STATCOM1.Util"

    # ── Wind Meteorological ────────────────────────────────────────
    WTG01_WIND_SPEED = "BWA.WTG_01.WMET1.WdSpd"
    WTG01_POWER_MW = "BWA.WTG_01.WGEN1.TotW"

    # ── Array Cable (66 kV) ────────────────────────────────────────
    ARRAY_CABLE_CURRENT_A = "BWA.OSS.XCBR_66KV.A.phsA"


@dataclass(frozen=True)
class TagMetadata:
    """Engineering metadata for a historian tag."""

    tag: HistorianTag
    display_name: str
    description: str
    unit: str
    nominal: float  # Typical operating value
    range_min: float  # Physical minimum (hard limit)
    range_max: float  # Physical maximum (hard limit)
    # Waveform parameters for data synthesis
    amplitude_slow: float  # Amplitude of slow sinusoidal trend
    period_slow_h: float  # Period of slow trend [hours]
    phase_slow_rad: float  # Phase offset of slow trend [radians]
    amplitude_fast: float  # Amplitude of fast oscillation
    period_fast_h: float  # Period of fast oscillation [hours]
    phase_fast_rad: float  # Phase offset of fast oscillation


# ── Tag Definitions ─────────────────────────────────────────────────

TAG_REGISTRY: dict[HistorianTag, TagMetadata] = {
    HistorianTag.OSS_TOTAL_POWER_MW: TagMetadata(
        tag=HistorianTag.OSS_TOTAL_POWER_MW,
        display_name="Farm Output",
        description="Total active power at PCC (220 kV offshore busbar) [MMXU1.TotW]",
        unit="MW",
        nominal=400.0,
        range_min=0.0,
        range_max=510.0,
        amplitude_slow=120.0,
        period_slow_h=8.0,
        phase_slow_rad=0.0,
        amplitude_fast=15.0,
        period_fast_h=0.5,
        phase_fast_rad=1.2,
    ),
    HistorianTag.OSS_REACTIVE_POWER_MVAR: TagMetadata(
        tag=HistorianTag.OSS_REACTIVE_POWER_MVAR,
        display_name="Reactive Power",
        description="Total reactive power injected at PCC [MMXU1.TotVAr]",
        unit="MVAR",
        nominal=0.0,
        range_min=-120.0,
        range_max=120.0,
        amplitude_slow=40.0,
        period_slow_h=6.0,
        phase_slow_rad=0.8,
        amplitude_fast=8.0,
        period_fast_h=0.3,
        phase_fast_rad=2.1,
    ),
    HistorianTag.OSS_FREQUENCY_HZ: TagMetadata(
        tag=HistorianTag.OSS_FREQUENCY_HZ,
        display_name="Grid Frequency",
        description="Frequency at PCC (PSE grid reference) [MMXU1.Hz]",
        unit="Hz",
        nominal=50.0,
        range_min=49.0,
        range_max=51.0,
        amplitude_slow=0.08,
        period_slow_h=3.0,
        phase_slow_rad=1.5,
        amplitude_fast=0.03,
        period_fast_h=0.1,
        phase_fast_rad=0.5,
    ),
    HistorianTag.OSS_VOLTAGE_PU: TagMetadata(
        tag=HistorianTag.OSS_VOLTAGE_PU,
        display_name="220 kV Voltage",
        description="Voltage magnitude at 220 kV OSS busbar [MMXU1.PhV.A, per-unit]",
        unit="pu",
        nominal=1.005,
        range_min=0.95,
        range_max=1.05,
        amplitude_slow=0.012,
        period_slow_h=10.0,
        phase_slow_rad=3.1,
        amplitude_fast=0.003,
        period_fast_h=0.2,
        phase_fast_rad=0.9,
    ),
    HistorianTag.OSS_CURRENT_KA: TagMetadata(
        tag=HistorianTag.OSS_CURRENT_KA,
        display_name="220 kV Current",
        description="Phase A current at 220 kV export cable [MMXU1.A.phsA]",
        unit="kA",
        nominal=1.05,
        range_min=0.0,
        range_max=1.60,
        amplitude_slow=0.30,
        period_slow_h=8.0,
        phase_slow_rad=0.0,
        amplitude_fast=0.04,
        period_fast_h=0.5,
        phase_fast_rad=1.2,
    ),
    HistorianTag.STATCOM_Q_MVAR: TagMetadata(
        tag=HistorianTag.STATCOM_Q_MVAR,
        display_name="STATCOM Output",
        description="STATCOM reactive power (negative = absorbing) [STATCOM1.TotVAr]",
        unit="MVAR",
        nominal=-30.0,
        range_min=-120.0,
        range_max=120.0,
        amplitude_slow=35.0,
        period_slow_h=7.0,
        phase_slow_rad=4.2,
        amplitude_fast=6.0,
        period_fast_h=0.25,
        phase_fast_rad=3.8,
    ),
    HistorianTag.STATCOM_UTIL_PCT: TagMetadata(
        tag=HistorianTag.STATCOM_UTIL_PCT,
        display_name="STATCOM Utilisation",
        description="STATCOM utilisation relative to ±120 MVAR rating [%]",
        unit="%",
        nominal=25.0,
        range_min=0.0,
        range_max=100.0,
        amplitude_slow=20.0,
        period_slow_h=7.0,
        phase_slow_rad=4.2,
        amplitude_fast=4.0,
        period_fast_h=0.25,
        phase_fast_rad=3.8,
    ),
    HistorianTag.WTG01_WIND_SPEED: TagMetadata(
        tag=HistorianTag.WTG01_WIND_SPEED,
        display_name="WTG-01 Wind Speed",
        description="Hub-height wind speed at turbine WTG-01 [WMET1.WdSpd]",
        unit="m/s",
        nominal=10.0,
        range_min=0.0,
        range_max=25.0,
        amplitude_slow=3.5,
        period_slow_h=9.0,
        phase_slow_rad=0.3,
        amplitude_fast=0.8,
        period_fast_h=0.15,
        phase_fast_rad=2.7,
    ),
    HistorianTag.WTG01_POWER_MW: TagMetadata(
        tag=HistorianTag.WTG01_POWER_MW,
        display_name="WTG-01 Output",
        description="Active power output of WTG-01 (15 MW rated) [WGEN1.TotW]",
        unit="MW",
        nominal=11.0,
        range_min=0.0,
        range_max=15.0,
        amplitude_slow=3.5,
        period_slow_h=8.0,
        phase_slow_rad=0.2,
        amplitude_fast=0.5,
        period_fast_h=0.5,
        phase_fast_rad=0.8,
    ),
    HistorianTag.ARRAY_CABLE_CURRENT_A: TagMetadata(
        tag=HistorianTag.ARRAY_CABLE_CURRENT_A,
        display_name="Array Cable Current",
        description="Phase A current on 66 kV array cable feeder A1 [XCBR_66KV.A]",
        unit="A",
        nominal=820.0,
        range_min=0.0,
        range_max=1200.0,
        amplitude_slow=220.0,
        period_slow_h=8.0,
        phase_slow_rad=0.0,
        amplitude_fast=30.0,
        period_fast_h=0.5,
        phase_fast_rad=1.0,
    ),
}


# ── Time-Series Generation ────────────────────────────────────────


class TimeResolution(StrEnum):
    """Available time resolutions for historian queries."""

    ONE_MINUTE = "1min"
    FIVE_MINUTES = "5min"
    FIFTEEN_MINUTES = "15min"
    ONE_HOUR = "1hr"


RESOLUTION_MINUTES: dict[TimeResolution, int] = {
    TimeResolution.ONE_MINUTE: 1,
    TimeResolution.FIVE_MINUTES: 5,
    TimeResolution.FIFTEEN_MINUTES: 15,
    TimeResolution.ONE_HOUR: 60,
}

# Maximum points per query (prevents accidental large responses)
MAX_POINTS_PER_QUERY = 2_000


@dataclass
class TimeSeriesPoint:
    """A single timestamp-value pair in a time-series."""

    timestamp_iso: str  # ISO-8601 UTC timestamp string
    value: float  # Engineering value in tag's unit


@dataclass
class TagTimeSeries:
    """Time-series data for one historian tag."""

    tag: str
    display_name: str
    unit: str
    description: str
    nominal: float
    range_min: float
    range_max: float
    resolution: str
    points: list[TimeSeriesPoint] = field(default_factory=list)


def _compute_value_at_hour(meta: TagMetadata, hour_offset: float) -> float:
    """Compute the synthesised value for a tag at a given hour offset.

    Uses a two-component sinusoidal model:
      y(h) = nominal
           + A_slow × sin(2π × h / T_slow + φ_slow)
           + A_fast × sin(2π × h / T_fast + φ_fast)

    Clamped to [range_min, range_max].

    Args:
        meta: Tag metadata with waveform parameters.
        hour_offset: Hours since the reference epoch (arbitrary but fixed).

    Returns:
        Clamped value in the tag's engineering unit.
    """
    slow = meta.amplitude_slow * math.sin(
        2 * math.pi * hour_offset / meta.period_slow_h + meta.phase_slow_rad
    )
    fast = meta.amplitude_fast * math.sin(
        2 * math.pi * hour_offset / meta.period_fast_h + meta.phase_fast_rad
    )
    raw = meta.nominal + slow + fast
    return max(meta.range_min, min(meta.range_max, raw))


def get_available_tags() -> list[TagMetadata]:
    """Return metadata for all available historian tags (sorted by display_name)."""
    return sorted(TAG_REGISTRY.values(), key=lambda m: m.display_name)


def generate_time_series(
    tag: HistorianTag,
    range_hours: int,
    resolution: TimeResolution,
    now_epoch_minutes: int = 0,
) -> TagTimeSeries:
    """Generate a deterministic time-series for a historian tag.

    Args:
        tag: The historian tag to query.
        range_hours: Time window in hours (1, 4, 24, or 168).
        resolution: Sample interval.
        now_epoch_minutes: Reference epoch in minutes from a fixed origin.
            Defaults to 0 (simulated "current time" at minute 0 of the origin).
            The frontend can pass a fixed offset so the chart appears live.

    Returns:
        A TagTimeSeries with ``range_hours * 60 / resolution_minutes`` points.

    Raises:
        ValueError: If tag is not in the registry or resolution is invalid.
    """
    if tag not in TAG_REGISTRY:
        raise ValueError(f"Unknown historian tag: '{tag}'")

    meta = TAG_REGISTRY[tag]
    res_minutes = RESOLUTION_MINUTES[resolution]

    total_minutes = range_hours * 60
    num_points = min(total_minutes // res_minutes + 1, MAX_POINTS_PER_QUERY)

    # Build points from oldest → newest (newest = now_epoch_minutes)
    start_minute = now_epoch_minutes - total_minutes

    points: list[TimeSeriesPoint] = []
    for i in range(num_points):
        abs_minute = start_minute + i * res_minutes
        hour_offset = abs_minute / 60.0
        value = _compute_value_at_hour(meta, hour_offset)

        # Format as pseudo-ISO timestamp relative to a fixed epoch
        # In production this would be real UTC datetime from TimescaleDB.
        # Here we encode as "T+{minutes}min" for the frontend to interpret.
        points.append(
            TimeSeriesPoint(
                timestamp_iso=_format_pseudo_iso(abs_minute),
                value=round(value, 3),
            )
        )

    return TagTimeSeries(
        tag=tag.value,
        display_name=meta.display_name,
        unit=meta.unit,
        description=meta.description,
        nominal=meta.nominal,
        range_min=meta.range_min,
        range_max=meta.range_max,
        resolution=resolution.value,
        points=points,
    )


def _format_pseudo_iso(abs_minute: int) -> str:
    """Format a minute offset as a pseudo-ISO 8601 datetime string.

    Uses a fixed epoch of 2026-01-01T00:00:00Z plus the minute offset.
    This produces stable, human-readable timestamps without requiring
    a real clock — suitable for deterministic simulation.

    Args:
        abs_minute: Minutes from 2026-01-01T00:00:00Z.

    Returns:
        ISO 8601 UTC string: e.g. "2026-01-01T00:05:00Z"
    """
    # Base epoch: 2026-01-01T00:00:00Z in minutes
    # Offset from epoch = 0 is midnight 2026-01-01
    total_minutes = abs_minute % (365 * 24 * 60)  # wrap at 1 year for cleanliness
    if total_minutes < 0:
        total_minutes += 365 * 24 * 60

    days, remainder_minutes = divmod(total_minutes, 60 * 24)
    hours, mins = divmod(remainder_minutes, 60)

    # Simple date arithmetic (good enough for simulation — not leap-year aware)
    month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = days
    month = 0
    for md in month_days:
        if day < md:
            break
        day -= md
        month += 1

    year = 2026
    return f"{year}-{month + 1:02d}-{day + 1:02d}T{hours:02d}:{mins:02d}:00Z"


def get_latest_values() -> dict[str, float]:
    """Return the latest synthesised value for every registered tag.

    Uses now_epoch_minutes=0 as the reference (equivalent to
    2026-01-01T00:00:00Z in the simulation timeline).

    Returns:
        Mapping of tag name → current value.
    """
    return {
        tag.value: round(_compute_value_at_hour(meta, 0.0), 3) for tag, meta in TAG_REGISTRY.items()
    }
