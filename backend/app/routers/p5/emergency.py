"""P5 sub-router: emergency procedures and their effect on the programme."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas.commissioning import (
    EmergencyEventSchema,
    EmergencyProcedureSchema,
    TriggerEmergencyRequest,
)
from app.services.p5.emergency_response import EMERGENCY_PROCEDURES, trigger_emergency
from app.services.p5.programme_repository import ProgrammeRepository

router = APIRouter()


@router.get("/emergency-procedures", response_model=list[EmergencyProcedureSchema])
async def list_emergency_procedures() -> list[EmergencyProcedureSchema]:
    return [
        EmergencyProcedureSchema(
            emergency_type=p.emergency_type.value,
            title=p.title,
            severity=p.severity.value,
            effect=p.effect.value,
            immediate_actions=list(p.immediate_actions),
            responsible=p.responsible,
            reference_document=p.reference_document,
            communication_protocol=list(p.communication_protocol),
        )
        for p in EMERGENCY_PROCEDURES.values()
    ]


@router.post("/programmes/{programme_id}/emergency", response_model=EmergencyEventSchema)
async def trigger_emergency_event(
    programme_id: str, body: TriggerEmergencyRequest, session: AsyncSession = Depends(get_session)
) -> EmergencyEventSchema:
    """Apply the procedure: TRIP opens all breakers and aborts, SUSPEND halts switching."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    event = trigger_emergency(programme, body.emergency_type, body.triggered_by)
    await repo.save_programme(programme)
    await session.commit()
    return EmergencyEventSchema(**event)
