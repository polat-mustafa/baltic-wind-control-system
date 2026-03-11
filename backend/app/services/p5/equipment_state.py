"""
Equipment state machine for HV commissioning switching operations.

Models the state transitions and safety interlocks for all OSS switchgear
(circuit breakers, disconnectors, earth switches, transformers) during the
30-step first energisation programme.

Physics — Why State Machines Matter in HV Switching
----------------------------------------------------
Closing a circuit breaker onto an earthed bus creates a bolted three-phase
short circuit. At 220 kV with 40 kA symmetrical fault current, the peak
making current reaches:

    I_peak = √2 × κ × I_sc = √2 × 1.8 × 40 kA ≈ 102 kA

where κ = 1.8 is the peak factor for X/R = 14 (IEC 60909-0 Table 1).
This 102 kA through-fault would destroy the CB, busbar, and CT within
one cycle (20 ms at 50 Hz). The equipment state machine prevents this by
enforcing interlocks: you physically cannot close CB-OSS-220-01 while
ES-OSS-220-01 remains CLOSED.

Similarly, opening a disconnector under load (even a few hundred amps at
66 kV) creates an arc that will not self-extinguish in air — the arc
ionises the SF6/air gap and causes a phase-to-earth fault. This is why
ILK-003 forbids closing (or opening) a disconnector while its associated
CB is CLOSED (carrying load current).

Standard — IEC 62271-100 & IEC 61936-1
---------------------------------------
- IEC 62271-100: High-voltage switchgear — AC circuit breakers.
  Defines CB rated characteristics: rated making capacity (peak),
  rated breaking capacity (symmetrical), operating sequence (O-0.3s-CO).
- IEC 61936-1: Power installations exceeding 1 kV AC — Part 1: Common rules.
  §7.6 Interlocking: "Interlocking shall prevent any switching operation
  that could lead to a dangerous condition." Our 5 interlocks implement
  this requirement.

Maths — State Machine Formalism
---------------------------------
The equipment state machine is a deterministic finite automaton (DFA) with
preconditions:

    M = (S, Σ, δ, s₀, Pre)

    S   = {OPEN, CLOSED, EARTHED, RACKED_IN, RACKED_OUT}  (state set)
    Σ   = {OPEN, CLOSE, EARTH, UNEARTH, RACK_IN, RACK_OUT} (input alphabet)
    δ   : S × Σ → S  (transition function, partial — not all combos valid)
    s₀  = depends on equipment type (CB: OPEN, ES: CLOSED for first energisation)
    Pre : S × Σ → bool  (precondition function — checks system-wide interlocks)

    An action a ∈ Σ is executed iff:
      1. δ(current_state, a) is defined  (valid transition)
      2. Pre(system_state, equipment_id, a) = True  (interlocks pass)

    If both hold: state[equipment_id] ← δ(current_state, a)
    If either fails: state unchanged, error returned.

References
----------
- IEC 62271-100:2021 — High-voltage switchgear and controlgear — AC CBs
- IEC 61936-1:2021 — Power installations exceeding 1 kV AC — Common rules
- IEC 60909-0:2016 — Short-circuit currents in three-phase AC systems
- IEEE C37.04-2018 — Rating structure for AC high-voltage circuit breakers
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

# ── Enums ──────────────────────────────────────────────────────────


class EquipmentType(StrEnum):
    """HV equipment types in the offshore substation.

    Each type has a specific set of valid states and transitions:
      CIRCUIT_BREAKER:  OPEN ↔ CLOSED, RACKED_IN ↔ RACKED_OUT
      DISCONNECTOR:     OPEN ↔ CLOSED
      EARTH_SWITCH:     OPEN ↔ CLOSED (CLOSED = earthed)
      TRANSFORMER:      OPEN ↔ CLOSED (energised/de-energised)
    """

    CIRCUIT_BREAKER = "circuit_breaker"
    DISCONNECTOR = "disconnector"
    EARTH_SWITCH = "earth_switch"
    TRANSFORMER = "transformer"


class EquipmentState(StrEnum):
    """Possible states for HV switchgear.

    OPEN:       Contacts separated — no current path
    CLOSED:     Contacts made — current can flow
    EARTHED:    Connected to earth (only meaningful for earth switches)
    RACKED_IN:  CB truck in service position (contacts can engage)
    RACKED_OUT: CB truck in test/isolated position (contacts cannot engage)
    """

    OPEN = "open"
    CLOSED = "closed"
    EARTHED = "earthed"
    RACKED_IN = "racked_in"
    RACKED_OUT = "racked_out"


class SwitchingAction(StrEnum):
    """Actions that can be performed on HV equipment.

    Each action maps to a specific state transition in the equipment
    state machine. Not all actions are valid for all equipment types.
    """

    OPEN = "open"
    CLOSE = "close"
    EARTH = "earth"
    UNEARTH = "unearth"
    RACK_IN = "rack_in"
    RACK_OUT = "rack_out"


# ── Data Models ────────────────────────────────────────────────────


@dataclass(frozen=True)
class EquipmentDefinition:
    """Immutable definition of a single piece of HV equipment.

    Attributes
    ----------
    equipment_id : str
        Unique identifier (e.g. 'CB-OSS-220-01').
    equipment_type : EquipmentType
        Category of equipment.
    voltage_kv : float
        Rated voltage in kV.
    location : str
        Physical location description.
    initial_state : EquipmentState
        State at programme creation (before any switching).
    """

    equipment_id: str
    equipment_type: EquipmentType
    voltage_kv: float
    location: str
    initial_state: EquipmentState


@dataclass(frozen=True)
class InterlockViolation:
    """Details of a safety interlock violation.

    Attributes
    ----------
    interlock_id : str
        Interlock code (e.g. 'ILK-001').
    description : str
        Human-readable explanation of the safety rule.
    blocking_equipment : str
        Equipment ID that caused the interlock to trigger.
    blocking_state : EquipmentState
        Current state of the blocking equipment.
    """

    interlock_id: str
    description: str
    blocking_equipment: str
    blocking_state: EquipmentState


@dataclass(frozen=True)
class SwitchingResult:
    """Immutable result of a switching action attempt.

    Attributes
    ----------
    success : bool
        True if the action was executed.
    equipment_id : str
        Equipment that was targeted.
    action : SwitchingAction
        Action that was attempted.
    previous_state : EquipmentState
        State before the action.
    new_state : EquipmentState
        State after the action (same as previous if failed).
    message : str
        Human-readable result description.
    interlock_violations : tuple[InterlockViolation, ...]
        Any interlock violations that prevented the action.
    timestamp : datetime
        UTC time of the action attempt.
    """

    success: bool
    equipment_id: str
    action: SwitchingAction
    previous_state: EquipmentState
    new_state: EquipmentState
    message: str
    interlock_violations: tuple[InterlockViolation, ...] = ()
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))


# ── Transition Maps ──────────────────────────────────────────────
#
# Each equipment type has a set of valid (state, action) → new_state
# transitions. Any combination not in the map is an invalid transition.

CB_TRANSITIONS: dict[tuple[EquipmentState, SwitchingAction], EquipmentState] = {
    (EquipmentState.OPEN, SwitchingAction.CLOSE): EquipmentState.CLOSED,
    (EquipmentState.CLOSED, SwitchingAction.OPEN): EquipmentState.OPEN,
    (EquipmentState.OPEN, SwitchingAction.RACK_OUT): EquipmentState.RACKED_OUT,
    (EquipmentState.RACKED_OUT, SwitchingAction.RACK_IN): EquipmentState.OPEN,
}

DS_TRANSITIONS: dict[tuple[EquipmentState, SwitchingAction], EquipmentState] = {
    (EquipmentState.OPEN, SwitchingAction.CLOSE): EquipmentState.CLOSED,
    (EquipmentState.CLOSED, SwitchingAction.OPEN): EquipmentState.OPEN,
}

ES_TRANSITIONS: dict[tuple[EquipmentState, SwitchingAction], EquipmentState] = {
    (EquipmentState.CLOSED, SwitchingAction.OPEN): EquipmentState.OPEN,
    (EquipmentState.OPEN, SwitchingAction.CLOSE): EquipmentState.CLOSED,
}

TX_TRANSITIONS: dict[tuple[EquipmentState, SwitchingAction], EquipmentState] = {
    (EquipmentState.OPEN, SwitchingAction.CLOSE): EquipmentState.CLOSED,
    (EquipmentState.CLOSED, SwitchingAction.OPEN): EquipmentState.OPEN,
}

TRANSITION_MAPS: dict[
    EquipmentType,
    dict[tuple[EquipmentState, SwitchingAction], EquipmentState],
] = {
    EquipmentType.CIRCUIT_BREAKER: CB_TRANSITIONS,
    EquipmentType.DISCONNECTOR: DS_TRANSITIONS,
    EquipmentType.EARTH_SWITCH: ES_TRANSITIONS,
    EquipmentType.TRANSFORMER: TX_TRANSITIONS,
}


# ── Equipment Registry ──────────────────────────────────────────
#
# All OSS equipment involved in the 30-step first energisation programme.
# Initial states reflect the de-energised, earthed, locked-out condition
# at programme start (pre-energisation).

OSS_EQUIPMENT: tuple[EquipmentDefinition, ...] = (
    # ── Earth Switches (all CLOSED = earthed at start) ──
    EquipmentDefinition(
        equipment_id="ES-ON-220-01",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=220.0,
        location="Onshore substation 220 kV bay",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-OSS-220-01",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=220.0,
        location="OSS 220 kV busbar",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-OSS-66-01",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=66.0,
        location="OSS 66 kV busbar",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-STR-01",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=66.0,
        location="String 1 feeder bay",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-STR-02",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=66.0,
        location="String 2 feeder bay",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-STR-03",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=66.0,
        location="String 3 feeder bay",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-STR-04",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=66.0,
        location="String 4 feeder bay",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-STR-05",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=66.0,
        location="String 5 feeder bay",
        initial_state=EquipmentState.CLOSED,
    ),
    EquipmentDefinition(
        equipment_id="ES-STR-06",
        equipment_type=EquipmentType.EARTH_SWITCH,
        voltage_kv=66.0,
        location="String 6 feeder bay",
        initial_state=EquipmentState.CLOSED,
    ),
    # ── Disconnectors (all OPEN at start) ──
    EquipmentDefinition(
        equipment_id="DS-ON-220-01",
        equipment_type=EquipmentType.DISCONNECTOR,
        voltage_kv=220.0,
        location="Onshore substation 220 kV bay",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="DS-OSS-220-01",
        equipment_type=EquipmentType.DISCONNECTOR,
        voltage_kv=220.0,
        location="OSS 220 kV bay",
        initial_state=EquipmentState.OPEN,
    ),
    # ── Circuit Breakers (all OPEN at start) ──
    EquipmentDefinition(
        equipment_id="CB-ON-220-01",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=220.0,
        location="Onshore substation 220 kV bay",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-OSS-220-01",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=220.0,
        location="OSS 220 kV busbar CB",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-TX-OSS-HV",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=220.0,
        location="OSS transformer HV side",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-TX-OSS-LV",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=66.0,
        location="OSS transformer LV side",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-STR-01",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=66.0,
        location="String 1 feeder CB",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-STR-02",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=66.0,
        location="String 2 feeder CB",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-STR-03",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=66.0,
        location="String 3 feeder CB",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-STR-04",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=66.0,
        location="String 4 feeder CB",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-STR-05",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=66.0,
        location="String 5 feeder CB",
        initial_state=EquipmentState.OPEN,
    ),
    EquipmentDefinition(
        equipment_id="CB-STR-06",
        equipment_type=EquipmentType.CIRCUIT_BREAKER,
        voltage_kv=66.0,
        location="String 6 feeder CB",
        initial_state=EquipmentState.OPEN,
    ),
    # ── Transformer (OPEN = de-energised at start) ──
    EquipmentDefinition(
        equipment_id="TX-OSS-01",
        equipment_type=EquipmentType.TRANSFORMER,
        voltage_kv=220.0,
        location="OSS main power transformer 220/66 kV",
        initial_state=EquipmentState.OPEN,
    ),
)

# Lookup for quick access by equipment_id
_EQUIPMENT_BY_ID: dict[str, EquipmentDefinition] = {eq.equipment_id: eq for eq in OSS_EQUIPMENT}


# ── Interlock Definitions ────────────────────────────────────────
#
# IEC 61936-1 §7.6: "Interlocking shall prevent any switching operation
# that could lead to a dangerous condition."
#
# Each interlock maps (target_equipment_id, action) → list of equipment
# that must NOT be in a specific state.

# CB-to-ES pairings for interlocks. Each CB has associated earth switches
# that must be checked before closing.
_CB_ES_PAIRS: dict[str, list[str]] = {
    "CB-ON-220-01": ["ES-ON-220-01"],
    "CB-OSS-220-01": ["ES-OSS-220-01"],
    "CB-TX-OSS-HV": ["ES-OSS-220-01"],
    "CB-TX-OSS-LV": ["ES-OSS-66-01"],
    "CB-STR-01": ["ES-STR-01"],
    "CB-STR-02": ["ES-STR-02"],
    "CB-STR-03": ["ES-STR-03"],
    "CB-STR-04": ["ES-STR-04"],
    "CB-STR-05": ["ES-STR-05"],
    "CB-STR-06": ["ES-STR-06"],
}

# ES-to-CB pairings (reverse of above)
_ES_CB_PAIRS: dict[str, list[str]] = {}
for _cb_id, _es_ids in _CB_ES_PAIRS.items():
    for _es_id in _es_ids:
        _ES_CB_PAIRS.setdefault(_es_id, []).append(_cb_id)

# CB-to-DS pairings: which disconnectors must be CLOSED before CB can close
_CB_DS_PAIRS: dict[str, list[str]] = {
    "CB-ON-220-01": ["DS-ON-220-01"],
    "CB-OSS-220-01": ["DS-OSS-220-01"],
}

# DS-to-CB pairings: which CBs must be OPEN before DS can operate
_DS_CB_PAIRS: dict[str, list[str]] = {}
for _cb_id, _ds_ids in _CB_DS_PAIRS.items():
    for _ds_id in _ds_ids:
        _DS_CB_PAIRS.setdefault(_ds_id, []).append(_cb_id)


# ── Exceptions ───────────────────────────────────────────────────

from app.core.exceptions import NotFoundError, StateTransitionError  # noqa: E402


class InvalidTransitionError(StateTransitionError):
    """Raised when a switching action is not a valid state transition."""


class InterlockError(StateTransitionError):
    """Raised when a switching action violates safety interlocks."""

    def __init__(self, message: str, violations: tuple[InterlockViolation, ...]) -> None:
        super().__init__(message)
        self.violations = violations


class EquipmentNotFoundError(NotFoundError):
    """Raised when an equipment ID is not in the registry."""


# ── Public Functions ─────────────────────────────────────────────


def get_equipment_definition(equipment_id: str) -> EquipmentDefinition:
    """Look up equipment definition by ID.

    Parameters
    ----------
    equipment_id : str
        Equipment identifier (e.g. 'CB-OSS-220-01').

    Returns
    -------
    EquipmentDefinition
        The equipment definition.

    Raises
    ------
    EquipmentNotFoundError
        If the equipment ID is not in the registry.
    """
    if equipment_id not in _EQUIPMENT_BY_ID:
        raise EquipmentNotFoundError(f"Equipment '{equipment_id}' not found in OSS registry.")
    return _EQUIPMENT_BY_ID[equipment_id]


def build_initial_state() -> dict[str, EquipmentState]:
    """Build the initial equipment state map for a new programme.

    All earth switches CLOSED (system earthed), all CBs OPEN,
    all disconnectors OPEN, transformer de-energised.

    Returns
    -------
    dict[str, EquipmentState]
        Equipment ID → initial state.
    """
    return {eq.equipment_id: eq.initial_state for eq in OSS_EQUIPMENT}


def check_interlocks(
    equipment_id: str,
    action: SwitchingAction,
    system_state: dict[str, EquipmentState],
) -> list[InterlockViolation]:
    """Check all safety interlocks before executing a switching action.

    Implements the 5 IEC 61936-1 interlocks:
      ILK-001: Cannot close CB if associated earth switch CLOSED
      ILK-002: Cannot close earth switch if associated CB CLOSED
      ILK-003: Cannot close/open disconnector if associated CB CLOSED
      ILK-004: Cannot close CB if associated disconnector OPEN
      ILK-005: Cannot rack out CB if CLOSED

    Parameters
    ----------
    equipment_id : str
        Equipment to act on.
    action : SwitchingAction
        Proposed switching action.
    system_state : dict[str, EquipmentState]
        Current state of all equipment.

    Returns
    -------
    list[InterlockViolation]
        Empty if all interlocks pass; otherwise the violations.
    """
    violations: list[InterlockViolation] = []
    equipment_def = _EQUIPMENT_BY_ID.get(equipment_id)
    if equipment_def is None:
        return violations

    eq_type = equipment_def.equipment_type

    # ILK-001: Cannot close CB if earth switch CLOSED
    if eq_type == EquipmentType.CIRCUIT_BREAKER and action == SwitchingAction.CLOSE:
        for es_id in _CB_ES_PAIRS.get(equipment_id, []):
            if system_state.get(es_id) == EquipmentState.CLOSED:
                violations.append(
                    InterlockViolation(
                        interlock_id="ILK-001",
                        description=(
                            f"Cannot close {equipment_id}: earth switch "
                            f"{es_id} is CLOSED. Opening CB onto earthed bus "
                            f"would cause a bolted three-phase fault."
                        ),
                        blocking_equipment=es_id,
                        blocking_state=EquipmentState.CLOSED,
                    )
                )

    # ILK-002: Cannot close earth switch if CB CLOSED
    if eq_type == EquipmentType.EARTH_SWITCH and action == SwitchingAction.CLOSE:
        for cb_id in _ES_CB_PAIRS.get(equipment_id, []):
            if system_state.get(cb_id) == EquipmentState.CLOSED:
                violations.append(
                    InterlockViolation(
                        interlock_id="ILK-002",
                        description=(
                            f"Cannot close earth switch {equipment_id}: "
                            f"circuit breaker {cb_id} is CLOSED. Earthing a "
                            f"live bus would cause a phase-to-earth fault."
                        ),
                        blocking_equipment=cb_id,
                        blocking_state=EquipmentState.CLOSED,
                    )
                )

    # ILK-003: Cannot close or open disconnector if CB CLOSED (no-load switching)
    if eq_type == EquipmentType.DISCONNECTOR and action in (
        SwitchingAction.CLOSE,
        SwitchingAction.OPEN,
    ):
        for cb_id in _DS_CB_PAIRS.get(equipment_id, []):
            if system_state.get(cb_id) == EquipmentState.CLOSED:
                violations.append(
                    InterlockViolation(
                        interlock_id="ILK-003",
                        description=(
                            f"Cannot {'close' if action == SwitchingAction.CLOSE else 'open'} "
                            f"disconnector {equipment_id}: circuit breaker "
                            f"{cb_id} is CLOSED. Disconnectors must only "
                            f"operate under no-load conditions."
                        ),
                        blocking_equipment=cb_id,
                        blocking_state=EquipmentState.CLOSED,
                    )
                )

    # ILK-004: Cannot close CB if associated disconnector OPEN
    if eq_type == EquipmentType.CIRCUIT_BREAKER and action == SwitchingAction.CLOSE:
        for ds_id in _CB_DS_PAIRS.get(equipment_id, []):
            if system_state.get(ds_id) == EquipmentState.OPEN:
                violations.append(
                    InterlockViolation(
                        interlock_id="ILK-004",
                        description=(
                            f"Cannot close {equipment_id}: disconnector "
                            f"{ds_id} is OPEN. CB must have a closed path "
                            f"through the disconnector before closing."
                        ),
                        blocking_equipment=ds_id,
                        blocking_state=EquipmentState.OPEN,
                    )
                )

    # ILK-005: Cannot rack out CB if CLOSED
    if (
        eq_type == EquipmentType.CIRCUIT_BREAKER
        and action == SwitchingAction.RACK_OUT
        and system_state.get(equipment_id) == EquipmentState.CLOSED
    ):
        violations.append(
            InterlockViolation(
                interlock_id="ILK-005",
                description=(
                    f"Cannot rack out {equipment_id}: CB is CLOSED. "
                    f"Open the CB before racking out to avoid arc flash."
                ),
                blocking_equipment=equipment_id,
                blocking_state=EquipmentState.CLOSED,
            )
        )

    return violations


def execute_switching_action(
    equipment_id: str,
    action: SwitchingAction,
    system_state: dict[str, EquipmentState],
) -> SwitchingResult:
    """Execute a switching action with full validation and interlock checking.

    Validation chain:
    1. Equipment exists in registry
    2. Action is a valid transition for this equipment type and current state
    3. All safety interlocks pass
    4. State is updated

    Parameters
    ----------
    equipment_id : str
        Equipment to act on.
    action : SwitchingAction
        Switching action to perform.
    system_state : dict[str, EquipmentState]
        Mutable state map — updated in place on success.

    Returns
    -------
    SwitchingResult
        Result of the action attempt.

    Raises
    ------
    EquipmentNotFoundError
        If the equipment ID is not in the registry.
    InvalidTransitionError
        If the action is not valid for the current state.
    InterlockError
        If safety interlocks prevent the action.
    """
    # 1. Equipment exists
    if equipment_id not in _EQUIPMENT_BY_ID:
        raise EquipmentNotFoundError(f"Equipment '{equipment_id}' not found in OSS registry.")

    equipment_def = _EQUIPMENT_BY_ID[equipment_id]
    current_state = system_state[equipment_id]

    # 2. Valid transition
    transition_map = TRANSITION_MAPS[equipment_def.equipment_type]
    transition_key = (current_state, action)

    if transition_key not in transition_map:
        raise InvalidTransitionError(
            f"Invalid transition: {equipment_id} cannot {action.value} "
            f"from state {current_state.value}."
        )

    # 3. Interlock check
    violations = check_interlocks(equipment_id, action, system_state)
    if violations:
        msg = f"Interlock violation(s) for {equipment_id} {action.value}: "
        msg += "; ".join(v.description for v in violations)
        raise InterlockError(msg, tuple(violations))

    # 4. Execute
    new_state = transition_map[transition_key]
    system_state[equipment_id] = new_state

    return SwitchingResult(
        success=True,
        equipment_id=equipment_id,
        action=action,
        previous_state=current_state,
        new_state=new_state,
        message=(
            f"{equipment_id}: {action.value} executed. {current_state.value} → {new_state.value}"
        ),
    )
