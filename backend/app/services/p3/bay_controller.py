"""
Bay Controller service — M01 Interlock Engine.

Manages the runtime state of all OSS switchboard bays and enforces the
7-rule interlock engine before executing any switching command.

Physics — What a Bay Controller Does
--------------------------------------
A bay controller is the industrial computer (e.g. ABB REF630, Siemens
SIPROTEC 5) mounted on the switchboard panel. It:
  1. Reads equipment positions via hard-wired binary inputs
  2. Enforces interlocks in firmware — physically cannot send a close
     command if the interlock matrix is not satisfied
  3. Records every operation to the SOE log with ms-precision timestamps
  4. Communicates state to SCADA via IEC 61850 MMS or OPC-UA

This service replicates that behaviour in software:
  - Bay state stored in an in-memory dict (Redis-ready)
  - State persisted to DB (BayStateSnapshot) after every command
  - All operations flow through check_interlocks() from equipment_state.py

Standard: IEC 61850-7-4 logical nodes XCBR, XSWI, CSWI, CILO, RREC

OSS Bay Registry (66 kV switchboard — Baltic Wind Alpha)
---------------------------------------------------------
BAY-OSS-66-01: String 1 Feeder  (WTG-01 to WTG-05)
BAY-OSS-66-02: String 2 Feeder  (WTG-06 to WTG-11)
BAY-OSS-66-03: String 3 Feeder  (WTG-12 to WTG-17)
BAY-OSS-66-04: String 4 Feeder  (WTG-18 to WTG-22)
BAY-OSS-66-05: String 5 Feeder  (WTG-23 to WTG-28)
BAY-OSS-66-06: String 6 Feeder  (WTG-29 to WTG-34)
BAY-OSS-66-07: Transformer LV   (66 kV side of 66/220 kV step-up)
BAY-OSS-66-08: Bus Coupler      (tie CB, requires synchrocheck — ILK-007)
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.exceptions import NotFoundError, StateTransitionError
from app.services.p5.equipment_state import (
    BayController,
    BayMode,
    EquipmentState,
    InterlockResult,
    RelayState,
    SwitchCommand,
    SwitchingAction,
    SwitchPosition,
    SynchroCheckResult,
    check_interlocks,
)

# ── Bay registry ────────────────────────────────────────────────────
#
# Maps bay_id (str) → (equipment_id_prefix, is_tie_cb)
# Equipment IDs follow the commissioning programme convention:
#   CB-STR-01, DS-BUS-STR-01, DS-LINE-STR-01, ES-STR-01, etc.

_BAY_DEFINITIONS: list[dict[str, Any]] = [
    {
        "bay_id": "BAY-OSS-66-01",
        "display_name": "String 1 Feeder",
        "voltage_kv": 66.0,
        "bay_type": "FEEDER",
        "is_tie_cb": False,
        "cb_id": "CB-STR-01",
        "ds_bus_id": "DS-BUS-STR-01",
        "ds_line_id": "DS-LINE-STR-01",
        "es_id": "ES-STR-01",
        "description": "Feeds WTG-01 to WTG-05 via 66 kV array cable String 1",
    },
    {
        "bay_id": "BAY-OSS-66-02",
        "display_name": "String 2 Feeder",
        "voltage_kv": 66.0,
        "bay_type": "FEEDER",
        "is_tie_cb": False,
        "cb_id": "CB-STR-02",
        "ds_bus_id": "DS-BUS-STR-02",
        "ds_line_id": "DS-LINE-STR-02",
        "es_id": "ES-STR-02",
        "description": "Feeds WTG-06 to WTG-11 via 66 kV array cable String 2",
    },
    {
        "bay_id": "BAY-OSS-66-03",
        "display_name": "String 3 Feeder",
        "voltage_kv": 66.0,
        "bay_type": "FEEDER",
        "is_tie_cb": False,
        "cb_id": "CB-STR-03",
        "ds_bus_id": "DS-BUS-STR-03",
        "ds_line_id": "DS-LINE-STR-03",
        "es_id": "ES-STR-03",
        "description": "Feeds WTG-12 to WTG-17 via 66 kV array cable String 3",
    },
    {
        "bay_id": "BAY-OSS-66-04",
        "display_name": "String 4 Feeder",
        "voltage_kv": 66.0,
        "bay_type": "FEEDER",
        "is_tie_cb": False,
        "cb_id": "CB-STR-04",
        "ds_bus_id": "DS-BUS-STR-04",
        "ds_line_id": "DS-LINE-STR-04",
        "es_id": "ES-STR-04",
        "description": "Feeds WTG-18 to WTG-22 via 66 kV array cable String 4",
    },
    {
        "bay_id": "BAY-OSS-66-05",
        "display_name": "String 5 Feeder",
        "voltage_kv": 66.0,
        "bay_type": "FEEDER",
        "is_tie_cb": False,
        "cb_id": "CB-STR-05",
        "ds_bus_id": "DS-BUS-STR-05",
        "ds_line_id": "DS-LINE-STR-05",
        "es_id": "ES-STR-05",
        "description": "Feeds WTG-23 to WTG-28 via 66 kV array cable String 5",
    },
    {
        "bay_id": "BAY-OSS-66-06",
        "display_name": "String 6 Feeder",
        "voltage_kv": 66.0,
        "bay_type": "FEEDER",
        "is_tie_cb": False,
        "cb_id": "CB-STR-06",
        "ds_bus_id": "DS-BUS-STR-06",
        "ds_line_id": "DS-LINE-STR-06",
        "es_id": "ES-STR-06",
        "description": "Feeds WTG-29 to WTG-34 via 66 kV array cable String 6",
    },
    {
        "bay_id": "BAY-OSS-66-07",
        "display_name": "Transformer LV Side",
        "voltage_kv": 66.0,
        "bay_type": "TRANSFORMER",
        "is_tie_cb": False,
        "cb_id": "CB-TX-OSS-LV",
        "ds_bus_id": "DS-BUS-TX-LV",
        "ds_line_id": "DS-TX-LV",
        "es_id": "ES-OSS-66-01",
        "description": "66 kV LV side of OSS main transformer (TX-OSS-01, 220/66 kV)",
    },
    {
        "bay_id": "BAY-OSS-66-08",
        "display_name": "Bus Coupler",
        "voltage_kv": 66.0,
        "bay_type": "BUS_COUPLER",
        "is_tie_cb": True,  # ILK-007 synchrocheck required
        "cb_id": "CB-TIE-66-01",
        "ds_bus_id": "DS-BUS-TIE-A",
        "ds_line_id": "DS-BUS-TIE-B",
        "es_id": "ES-TIE-66-01",
        "description": "Bus coupler — parallels busbar sections A and B. Synchrocheck required.",
    },
]

# ── In-memory state store ───────────────────────────────────────────
#
# Keyed by bay_id string. In production, this would be Redis with
# sub-millisecond read latency. The structure is compatible with Redis
# hash serialisation — each BayController field maps to a hash key.

_bay_state: dict[str, BayController] = {}
_bay_meta: dict[str, dict[str, Any]] = {}


def _initialise_bays() -> None:
    """Build initial bay state from the registry definitions."""
    for defn in _BAY_DEFINITIONS:
        bay_id = defn["bay_id"]
        _bay_meta[bay_id] = defn
        _bay_state[bay_id] = BayController(
            bay_id=bay_id,
            bay_name=defn["display_name"],
            voltage_kv=defn["voltage_kv"],
            bay_mode=BayMode.REMOTE,
            # Start in safe de-energised state: all OPEN except earth switch CLOSED
            circuit_breaker=SwitchPosition.OPEN,
            disconnector_bus=SwitchPosition.OPEN,
            disconnector_line=SwitchPosition.OPEN,
            earth_switch=SwitchPosition.CLOSED,
            protection_relay=RelayState.ARMED,
            manual_isolation_active=False,
            synchrocheck=None,
            is_tie_cb=defn["is_tie_cb"],
        )


_initialise_bays()


# ── Equipment state → SwitchPosition conversion ──────────────────────


def _equipment_state_to_switch_position(state: EquipmentState) -> SwitchPosition:
    """Map commissioning EquipmentState to bay-level SwitchPosition."""
    return {
        EquipmentState.OPEN: SwitchPosition.OPEN,
        EquipmentState.CLOSED: SwitchPosition.CLOSED,
        EquipmentState.EARTHED: SwitchPosition.CLOSED,
        EquipmentState.RACKED_IN: SwitchPosition.OPEN,
        EquipmentState.RACKED_OUT: SwitchPosition.OPEN,
    }.get(state, SwitchPosition.INTERMEDIATE)


def _build_system_state(bay: BayController, meta: dict[str, Any]) -> dict[str, EquipmentState]:
    """Build the flat system_state dict needed by check_interlocks().

    The commissioning check_interlocks() expects:
      equipment_id → EquipmentState (OPEN or CLOSED)

    We only populate the equipment in this bay — the interlock engine
    only checks equipment associated with the target equipment_id.
    """

    # Map SwitchPosition to EquipmentState for interlock checks
    def pos_to_state(pos: SwitchPosition) -> EquipmentState:
        return EquipmentState.CLOSED if pos == SwitchPosition.CLOSED else EquipmentState.OPEN

    return {
        meta["cb_id"]: pos_to_state(bay.circuit_breaker),
        meta["ds_bus_id"]: pos_to_state(bay.disconnector_bus),
        meta["ds_line_id"]: pos_to_state(bay.disconnector_line),
        meta["es_id"]: pos_to_state(bay.earth_switch),
    }


# ── Public API ──────────────────────────────────────────────────────


def get_all_bays() -> list[BayController]:
    """Return current state of all 8 OSS 66 kV bays.

    Used by the fleet overview endpoint.
    """
    return list(_bay_state.values())


def get_bay_state(bay_id: str) -> BayController:
    """Return current state of a single bay.

    Parameters
    ----------
    bay_id : str
        Bay identifier, e.g. 'BAY-OSS-66-01'.

    Raises
    ------
    NotFoundError
        If bay_id is not in the registry.
    """
    if bay_id not in _bay_state:
        raise NotFoundError(f"Bay '{bay_id}' not found in OSS registry.")
    return _bay_state[bay_id]


def get_interlock_status(bay_id: str) -> list[dict[str, Any]]:
    """Return the current status of all 7 interlock rules for a bay.

    Each rule is evaluated against the current equipment state and
    returns: rule ID, description, whether it is currently active, and
    which equipment is blocking operations.

    Used by the interlock status panel in the SCADA UI.
    """
    if bay_id not in _bay_state:
        raise NotFoundError(f"Bay '{bay_id}' not found in OSS registry.")

    bay = _bay_state[bay_id]
    meta = _bay_meta[bay_id]
    cb_id = meta["cb_id"]
    es_id = meta["es_id"]
    ds_bus_id = meta["ds_bus_id"]

    rules = []

    # ILK-001: CB close blocked if earth switch CLOSED
    es_closed = bay.earth_switch == SwitchPosition.CLOSED
    rules.append(
        {
            "interlock_id": "ILK-001",
            "description": (
                f"Cannot close {cb_id} while earth switch {es_id} is CLOSED — bolted fault hazard"
            ),
            "currently_active": es_closed,
            "blocking_equipment": es_id if es_closed else None,
            "blocking_state": "closed" if es_closed else None,
        }
    )

    # ILK-002: Earth switch close blocked if CB CLOSED
    cb_closed = bay.circuit_breaker == SwitchPosition.CLOSED
    rules.append(
        {
            "interlock_id": "ILK-002",
            "description": (
                f"Cannot close earth switch {es_id} while {cb_id} is CLOSED"
                " — phase-to-earth fault hazard"
            ),
            "currently_active": cb_closed,
            "blocking_equipment": cb_id if cb_closed else None,
            "blocking_state": "closed" if cb_closed else None,
        }
    )

    # ILK-003: Disconnector blocked if CB CLOSED
    rules.append(
        {
            "interlock_id": "ILK-003",
            "description": (
                f"Cannot operate disconnector {ds_bus_id} while {cb_id} is CLOSED"
                " — no break under load"
            ),
            "currently_active": cb_closed,
            "blocking_equipment": cb_id if cb_closed else None,
            "blocking_state": "closed" if cb_closed else None,
        }
    )

    # ILK-004: CB close blocked if disconnector OPEN
    ds_open = bay.disconnector_bus == SwitchPosition.OPEN
    rules.append(
        {
            "interlock_id": "ILK-004",
            "description": (
                f"Cannot close {cb_id} while disconnector {ds_bus_id} is OPEN — no circuit path"
            ),
            "currently_active": ds_open,
            "blocking_equipment": ds_bus_id if ds_open else None,
            "blocking_state": "open" if ds_open else None,
        }
    )

    # ILK-005: Cannot rack out CB if CLOSED
    rules.append(
        {
            "interlock_id": "ILK-005",
            "description": f"Cannot rack out {cb_id} while CLOSED — arc flash hazard",
            "currently_active": cb_closed,
            "blocking_equipment": cb_id if cb_closed else None,
            "blocking_state": "closed" if cb_closed else None,
        }
    )

    # ILK-006: Auto-reclose blocked during manual isolation
    rules.append(
        {
            "interlock_id": "ILK-006",
            "description": "Auto-reclose blocked while manual isolation (PTW/tag-out) is active",
            "currently_active": bay.manual_isolation_active,
            "blocking_equipment": bay_id if bay.manual_isolation_active else None,
            "blocking_state": "isolation_active" if bay.manual_isolation_active else None,
        }
    )

    # ILK-007: Synchrocheck required for tie CB
    if bay.is_tie_cb:
        sync_missing = bay.synchrocheck is None
        sync_failed = bay.synchrocheck is not None and not bay.synchrocheck.is_in_sync
        sync_active = sync_missing or sync_failed
        rules.append(
            {
                "interlock_id": "ILK-007",
                "description": (
                    f"Synchrocheck required before closing tie CB {cb_id}"
                    " — DV < 5%, Df < 0.1 Hz, Dphi < 10 deg"
                ),
                "currently_active": sync_active,
                "blocking_equipment": cb_id if sync_active else None,
                "blocking_state": (
                    "sync_unavailable" if sync_missing else ("out_of_sync" if sync_failed else None)
                ),
            }
        )
    else:
        rules.append(
            {
                "interlock_id": "ILK-007",
                "description": "Synchrocheck not applicable — this is not a tie/coupler bay",
                "currently_active": False,
                "blocking_equipment": None,
                "blocking_state": None,
            }
        )

    return rules


def validate_command(
    bay_id: str,
    equipment_id: str,
    action: str,
    is_auto_reclose: bool = False,
    synchrocheck_data: dict[str, float] | None = None,
) -> InterlockResult:
    """Dry-run interlock check — does not change state.

    Used by the SCADA UI to show green/red before operator confirms.

    Parameters
    ----------
    bay_id : str
        Bay to check, e.g. 'BAY-OSS-66-01'.
    equipment_id : str
        Equipment to operate, e.g. 'CB-STR-01'.
    action : str
        Action string: 'open' / 'close' / 'earth' / etc.
    is_auto_reclose : bool
        True if validating an auto-reclose scenario (ILK-006).
    synchrocheck_data : dict | None
        {delta_voltage_percent, delta_frequency_hz, delta_phase_deg} for ILK-007.

    Returns
    -------
    InterlockResult
        allowed=True if command would succeed, otherwise blocked_by + reasons.
    """
    if bay_id not in _bay_state:
        raise NotFoundError(f"Bay '{bay_id}' not found.")

    bay = _bay_state[bay_id]
    meta = _bay_meta[bay_id]
    system_state = _build_system_state(bay, meta)

    try:
        switching_action = SwitchingAction(action.lower())
    except ValueError:
        return InterlockResult(
            allowed=False,
            blocked_by=("INVALID_ACTION",),
            reasons=(
                f"Unknown action '{action}'. Valid: open/close/earth/unearth/rack_in/rack_out",
            ),
        )

    synchrocheck = None
    if synchrocheck_data:
        synchrocheck = SynchroCheckResult(
            delta_voltage_percent=synchrocheck_data.get("delta_voltage_percent", 999.0),
            delta_frequency_hz=synchrocheck_data.get("delta_frequency_hz", 999.0),
            delta_phase_deg=synchrocheck_data.get("delta_phase_deg", 999.0),
        )

    violations = check_interlocks(
        equipment_id,
        switching_action,
        system_state,
        is_auto_reclose=is_auto_reclose,
        manual_isolation_active=bay.manual_isolation_active,
        is_tie_cb=bay.is_tie_cb,
        synchrocheck=synchrocheck,
    )

    if not violations:
        return InterlockResult(allowed=True, blocked_by=(), reasons=())

    return InterlockResult(
        allowed=False,
        blocked_by=tuple(v.interlock_id for v in violations),
        reasons=tuple(v.description for v in violations),
    )


def execute_command(
    bay_id: str,
    command: SwitchCommand,
    synchrocheck_data: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Execute a switching command after full interlock validation.

    Validation chain:
      1. Bay exists in registry
      2. Bay is in REMOTE mode (LOCAL and MAINTENANCE block remote commands)
      3. All 7 interlock rules pass
      4. Equipment state is updated
      5. Snapshot is written (returned for DB persistence by the router)

    Parameters
    ----------
    bay_id : str
        Target bay, e.g. 'BAY-OSS-66-01'.
    command : SwitchCommand
        The switch command with equipment_id, action, operator_id.
    synchrocheck_data : dict | None
        Synchrocheck measurements for ILK-007 (tie CB only).

    Returns
    -------
    dict
        Result including success, previous/new state, and snapshot data.

    Raises
    ------
    NotFoundError
        Bay not found.
    StateTransitionError
        Bay in LOCAL/MAINTENANCE mode, or interlock violation, or invalid transition.
    """
    if bay_id not in _bay_state:
        raise NotFoundError(f"Bay '{bay_id}' not found.")

    bay = _bay_state[bay_id]
    meta = _bay_meta[bay_id]

    # Mode check: remote commands require REMOTE mode
    if bay.bay_mode == BayMode.LOCAL:
        raise StateTransitionError(
            f"Bay '{bay_id}' is in LOCAL mode. Remote SCADA commands are not accepted. "
            f"Switch bay to REMOTE mode at the local panel."
        )
    if bay.bay_mode == BayMode.MAINTENANCE:
        raise StateTransitionError(
            f"Bay '{bay_id}' is in MAINTENANCE mode. All switching is blocked. "
            f"Clear PTW and return bay to REMOTE mode before operating."
        )

    system_state = _build_system_state(bay, meta)

    try:
        switching_action = SwitchingAction(command.action.lower())
    except ValueError as err:
        raise StateTransitionError(f"Unknown action '{command.action}'.") from err

    synchrocheck = None
    if synchrocheck_data:
        synchrocheck = SynchroCheckResult(
            delta_voltage_percent=synchrocheck_data.get("delta_voltage_percent", 999.0),
            delta_frequency_hz=synchrocheck_data.get("delta_frequency_hz", 999.0),
            delta_phase_deg=synchrocheck_data.get("delta_phase_deg", 999.0),
        )

    # Run interlock check
    violations = check_interlocks(
        command.equipment_id,
        switching_action,
        system_state,
        is_auto_reclose=command.is_auto_reclose,
        manual_isolation_active=bay.manual_isolation_active,
        is_tie_cb=bay.is_tie_cb,
        synchrocheck=synchrocheck,
    )
    if violations:
        reasons = "; ".join(v.description for v in violations)
        raise StateTransitionError(
            f"Interlock violation for {command.equipment_id} {command.action}: {reasons}"
        )

    # Determine previous state
    equipment_to_field = {
        meta["cb_id"]: "circuit_breaker",
        meta["ds_bus_id"]: "disconnector_bus",
        meta["ds_line_id"]: "disconnector_line",
        meta["es_id"]: "earth_switch",
    }

    field_name = equipment_to_field.get(command.equipment_id)
    if field_name is None:
        raise StateTransitionError(
            f"Equipment '{command.equipment_id}' is not part of bay '{bay_id}'. "
            f"Expected one of: {', '.join(equipment_to_field.keys())}"
        )

    previous_position = getattr(bay, field_name)

    # Map action to new position
    action_to_position: dict[SwitchingAction, SwitchPosition] = {
        SwitchingAction.CLOSE: SwitchPosition.CLOSED,
        SwitchingAction.OPEN: SwitchPosition.OPEN,
        SwitchingAction.EARTH: SwitchPosition.CLOSED,
        SwitchingAction.UNEARTH: SwitchPosition.OPEN,
        SwitchingAction.RACK_IN: SwitchPosition.OPEN,
        SwitchingAction.RACK_OUT: SwitchPosition.OPEN,
    }
    new_position = action_to_position[switching_action]

    # If it's a CB trip (by protection), mark as TRIPPED
    if field_name == "circuit_breaker" and switching_action == SwitchingAction.OPEN:
        # Normal open stays OPEN; protection trip is handled by set_relay_tripped()
        new_position = SwitchPosition.OPEN

    # Update state
    setattr(bay, field_name, new_position)
    timestamp = datetime.now(UTC)

    return {
        "success": True,
        "equipment_id": command.equipment_id,
        "action": command.action,
        "previous_state": previous_position.value,
        "new_state": new_position.value,
        "message": (
            f"{command.equipment_id}: {command.action} executed by {command.operator_id}. "
            f"{previous_position.value} → {new_position.value}"
        ),
        "timestamp": timestamp,
        "snapshot": {
            "bay_id": bay_id,
            "timestamp_utc": timestamp,
            "cb_state": bay.circuit_breaker.value,
            "disconnector_bus": bay.disconnector_bus.value,
            "disconnector_line": bay.disconnector_line.value,
            "earth_switch": bay.earth_switch.value,
            "relay_state": bay.protection_relay.value,
            "bay_mode": bay.bay_mode.value,
            "manual_isolation_active": bay.manual_isolation_active,
            "operator_id": command.operator_id,
            "trigger_command": command.action,
        },
    }


