"""
Bay controller API endpoints — M01 Interlock Engine.

Endpoints
---------
GET  /api/v1/scada/bays                          — All bay states (fleet overview)
GET  /api/v1/scada/bays/{bay_id}/state           — Single bay current state
GET  /api/v1/scada/bays/{bay_id}/interlocks      — Interlock rule status for bay
POST /api/v1/scada/bays/{bay_id}/command         — Execute switching command
POST /api/v1/scada/interlocks/validate           — Dry-run validation (no state change)

All switching commands pass through the 7-rule interlock engine before execution.
A rejected command returns HTTP 409 with the blocking interlock IDs and reasons.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.exceptions import NotFoundError
from app.schemas.bay import (
    AllBaysResponse,
    BayStateResponse,
    CommandExecutionResponse,
    CommandValidationResponse,
    InterlockRuleStatus,
    InterlockStatusResponse,
    SwitchCommandRequest,
    SynchroCheckSchema,
    ValidateCommandRequest,
)
from app.services.p3 import bay_controller as svc
from app.services.p5.equipment_state import BayController, SwitchCommand, SwitchingAction

router = APIRouter(tags=["M01 Bay Controller"])


def _bay_to_response(bay: BayController, bay_id_str: str) -> BayStateResponse:
    """Convert a BayController dataclass to a BayStateResponse schema."""
    sync = None
    if bay.synchrocheck is not None:
        sync = SynchroCheckSchema(
            delta_voltage_percent=bay.synchrocheck.delta_voltage_percent,
            delta_frequency_hz=bay.synchrocheck.delta_frequency_hz,
            delta_phase_deg=bay.synchrocheck.delta_phase_deg,
            is_in_sync=bay.synchrocheck.is_in_sync,
        )
    # Retrieve the UUID from meta (bay_id is used as string key)
    meta = svc._bay_meta.get(bay_id_str, {})
    # Generate a stable UUID from the bay_id string for the response
    stable_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, bay_id_str)

    return BayStateResponse(
        bay_id=stable_uuid,
        name=bay_id_str,
        display_name=bay.bay_name,
        voltage_kv=bay.voltage_kv,
        bay_type=meta.get("bay_type", "FEEDER"),
        bay_mode=bay.bay_mode.value,
        circuit_breaker=bay.circuit_breaker.value,
        disconnector_bus=bay.disconnector_bus.value,
        disconnector_line=bay.disconnector_line.value,
        earth_switch=bay.earth_switch.value,
        protection_relay=bay.protection_relay.value,
        manual_isolation_active=bay.manual_isolation_active,
        is_tie_cb=bay.is_tie_cb,
        synchrocheck=sync,
        last_updated=datetime.now(UTC),
    )


@router.get("/bays", response_model=AllBaysResponse, summary="Get all bay states")
async def get_all_bays() -> AllBaysResponse:
    """Return current state of all 8 OSS 66 kV switchboard bays.

    Physics: Each bay represents one feeder panel on the 66 kV switchboard.
    The bay state shows the position of every switching device (CB, two
    disconnectors, earth switch) and the protection relay arming state.

    Used by the SCADA SLD overview dashboard.
    """
    bays = svc.get_all_bays()
    bay_responses = [_bay_to_response(b, b.bay_id) for b in bays]

    energised = sum(1 for b in bays if b.circuit_breaker.value == "closed")
    earthed = sum(1 for b in bays if b.earth_switch.value == "closed")
    alarms = sum(1 for b in bays if b.circuit_breaker.value in ("tripped", "failed"))

    return AllBaysResponse(
        bays=bay_responses,
        total=len(bay_responses),
        energised_count=energised,
        earthed_count=earthed,
        alarm_count=alarms,
    )


@router.get(
    "/bays/{bay_id}/state",
    response_model=BayStateResponse,
    summary="Get single bay state",
)
async def get_bay_state(bay_id: str) -> BayStateResponse:
    """Return the current equipment state of a single bay.

    Parameters
    ----------
    bay_id : str
        Bay identifier, e.g. 'BAY-OSS-66-01' (String 1 Feeder).

    Returns the position of: CB, bus disconnector, line disconnector,
    earth switch, and protection relay arming state.
    """
    bay = svc.get_bay_state(bay_id)
    return _bay_to_response(bay, bay_id)


@router.get(
    "/bays/{bay_id}/interlocks",
    response_model=InterlockStatusResponse,
    summary="Get interlock status for bay",
)
async def get_interlock_status(bay_id: str) -> InterlockStatusResponse:
    """Return the status of all 7 interlock rules for a bay.

    Each rule shows:
      - interlock_id: e.g. 'ILK-001'
      - description: plain-English safety rule
      - currently_active: True if this rule is currently blocking operations
      - blocking_equipment: which device is causing the interlock

    The SCADA UI uses this to colour equipment: green = allowed, red = blocked.

    Physics: Interlocks are permanent electrical wiring in real HV bays.
    IEC 61936-1 §7.6 requires them to prevent equipment destruction and
    personnel death during switching operations.
    """
    rules_raw = svc.get_interlock_status(bay_id)
    bay = svc.get_bay_state(bay_id)

    rules = [
        InterlockRuleStatus(
            interlock_id=r["interlock_id"],
            description=r["description"],
            currently_active=r["currently_active"],
            blocking_equipment=r.get("blocking_equipment"),
            blocking_state=r.get("blocking_state"),
        )
        for r in rules_raw
    ]

    return InterlockStatusResponse(
        bay_id=uuid.uuid5(uuid.NAMESPACE_DNS, bay_id),
        bay_name=bay.bay_name,
        rules=rules,
        all_clear=not any(r.currently_active for r in rules),
    )


@router.post(
    "/bays/{bay_id}/command",
    response_model=CommandExecutionResponse,
    summary="Execute a switching command",
)
async def execute_command(bay_id: str, body: SwitchCommandRequest) -> CommandExecutionResponse:
    """Execute a switching command on bay equipment after interlock validation.

    The command passes through the full 7-rule interlock engine:
      ILK-001 to ILK-005: classical HV switchgear interlocks
      ILK-006: auto-reclose blocked during manual isolation
      ILK-007: synchrocheck required for tie CB

    On interlock violation: HTTP 409 with blocked_by and reasons.
    On invalid transition (e.g. close an already-closed CB): HTTP 409.
    On success: equipment state is updated and an SOE event is created.

    Example: To close CB-STR-01 in BAY-OSS-66-01:
      POST /api/v1/scada/bays/BAY-OSS-66-01/command
      {"equipment_id": "CB-STR-01", "action": "close", "operator_id": "kaan"}
    """
    synchrocheck_data = None
    if body.synchrocheck:
        synchrocheck_data = {
            "delta_voltage_percent": body.synchrocheck.delta_voltage_percent,
            "delta_frequency_hz": body.synchrocheck.delta_frequency_hz,
            "delta_phase_deg": body.synchrocheck.delta_phase_deg,
        }

    cmd = SwitchCommand(
        equipment_id=body.equipment_id,
        action=SwitchingAction(body.action),
        operator_id=body.operator_id,
        is_auto_reclose=body.is_auto_reclose,
    )

    result = svc.execute_command(bay_id, cmd, synchrocheck_data)

    return CommandExecutionResponse(
        success=result["success"],
        equipment_id=result["equipment_id"],
        action=result["action"],
        previous_state=result["previous_state"],
        new_state=result["new_state"],
        message=result["message"],
        timestamp=result["timestamp"],
        soe_event_id=None,  # M02 SOE recorder will populate this
    )


@router.post(
    "/interlocks/validate",
    response_model=CommandValidationResponse,
    summary="Dry-run interlock validation (no state change)",
)
async def validate_command(body: ValidateCommandRequest) -> CommandValidationResponse:
    """Validate whether a switching command would be allowed without executing it.

    Used by the SCADA UI to show green/red equipment before the operator
    clicks the confirmation dialog. No state change occurs.

    Returns:
      allowed=True  → command would succeed
      allowed=False → blocked_by shows which interlock rules would fire

    Physics: In real bay controllers (e.g. ABB REF630) this is called a
    "command check" — the bay controller evaluates the interlock matrix
    and returns a go/no-go before the operator trips the physical switch.
    """
    bay_id_str = str(body.bay_id)
    # Try to find the bay by UUID or by string key
    # The bay_id might be the UUID form of the string bay ID
    bay_id_key = None
    for key in svc._bay_state:
        if str(uuid.uuid5(uuid.NAMESPACE_DNS, key)) == bay_id_str or key == bay_id_str:
            bay_id_key = key
            break

    if bay_id_key is None:
        raise NotFoundError(f"Bay '{bay_id_str}' not found.")

    synchrocheck_data = None
    if body.synchrocheck:
        synchrocheck_data = {
            "delta_voltage_percent": body.synchrocheck.delta_voltage_percent,
            "delta_frequency_hz": body.synchrocheck.delta_frequency_hz,
            "delta_phase_deg": body.synchrocheck.delta_phase_deg,
        }

    result = svc.validate_command(
        bay_id=bay_id_key,
        equipment_id=body.equipment_id,
        action=body.action,
        is_auto_reclose=body.is_auto_reclose,
        synchrocheck_data=synchrocheck_data,
    )

    return CommandValidationResponse(
        allowed=result.allowed,
        blocked_by=list(result.blocked_by),
        reasons=list(result.reasons),
        equipment_id=body.equipment_id,
        action=body.action,
    )
