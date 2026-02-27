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
