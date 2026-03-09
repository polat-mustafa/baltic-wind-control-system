"""P5 sub-router: Emergency response procedures and event management."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.commissioning import (
    EmergencyEventSchema,
    EmergencyLogResponse,
    EmergencyProcedureSchema,
    TriggerEmergencyRequest,
)
from app.services.p5.emergency_response import (
    EmergencyType,
    get_all_procedures,
    get_emergency_log,
    get_procedure,
    trigger_emergency,
)
from app.services.p5.programme_store import get_programme

router = APIRouter()


@router.get(
    "/emergency-procedures",
    response_model=list[EmergencyProcedureSchema],
    summary="List all emergency procedures",
)
async def list_emergency_procedures() -> list[EmergencyProcedureSchema]:
    """Return all 6 pre-defined emergency response procedures."""
    procedures = get_all_procedures()
    return [
        EmergencyProcedureSchema(
            emergency_type=p.emergency_type.value,
            severity=p.severity.value,
            immediate_actions=p.immediate_actions,
            responsible=p.responsible,
            reference_document=p.reference_document,
            automated_scada_actions=p.automated_scada_actions,
            communication_protocol=p.communication_protocol,
        )
        for p in procedures
    ]


@router.get(
    "/emergency-procedures/{emergency_type}",
    response_model=EmergencyProcedureSchema,
    summary="Get a specific emergency procedure",
)
async def get_emergency_procedure(emergency_type: str) -> EmergencyProcedureSchema:
    """Return the procedure for a specific emergency type."""
    try:
        etype = EmergencyType(emergency_type)
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown emergency type: {emergency_type}",
        ) from None
    p = get_procedure(etype)
    return EmergencyProcedureSchema(
        emergency_type=p.emergency_type.value,
        severity=p.severity.value,
        immediate_actions=p.immediate_actions,
        responsible=p.responsible,
        reference_document=p.reference_document,
        automated_scada_actions=p.automated_scada_actions,
        communication_protocol=p.communication_protocol,
    )


@router.post(
    "/programmes/{programme_id}/emergency",
    response_model=EmergencyEventSchema,
    summary="Trigger an emergency event",
)
async def trigger_emergency_event(
    programme_id: str,
    body: TriggerEmergencyRequest,
) -> EmergencyEventSchema:
    """Trigger an emergency on a programme and record the event."""
    get_programme(programme_id)  # Validate programme exists
    try:
        etype = EmergencyType(body.emergency_type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown emergency type: {body.emergency_type}",
        ) from None

    event = trigger_emergency(etype, body.triggered_by, programme_id)
    return EmergencyEventSchema(
        event_id=event.event_id,
        programme_id=event.programme_id,
        emergency_type=event.emergency_type.value,
        severity=event.severity.value,
        triggered_by=event.triggered_by,
        triggered_at=event.triggered_at,
        actions_taken=event.actions_taken,
        scada_actions_executed=event.scada_actions_executed,
        resolved=event.resolved,
        resolved_at=event.resolved_at,
    )


@router.get(
    "/programmes/{programme_id}/emergency-log",
    response_model=EmergencyLogResponse,
    summary="Get emergency event history",
)
async def get_programme_emergency_log(programme_id: str) -> EmergencyLogResponse:
    """Return the emergency event history for a programme."""
    get_programme(programme_id)  # Validate programme exists
    events = get_emergency_log(programme_id)
    return EmergencyLogResponse(
        programme_id=programme_id,
        total_events=len(events),
        events=[
            EmergencyEventSchema(
                event_id=e.event_id,
                programme_id=e.programme_id,
                emergency_type=e.emergency_type.value,
                severity=e.severity.value,
                triggered_by=e.triggered_by,
                triggered_at=e.triggered_at,
                actions_taken=e.actions_taken,
                scada_actions_executed=e.scada_actions_executed,
                resolved=e.resolved,
                resolved_at=e.resolved_at,
            )
            for e in events
        ],
    )
