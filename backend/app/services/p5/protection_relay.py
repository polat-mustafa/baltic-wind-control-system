"""
Protection relay setting registry and selectivity verification.

Implements protection relay settings for the OSS and verifies
time-grading coordination between downstream and upstream relays.

Physics — Why Protection Coordination Matters
-----------------------------------------------
In a 510 MW offshore wind farm, a cable fault on a 66 kV array string
must be cleared by the string feeder relay (downstream) — NOT by the
220 kV export cable relay (upstream). If the upstream relay trips first,
all 34 turbines lose grid connection instead of just 6.

This is achieved through **time grading**: each upstream relay is set
with a deliberate time delay margin above its downstream relay. The
margin must account for:
- CB operating time (~60 ms per IEC 62271-100)
- Relay timing error (~5% of setting)
- CT saturation uncertainty

Typical grading margins:
- PTOC (overcurrent): 300 ms between stages
- PDIS (distance): 400 ms between zones

Standard — IEC 60255 + IEEE C37.112
-------------------------------------
- IEC 60255-151:2009 — Overcurrent protection (PTOC)
- IEC 60255-121:2014 — Distance protection (PDIS)
- IEC 60255-127:2010 — Over/under voltage protection (PTOV/PTUV)
- IEC 60255-181:2019 — Over/under frequency protection (PTOF/PTUF)
- IEEE C37.112 — Inverse-time overcurrent relay coordination

Maths — Grading Margin Calculation
------------------------------------
For two relays in series (downstream D, upstream U):

    actual_margin = (U.time_delay - D.time_delay) × 1000 ms

    verdict = SELECTIVE  if actual_margin >= required_margin
              NON_SELECTIVE otherwise

Example for PTOC:
    D: feeder relay at 0.5 s, U: incomer relay at 0.8 s
    actual_margin = (0.8 - 0.5) × 1000 = 300 ms
    required_margin = 300 ms → SELECTIVE ✓

Code — Registry + Verification Pattern
----------------------------------------
OSS_RELAY_SETTINGS is an immutable tuple of all relay settings.
GRADING_PAIRS defines which downstream→upstream pairs must be checked.
verify_selectivity() iterates all pairs and returns pass/fail per pair.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Any

# ── Enums ──────────────────────────────────────────────────────────


class ProtectionFunction(StrEnum):
    """IEC 61850 protection function codes."""

    PTOC = "PTOC"  # Time overcurrent
    PDIS = "PDIS"  # Distance
    PTOV = "PTOV"  # Overvoltage
    PTUV = "PTUV"  # Undervoltage
    PTOF = "PTOF"  # Overfrequency
    PTUF = "PTUF"  # Underfrequency


class SelectivityVerdict(StrEnum):
    """Verdict for a grading pair check."""

    SELECTIVE = "selective"
    NON_SELECTIVE = "non_selective"


# ── Data Models ────────────────────────────────────────────────────


@dataclass(frozen=True)
class RelaySetting:
    """Immutable protection relay setting.

    Attributes
    ----------
    setting_id : str
        Unique identifier (e.g. 'PTOC-01').
    function : ProtectionFunction
        IEC 61850 function code.
    description : str
        Human-readable description.
    pickup_value : float
        Relay pickup threshold.
    pickup_unit : str
        Unit of pickup value.
    time_delay : float
        Operating time delay in seconds.
    location : str
        Relay location (e.g. 'String feeder', 'Incomer').
    standard : str
        IEC standard reference.
    """

    setting_id: str
    function: ProtectionFunction
    description: str
    pickup_value: float
    pickup_unit: str
    time_delay: float
    location: str
    standard: str


@dataclass(frozen=True)
class GradingPair:
    """A downstream→upstream relay pair that must be coordinated.

    Attributes
    ----------
    pair_id : str
        Unique identifier.
    downstream_id : str
        Setting ID of the downstream (faster) relay.
    upstream_id : str
        Setting ID of the upstream (slower) relay.
    required_margin_ms : float
        Minimum time margin in milliseconds.
    description : str
        Human-readable description of the grading pair.
    """

    pair_id: str
    downstream_id: str
    upstream_id: str
    required_margin_ms: float
    description: str


@dataclass(frozen=True)
class GradingResult:
    """Result of checking one grading pair.

    Attributes
    ----------
    pair_id : str
        Grading pair checked.
    downstream_id : str
        Downstream relay setting ID.
    upstream_id : str
        Upstream relay setting ID.
    downstream_delay_s : float
        Downstream relay time delay (seconds).
    upstream_delay_s : float
        Upstream relay time delay (seconds).
    actual_margin_ms : float
        Actual margin in milliseconds.
    required_margin_ms : float
        Required margin in milliseconds.
    verdict : SelectivityVerdict
        SELECTIVE or NON_SELECTIVE.
    """

    pair_id: str
    downstream_id: str
    upstream_id: str
    downstream_delay_s: float
    upstream_delay_s: float
    actual_margin_ms: float
    required_margin_ms: float
    verdict: SelectivityVerdict


# ── OSS Relay Settings Registry ──────────────────────────────────

OSS_RELAY_SETTINGS: tuple[RelaySetting, ...] = (
    # Overcurrent — feeder (downstream)
    RelaySetting(
        setting_id="PTOC-01",
        function=ProtectionFunction.PTOC,
        description="String feeder overcurrent -- 1.2xIn, 0.5 s",
        pickup_value=1.2,
        pickup_unit="xIn",
        time_delay=0.5,
        location="String feeder",
        standard="IEC 60255-151",
    ),
    # Overcurrent — incomer (upstream backup)
    RelaySetting(
        setting_id="PTOC-02",
        function=ProtectionFunction.PTOC,
        description="Incomer overcurrent backup -- 1.2xIn, 0.8 s",
        pickup_value=1.2,
        pickup_unit="xIn",
        time_delay=0.8,
        location="Incomer",
        standard="IEC 60255-151",
    ),
    # Distance Zone 1 (downstream)
    RelaySetting(
        setting_id="PDIS-Z1",
        function=ProtectionFunction.PDIS,
        description="Distance Zone 1 — 80% reach, instantaneous",
        pickup_value=80.0,
        pickup_unit="%_reach",
        time_delay=0.0,
        location="Export cable",
        standard="IEC 60255-121",
    ),
    # Distance Zone 2 (upstream backup)
    RelaySetting(
        setting_id="PDIS-Z2",
        function=ProtectionFunction.PDIS,
        description="Distance Zone 2 — 120% reach, 0.4 s delay",
        pickup_value=120.0,
        pickup_unit="%_reach",
        time_delay=0.4,
        location="Export cable",
        standard="IEC 60255-121",
    ),
    # Overvoltage
    RelaySetting(
        setting_id="PTOV-01",
        function=ProtectionFunction.PTOV,
        description="Overvoltage stage 1 — 1.15 pu, 1.0 s",
        pickup_value=1.15,
        pickup_unit="pu",
        time_delay=1.0,
        location="220 kV bus",
        standard="IEC 60255-127",
    ),
    # Undervoltage
    RelaySetting(
        setting_id="PTUV-01",
        function=ProtectionFunction.PTUV,
        description="Undervoltage stage 1 — 0.80 pu, 3.0 s",
        pickup_value=0.80,
        pickup_unit="pu",
        time_delay=3.0,
        location="220 kV bus",
        standard="IEC 60255-127",
    ),
    # Overfrequency
    RelaySetting(
        setting_id="PTOF-01",
        function=ProtectionFunction.PTOF,
        description="Overfrequency — 51.5 Hz, 0.5 s",
        pickup_value=51.5,
        pickup_unit="Hz",
        time_delay=0.5,
        location="220 kV bus",
        standard="IEC 60255-181",
    ),
    # Underfrequency
    RelaySetting(
        setting_id="PTUF-01",
        function=ProtectionFunction.PTUF,
        description="Underfrequency — 47.5 Hz, 0.5 s",
        pickup_value=47.5,
        pickup_unit="Hz",
        time_delay=0.5,
        location="220 kV bus",
        standard="IEC 60255-181",
    ),
)


# ── Grading Pairs ─────────────────────────────────────────────────

GRADING_PAIRS: tuple[GradingPair, ...] = (
    GradingPair(
        pair_id="GP-001",
        downstream_id="PTOC-01",
        upstream_id="PTOC-02",
        required_margin_ms=300.0,
        description="Feeder OC (0.5s) → Incomer OC backup (0.8s)",
    ),
    GradingPair(
        pair_id="GP-002",
        downstream_id="PDIS-Z1",
        upstream_id="PDIS-Z2",
        required_margin_ms=400.0,
        description="Distance Zone 1 (0s) → Zone 2 (0.4s)",
    ),
)


# ── Functions ─────────────────────────────────────────────────────


def get_relay_settings() -> tuple[RelaySetting, ...]:
    """Return all OSS relay settings.

    Returns
    -------
    tuple[RelaySetting, ...]
        Immutable tuple of all 8 relay settings.
    """
    return OSS_RELAY_SETTINGS


def check_single_grading_pair(
    pair: GradingPair,
    settings: dict[str, RelaySetting],
) -> GradingResult:
    """Check selectivity for a single downstream→upstream grading pair.

    Parameters
    ----------
    pair : GradingPair
        The pair to check.
    settings : dict[str, RelaySetting]
        Settings registry keyed by setting_id.

    Returns
    -------
    GradingResult
        Result with actual margin and verdict.

    Raises
    ------
    KeyError
        If downstream or upstream setting_id not found.
    """
    downstream = settings[pair.downstream_id]
    upstream = settings[pair.upstream_id]

    actual_margin_ms = (upstream.time_delay - downstream.time_delay) * 1000.0

    verdict = (
        SelectivityVerdict.SELECTIVE
        if actual_margin_ms >= pair.required_margin_ms
        else SelectivityVerdict.NON_SELECTIVE
    )

    return GradingResult(
        pair_id=pair.pair_id,
        downstream_id=pair.downstream_id,
        upstream_id=pair.upstream_id,
        downstream_delay_s=downstream.time_delay,
        upstream_delay_s=upstream.time_delay,
        actual_margin_ms=actual_margin_ms,
        required_margin_ms=pair.required_margin_ms,
        verdict=verdict,
    )


def verify_selectivity(
    settings: tuple[RelaySetting, ...] | None = None,
    grading_pairs: tuple[GradingPair, ...] | None = None,
) -> list[GradingResult]:
    """Verify selectivity for all grading pairs.

    Parameters
    ----------
    settings : tuple[RelaySetting, ...] | None
        Relay settings to check. Defaults to OSS_RELAY_SETTINGS.
    grading_pairs : tuple[GradingPair, ...] | None
        Grading pairs to verify. Defaults to GRADING_PAIRS.

    Returns
    -------
    list[GradingResult]
        One result per grading pair with verdict.
    """
    if settings is None:
        settings = OSS_RELAY_SETTINGS
    if grading_pairs is None:
        grading_pairs = GRADING_PAIRS

    settings_map = {s.setting_id: s for s in settings}

    return [check_single_grading_pair(pair, settings_map) for pair in grading_pairs]


# ── IEC 60255 Overcurrent Curve Equations ─────────────────────────
#
# IEC 60255-151 defines four IDMT (Inverse Definite Minimum Time) curve
# families. Each uses the same formula structure:
#
#   t = k × TMS / ((I/Ip)^α - 1)
#
# where:
#   t   = operating time [s]
#   TMS = Time Multiplier Setting (relay front panel knob)
#   I   = measured fault current
#   Ip  = pickup current setting
#   k,α = curve-family constants
#
# The larger α, the more steeply the time decreases as current increases
# (SI is least sensitive to current level; EI is most sensitive).
#
# Definite Time (DT) ignores current magnitude — it always operates at
# time_delay once current exceeds pickup. Used where IDMT is unnecessary.

# Curve constants (k, alpha) per IEC 60255-151:2009
_IEC_CURVE_CONSTANTS: dict[str, tuple[float, float]] = {
    "SI": (0.14, 0.02),  # Standard Inverse
    "VI": (13.5, 1.0),  # Very Inverse
    "EI": (80.0, 2.0),  # Extremely Inverse
}

# Suggested plotting colours (by relay role)
_CURVE_COLOURS: list[str] = [
    "#e74c3c",  # red — most downstream
    "#e67e22",  # orange
    "#f1c40f",  # yellow
    "#2ecc71",  # green
    "#3498db",  # blue
    "#9b59b6",  # purple
    "#1abc9c",  # teal
    "#34495e",  # dark grey
]

# Fault current at each named location (kA symmetrical 3-phase) for study
# calculations, based on IEC 60909 short-circuit study results.
FAULT_LOCATION_CURRENTS: dict[str, float] = {
    "string_feeder": 8.5,  # 66 kV string feeder, close-in fault [kA]
    "export_cable_near": 7.2,  # Export cable, 5 km from OSS [kA]
    "export_cable_mid": 5.1,  # Export cable, 22 km midpoint [kA]
    "export_cable_far": 2.8,  # Export cable, 40 km from OSS [kA]
    "hv_busbar": 12.4,  # 220 kV busbar fault [kA]
}

# CB opening time per IEC 62271-100 for 66 kV / 220 kV switchgear
CB_OPENING_TIME_MS: float = 60.0  # circuit breaker mechanical open time
ARC_EXTINCTION_EXTRA_MS: float = 20.0  # ~1 power cycle for arc extinction

# Clearance time limits
CLEARANCE_LIMIT_66KV_MS: float = 100.0  # IEC 61936-1 / standard HV networks
CLEARANCE_LIMIT_220KV_MS: float = 80.0  # PSE IRiESP Type D generators


def idmt_operating_time(
    current_multiple: float,
    tms: float,
    curve_type: str,
    time_delay_fallback_s: float = 0.5,
) -> float:
    """Calculate IDMT relay operating time for a given current multiple.

    Parameters
    ----------
    current_multiple : float
        Fault current / pickup current (I/Ip). Must be > 1.0 for relay to operate.
    tms : float
        Time Multiplier Setting (relay dial).
    curve_type : str
        'SI' / 'VI' / 'EI' / 'DT'. Defaults to DT if curve_type unknown.
    time_delay_fallback_s : float
        Used when curve_type is 'DT' or current_multiple <= 1.0.

    Returns
    -------
    float
        Operating time in seconds. Returns math.inf if I/Ip <= 1.0 (no trip).
    """
    import math

    if current_multiple <= 1.0:
        return math.inf

    if curve_type == "DT":
        return time_delay_fallback_s

    if curve_type not in _IEC_CURVE_CONSTANTS:
        return time_delay_fallback_s

    k, alpha = _IEC_CURVE_CONSTANTS[curve_type]
    denominator = (current_multiple**alpha) - 1.0
    if denominator <= 0.0:
        return time_delay_fallback_s

    return float(k * tms / denominator)


def get_tcc_plot_data(
    relay_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Generate TCC curve (I, t) data points for a set of relays.

    Produces 50 log-spaced current multiples from 1.05× to 20× pickup.
    Suitable for Plotly log-log axis rendering.

    Parameters
    ----------
    relay_ids : list[str] | None
        Relay setting IDs to include. Defaults to all PTOC/PDIS relays.

    Returns
    -------
    list[dict]
        Each element is a curve dict with keys:
        relay_id, curve_type, tms, pickup_value, pickup_unit, points, color_hint.
    """
    import math

    target_ids = set(relay_ids) if relay_ids else None
    settings = OSS_RELAY_SETTINGS

    curves = []
    colour_idx = 0

    for setting in settings:
        if target_ids and setting.setting_id not in target_ids:
            continue
        if setting.function not in (ProtectionFunction.PTOC, ProtectionFunction.PDIS):
            # Only IDMT/distance relays have meaningful TCC shapes
            continue

        points = []
        for i in range(50):
            # 50 log-spaced multiples from 1.05 to 20
            multiple = math.exp(math.log(1.05) + i * (math.log(20.0) - math.log(1.05)) / 49.0)
            t = idmt_operating_time(
                current_multiple=multiple,
                tms=0.1,  # default TMS; will be overridden per-relay by service
                curve_type="SI",  # default; overridden per-relay
                time_delay_fallback_s=setting.time_delay,
            )
            if t < 10.0:  # clip extreme values for chart readability
                points.append({"current_multiple": round(multiple, 4), "time_s": round(t, 4)})

        curves.append(
            {
                "relay_id": setting.setting_id,
                "location": setting.location,
                "curve_type": "SI",
                "tms": 0.1,
                "pickup_value": setting.pickup_value,
                "pickup_unit": setting.pickup_unit,
                "time_delay_s": setting.time_delay,
                "points": points,
                "color_hint": _CURVE_COLOURS[colour_idx % len(_CURVE_COLOURS)],
            }
        )
        colour_idx += 1

    return curves


