"""
Protection scheme of the OSS / export system and its coordination.

The scheme
----------
::

    66 kV string feeder   PTOC-01  IDMT SI, CT 1000/1, I> 1.2 In, TMS 0.10
    66 kV incomer (TX LV) PTOC-02  IDMT SI, CT 3000/1, I> 1.2 In, TMS 0.15   backup
    OSS busbars           PDIF-87B busbar differential, 20 ms               main
    220 kV export cable   PDIF-87L line differential, 25 ms                 main
                          PDIS-Z1  distance, 80 % reach, instantaneous      main 2
                          PDIS-Z2  distance, 120 % reach, 0.4 s             backup
    220 kV busbar         PTOV / PTUV / PTOF / PTUF  (grid-code ranges)

Selectivity means the protection of the faulted zone clears the fault and
everything upstream only backs it up. For inverse-time (IDMT) relays the
margin must be checked at the fault currents that can actually flow —
IEC 60909 maximum and minimum at the OSS 66 kV busbar — not on the
configured delays alone:

    t = TMS · k / ((I / I_p)^α − 1)        IEC 60255-151 (SI: k 0.14, α 0.02)

    margin = t_upstream(I) − t_downstream(I) ≥ 300 ms
    (CB break time 60 ms + relay errors + overshoot + safety)

Fault clearance time = relay operating time + CB rated break time (3 cycles
= 60 ms at 50 Hz, IEC 62271-100; the break time already includes arcing).
Main protection is judged against 150 ms — the fault duration PSE's FRT
profile is built on (t_clear = 0.15 s); a design target, not a separate
PSE clearance-time rule.

Voltage and frequency stages sit outside PSE's ride-through ranges:
47.5 / 51.5 Hz (NC RfG frequency ranges), 1.15 pu above the 60-min band at
110–300 kV (1.118–1.15 pu), 0.80 pu after 3 s (beyond the 2.5 s FRT profile).

Fault currents: 66 kV from pandapower IEC 60909 (``calc_short_circuit``);
along the export cable from the series-impedance chain with c = 1.10 plus
the converters' rated-current infeed (k = 1). Balanced faults only — earth
faults need zero-sequence data the model does not carry.

Standards: IEC 60255-151 (overcurrent), -121 (distance), -127 (voltage),
-181 (frequency), -187 (differential); IEC 62271-100; IEC 60909-0.
"""

from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, replace
from enum import StrEnum
from functools import lru_cache
from typing import Any

from app.core.exceptions import ValidationError
from app.services.p2.network_model import (
    STATCOM_RATING_MVAR,
    TOTAL_CAPACITY_MW,
    series_impedances_pu,
)

# ── Enums / data ─────────────────────────────────────────────────


class ProtectionFunction(StrEnum):
    """IEC 61850 protection logical-node classes."""

    PTOC = "PTOC"  # Time overcurrent
    PDIS = "PDIS"  # Distance
    PDIF = "PDIF"  # Differential (line, busbar)
    PTOV = "PTOV"  # Overvoltage
    PTUV = "PTUV"  # Undervoltage
    PTOF = "PTOF"  # Overfrequency
    PTUF = "PTUF"  # Underfrequency


class SelectivityVerdict(StrEnum):
    """Verdict for a grading pair check."""

    SELECTIVE = "selective"
    NON_SELECTIVE = "non_selective"


@dataclass(frozen=True)
class RelaySetting:
    """One protection stage.

    ``time_delay`` is the definite time [s] of DT stages (incl. distance
    zones); for IDMT stages it is 0 and the time follows the curve with
    ``tms``. ``ct_primary_a`` turns ``× In`` pickups into amperes.
    """

    setting_id: str
    function: ProtectionFunction
    description: str
    pickup_value: float
    pickup_unit: str
    time_delay: float
    location: str
    standard: str
    curve: str = "DT"  # "SI" / "VI" / "EI" / "DT"
    tms: float = 0.0
    ct_primary_a: float = 0.0
    operate_ms: float = 25.0  # intrinsic operating time of the numerical relay


