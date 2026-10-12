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

Every value that follows the plant comes from its design (``FarmSpec``; SB-510 or the
own project in the X-Farm header): CT primaries are the smallest IEC 61869-2 ratings
≥ 1.1 × the rated current (longest string at the feeder, one OSS transformer at the
incomer — SB-510: 787 A → 1000/1, 2624 A → 3000/1), the head-cable withstand uses the
weakest string head section, and the fault currents come from that design's network.

Fault currents: 66 kV from pandapower IEC 60909 (``calc_short_circuit``);
along the export cable from the series-impedance chain with c = 1.10 plus
the converters' rated-current infeed (k = 1).

Earth faults (``run_earth_fault_study``, engineering audit F5): the 66 kV array is
resistance earthed (one NER per OSS transformer star point, 1 kA), so a feeder earth
fault draws ≈ 1.2–3.2 kA (IEC 60909 min / max, ``short_circuit.earth_fault_levels``),
far below phase faults — the phase overcurrent stages do not see it. Residual stages:

    66 kV feeder   PTOC-01N  DT, core-balance CT, pickup above the largest healthy
                             feeder's own capacitive earth-fault current (sympathetic
                             trips), 0.2 s
    NER / incomer  PTOC-02N  DT on the NER CT, 2 × the feeder pickup, 0.6 s   backup
    NER rating     10 s at 1 kA (short-time) — the backup must clear well inside it
The 220 kV system is effectively earthed (onshore YNyn units, PSE grid): earth faults
there are cleared by 87L / 87B and the distance relay's earth loops.

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
    ARRAY_KV,
    SB510,
    FarmSpec,
    _get_cable_grade,
    series_impedances_pu,
    string_current_ka,
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
        "String feeder overcurrent — IEC SI, CT 1000/1, 1.2 × In, TMS 0.10",
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
        "66 kV incomer overcurrent (backup) — IEC SI, CT 3000/1, 1.2 × In, TMS 0.15",
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
# IEC 61869-2 standard rated primary currents ≥ 100 A (10 … 75 A × decades)
CT_RATINGS_A = (100, 125, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1250, 1500, 2000,
                2500, 3000, 4000, 5000, 6000, 7500)  # fmt: skip
CT_HEADROOM = 1.1  # continuous load ≤ 1/1.1 of the CT primary
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


# ── Settings of a farm ───────────────────────────────────────────


def ct_primary_a(rated_a: float) -> float:
    """Smallest IEC 61869-2 primary rating ≥ 1.1 × the rated current [A]."""
    need = CT_HEADROOM * rated_a
    return float(next((r for r in CT_RATINGS_A if r >= need - 1e-9), CT_RATINGS_A[-1]))


@lru_cache(maxsize=16)
def relay_settings(spec: FarmSpec = SB510) -> tuple[RelaySetting, ...]:
    """The scheme set for ``spec`` (SB-510 gives ``OSS_RELAY_SETTINGS``).

    CTs from the rated currents; the feeder keeps TMS 0.10 and the incomer gets the
    smallest TMS step (0.05) that grades ≥ 300 ms behind it at both IEC 60909 66 kV
    fault levels — SB-510: 0.134 needed → 0.15.
    """
    s = {r.setting_id: r for r in OSS_RELAY_SETTINGS}
    feeder_a = string_current_ka(max(spec.string_layout), spec.turbine_rated_mw) * 1000.0
    incomer_a = spec.oss_trafo_mva / (math.sqrt(3) * ARRAY_KV) * 1000.0
    feeder = replace(s["PTOC-01"], ct_primary_a=ct_primary_a(feeder_a))
    incomer = replace(s["PTOC-02"], ct_primary_a=ct_primary_a(incomer_a))
    pair = next(p for p in GRADING_PAIRS if p.upstream_id == "PTOC-02")
    currents = oss_66kv_fault_levels_ka(spec)
    for step in range(1, 21):
        incomer = replace(incomer, tms=round(0.05 * step, 2))
        graded = check_single_grading_pair(pair, {"PTOC-01": feeder, "PTOC-02": incomer}, currents)
        if graded.verdict == SelectivityVerdict.SELECTIVE:
            break
    for r in (feeder, incomer):
        what = "String feeder overcurrent" if r is feeder else "66 kV incomer overcurrent (backup)"
        s[r.setting_id] = replace(
            r,
            description=f"{what} — IEC SI, CT {r.ct_primary_a:.0f}/1, 1.2 × In, TMS {r.tms:.2f}",
        )
    return tuple(s[r.setting_id] for r in OSS_RELAY_SETTINGS)


def head_cable_mm2(spec: FarmSpec = SB510) -> float:
    """Smallest string head section (the cable next to the OSS) [mm²] — SB-510: the
    5-turbine strings' 630 mm²."""
    return min(
        _get_cable_grade(n, spec.turbine_rated_mw).cross_section_mm2 for n in spec.string_layout
    )


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


