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
  - Bay state stored in an in-memory dict per farm, initialised to the running plant
    (feeders and incomers closed, bus coupler open, earth switches open)
  - Every command passes the bay's own 7 interlock rules (_violations) —
    the same rules the interlock status endpoint reports

Standard: IEC 61850-7-4 logical nodes XCBR, XSWI, CSWI, CILO, RREC

OSS Bay Registry (66 kV switchboard) — built from the farm (``bay_definitions``):
one feeder per string, strings 1…⌈n/2⌉ on section A. SB-510:
---------------------------------------------------------
BAY-OSS-66-01: String 1 Feeder  (WTG-01 to WTG-06)
BAY-OSS-66-02: String 2 Feeder  (WTG-07 to WTG-12)
BAY-OSS-66-03: String 3 Feeder  (WTG-13 to WTG-18)
BAY-OSS-66-04: String 4 Feeder  (WTG-19 to WTG-24)
BAY-OSS-66-05: String 5 Feeder  (WTG-25 to WTG-29)
BAY-OSS-66-06: String 6 Feeder  (WTG-30 to WTG-34)
(same 6-6-6-6-5-5 split as network_model.STRING_LAYOUT)
Strings 1-3 on busbar section A, 4-6 on section B (network_model.STRING_BUSBAR_SECTION)
BAY-OSS-66-07: Transformer A LV (66 kV side of TX-OSS-01, busbar section A)
BAY-OSS-66-08: Bus Coupler      (tie CB, requires synchrocheck — ILK-007)
BAY-OSS-66-09: Transformer B LV (66 kV side of TX-OSS-02, busbar section B)
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

from app.core.exceptions import NotFoundError, StateTransitionError
from app.services.p2.network_model import SB510, FarmSpec
from app.services.p5.equipment_state import (
    BayController,
    BayMode,
    InterlockResult,
    RelayState,
    SwitchCommand,
    SwitchingAction,
    SwitchPosition,
    SynchroCheckResult,
)

# ── Bay registry ────────────────────────────────────────────────────
#
# One feeder bay per string (BAY-OSS-66-01 … n), then incomer A (n+1), the bus
# coupler (n+2) and incomer B (n+3) — SB-510: 01…06, 07, 08, 09. Equipment IDs
# follow the commissioning programme: CB-STR-01, DS-BUS-STR-01, ES-STR-01, …


def bay_name(n: int) -> str:
    return f"BAY-OSS-66-{n:02d}"


def _bay_def(
    n: int, name: str, bay_type: str, ids: tuple[str, str, str, str], desc: str
) -> dict[str, Any]:
    cb, ds_bus, ds_line, es = ids
    return {
        "bay_id": bay_name(n),
        "display_name": name,
        "voltage_kv": 66.0,
        "bay_type": bay_type,
        "is_tie_cb": bay_type == "BUS_COUPLER",  # ILK-007 synchrocheck required
        "cb_id": cb,
        "ds_bus_id": ds_bus,
        "ds_line_id": ds_line,
        "es_id": es,
        "description": desc,
    }


