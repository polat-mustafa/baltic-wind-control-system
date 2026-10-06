"""P5 sub-router: isolation locks (lock-out / tag-out)."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.exceptions import ValidationError as DomainValidationError
from app.db import get_session
from app.schemas.commissioning import LOTOActionRequest, LOTOPointSchema, LOTOSetSchema
from app.services.p5.equipment_state import OSS_EQUIPMENT
from app.services.p5.loto import LOTOSet, LOTOStatus, apply_loto, remove_loto
from app.services.p5.programme_repository import ProgrammeRepository
from app.services.p5.switching_programme import SwitchingProgramme, add_audit

router = APIRouter()

# Register order = plant order (onshore → OSS → strings); JSONB does not keep key order
_ORDER = {eq.equipment_id: i for i, eq in enumerate(OSS_EQUIPMENT)}


def _schema(loto: LOTOSet) -> LOTOSetSchema:
    return LOTOSetSchema(
        programme_id=loto.programme_id,
        points=[
            LOTOPointSchema(**asdict(p))
            for p in sorted(loto.points.values(), key=lambda p: _ORDER.get(p.equipment_id, 999))
        ],
        applied_count=sum(p.status == LOTOStatus.APPLIED for p in loto.points.values()),
    )


def _loto(programme: SwitchingProgramme) -> LOTOSet:
    if programme.loto_set is None:
        raise NotFoundError("This programme has no isolation register.")
    return programme.loto_set


@router.get("/programmes/{programme_id}/loto", response_model=LOTOSetSchema)
async def get_loto(
    programme_id: str, session: AsyncSession = Depends(get_session)
) -> LOTOSetSchema:
    programme = await ProgrammeRepository(session).get_programme(programme_id)
    return _schema(_loto(programme))


@router.post("/programmes/{programme_id}/loto/{point_id}/apply", response_model=LOTOSetSchema)
async def apply_lock(
    programme_id: str,
    point_id: str,
    request: LOTOActionRequest,
    session: AsyncSession = Depends(get_session),
) -> LOTOSetSchema:
    """Re-apply a lock; the device must be back in its secured position."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    point = apply_loto(_loto(programme), point_id, request.performed_by, programme.system_state)
    add_audit(programme, f"Lock applied: {point.equipment_id}", request.performed_by,
               details=point.tag_number)  # fmt: skip
    await repo.save_programme(programme)
    await session.commit()
    return _schema(_loto(programme))


@router.post("/programmes/{programme_id}/loto/{point_id}/remove", response_model=LOTOSetSchema)
async def remove_lock(
    programme_id: str,
    point_id: str,
    request: LOTOActionRequest,
    session: AsyncSession = Depends(get_session),
) -> LOTOSetSchema:
    """Release a lock — only the Person in Control may authorise it."""
    repo = ProgrammeRepository(session)
    programme = await repo.get_programme(programme_id)
    if request.performed_by != programme.pic_name:
        raise DomainValidationError(
            f"Only the Person in Control ({programme.pic_name}) may remove locks."
        )
    point = remove_loto(_loto(programme), point_id, request.performed_by)
    add_audit(programme, f"Lock removed: {point.equipment_id}", request.performed_by,
               details=point.tag_number)  # fmt: skip
    await repo.save_programme(programme)
    await session.commit()
    return _schema(_loto(programme))