def run_coordination_study(
    fault_location: str,
    fault_current_ka: float | None = None,
) -> dict[str, Any]:
    """Run a TCC coordination study for a named fault location.

    Computes which relays operate, in what order, and checks all grading
    margins are adequate.

    Parameters
    ----------
    fault_location : str
        One of: 'string_feeder', 'export_cable_near', 'export_cable_mid',
        'export_cable_far', 'hv_busbar'.
    fault_current_ka : float | None
        Override fault current. Defaults to the pre-calculated value for
        the location from the IEC 60909 short-circuit study.

    Returns
    -------
    dict
        study_id, fault_location, fault_current_ka, relay_sequence (sorted
        by trip time), fully_graded, grading_results, first_relay details.
    """
    import math
    import uuid as _uuid

    if fault_current_ka is None:
        fault_current_ka = FAULT_LOCATION_CURRENTS.get(fault_location, 5.0)

    relay_events: list[dict[str, Any]] = []
    for setting in OSS_RELAY_SETTINGS:
        if setting.pickup_unit != "xIn":
            # Skip non-overcurrent relays for the basic study
            # (voltage, frequency, and distance relays assessed separately)
            continue

        current_multiple = fault_current_ka * 1000.0 / (setting.pickup_value * 1000.0)
        trip_time_s = idmt_operating_time(
            current_multiple=current_multiple,
            tms=0.1,
            curve_type="SI",
            time_delay_fallback_s=setting.time_delay,
        )
        operated = trip_time_s < math.inf

        relay_events.append(
            {
                "relay_id": setting.setting_id,
                "relay_location": setting.location,
                "trip_time_ms": round(trip_time_s * 1000.0, 1),
                "fault_current_multiple": round(current_multiple, 2),
                "operated": operated,
            }
        )

    # Sort by trip time (fastest first); non-operating relays go last
    relay_events.sort(key=lambda x: float(x["trip_time_ms"]) if x["operated"] else float("inf"))

    grading_results_raw = verify_selectivity()
    grading_violations = sum(
        1 for r in grading_results_raw if r.verdict == SelectivityVerdict.NON_SELECTIVE
    )
    fully_graded = grading_violations == 0

    first = relay_events[0] if relay_events and relay_events[0]["operated"] else None

    return {
        "study_id": str(_uuid.uuid4()),
        "fault_location": fault_location,
        "fault_current_ka": fault_current_ka,
        "relay_sequence": relay_events,
        "first_relay": first["relay_id"] if first else "NONE",
        "first_relay_time_ms": first["trip_time_ms"] if first else 0.0,
        "fully_graded": fully_graded,
        "grading_results": [
            {
                "pair_id": r.pair_id,
                "downstream_id": r.downstream_id,
                "upstream_id": r.upstream_id,
                "downstream_delay_s": r.downstream_delay_s,
                "upstream_delay_s": r.upstream_delay_s,
                "actual_margin_ms": r.actual_margin_ms,
                "required_margin_ms": r.required_margin_ms,
                "selective": r.verdict == SelectivityVerdict.SELECTIVE,
            }
            for r in grading_results_raw
        ],
        "grading_violations": grading_violations,
        "assessment": "PASS" if fully_graded else "FAIL",
    }