@lru_cache(maxsize=64)
def bay_definitions(spec: FarmSpec = SB510) -> tuple[dict[str, Any], ...]:
    """The 66 kV switchboard of a farm: string feeders, two incomers and the coupler."""
    n = len(spec.string_layout)
    out = []
    first = 1
    for s, k in enumerate(spec.string_layout, start=1):
        last = first + k - 1
        wtg = f"WTG-{first:02d}" if k == 1 else f"WTG-{first:02d} to WTG-{last:02d}"
        section = "A" if s <= spec.section_a_strings else "B"
        out.append(
            _bay_def(
                s,
                f"String {s} Feeder",
                "FEEDER",
                (
                    f"CB-STR-{s:02d}",
                    f"DS-BUS-STR-{s:02d}",
                    f"DS-LINE-STR-{s:02d}",
                    f"ES-STR-{s:02d}",
                ),
                f"Feeds {wtg} via 66 kV array cable String {s} (busbar section {section})",
            )
        )
        first = last + 1
    mva = f"220/66 kV {spec.oss_trafo_mva:.0f} MVA"
    out += [
        _bay_def(
            n + 1,
            "Transformer A LV Side",
            "TRANSFORMER",
            ("CB-TX-OSS-LV", "DS-BUS-TX-LV", "DS-TX-LV", "ES-OSS-66-01"),
            f"66 kV LV side of OSS transformer 1 (TX-OSS-01, {mva})",
        ),
        _bay_def(
            n + 2,
            "Bus Coupler",
            "BUS_COUPLER",
            ("CB-TIE-66-01", "DS-BUS-TIE-A", "DS-BUS-TIE-B", "ES-TIE-66-01"),
            "Bus coupler — parallels busbar sections A and B. Synchrocheck required.",
        ),
        _bay_def(
            n + 3,
            "Transformer B LV Side",
            "TRANSFORMER",
            ("CB-TX-OSS-02-LV", "DS-BUS-TX2-LV", "DS-TX2-LV", "ES-OSS-66-02"),
            f"66 kV LV side of OSS transformer 2 (TX-OSS-02, {mva})",
        ),
    ]
    return tuple(out)


_BAY_DEFINITIONS = bay_definitions(SB510)


@lru_cache(maxsize=64)
def _registry(spec: FarmSpec) -> dict[str, dict[str, Any]]:
    return {d["bay_id"]: d for d in bay_definitions(spec)}


def bay_meta(bay_id: str, spec: FarmSpec = SB510) -> dict[str, Any]:
    """Registry entry of a bay (equipment IDs, type, description)."""
    meta = _registry(spec).get(bay_id)
    if meta is None:
        raise NotFoundError(f"Bay '{bay_id}' not found in OSS registry.")
    return meta


# ── In-memory state store ───────────────────────────────────────────
#
# One switchboard per farm, keyed by its FarmSpec (SB-510 or a learner's
# design from the X-Farm header). In production, this would be Redis.
# ponytail: process-local LRU of 32 farms — an evicted farm restarts as the
# running plant; key by project id in Redis if state must survive restarts.

_MAX_FARMS = 32
_farms: OrderedDict[FarmSpec, dict[str, BayController]] = OrderedDict()


def _initial_state(defn: dict[str, Any]) -> BayController:
    return BayController(
        bay_id=defn["bay_id"],
        bay_name=defn["display_name"],
        voltage_kv=defn["voltage_kv"],
        bay_mode=BayMode.REMOTE,
        # Plant in service: bay connected, earth switch open; the bus
        # coupler runs open (one transformer per busbar section)
        circuit_breaker=SwitchPosition.OPEN if defn["is_tie_cb"] else SwitchPosition.CLOSED,
        disconnector_bus=SwitchPosition.CLOSED,
        disconnector_line=SwitchPosition.CLOSED,
        earth_switch=SwitchPosition.OPEN,
        protection_relay=RelayState.ARMED,
        manual_isolation_active=False,
        synchrocheck=None,
        is_tie_cb=defn["is_tie_cb"],
    )


def _initialise_bays() -> None:
    """Reset every farm to the running plant (tests, restart)."""
    _farms.clear()


def _bays(spec: FarmSpec) -> dict[str, BayController]:
    bays = _farms.get(spec)
    if bays is None:
        bays = {d["bay_id"]: _initial_state(d) for d in bay_definitions(spec)}
        _farms[spec] = bays
        if len(_farms) > _MAX_FARMS:
            _farms.popitem(last=False)
    _farms.move_to_end(spec)
    return bays


def _bay(spec: FarmSpec, bay_id: str) -> BayController:
    bay = _bays(spec).get(bay_id)
    if bay is None:
        raise NotFoundError(f"Bay '{bay_id}' not found in OSS registry.")
    return bay


def _incomers(spec: FarmSpec) -> tuple[str, str]:
    a, b = (d["bay_id"] for d in bay_definitions(spec) if d["bay_type"] == "TRANSFORMER")
    return a, b