@lru_cache(maxsize=16)
def oss_66kv_fault_levels_ka(spec: FarmSpec = SB510) -> tuple[float, float]:
    """IEC 60909 Ik'' (max, min) at the OSS 66 kV busbar [kA] (pandapower)."""
    from app.services.p2.short_circuit import calc_short_circuit

    def at_66(case: str) -> float:
        res = calc_short_circuit(case, spec=spec)
        return next(b.ikss_ka for b in res.bus_results if b.bus_name == "OSS_66kV")

    return at_66("max"), at_66("min")


def export_cable_fault_ka(
    position_pct: float, c: float = 1.1, spec: FarmSpec = SB510
) -> tuple[float, float]:
    """(grid-side, converter) fault current [kA] at a point of the export cable.

    position_pct: 0 = onshore end, 100 = OSS end. Grid side through the
    series-impedance chain with voltage factor c; converters and STATCOM
    feed about their rated current (k = 1).
    """
    z = series_impedances_pu(100.0, spec=spec)
    z_path = z["grid"] + z["onshore"] + z["export"] * position_pct / 100.0
    grid = c * 100.0 / (math.sqrt(3) * 220.0 * abs(z_path))
    converters = (spec.capacity_mw + spec.statcom_mvar) / (math.sqrt(3) * 220.0)
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
    spec: FarmSpec = SB510,
) -> list[GradingResult]:
    """Check every grading pair (worst case over the fault currents of ``spec``)."""
    settings_map = {s.setting_id: s for s in (settings or relay_settings(spec))}
    currents = currents_ka or oss_66kv_fault_levels_ka(spec)
    return [
        check_single_grading_pair(pair, settings_map, currents)
        for pair in (grading_pairs or GRADING_PAIRS)
    ]


def apply_overrides(
    overrides: dict[str, dict[str, Any]], spec: FarmSpec = SB510
) -> tuple[RelaySetting, ...]:
    """Settings of ``spec`` with user changes (pickup, delay, TMS, curve) applied."""
    fields = {
        "pickup_value": "pickup_value",
        "time_delay_s": "time_delay",
        "tms": "tms",
        "curve_type": "curve",
    }
    out = []
    for s in relay_settings(spec):
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
    spec: FarmSpec = SB510,
) -> dict[str, Any]:
    """Which relays see a fault, when they trip, and whether it is selective.

    The study fault current comes from IEC 60909 / the impedance chain unless
    ``fault_current_ka`` overrides it (useful to walk along a TCC).
    """
    if fault_type not in ("3ph", "ph_ph"):
        msg = (
            "fault_type must be '3ph' or 'ph_ph'; earth faults of the resistance-earthed "
            "66 kV array: run_earth_fault_study (GET /api/v1/grid/protection/earth-fault)"
        )
        raise ValidationError(msg)
    factor = 1.0 if fault_type == "3ph" else math.sqrt(3) / 2
    location, position = _resolve_location(fault_location, position_pct)
    s = {r.setting_id: r for r in (settings or relay_settings(spec))}

    if location in ("string_feeder", "oss_busbar_66kv"):
        i_max, i_min = oss_66kv_fault_levels_ka(spec)
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
        grid, conv = export_cable_fault_ka(position, spec=spec)
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

    grading = verify_selectivity(tuple(s.values()), currents_ka=currents, spec=spec)
    violations = sum(r.verdict == SelectivityVerdict.NON_SELECTIVE for r in grading)
    main_first = first is not None and str(first["role"]).startswith("main")
    selective = main_first and backup_margin >= 300.0 - 1e-6 and violations == 0
    head_mm2 = head_cable_mm2(spec)
    if location == "string_feeder":
        # Internal array fault: the grid barely sees it; the limit is the weakest head
        # cable's short-circuit withstand, judged on the backup clearance
        limit_s = (CU_XLPE_K * head_mm2 / (current * 1000.0)) ** 2
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
            f"head-cable I²t withstand (k = 143, {head_mm2:.0f} mm² Cu) vs backup clearance"
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
    settings: tuple[RelaySetting, ...] | None = None,
    spec: FarmSpec = SB510,
) -> dict[str, Any]:
    """Clearance timeline of the main protection for one fault.

    A fault impedance Z_f [Ω] is added in series with the source impedance
    seen at the fault (purely reactive sources, resistive fault — magnitudes).
    """
    location, position = _resolve_location(fault_location, position_pct)
    base = run_coordination_study(
        location, position_pct=position, settings=settings, fault_type=fault_type, spec=spec
    )
    current = base["fault_current_ka"]
    if fault_impedance_ohm > 0:
        kv = base["voltage_kv"]
        z_source = kv / (math.sqrt(3) * current)  # Ω
        current = kv / (math.sqrt(3) * math.hypot(z_source, fault_impedance_ohm))
        base = run_coordination_study(location, current, position, settings, fault_type, spec)
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


# ── Earth faults (66 kV resistance-earthed array) ────────────────

EF_FEEDER_DELAY_S = 0.2
EF_BACKUP_DELAY_S = 0.6
EF_SYMPATHETIC_MARGIN = 1.3  # pickup ≥ 1.3 × a healthy feeder's own capacitive current
NER_RATED_TIME_S = 10.0  # short-time rating of the NER at its rated current