@dataclass(frozen=True)
class GradingPair:
    """A downstream → upstream relay pair that must be time-graded."""

    pair_id: str
    downstream_id: str
    upstream_id: str
    required_margin_ms: float
    description: str


@dataclass(frozen=True)
class GradingResult:
    """Result of one grading check (times at the worst-case fault current)."""

    pair_id: str
    downstream_id: str
    upstream_id: str
    downstream_delay_s: float
    upstream_delay_s: float
    actual_margin_ms: float
    required_margin_ms: float
    verdict: SelectivityVerdict


OSS_RELAY_SETTINGS: tuple[RelaySetting, ...] = (
    RelaySetting(
        "PTOC-01",
        ProtectionFunction.PTOC,
        "String feeder overcurrent — IEC SI, 1.2 × In, TMS 0.10",
        1.2,
        "xIn",
        0.0,
        "String feeder",
        "IEC 60255-151",
        curve="SI",
        tms=0.10,
        ct_primary_a=1000.0,
    ),
    RelaySetting(
        "PTOC-02",
        ProtectionFunction.PTOC,
        "66 kV incomer overcurrent (backup) — IEC SI, 1.2 × In, TMS 0.15",
        1.2,
        "xIn",
        0.0,
        "Incomer",
        "IEC 60255-151",
        curve="SI",
        tms=0.15,
        ct_primary_a=3000.0,
    ),
    RelaySetting(
        "PDIS-Z1",
        ProtectionFunction.PDIS,
        "Distance zone 1 — 80 % of the export cable, instantaneous",
        80.0,
        "%_reach",
        0.0,
        "Export cable",
        "IEC 60255-121",
    ),
    RelaySetting(
        "PDIS-Z2",
        ProtectionFunction.PDIS,
        "Distance zone 2 — 120 % reach, 0.4 s",
        120.0,
        "%_reach",
        0.4,
        "Export cable",
        "IEC 60255-121",
    ),
    RelaySetting(
        "PTOV-01",
        ProtectionFunction.PTOV,
        "Overvoltage — 1.15 pu, 1.0 s",
        1.15,
        "pu",
        1.0,
        "220 kV bus",
        "IEC 60255-127",
    ),
    RelaySetting(
        "PTUV-01",
        ProtectionFunction.PTUV,
        "Undervoltage — 0.80 pu, 3.0 s (beyond the 2.5 s FRT profile)",
        0.80,
        "pu",
        3.0,
        "220 kV bus",
        "IEC 60255-127",
    ),
    RelaySetting(
        "PTOF-01",
        ProtectionFunction.PTOF,
        "Overfrequency — 51.5 Hz, 0.5 s",
        51.5,
        "Hz",
        0.5,
        "220 kV bus",
        "IEC 60255-181",
    ),
    RelaySetting(
        "PTUF-01",
        ProtectionFunction.PTUF,
        "Underfrequency — 47.5 Hz, 0.5 s",
        47.5,
        "Hz",
        0.5,
        "220 kV bus",
        "IEC 60255-181",
    ),
    RelaySetting(
        "PDIF-87L",
        ProtectionFunction.PDIF,
        "Export cable line differential — both ends, ≈ 25 ms",
        0.2,
        "xIn",
        0.0,
        "Export cable",
        "IEC 60255-187-1",
    ),
    RelaySetting(
        "PDIF-87B",
        ProtectionFunction.PDIF,
        "OSS busbar differential (66 and 220 kV) — ≈ 20 ms",
        0.2,
        "xIn",
        0.0,
        "OSS busbars",
        "IEC 60255-187-1",
        operate_ms=20.0,
    ),
)

GRADING_PAIRS: tuple[GradingPair, ...] = (
    GradingPair(
        "GP-001",
        "PTOC-01",
        "PTOC-02",
        300.0,
        "Feeder OC → incomer OC backup at the 66 kV fault level",
    ),
    GradingPair("GP-002", "PDIS-Z1", "PDIS-Z2", 300.0, "Distance zone 1 (inst.) → zone 2 (0.4 s)"),
)