def _violations(
    bay: BayController,
    meta: dict[str, Any],
    equipment_id: str,
    action: SwitchingAction,
    is_auto_reclose: bool,
    spec: FarmSpec,
) -> list[tuple[str, str]]:
    """Bay interlock rules ILK-001…007 → [(rule id, reason)] that block the command."""
    cb_closed = bay.circuit_breaker == SwitchPosition.CLOSED
    closing = action in (SwitchingAction.CLOSE, SwitchingAction.EARTH)
    out: list[tuple[str, str]] = []
    if equipment_id == meta["cb_id"]:
        if closing and bay.earth_switch == SwitchPosition.CLOSED:
            out.append(("ILK-001", f"{meta['es_id']} is CLOSED — closing onto an earthed bay"))
        if closing and bay.disconnector_bus != SwitchPosition.CLOSED:
            out.append(("ILK-004", f"{meta['ds_bus_id']} is OPEN — no circuit path"))
        if action == SwitchingAction.RACK_OUT and cb_closed:
            out.append(("ILK-005", f"{meta['cb_id']} is CLOSED — cannot rack out under load"))
        if closing and is_auto_reclose and bay.manual_isolation_active:
            out.append(("ILK-006", "auto-reclose blocked while a PTW isolation is active"))
        if closing and bay.protection_relay == RelayState.TRIPPED:
            out.append(("ILK-006", "protection lockout (86) — reset the relay before closing"))
        if closing:
            out.extend(_parallel_violation(bay, spec))
    elif equipment_id == meta["es_id"]:
        if closing and cb_closed:
            out.append(("ILK-002", f"{meta['cb_id']} is CLOSED — earthing a live bay"))
    elif equipment_id in (meta["ds_bus_id"], meta["ds_line_id"]):
        if cb_closed:
            out.append(("ILK-003", f"{meta['cb_id']} is CLOSED — disconnectors do not break load"))
    return out


def _parallel_violation(bay: BayController, spec: FarmSpec) -> list[tuple[str, str]]:
    """ILK-007: the 66 kV sections never run in parallel through the coupler.

    Two OSS transformers in parallel raise the 66 kV fault level towards
    the 25 kA switchgear rating. The coupler therefore closes only dead-bus
    (one incomer open) — the synchrocheck (ANSI 25) dead-bus mode — and an
    incomer only closes while the coupler is open or the other incomer is open.
    """
    state = _bays(spec)
    incomers = _incomers(spec)
    closed = {b: state[b].circuit_breaker == SwitchPosition.CLOSED for b in incomers}
    coupler = next(b for b in state.values() if b.is_tie_cb)
    if bay.is_tie_cb and all(closed.values()):
        return [
            (
                "ILK-007",
                "both transformer incomers closed — live-live closing would parallel TX-OSS-01/02",
            )
        ]
    if bay.bay_id in incomers and coupler.circuit_breaker == SwitchPosition.CLOSED:
        other = next(b for b in incomers if b != bay.bay_id)
        if closed[other]:
            return [
                (
                    "ILK-007",
                    "bus coupler closed and the other incomer in service"
                    " — would parallel TX-OSS-01/02",
                )
            ]
    return []


# ── Public API ──────────────────────────────────────────────────────


def get_all_bays(spec: FarmSpec = SB510) -> list[BayController]:
    """Return current state of all OSS 66 kV bays (strings + 3; SB-510: 9).

    Used by the fleet overview endpoint.
    """
    return list(_bays(spec).values())


def get_bay_state(bay_id: str, spec: FarmSpec = SB510) -> BayController:
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
    return _bay(spec, bay_id)