def set_bay_mode(bay_id: str, mode: str, operator_id: str) -> BayController:
    """Change bay operational mode (LOCAL / REMOTE / MAINTENANCE).

    Used when an engineer arrives at the local panel (→ LOCAL)
    or when a PTW is issued (→ MAINTENANCE).
    """
    if bay_id not in _bay_state:
        raise NotFoundError(f"Bay '{bay_id}' not found.")
    try:
        new_mode = BayMode(mode.lower())
    except ValueError as err:
        raise StateTransitionError(
            f"Unknown bay mode '{mode}'. Valid: local/remote/maintenance"
        ) from err
    _bay_state[bay_id].bay_mode = new_mode
    return _bay_state[bay_id]


def set_manual_isolation(bay_id: str, active: bool, operator_id: str) -> BayController:
    """Set or clear the manual isolation flag for a bay.

    Called when a PTW is issued (active=True) or withdrawn (active=False).
    When active, ILK-006 blocks auto-reclose on this bay.
    """
    if bay_id not in _bay_state:
        raise NotFoundError(f"Bay '{bay_id}' not found.")
    _bay_state[bay_id].manual_isolation_active = active
    return _bay_state[bay_id]


def update_synchrocheck(
    bay_id: str,
    delta_voltage_percent: float,
    delta_frequency_hz: float,
    delta_phase_deg: float,
) -> BayController:
    """Update live synchrocheck measurements for a tie CB bay.

    Called periodically by the measurement system (every 1–2 s) to
    keep the ILK-007 check current.
    """
    if bay_id not in _bay_state:
        raise NotFoundError(f"Bay '{bay_id}' not found.")
    if not _bay_state[bay_id].is_tie_cb:
        raise StateTransitionError(f"Bay '{bay_id}' is not a tie CB bay.")
    _bay_state[bay_id].synchrocheck = SynchroCheckResult(
        delta_voltage_percent=delta_voltage_percent,
        delta_frequency_hz=delta_frequency_hz,
        delta_phase_deg=delta_phase_deg,
    )
    return _bay_state[bay_id]