IEC_CURVES: dict[str, tuple[float, float]] = {
    "SI": (0.14, 0.02),
    "VI": (13.5, 1.0),
    "EI": (80.0, 2.0),
}
CB_BREAK_TIME_MS = 60.0  # 3-cycle breaker, IEC 62271-100 rated break time
MAIN_CLEARANCE_TARGET_MS = 150.0  # PSE FRT profile t_clear
CU_XLPE_K = 143.0  # A·√s/mm², Cu, XLPE 90 → 250 °C (IEC 60364-5-54 adiabatic k)
ARRAY_HEAD_CABLE_MM2 = 800.0  # string head cable cross-section
LEGACY_LOCATIONS = {  # older API names → (location, % of cable from the onshore end)
    "export_cable_near": ("export_cable", 89.0),
    "export_cable_mid": ("export_cable", 50.0),
    "export_cable_far": ("export_cable", 11.0),
    "hv_busbar": ("oss_busbar_220kv", 100.0),
}
LOCATION_LABEL = {
    "string_feeder": "66 kV string feeder (OSS end)",
    "oss_busbar_66kv": "OSS 66 kV busbar",
    "export_cable": "220 kV export cable",
    "oss_busbar_220kv": "OSS 220 kV busbar",
}


def get_relay_settings() -> tuple[RelaySetting, ...]:
    """Return all relay settings of the OSS / export system."""
    return OSS_RELAY_SETTINGS


# ── Operating times ─────────────────────────────────────────────


def idmt_operating_time(
    current_multiple: float,
    tms: float,
    curve_type: str,
    time_delay_fallback_s: float = 0.5,
) -> float:
    """IEC 60255-151 operating time [s]; ``math.inf`` below pickup.

    DT (or an unknown curve) returns ``time_delay_fallback_s`` above pickup.
    """
    if current_multiple <= 1.0:
        return math.inf
    if curve_type not in IEC_CURVES:
        return time_delay_fallback_s
    k, alpha = IEC_CURVES[curve_type]
    return float(k * tms / (current_multiple**alpha - 1.0))


def ptoc_time_s(setting: RelaySetting, current_ka: float) -> float:
    """Operating time of an overcurrent stage for a primary current [kA]."""
    pickup_ka = setting.pickup_value * setting.ct_primary_a / 1000.0
    return idmt_operating_time(
        current_ka / pickup_ka, setting.tms, setting.curve, setting.time_delay
    )


@lru_cache(maxsize=1)
def oss_66kv_fault_levels_ka() -> tuple[float, float]:
    """IEC 60909 Ik'' (max, min) at the OSS 66 kV busbar [kA] (pandapower)."""
    from app.services.p2.short_circuit import calc_short_circuit

    def at_66(case: str) -> float:
        res = calc_short_circuit(case)
        return next(b.ikss_ka for b in res.bus_results if b.bus_name == "OSS_66kV")

    return at_66("max"), at_66("min")


def export_cable_fault_ka(position_pct: float, c: float = 1.1) -> tuple[float, float]:
    """(grid-side, converter) fault current [kA] at a point of the export cable.

    position_pct: 0 = onshore end, 100 = OSS end. Grid side through the
    series-impedance chain with voltage factor c; converters and STATCOM
    feed about their rated current (k = 1).
    """
    z = series_impedances_pu(100.0)
    z_path = z["grid"] + z["onshore"] + z["export"] * position_pct / 100.0
    grid = c * 100.0 / (math.sqrt(3) * 220.0 * abs(z_path))
    converters = (TOTAL_CAPACITY_MW + STATCOM_RATING_MVAR) / (math.sqrt(3) * 220.0)
    return grid, converters


# ── Selectivity (P5 commissioning check + P2 study) ─────────────


def _pair_times(
    pair: GradingPair, settings: dict[str, RelaySetting], current_ka: float
) -> tuple[float, float]:
    down, up = settings[pair.downstream_id], settings[pair.upstream_id]
    if down.function == ProtectionFunction.PTOC and up.function == ProtectionFunction.PTOC:
        return ptoc_time_s(down, current_ka), ptoc_time_s(up, current_ka)
    return down.time_delay, up.time_delay