def get_interlock_status(bay_id: str, spec: FarmSpec = SB510) -> list[dict[str, Any]]:
    """Return the current status of all 7 interlock rules for a bay.

    Each rule is evaluated against the current equipment state and
    returns: rule ID, description, whether it is currently active, and
    which equipment is blocking operations.

    Used by the interlock status panel in the SCADA UI.
    """
    bay = _bay(spec, bay_id)
    meta = bay_meta(bay_id, spec)
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

    # ILK-007: no parallel operation of the OSS transformers via the coupler
    coupler_or_incomer = bay.is_tie_cb or bay_id in _incomers(spec)
    parallel = _parallel_violation(bay, spec) if coupler_or_incomer else []
    rules.append(
        {
            "interlock_id": "ILK-007",
            "description": (
                "Bus coupler closes dead-bus only — the 66 kV sections never run in parallel"
                if coupler_or_incomer
                else "Coupler / incomer rule — not applicable to a feeder bay"
            ),
            "currently_active": bool(parallel),
            "blocking_equipment": cb_id if parallel else None,
            "blocking_state": "parallel_transformers" if parallel else None,
        }
    )

    return rules


def validate_command(
    bay_id: str,
    equipment_id: str,
    action: str,
    is_auto_reclose: bool = False,
    synchrocheck_data: dict[str, float] | None = None,
    spec: FarmSpec = SB510,
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
    bay = _bay(spec, bay_id)
    meta = bay_meta(bay_id, spec)
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

    violations = _violations(bay, meta, equipment_id, switching_action, is_auto_reclose, spec)
    if not violations:
        return InterlockResult(allowed=True, blocked_by=(), reasons=())
    return InterlockResult(
        allowed=False,
        blocked_by=tuple(rule for rule, _ in violations),
        reasons=tuple(reason for _, reason in violations),
    )


def execute_command(
    bay_id: str,
    command: SwitchCommand,
    synchrocheck_data: dict[str, float] | None = None,
    spec: FarmSpec = SB510,
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
    bay = _bay(spec, bay_id)
    meta = bay_meta(bay_id, spec)

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

    try:
        switching_action = SwitchingAction(command.action.lower())
    except ValueError as err:
        raise StateTransitionError(f"Unknown action '{command.action}'.") from err

    violations = _violations(
        bay, meta, command.equipment_id, switching_action, command.is_auto_reclose, spec
    )
    if violations:
        reasons = "; ".join(f"{rule}: {reason}" for rule, reason in violations)
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


def set_bay_mode(bay_id: str, mode: str, operator_id: str, spec: FarmSpec = SB510) -> BayController:
    """Change bay operational mode (LOCAL / REMOTE / MAINTENANCE).

    Used when an engineer arrives at the local panel (→ LOCAL)
    or when a PTW is issued (→ MAINTENANCE).
    """
    bay = _bay(spec, bay_id)
    try:
        new_mode = BayMode(mode.lower())
    except ValueError as err:
        raise StateTransitionError(
            f"Unknown bay mode '{mode}'. Valid: local/remote/maintenance"
        ) from err
    bay.bay_mode = new_mode
    return bay


def set_manual_isolation(
    bay_id: str, active: bool, operator_id: str, spec: FarmSpec = SB510
) -> BayController:
    """Set or clear the manual isolation flag for a bay.

    Called when a PTW is issued (active=True) or withdrawn (active=False).
    When active, ILK-006 blocks auto-reclose on this bay.
    """
    bay = _bay(spec, bay_id)
    bay.manual_isolation_active = active
    return bay


def update_synchrocheck(
    bay_id: str,
    delta_voltage_percent: float,
    delta_frequency_hz: float,
    delta_phase_deg: float,
    spec: FarmSpec = SB510,
) -> BayController:
    """Update live synchrocheck measurements for a tie CB bay.

    Called periodically by the measurement system (every 1–2 s) to
    keep the ILK-007 check current.
    """
    bay = _bay(spec, bay_id)
    if not bay.is_tie_cb:
        raise StateTransitionError(f"Bay '{bay_id}' is not a tie CB bay.")
    bay.synchrocheck = SynchroCheckResult(
        delta_voltage_percent=delta_voltage_percent,
        delta_frequency_hz=delta_frequency_hz,
        delta_phase_deg=delta_phase_deg,
    )
    return bay
