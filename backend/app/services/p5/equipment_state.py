"""
Switchgear of export circuit 1 and its topology-based interlocking.

Scope
-----
The first-energisation programme (``switching_programme.py``) energises export
circuit 1 from the already-live onshore 220 kV busbar::

    ONS220 ─DS-ON-220-01─ ONS-E1 ─CB-ON-220-01─ CABLE1 (45 km) ─CB-OSS-220-01─ OSS-E1
           ─DS-OSS-220-01─ OSS220 ┬─CB-SR-01──── SR1    shunt reactor 1, 80 Mvar
                                  ├─CB-STC-01─── STC    STATCOM ±120 Mvar
                                  ├─CB-TX-OSS-HV─ TX1 ─CB-TX-OSS-LV─ 66A ─CB-STR-0n─ STRn  n=1…3
                                  └─CB-TX-OSS-02-HV─ TX2 ─CB-TX-OSS-02-LV─ 66B ─…─ STRn  n=4…6

    earth switches: ES-ON-220-01 / ES-OSS-220-01 on the cable (one per end),
    ES-OSS-220-BB on the OSS 220 kV busbar, ES-SR-01 / ES-STC-01 / ES-TX-OSS-01/-02
    in the reactor, STATCOM and transformer bays, ES-OSS-66-01/-02 on sections A/B,
    ES-STR-0n on each string feeder.
    WTG-GRP-0n: the main breakers of the turbines on string n, operated as one
    "release for generation" command.

Circuit 2 (TX-OSS-02, section B, strings 4–6) stays earthed in this programme;
its second export cable, the spare reactors and the 66 kV bus coupler are not
modelled here. The onshore busbar ONS220 is the only source. The short GIS bay
sections between disconnector and breaker (ONS-E1, OSS-E1) carry no earth
switch in this model, so they show as isolated-but-unearthed when open.

Interlocking — derived from the topology
----------------------------------------
Each device joins two zones (an earth switch sits on one zone). A union-find
over the closed CBs/DSs gives the connected groups; a group is *live* when it
contains ONS220 and *earthed* when one of its earth switches is closed. From
that, five rules cover every operation (IEC 61936-1 requires interlocking that
prevents mal-operation; the rules themselves are the usual station-level
scheme, not text from the standard):

    ILK-001  a CB/DS may not close if it would join a live group to an earthed
             group — that is a bolted earth fault made by the switch itself.
    ILK-002  an earth switch may not close on a live group.
    ILK-003  a disconnector may only operate with its series CB open — it has
             no current-breaking or making capability.
    ILK-004  a device held by an isolation lock (LOTO) cannot be operated.
    ILK-005  turbines may only be released onto a live string — they are
             grid-following and cannot energise a dead feeder.

Because the rule works on groups, the far-end earth of the cable is caught too:
closing CB-ON-220-01 with ES-OSS-220-01 still closed 45 km away is blocked,
which a bay-local CB↔ES pairing would miss.

References
----------
- IEC 61936-1:2021 — Power installations exceeding 1 kV AC (interlocking)
- EN 50110-1:2013 — Operation of electrical installations (isolation, earthing)
- IEC 62271-102:2018 — Disconnectors and earthing switches
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

from app.core.exceptions import NotFoundError, StateTransitionError

# ── Enums ──────────────────────────────────────────────────────────


class EquipmentType(StrEnum):
    """Switching devices of circuit 1."""

    CIRCUIT_BREAKER = "circuit_breaker"
    DISCONNECTOR = "disconnector"
    EARTH_SWITCH = "earth_switch"
    WTG_GROUP = "wtg_group"  # turbine main breakers of one string


class EquipmentState(StrEnum):
    """Contact position. For an earth switch CLOSED = earthed; for a WTG group
    CLOSED = turbines released and connected."""

    OPEN = "open"
    CLOSED = "closed"


class SwitchingAction(StrEnum):
    """Switching commands. The programme uses OPEN/CLOSE; the P3 bay
    controllers also accept EARTH/UNEARTH and the rack commands."""

    OPEN = "open"
    CLOSE = "close"
    EARTH = "earth"
    UNEARTH = "unearth"
    RACK_IN = "rack_in"
    RACK_OUT = "rack_out"


class ZoneStatus(StrEnum):
    """Electrical condition of a zone."""

    LIVE = "live"
    EARTHED = "earthed"
    DEAD = "dead"  # isolated, not earthed — never safe to touch


# ── Registry ───────────────────────────────────────────────────────


@dataclass(frozen=True)
class EquipmentDefinition:
    """One switching device.

    ``zones`` holds the two zones a CB/DS joins, or the single zone an earth
    switch earths / a WTG group connects to.
    """

    equipment_id: str
    equipment_type: EquipmentType
    voltage_kv: float
    location: str
    initial_state: EquipmentState
    zones: tuple[str, ...]


_CB = EquipmentType.CIRCUIT_BREAKER
_DS = EquipmentType.DISCONNECTOR
_ES = EquipmentType.EARTH_SWITCH
_OPEN = EquipmentState.OPEN
_CLOSED = EquipmentState.CLOSED


def _string_devices() -> tuple[EquipmentDefinition, ...]:
    devices: list[EquipmentDefinition] = []
    for n in range(1, 7):
        section = "A" if n <= 3 else "B"
        bus = "66A" if n <= 3 else "66B"
        devices += [
            EquipmentDefinition(
                f"CB-STR-0{n}",
                _CB,
                66.0,
                f"String {n} feeder CB (66 kV section {section})",
                _OPEN,
                (bus, f"STR{n}"),
            ),
            EquipmentDefinition(
                f"ES-STR-0{n}",
                _ES,
                66.0,
                f"String {n} feeder earth switch (cable side)",
                _CLOSED,
                (f"STR{n}",),
            ),
        ]
        if n <= 3:
            devices.append(
                EquipmentDefinition(
                    f"WTG-GRP-0{n}",
                    EquipmentType.WTG_GROUP,
                    66.0,
                    f"Main breakers of the 6 turbines on string {n}",
                    _OPEN,
                    (f"STR{n}",),
                )
            )
    return tuple(devices)


OSS_EQUIPMENT: tuple[EquipmentDefinition, ...] = (
    # Onshore export bay E1 (220 kV)
    EquipmentDefinition(
        "DS-ON-220-01",
        _DS,
        220.0,
        "Onshore bay E1 busbar disconnector",
        _OPEN,
        ("ONS220", "ONS-E1"),
    ),
    EquipmentDefinition(
        "CB-ON-220-01", _CB, 220.0, "Onshore bay E1 circuit breaker", _OPEN, ("ONS-E1", "CABLE1")
    ),
    EquipmentDefinition(
        "ES-ON-220-01", _ES, 220.0, "Export cable 1 earth switch, onshore end", _CLOSED, ("CABLE1",)
    ),
    # OSS export bay E1 (220 kV)
    EquipmentDefinition(
        "ES-OSS-220-01", _ES, 220.0, "Export cable 1 earth switch, OSS end", _CLOSED, ("CABLE1",)
    ),
    EquipmentDefinition(
        "CB-OSS-220-01", _CB, 220.0, "OSS bay E1 circuit breaker", _OPEN, ("CABLE1", "OSS-E1")
    ),
    EquipmentDefinition(
        "DS-OSS-220-01", _DS, 220.0, "OSS bay E1 busbar disconnector", _OPEN, ("OSS-E1", "OSS220")
    ),
    EquipmentDefinition(
        "ES-OSS-220-BB", _ES, 220.0, "OSS 220 kV busbar earth switch", _CLOSED, ("OSS220",)
    ),
    # Reactive compensation on the OSS 220 kV busbar
    EquipmentDefinition(
        "CB-SR-01",
        _CB,
        220.0,
        "Shunt reactor 1 (80 Mvar) circuit breaker",
        _OPEN,
        ("OSS220", "SR1"),
    ),
    EquipmentDefinition(
        "CB-STC-01", _CB, 220.0, "STATCOM (±120 Mvar) circuit breaker", _OPEN, ("OSS220", "STC")
    ),
    EquipmentDefinition(
        "ES-SR-01", _ES, 220.0, "Shunt reactor 1 bay earth switch", _CLOSED, ("SR1",)
    ),
    EquipmentDefinition("ES-STC-01", _ES, 220.0, "STATCOM bay earth switch", _CLOSED, ("STC",)),
    # OSS transformers 220/66 kV, 300 MVA each
    EquipmentDefinition(
        "CB-TX-OSS-HV", _CB, 220.0, "TX-OSS-01 HV circuit breaker", _OPEN, ("OSS220", "TX1")
    ),
    EquipmentDefinition(
        "ES-TX-OSS-01", _ES, 220.0, "TX-OSS-01 HV bay earth switch", _CLOSED, ("TX1",)
    ),
    EquipmentDefinition(
        "CB-TX-OSS-LV", _CB, 66.0, "TX-OSS-01 LV incomer, 66 kV section A", _OPEN, ("TX1", "66A")
    ),
    EquipmentDefinition(
        "ES-OSS-66-01", _ES, 66.0, "66 kV busbar section A earth switch", _CLOSED, ("66A",)
    ),
    EquipmentDefinition(
        "CB-TX-OSS-02-HV", _CB, 220.0, "TX-OSS-02 HV circuit breaker", _OPEN, ("OSS220", "TX2")
    ),
    EquipmentDefinition(
        "ES-TX-OSS-02", _ES, 220.0, "TX-OSS-02 HV bay earth switch", _CLOSED, ("TX2",)
    ),
    EquipmentDefinition(
        "CB-TX-OSS-02-LV", _CB, 66.0, "TX-OSS-02 LV incomer, 66 kV section B", _OPEN, ("TX2", "66B")
    ),
    EquipmentDefinition(
        "ES-OSS-66-02", _ES, 66.0, "66 kV busbar section B earth switch", _CLOSED, ("66B",)
    ),
    *_string_devices(),
)

_EQUIPMENT_BY_ID: dict[str, EquipmentDefinition] = {eq.equipment_id: eq for eq in OSS_EQUIPMENT}

SOURCE_ZONE = "ONS220"
ZONES: tuple[str, ...] = tuple(dict.fromkeys(z for eq in OSS_EQUIPMENT for z in eq.zones))

# Disconnector → the CB in series with it (ILK-003)
SERIES_CB: dict[str, str] = {"DS-ON-220-01": "CB-ON-220-01", "DS-OSS-220-01": "CB-OSS-220-01"}


# ── Results / errors ───────────────────────────────────────────────


@dataclass(frozen=True)
class InterlockViolation:
    """One interlock that blocks a command."""

    interlock_id: str
    description: str
    blocking_equipment: str


@dataclass(frozen=True)
class SwitchingResult:
    """Outcome of an executed switching command."""

    equipment_id: str
    action: SwitchingAction
    previous_state: EquipmentState
    new_state: EquipmentState
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


class InvalidTransitionError(StateTransitionError):
    """The device is already in the commanded position."""


class InterlockError(StateTransitionError):
    """The command is blocked by one or more interlocks."""

    def __init__(self, message: str, violations: tuple[InterlockViolation, ...]) -> None:
        super().__init__(message)
        self.violations = violations


class EquipmentNotFoundError(NotFoundError):
    """Unknown equipment ID."""


# ── Topology ───────────────────────────────────────────────────────


def get_equipment_definition(equipment_id: str) -> EquipmentDefinition:
    """Registry lookup; raises EquipmentNotFoundError."""
    try:
        return _EQUIPMENT_BY_ID[equipment_id]
    except KeyError:
        raise EquipmentNotFoundError(
            f"Equipment '{equipment_id}' is not in the circuit 1 registry."
        ) from None


def build_initial_state() -> dict[str, EquipmentState]:
    """Construction condition: every earth switch closed, everything else open."""
    return {eq.equipment_id: eq.initial_state for eq in OSS_EQUIPMENT}


def _groups(state: dict[str, EquipmentState], extra_closed: str | None = None) -> dict[str, str]:
    """Zone → representative of its connected group (union-find over closed CB/DS)."""
    parent = {z: z for z in ZONES}

    def find(z: str) -> str:
        while parent[z] != z:
            parent[z] = parent[parent[z]]
            z = parent[z]
        return z

    for eq in OSS_EQUIPMENT:
        if eq.equipment_type not in (_CB, _DS):
            continue
        if state.get(eq.equipment_id) == _CLOSED or eq.equipment_id == extra_closed:
            a, b = (find(z) for z in eq.zones)
            parent[a] = b
    return {z: find(z) for z in ZONES}


def zone_status(state: dict[str, EquipmentState]) -> dict[str, ZoneStatus]:
    """LIVE / EARTHED / DEAD for every zone. Interlocks make live+earthed impossible."""
    group = _groups(state)
    live = {group[SOURCE_ZONE]}
    earthed = {
        group[eq.zones[0]]
        for eq in OSS_EQUIPMENT
        if eq.equipment_type == _ES and state.get(eq.equipment_id) == _CLOSED
    }
    return {
        z: ZoneStatus.LIVE
        if group[z] in live
        else ZoneStatus.EARTHED
        if group[z] in earthed
        else ZoneStatus.DEAD
        for z in ZONES
    }


# ── Interlocks ─────────────────────────────────────────────────────


def check_interlocks(
    equipment_id: str,
    action: SwitchingAction,
    state: dict[str, EquipmentState],
    locked: frozenset[str] = frozenset(),
) -> list[InterlockViolation]:
    """All interlocks that block ``action`` on ``equipment_id`` (empty = allowed).

    ``locked`` holds the IDs of devices currently secured by an isolation lock.
    """
    eq = get_equipment_definition(equipment_id)
    closing = action == SwitchingAction.CLOSE
    violations: list[InterlockViolation] = []

    if equipment_id in locked:
        violations.append(
            InterlockViolation(
                "ILK-004",
                f"{equipment_id} is secured by an isolation lock — the lock must be removed "
                "under the Person in Control's authority before it can be operated.",
                equipment_id,
            )
        )

    status = zone_status(state)
    group = _groups(state)
    if closing and eq.equipment_type in (_CB, _DS):
        a, b = (status[z] for z in eq.zones)
        if {a, b} == {ZoneStatus.LIVE, ZoneStatus.EARTHED}:
            earthed_zone = eq.zones[0] if a == ZoneStatus.EARTHED else eq.zones[1]
            es = [
                e.equipment_id
                for e in OSS_EQUIPMENT
                if e.equipment_type == _ES
                and state.get(e.equipment_id) == _CLOSED
                and group[e.zones[0]] == group[earthed_zone]
            ]
            violations.append(
                InterlockViolation(
                    "ILK-001",
                    f"Closing {equipment_id} would connect a live section to earth through "
                    f"{', '.join(es)} — a bolted three-phase earth fault made by the switch.",
                    es[0] if es else equipment_id,
                )
            )

    if closing and eq.equipment_type == _ES and status[eq.zones[0]] == ZoneStatus.LIVE:
        violations.append(
            InterlockViolation(
                "ILK-002",
                f"Cannot close earth switch {equipment_id}: zone {eq.zones[0]} is live. "
                "Isolate it first.",
                equipment_id,
            )
        )

    series_cb = SERIES_CB.get(equipment_id)
    if series_cb and state.get(series_cb) == _CLOSED:
        violations.append(
            InterlockViolation(
                "ILK-003",
                f"Disconnector {equipment_id} may only operate off-load: open {series_cb} first.",
                series_cb,
            )
        )

    if (
        closing
        and eq.equipment_type == EquipmentType.WTG_GROUP
        and status[eq.zones[0]] != ZoneStatus.LIVE
    ):
        violations.append(
            InterlockViolation(
                "ILK-005",
                f"Turbines on {eq.zones[0]} cannot be released: the string is not energised.",
                equipment_id,
            )
        )

    return violations


def execute_switching_action(
    equipment_id: str,
    action: SwitchingAction,
    state: dict[str, EquipmentState],
    locked: frozenset[str] = frozenset(),
) -> SwitchingResult:
    """Validate and execute OPEN/CLOSE on one device; ``state`` is updated in place.

    Raises EquipmentNotFoundError, InvalidTransitionError or InterlockError.
    """
    get_equipment_definition(equipment_id)
    if action not in (SwitchingAction.OPEN, SwitchingAction.CLOSE):
        raise InvalidTransitionError(f"{action.value} is not a programme command.")
    current = state[equipment_id]
    target = _CLOSED if action == SwitchingAction.CLOSE else _OPEN
    if current == target:
        raise InvalidTransitionError(f"{equipment_id} is already {current.value}.")

    violations = check_interlocks(equipment_id, action, state, locked)
    if violations:
        raise InterlockError(
            f"{equipment_id} {action.value} blocked: "
            + "; ".join(f"{v.interlock_id} {v.description}" for v in violations),
            tuple(violations),
        )
    state[equipment_id] = target
    return SwitchingResult(equipment_id, action, current, target)


# ── Bay-controller types (used by the P3 SCADA bay controllers) ─────


class BayMode(StrEnum):
    """Operational mode of a bay controller.

    LOCAL:       All commands from local panel only; SCADA commands ignored.
                 Used during local maintenance and testing at the bay.
    REMOTE:      SCADA and remote commands accepted — normal operating state.
    MAINTENANCE: Bay isolated for maintenance work; all switching blocked.
                 Set when a PTW is issued for the bay.
    """

    LOCAL = "local"
    REMOTE = "remote"
    MAINTENANCE = "maintenance"


class RelayState(StrEnum):
    """State of the protection relay in a bay.

    ARMED:   Relay energised and monitoring for faults — normal state.
    TRIPPED: Relay has operated (fault detected); reset before reclose.
    BLOCKED: Relay manually disabled (e.g. during secondary injection test);
             CB close is still permitted by the interlock engine.
    TEST:    Relay in test mode with secondary injection active;
             all CB operations locked out by ILK-004.
    """

    ARMED = "armed"
    TRIPPED = "tripped"
    BLOCKED = "blocked"
    TEST = "test"


class SwitchPosition(StrEnum):
    """Detailed position states for bay-level equipment display.

    More granular than EquipmentState — used by the SCADA bay controller
    to represent positions that are not captured in the commissioning
    state machine (e.g. TRIPPED, FAILED, INTERMEDIATE).

    OPEN:          Contacts separated — no current path.
    CLOSED:        Contacts made — current can flow.
    TRIPPED:       CB only — opened by protection relay operation.
    FAILED:        Mechanism failure — position uncertain.
    INTERMEDIATE:  Contacts in motion or indeterminate state.
    """

    OPEN = "open"
    CLOSED = "closed"
    TRIPPED = "tripped"
    FAILED = "failed"
    INTERMEDIATE = "intermediate"


@dataclass(frozen=True)
class SynchroCheckResult:
    """Live voltage/frequency/phase difference across a tie CB (synchrocheck, ANSI 25).

    Before a coupler parallels two live busbars the differences must be small,
    otherwise the closing current can reach fault level:

      ΔV = |V_a − V_b| / V_nom × 100 %  < 5 %
      Δf = |f_a − f_b|                   < 0.1 Hz
      Δφ = |φ_a − φ_b|                   < 10°

    The limits are typical synchrocheck relay settings (project values), not
    figures from a standard.
    """

    delta_voltage_percent: float
    delta_frequency_hz: float
    delta_phase_deg: float

    @property
    def is_in_sync(self) -> bool:
        """True if all three synchronising conditions are within limits."""
        return (
            self.delta_voltage_percent < 5.0
            and self.delta_frequency_hz < 0.1
            and self.delta_phase_deg < 10.0
        )


@dataclass(frozen=True)
class SwitchCommand:
    """A SCADA switching command with operational context.

    Carries the operator identity and whether this is an automatic
    reclose (initiated by auto-reclose logic) or a manual command.
    Auto-reclose commands are subject to ILK-006.
    """

    equipment_id: str
    action: SwitchingAction
    operator_id: str
    is_auto_reclose: bool = False


@dataclass(frozen=True)
class InterlockResult:
    """Result of an interlock validation dry-run.

    Returned by the bay controller validate_command() endpoint so the
    SCADA UI can show green/red interlock status before the operator
    executes the command.
    """

    allowed: bool
    blocked_by: tuple[str, ...]  # Interlock IDs that fired, e.g. ('ILK-001',)
    reasons: tuple[str, ...]  # Human-readable block reason per interlock


@dataclass
class BayController:
    """Runtime state of a single bay controller.

    Aggregates all equipment positions and relay state for one feeder,
    transformer, or coupler bay. Used by the SCADA bay_controller service
    (P3) — one instance per bay.

    Physics — Bay Controller Role
    ------------------------------
    A bay controller is the digital representation of one feeder panel in
    the switchboard. It holds the current position of every switching device
    in the bay (CB, two disconnectors, earth switch) and the protection relay
    arming state. The interlock engine uses this state to validate commands
    before passing them to the primary equipment.

    Standard: IEC 61850-7-4 logical nodes CSWI (switch controller),
    XCBR (CB), XSWI (disconnector), CILO (interlock).

    Attributes
    ----------
    bay_id : str
        Unique identifier, e.g. 'BAY-OSS-66-01'.
    bay_name : str
        Human-readable label, e.g. 'String 1 Feeder'.
    voltage_kv : float
        Nominal voltage level of the bay [kV].
    bay_mode : BayMode
        LOCAL / REMOTE / MAINTENANCE.
    circuit_breaker : SwitchPosition
        CB position (OPEN / CLOSED / TRIPPED / FAILED).
    disconnector_bus : SwitchPosition
        Busbar side disconnector position.
    disconnector_line : SwitchPosition
        Line side disconnector (feeder bays; OPEN for transformer bays).
    earth_switch : SwitchPosition
        Earth switch position.
    protection_relay : RelayState
        Protection relay arming state.
    manual_isolation_active : bool
        True if a PTW or manual isolation tag-out is in place for this bay.
    synchrocheck : SynchroCheckResult | None
        Live synchrocheck measurements — only relevant for tie/coupler CBs.
    is_tie_cb : bool
        True if the bay CB is a bus coupler or tie CB requiring synchrocheck.
    """

    bay_id: str
    bay_name: str
    voltage_kv: float
    bay_mode: BayMode = BayMode.REMOTE
    circuit_breaker: SwitchPosition = SwitchPosition.OPEN
    disconnector_bus: SwitchPosition = SwitchPosition.OPEN
    disconnector_line: SwitchPosition = SwitchPosition.OPEN
    earth_switch: SwitchPosition = SwitchPosition.OPEN
    protection_relay: RelayState = RelayState.ARMED
    manual_isolation_active: bool = False
    synchrocheck: SynchroCheckResult | None = None
    is_tie_cb: bool = False