def check_single_grading_pair(
    pair: GradingPair,
    settings: dict[str, RelaySetting],
    currents_ka: tuple[float, ...] | None = None,
) -> GradingResult:
    """Margin of one pair at the worst of the given fault currents.

    IDMT pairs are evaluated at the IEC 60909 max and min 66 kV fault levels
    (or ``currents_ka``); DT pairs compare their delays.
    """
    currents = currents_ka or oss_66kv_fault_levels_ka()
    margins = []
    for i_ka in currents:
        t_down, t_up = _pair_times(pair, settings, i_ka)
        margins.append(((t_up - t_down) * 1000.0, t_down, t_up))
    margin_ms, t_down, t_up = min(margins, key=lambda m: m[0])
    return GradingResult(
        pair_id=pair.pair_id,
        downstream_id=pair.downstream_id,
        upstream_id=pair.upstream_id,
        downstream_delay_s=round(t_down, 3),
        upstream_delay_s=round(t_up, 3),
        actual_margin_ms=round(margin_ms, 1),
        required_margin_ms=pair.required_margin_ms,
        verdict=(
            SelectivityVerdict.SELECTIVE
            if margin_ms >= pair.required_margin_ms
            else SelectivityVerdict.NON_SELECTIVE
        ),
    )


def verify_selectivity(
    settings: tuple[RelaySetting, ...] | None = None,
    grading_pairs: tuple[GradingPair, ...] | None = None,
    currents_ka: tuple[float, ...] | None = None,
) -> list[GradingResult]:
    """Check every grading pair (worst case over the fault currents)."""
    settings_map = {s.setting_id: s for s in (settings or OSS_RELAY_SETTINGS)}
    return [
        check_single_grading_pair(pair, settings_map, currents_ka)
        for pair in (grading_pairs or GRADING_PAIRS)
    ]


def apply_overrides(overrides: dict[str, dict[str, Any]]) -> tuple[RelaySetting, ...]:
    """Settings with user changes (pickup, delay, TMS, curve) applied."""
    fields = {
        "pickup_value": "pickup_value",
        "time_delay_s": "time_delay",
        "tms": "tms",
        "curve_type": "curve",
    }
    out = []
    for s in OSS_RELAY_SETTINGS:
        ov = overrides.get(s.setting_id, {})
        out.append(
            replace(s, **{fields[k]: v for k, v in ov.items() if k in fields and v is not None})
        )
    return tuple(out)


# ── Fault study ──────────────────────────────────────────────────


def _resolve_location(location: str, position_pct: float | None) -> tuple[str, float]:
    if location in LEGACY_LOCATIONS:
        name, pos = LEGACY_LOCATIONS[location]
        return name, pos if position_pct is None else position_pct
    if location not in LOCATION_LABEL:
        msg = f"fault_location must be one of {', '.join(LOCATION_LABEL)}"
        raise ValidationError(msg)
    return location, 50.0 if position_pct is None else position_pct


def _event(setting: RelaySetting, t_s: float, role: str, multiple: float = 0.0) -> dict[str, Any]:
    operated = math.isfinite(t_s)
    relay_ms = t_s * 1000.0 + (setting.operate_ms if setting.curve == "DT" else 0.0)
    return {
        "relay_id": setting.setting_id,
        "relay_location": setting.location,
        "role": role,
        "trip_time_ms": round(relay_ms, 1) if operated else 0.0,
        "clearance_time_ms": round(relay_ms + CB_BREAK_TIME_MS, 1) if operated else 0.0,
        "fault_current_multiple": round(multiple, 2),
        "operated": operated,
    }


