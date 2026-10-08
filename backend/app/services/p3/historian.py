"""
SCADA historian of the farm (SB-510 or the learner's design, ``FarmSpec``).

A production historian reads TimescaleDB hypertables (raw 90 days, 1-min
aggregates 2 years, 1-h lifetime). Here the series are synthesised, but from
ONE physical state so every tag agrees with every other:

  wind u(t)  → WTG-01 power P(u) on the official IEA 15 MW curve (3 / 10.66 / 25 m/s)
             → farm generation N · P(0.94 u)  (≈ 6 % wake loss)
             → OSS export = generation − array/OSS-transformer losses
             → 220 kV current per export circuit  I = √(I_P² + (I_C/2)²)
             → STATCOM Q closing the reactive balance (cable charging ωCV²L,
               shunt reactors, series I²X absorption) — SB-510: 442 Mvar,
               3 × 170 Mvar, ±120 Mvar; other farms: their design() values
  frequency  → Continental Europe: slow load-following swing + 15-min market
               steps, inside ±50 mHz most of the time

The wind is a deterministic sum of a weather-front swing (hours) and
turbulence-scale components (minutes), so the same instant always returns
the same value. Time stamps are real UTC instants.

Standards: IEC 61400-25 (tag model, report rates), IEC 61850-7-4 logical
nodes (MMXU, WMET, WGEN), ENTSO-E SO GL (frequency quality).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from functools import lru_cache

from app.services.p1.turbine_models import get_turbine
from app.services.p2.network_model import SB510, FarmSpec

# ── Plant constants (the rest comes from the FarmSpec) ───────────────

_TURBINE = get_turbine()
RATED_MW = _TURBINE.rated_mw
CUT_IN, RATED_WS, CUT_OUT = _TURBINE.cut_in_ms, _TURBINE.rated_ms, _TURBINE.cut_out_ms
WAKE_FACTOR = 0.94  # farm-average wind relative to the free stream
# SB-510 at rated output: net reactive absorption of transformers and cables (I²X)
# minus the Q the PSE grid supplies at the POC, calibrated so the STATCOM tag matches the
# P2 Grid-tab load flow (3 of 4 reactors in, ≈ −3 MVAR); array/OSS losses. Other farms
# scale with capacity (transformers and cables are sized to it).
SB510_SERIES_Q_MVAR = 80.0
SB510_LOSS_MW = (0.12, 3.2)  # no-load + load losses at rated


class HistorianTag(StrEnum):
    """Historian tags (IEC 61400-25 / IEC 61850-7-4 naming, SB5 = SB-510)."""

    OSS_TOTAL_POWER_MW = "SB5.OSS.MMXU1.TotW"
    OSS_REACTIVE_POWER_MVAR = "SB5.OSS.MMXU1.TotVAr"
    OSS_FREQUENCY_HZ = "SB5.OSS.MMXU1.Hz"
    OSS_VOLTAGE_PU = "SB5.OSS.MMXU1.PhV.A"
    OSS_CURRENT_KA = "SB5.OSS.MMXU1.A.phsA"
    STATCOM_Q_MVAR = "SB5.OSS.STATCOM1.TotVAr"
    STATCOM_UTIL_PCT = "SB5.OSS.STATCOM1.Util"
    WTG01_WIND_SPEED = "SB5.WTG_01.WMET1.WdSpd"
    WTG01_POWER_MW = "SB5.WTG_01.WGEN1.TotW"
    ARRAY_CABLE_CURRENT_A = "SB5.OSS.XCBR_66KV.A.phsA"


@dataclass(frozen=True)
class TagMetadata:
    """Engineering metadata for a historian tag."""

    tag: HistorianTag
    display_name: str
    description: str
    unit: str
    nominal: float
    range_min: float
    range_max: float


def _meta(
    tag: HistorianTag, name: str, desc: str, unit: str, nom: float, lo: float, hi: float
) -> TagMetadata:
    return TagMetadata(tag, name, desc, unit, nom, lo, hi)


T = HistorianTag


@lru_cache(maxsize=64)
def tag_registry(spec: FarmSpec = SB510) -> dict[HistorianTag, TagMetadata]:
    """Tag metadata of a farm: ranges follow its capacity, STATCOM and string 1."""
    k1 = spec.string_layout[0]
    string1_a = k1 * RATED_MW * 1e3 / (math.sqrt(3) * 66.0)
    return {m.tag: m for m in _tags(spec, k1, max(900.0, 10 * math.ceil(0.12 * string1_a)))}


def _tags(spec: FarmSpec, k1: int, string1_max_a: float) -> tuple[TagMetadata, ...]:
    q = spec.statcom_mvar
    return (
        _meta(
            T.OSS_TOTAL_POWER_MW,
            "Farm Output",
            "Active power exported at the OSS 220 kV busbar [MMXU1.TotW]",
            "MW",
            round(0.78 * spec.capacity_mw),
            0.0,
            spec.capacity_mw,
        ),
        _meta(
            T.OSS_REACTIVE_POWER_MVAR,
            "Reactive Power",
            "Reactive power at the OSS 220 kV busbar, generating + [MMXU1.TotVAr]",
            "MVAr",
            0.0,
            -q,
            q,
        ),
        _meta(
            T.OSS_FREQUENCY_HZ,
            "Grid Frequency",
            "System frequency (Continental Europe) [MMXU1.Hz]",
            "Hz",
            50.0,
            49.8,
            50.2,
        ),
        _meta(
            T.OSS_VOLTAGE_PU,
            "220 kV Voltage",
            "OSS 220 kV busbar voltage, per unit of 220 kV [MMXU1.PhV]",
            "pu",
            1.0,
            0.95,
            1.05,
        ),
        _meta(
            T.OSS_CURRENT_KA,
            "220 kV Current",
            "Current per export circuit incl. half the charging current [MMXU1.A]",
            "kA",
            0.6,
            0.0,
            1.0,
        ),
        _meta(
            T.STATCOM_Q_MVAR,
            "STATCOM Output",
            "STATCOM reactive power, generating + [STATCOM1.TotVAr]",
            "MVAr",
            0.0,
            -q,
            q,
        ),
        _meta(
            T.STATCOM_UTIL_PCT,
            "STATCOM Utilisation",
            f"|Q| relative to the ±{q:.0f} MVAr rating",
            "%",
            25.0,
            0.0,
            100.0,
        ),
        _meta(
            T.WTG01_WIND_SPEED,
            "WTG-01 Wind Speed",
            "Hub-height (150 m) wind speed at WTG-01 [WMET1.WdSpd]",
            "m/s",
            10.0,
            0.0,
            35.0,
        ),
        _meta(
            T.WTG01_POWER_MW,
            "WTG-01 Output",
            "Active power of WTG-01, 15 MW rated [WGEN1.TotW]",
            "MW",
            11.0,
            0.0,
            15.0,
        ),
        _meta(
            T.ARRAY_CABLE_CURRENT_A,
            "Array Cable Current",
            f"String 1 feeder current at the OSS ({k1} × V236, 66 kV) [XCBR.A]",
            "A",
            round(0.83 * k1 * RATED_MW * 1e3 / (math.sqrt(3) * 66.0), -1),
            0.0,
            string1_max_a,
        ),
    )


TAG_REGISTRY = tag_registry(SB510)


class TimeResolution(StrEnum):
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
MAX_POINTS_PER_QUERY = 2_000


@dataclass
class TimeSeriesPoint:
    timestamp_iso: str
    value: float


@dataclass
class TagTimeSeries:
    tag: str
    display_name: str
    unit: str
    description: str
    nominal: float
    range_min: float
    range_max: float
    resolution: str
    points: list[TimeSeriesPoint] = field(default_factory=list)


# ── Physical model ───────────────────────────────────────────────────


def _wave(m: float, components: tuple[tuple[float, float, float], ...]) -> float:
    """Σ A·sin(2π·m/T + φ) for (A, T [min], φ) — deterministic in the minute m."""
    return sum(a * math.sin(2 * math.pi * m / t + p) for a, t, p in components)


def wind_speed(m: float) -> float:
    """Free-stream hub wind [m/s]: 31 h / 7.3 h fronts + turbulence (σ ≈ 0.6 m/s)."""
    slow = _wave(m, ((3.0, 31 * 60, 0.4), (1.8, 7.3 * 60, 1.1)))
    gusts = _wave(m, ((0.55, 47.0, 0.3), (0.4, 13.7, 2.0), (0.25, 5.3, 4.1)))
    return max(0.0, 10.5 + slow + gusts)


def power_curve_mw(u: float) -> float:
    """SB-510 turbine (IEA 15 MW): the official power table, 0 outside 3–25 m/s."""
    return float(_TURBINE.power_curve_kw(u)) / 1e3


def frequency_hz(m: float) -> float:
    """CE frequency: load-following swing plus a dip at each 15-min market step."""
    step = 0.018 * math.exp(-(m % 15) / 3.0)  # deterministic-frequency deviation
    return 50.0 + _wave(m, ((0.018, 60.0, 0.7), (0.009, 17.0, 2.2), (0.004, 4.1, 5.0))) - step


def plant_state(m: float, spec: FarmSpec = SB510) -> dict[HistorianTag, float]:
    """Every tag at minute m (minutes since the Unix epoch, UTC)."""
    u = wind_speed(m)
    p_wtg = power_curve_mw(u)
    gen = spec.num_turbines * power_curve_mw(WAKE_FACTOR * u)
    p = gen / spec.capacity_mw
    scale = spec.capacity_mw / SB510.capacity_mw
    no_load, load = SB510_LOSS_MW
    oss_export = max(0.0, gen - scale * (no_load + load * p * p))  # array + OSS trafo losses

    # Export circuit current: the farm active current + half the charging current,
    # shared by the circuits
    n_cct = spec.num_export_cables
    i_active = oss_export * 1e3 / (math.sqrt(3) * 220.0 * n_cct)
    i_charge_half = spec.cable_q_mvar / n_cct * 1e3 / (math.sqrt(3) * 220.0) / 2
    i_circuit_ka = math.hypot(i_active, i_charge_half) / 1e3

    # Reactive balance of the export system, reactors at both ends (one out near rated);
    # the OSS 66 kV harmonic filter generates its rated Q at 50 Hz
    n_react = spec.num_reactors
    q_max = spec.statcom_mvar
    absorbed = SB510_SERIES_Q_MVAR * scale * p * p
    generated = spec.cable_q_mvar + spec.harmonic_filter_mvar
    statcom = n_react * spec.reactor_unit_mvar + absorbed - generated
    if n_react and statcom > q_max / 2:
        n_react -= 1
        statcom -= spec.reactor_unit_mvar
    statcom = max(-q_max, min(q_max, statcom))
    q_residual = _wave(m, ((3.0, 23.0, 0.5), (1.5, 6.7, 1.9)))  # controller ripple

    return {
        T.OSS_TOTAL_POWER_MW: oss_export,
        T.OSS_REACTIVE_POWER_MVAR: q_residual,
        T.OSS_FREQUENCY_HZ: frequency_hz(m),
        T.OSS_VOLTAGE_PU: 1.0 + 0.006 * math.sin(2 * math.pi * m / 600 + 1.3) - 0.01 * p * p,
        T.OSS_CURRENT_KA: i_circuit_ka,
        T.STATCOM_Q_MVAR: statcom,
        T.STATCOM_UTIL_PCT: abs(statcom) / q_max * 100,
        T.WTG01_WIND_SPEED: u,
        T.WTG01_POWER_MW: p_wtg,
        T.ARRAY_CABLE_CURRENT_A: spec.string_layout[0]
        * power_curve_mw(0.97 * u)
        * 1e3
        / (math.sqrt(3) * 66.0),
    }


def _now_minute() -> int:
    return int(datetime.now(UTC).timestamp() // 60)


def _iso(m: int) -> str:
    return datetime.fromtimestamp(m * 60, UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Public API ───────────────────────────────────────────────────────


def get_available_tags(spec: FarmSpec = SB510) -> list[TagMetadata]:
    """Metadata for all historian tags, sorted by display name."""
    return sorted(tag_registry(spec).values(), key=lambda t: t.display_name)


def generate_time_series(
    tag: HistorianTag,
    range_hours: int,
    resolution: TimeResolution,
    now_epoch_minutes: int = 0,
    spec: FarmSpec = SB510,
) -> TagTimeSeries:
    """Series for one tag ending at `now_epoch_minutes` (Unix minutes; 0 → now).

    The last point is aligned to the resolution grid, oldest point first.
    """
    registry = tag_registry(spec)
    if tag not in registry:
        raise ValueError(f"Unknown historian tag: '{tag}'")
    meta = registry[tag]
    step = RESOLUTION_MINUTES[resolution]
    end = now_epoch_minutes or _now_minute()
    end -= end % step
    n = min(range_hours * 60 // step + 1, MAX_POINTS_PER_QUERY)
    points = []
    for i in range(n):
        m = end - (n - 1 - i) * step
        value = max(meta.range_min, min(meta.range_max, plant_state(m, spec)[tag]))
        points.append(TimeSeriesPoint(timestamp_iso=_iso(m), value=round(value, 3)))
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


def get_latest_values(now_epoch_minutes: int = 0, spec: FarmSpec = SB510) -> dict[str, float]:
    """Latest value of every tag (same model, current minute)."""
    state = plant_state(now_epoch_minutes or _now_minute(), spec)
    return {tag.value: round(v, 3) for tag, v in state.items()}