def string_capacitive_earth_fault_a(spec: FarmSpec = SB510) -> list[float]:
    """Capacitive earth-fault current each string feeds into a fault elsewhere [A]:
    3·ω·C0·U0 of its cable sections (C0 = C1, individually screened cores)."""
    u0 = ARRAY_KV * 1e3 / math.sqrt(3)
    w = 2 * math.pi * 50.0
    out = []
    for n in spec.string_layout:
        c_f = (
            sum(
                _get_cable_grade(n - pos, spec.turbine_rated_mw).c_nf_per_km * 1e-9
                for pos in range(n)
            )
            * spec.array_cable_length_km
        )
        out.append(3 * w * c_f * u0)
    return out


def earth_fault_settings(spec: FarmSpec = SB510) -> tuple[RelaySetting, RelaySetting]:
    """Feeder and NER residual stages of ``spec`` (pickups in primary amperes)."""
    i_c = max(string_capacitive_earth_fault_a(spec))
    feeder = math.ceil(EF_SYMPATHETIC_MARGIN * i_c / 10.0) * 10.0
    return (
        RelaySetting(
            "PTOC-01N", ProtectionFunction.PTOC,
            f"String feeder earth fault — core-balance CT, {feeder:.0f} A, DT "
            f"{EF_FEEDER_DELAY_S:.1f} s", feeder, "A", EF_FEEDER_DELAY_S, "String feeder",
            "IEC 60255-151",
        ),
        RelaySetting(
            "PTOC-02N", ProtectionFunction.PTOC,
            f"NER / incomer earth fault (backup) — {2 * feeder:.0f} A, DT "
            f"{EF_BACKUP_DELAY_S:.1f} s", 2 * feeder, "A", EF_BACKUP_DELAY_S, "Incomer",
            "IEC 60255-151",
        ),
    )  # fmt: skip


def run_earth_fault_study(
    fault_resistance_ohm: float = 0.0, spec: FarmSpec = SB510
) -> dict[str, Any]:
    """Earth fault on a 66 kV string feeder at the OSS: currents, residual protection and
    its checks — selectivity (≥ 300 ms), no sympathetic trip of healthy feeders, the NER's
    short-time rating, and the highest fault resistance the feeder stage still detects."""
    from app.services.p2.network_model import NER_OHM
    from app.services.p2.short_circuit import earth_fault_levels

    hi = earth_fault_levels("max", spec)["OSS_66kV"]
    lo = earth_fault_levels("min", spec)["OSS_66kV"]
    feeder, backup = earth_fault_settings(spec)
    # A resistive fault adds 3·R_f to the sequence loop Z(1) + Z(2) + Z(0), which the NER
    # (3·R_N in Z(0)) makes nearly resistive: I = 3·U0 / (|Z_loop| + 3·R_f) ≈ U0 / (R_N + R_f)
    u0 = ARRAY_KV * 1e3 / math.sqrt(3)
    z_loop = 3 * u0 / (lo["ik1_ka"] * 1000.0)  # min case, c = 1.0
    i_fault = 3 * u0 / (z_loop + 3 * fault_resistance_ohm)
    r_max = max(z_loop / 3 * (lo["ik1_ka"] * 1000.0 / feeder.pickup_value) - z_loop / 3, 0.0)
    events = [
        _event(feeder, feeder.time_delay if i_fault >= feeder.pickup_value else math.inf, "main"),
        _event(backup, backup.time_delay if i_fault >= backup.pickup_value else math.inf, "backup"),
    ]
    main, back = events
    margin = (
        back["trip_time_ms"] - main["trip_time_ms"]
        if main["operated"] and back["operated"]
        else None
    )
    i_c = string_capacitive_earth_fault_a(spec)
    return {
        "fault_location": "string_feeder",
        "fault_type": "1ph",
        "fault_resistance_ohm": fault_resistance_ohm,
        "ik1_max_ka": hi["ik1_ka"],
        "ik1_min_ka": lo["ik1_ka"],
        "fault_current_a": round(i_fault, 1),
        "ner_ohm": round(NER_OHM, 2),
        "relay_sequence": events,
        "settings": [feeder, backup],
        "healthy_feeder_capacitive_a": [round(x, 1) for x in i_c],
        "no_sympathetic_trip": feeder.pickup_value >= EF_SYMPATHETIC_MARGIN * max(i_c) - 1e-9,
        "backup_margin_ms": None if margin is None else round(margin, 1),
        "selective": margin is not None and margin >= 300.0 - 1e-6,
        "ner_within_rating": back["clearance_time_ms"] / 1000.0 <= NER_RATED_TIME_S,
        "max_detectable_resistance_ohm": round(r_max, 0),
        "assessment": "PASS"
        if main["operated"] and margin is not None and margin >= 300.0 - 1e-6
        else "FAIL — fault resistance above the feeder stage's reach",
    }