def run_coordination_study(
    fault_location: str,
    fault_current_ka: float | None = None,
    position_pct: float | None = None,
    settings: tuple[RelaySetting, ...] | None = None,
    fault_type: str = "3ph",
) -> dict[str, Any]:
    """Which relays see a fault, when they trip, and whether it is selective.

    The study fault current comes from IEC 60909 / the impedance chain unless
    ``fault_current_ka`` overrides it (useful to walk along a TCC).
    """
    if fault_type not in ("3ph", "ph_ph"):
        msg = "fault_type must be '3ph' or 'ph_ph' (earth faults need zero-sequence data)"
        raise ValidationError(msg)
    factor = 1.0 if fault_type == "3ph" else math.sqrt(3) / 2
    location, position = _resolve_location(fault_location, position_pct)
    s = {r.setting_id: r for r in (settings or OSS_RELAY_SETTINGS)}

    if location in ("string_feeder", "oss_busbar_66kv"):
        i_max, i_min = oss_66kv_fault_levels_ka()
        current = (fault_current_ka or i_max) * factor
        kv = 66.0
        events = [
            _event(
                s["PTOC-02"],
                ptoc_time_s(s["PTOC-02"], current),
                "backup",
                current / (s["PTOC-02"].pickup_value * s["PTOC-02"].ct_primary_a / 1000),
            )
        ]
        if location == "string_feeder":
            events.append(
                _event(
                    s["PTOC-01"],
                    ptoc_time_s(s["PTOC-01"], current),
                    "main",
                    current / (s["PTOC-01"].pickup_value * s["PTOC-01"].ct_primary_a / 1000),
                )
            )
            main_id = "PTOC-01"
        else:
            events.append(_event(s["PDIF-87B"], 0.0, "main"))
            main_id = "PDIF-87B"
        currents: tuple[float, ...] = (
            (current,) if fault_current_ka else (i_max * factor, i_min * factor)
        )
    else:
        kv = 220.0
        if location == "oss_busbar_220kv":
            position = 100.0
        grid, conv = export_cable_fault_ka(position)
        current = (fault_current_ka or grid + conv) * factor
        # Distance relay at the onshore end: Z1 covers 80 % of the cable, Z2 (120 %)
        # backs up the whole cable and the OSS 220 kV busbar
        events = [_event(s["PDIS-Z2"], s["PDIS-Z2"].time_delay, "backup")]
        if location == "export_cable" and position <= s["PDIS-Z1"].pickup_value:
            events.append(_event(s["PDIS-Z1"], s["PDIS-Z1"].time_delay, "main 2"))
        if location == "export_cable":
            events.append(_event(s["PDIF-87L"], 0.0, "main"))
            main_id = "PDIF-87L"
        else:
            events.append(_event(s["PDIF-87B"], 0.0, "main"))
            main_id = "PDIF-87B"
        currents = (current,)

    events.sort(key=lambda e: e["trip_time_ms"] if e["operated"] else math.inf)
    first = next((e for e in events if e["operated"]), None)
    main = next(e for e in events if e["relay_id"] == main_id)
    backups = [e for e in events if e["role"] == "backup" and e["operated"]]
    backup_margin = (
        min(b["trip_time_ms"] for b in backups) - main["trip_time_ms"]
        if backups and main["operated"]
        else math.inf
    )

    grading = verify_selectivity(tuple(s.values()), currents_ka=currents)
    violations = sum(r.verdict == SelectivityVerdict.NON_SELECTIVE for r in grading)
    main_first = first is not None and str(first["role"]).startswith("main")
    selective = main_first and backup_margin >= 300.0 - 1e-6 and violations == 0
    if location == "string_feeder":
        # Internal array fault: the grid barely sees it; the limit is the head
        # cable's short-circuit withstand, judged on the backup clearance
        limit_s = (CU_XLPE_K * ARRAY_HEAD_CABLE_MM2 / (current * 1000.0)) ** 2
        backup_ms = min(
            (b["clearance_time_ms"] for b in backups), default=main["clearance_time_ms"]
        )
        fast = backup_ms / 1000.0 <= limit_s
    else:
        limit_s = MAIN_CLEARANCE_TARGET_MS / 1000.0
        fast = main["operated"] and main["clearance_time_ms"] <= MAIN_CLEARANCE_TARGET_MS

    return {
        "study_id": str(uuid.uuid4()),
        "fault_location": location,
        "position_pct": position if location == "export_cable" else None,
        "fault_type": fault_type,
        "voltage_kv": kv,
        "fault_current_ka": round(current, 2),
        "description": f"{LOCATION_LABEL[location]}"
        + (f" at {position:.0f} % from the onshore end" if location == "export_cable" else "")
        + f" — {current:.1f} kA {'3-phase' if fault_type == '3ph' else 'phase-phase'}",
        "relay_sequence": events,
        "main_relay": main_id,
        "first_relay": first["relay_id"] if first else "NONE",
        "first_relay_time_ms": first["trip_time_ms"] if first else 0.0,
        "main_clearance_ms": main["clearance_time_ms"],
        "backup_margin_ms": round(backup_margin, 1) if math.isfinite(backup_margin) else None,
        "fully_graded": violations == 0,
        "grading_results": grading,
        "grading_violations": violations,
        "selective": selective,
        "fast_enough": fast,
        "time_limit_s": round(limit_s, 3),
        "time_criterion": (
            "head-cable I²t withstand (k = 143, 800 mm² Cu) vs backup clearance"
            if location == "string_feeder"
            else "main clearance ≤ 150 ms (PSE FRT profile t_clear)"
        ),
        "assessment": "PASS" if selective and fast else "FAIL",
    }