def simulate_fault_clearance(
    fault_type: str,
    fault_location: str,
    fault_impedance_ohm: float = 0.0,
) -> dict[str, Any]:
    """Simulate complete fault clearance sequence including CB operation.

    Fault clearance time (FCT) = relay operate time + CB open time + arc extinction.

    IEC 61936-1 §8 / PSE IRiESP: FCT < 80 ms at 220 kV (Type D generators).

    Parameters
    ----------
    fault_type : str
        '3ph' / 'ph_ph' / 'ph_e' / 'ph_ph_e'.
    fault_location : str
        Named location (see FAULT_LOCATION_CURRENTS).
    fault_impedance_ohm : float
        Bolted fault = 0.0.

    Returns
    -------
    dict
        Full clearance timing and compliance assessment.
    """
    # Fault current magnitude depends on fault type
    base_ka = FAULT_LOCATION_CURRENTS.get(fault_location, 5.0)
    fault_type_factor = {
        "3ph": 1.0,  # highest fault current
        "ph_ph": 0.866,  # √3/2 × 3ph symmetric
        "ph_ph_e": 0.9,
        "ph_e": 0.6,  # single phase — lower in solidly earthed systems
    }.get(fault_type, 1.0)

    # Apply fault impedance reduction (Ohm's law approximation)
    fault_current_ka = base_ka * fault_type_factor / max(1.0, 1.0 + fault_impedance_ohm)

    # Run coordination study to get relay operate time
    study = run_coordination_study(fault_location, fault_current_ka)
    first_relay_time_ms = float(study["first_relay_time_ms"])

    total_ms = first_relay_time_ms + CB_OPENING_TIME_MS + ARC_EXTINCTION_EXTRA_MS

    is_hv = "export" in fault_location or "busbar" in fault_location
    limit_ms = CLEARANCE_LIMIT_220KV_MS if is_hv else CLEARANCE_LIMIT_66KV_MS

    return {
        "fault_type": fault_type,
        "fault_location": fault_location,
        "fault_impedance_ohm": fault_impedance_ohm,
        "fault_current_ka": round(fault_current_ka, 3),
        "first_relay_time_ms": first_relay_time_ms,
        "cb_open_time_ms": CB_OPENING_TIME_MS,
        "arc_extinction_time_ms": ARC_EXTINCTION_EXTRA_MS,
        "total_clearance_time_ms": round(total_ms, 1),
        "compliant": total_ms <= limit_ms,
        "requirement_ms": limit_ms,
        "relay_sequence": study["relay_sequence"],
        "assessment": "PASS" if total_ms <= limit_ms else "FAIL",
    }