def simulate_fault_clearance(
    fault_type: str,
    fault_location: str,
    fault_impedance_ohm: float = 0.0,
    position_pct: float | None = None,
) -> dict[str, Any]:
    """Clearance timeline of the main protection for one fault.

    A fault impedance Z_f [Ω] is added in series with the source impedance
    seen at the fault (purely reactive sources, resistive fault — magnitudes).
    """
    location, position = _resolve_location(fault_location, position_pct)
    base = run_coordination_study(location, position_pct=position, fault_type=fault_type)
    current = base["fault_current_ka"]
    if fault_impedance_ohm > 0:
        kv = base["voltage_kv"]
        z_source = kv / (math.sqrt(3) * current)  # Ω
        current = kv / (math.sqrt(3) * math.hypot(z_source, fault_impedance_ohm))
        base = run_coordination_study(location, current, position, fault_type=fault_type)
    main = next(e for e in base["relay_sequence"] if e["relay_id"] == base["main_relay"])
    return {
        "fault_type": fault_type,
        "fault_location": location,
        "fault_impedance_ohm": fault_impedance_ohm,
        "fault_current_ka": round(current, 3),
        "first_relay_time_ms": main["trip_time_ms"],
        "cb_open_time_ms": CB_BREAK_TIME_MS,
        "arc_extinction_time_ms": 0.0,  # included in the rated break time
        "total_clearance_time_ms": main["clearance_time_ms"],
        "compliant": main["clearance_time_ms"] <= MAIN_CLEARANCE_TARGET_MS,
        "requirement_ms": MAIN_CLEARANCE_TARGET_MS,
        "relay_sequence": base["relay_sequence"],
        "assessment": "PASS" if main["clearance_time_ms"] <= MAIN_CLEARANCE_TARGET_MS else "FAIL",
    }


def get_tcc_plot_data(
    relay_ids: list[str] | None = None,
    settings: tuple[RelaySetting, ...] | None = None,
) -> list[dict[str, Any]]:
    """Time–current curves of the overcurrent stages, in primary kA at 66 kV.

    60 log-spaced currents from 1.05 × pickup to 40 kA; distance and
    differential stages are not current-graded and are not drawn.
    """
    curves = []
    for s in settings or OSS_RELAY_SETTINGS:
        if s.function != ProtectionFunction.PTOC or (relay_ids and s.setting_id not in relay_ids):
            continue
        pickup_ka = s.pickup_value * s.ct_primary_a / 1000.0
        lo, hi = math.log(1.05 * pickup_ka), math.log(40.0)
        points = []
        for i in range(60):
            i_ka = math.exp(lo + i * (hi - lo) / 59)
            t = ptoc_time_s(s, i_ka)
            if t <= 30.0:
                points.append(
                    {
                        "current_ka": round(i_ka, 3),
                        "current_multiple": round(i_ka / pickup_ka, 3),
                        "time_s": round(t, 4),
                    }
                )
        curves.append(
            {
                "relay_id": s.setting_id,
                "location": s.location,
                "curve_type": s.curve,
                "tms": s.tms,
                "pickup_value": s.pickup_value,
                "pickup_unit": s.pickup_unit,
                "pickup_ka": round(pickup_ka, 3),
                "time_delay_s": s.time_delay,
                "points": points,
            }
        )
    return curves
