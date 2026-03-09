"""P5 sub-router: LOTO (Lock-Out / Tag-Out) endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.commissioning import (
    LOTOActionRequest,
    LOTOActionResponse,
    LOTOPointSchema,
    LOTOSetSchema,
)
from app.services.p5.loto import (
    LOTOAlreadyAppliedError,
    LOTONotAppliedError,
    LOTOPointNotFoundError,
    all_loto_applied,
    all_loto_removed,
    apply_loto,
    remove_loto,
)
from app.services.p5.programme_store import get_programme

router = APIRouter()


@router.get("/programmes/{programme_id}/loto", response_model=LOTOSetSchema)
async def get_loto_status(programme_id: str) -> LOTOSetSchema:
    """Get LOTO status for all isolation points in a programme."""
    programme = get_programme(programme_id)
    if programme.loto_set is None:
        raise HTTPException(status_code=404, detail="No LOTO set for this programme.")

    loto = programme.loto_set
    points = [
        LOTOPointSchema(
            point_id=p.point_id,
            equipment_id=p.equipment_id,
            status=p.status.value,
            locked_by=p.locked_by,
            tag_number=p.tag_number,
            applied_at=p.applied_at,
            removed_at=p.removed_at,
            removed_by=p.removed_by,
        )
        for p in loto.points.values()
    ]

    return LOTOSetSchema(
        programme_id=loto.programme_id,
        points=points,
        all_applied=all_loto_applied(loto),
        all_removed=all_loto_removed(loto),
    )


@router.post(
    "/programmes/{programme_id}/loto/{point_id}/apply",
    response_model=LOTOActionResponse,
)
async def apply_loto_endpoint(
    programme_id: str,
    point_id: str,
    request: LOTOActionRequest,
) -> LOTOActionResponse:
    """Apply LOTO (lock and danger tag) to an isolation point."""
    programme = get_programme(programme_id)
    if programme.loto_set is None:
        raise HTTPException(status_code=404, detail="No LOTO set for this programme.")

    try:
        point = apply_loto(programme.loto_set, point_id, request.performed_by)
    except LOTOPointNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except LOTOAlreadyAppliedError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return LOTOActionResponse(
        success=True,
        point_id=point.point_id,
        status=point.status.value,
        message=f"LOTO applied to {point_id} by {request.performed_by}.",
    )


@router.post(
    "/programmes/{programme_id}/loto/{point_id}/remove",
    response_model=LOTOActionResponse,
)
async def remove_loto_endpoint(
    programme_id: str,
    point_id: str,
    request: LOTOActionRequest,
) -> LOTOActionResponse:
    """Remove LOTO (lock and danger tag) from an isolation point."""
    programme = get_programme(programme_id)
    if programme.loto_set is None:
        raise HTTPException(status_code=404, detail="No LOTO set for this programme.")

    try:
        point = remove_loto(programme.loto_set, point_id, request.performed_by)
    except LOTOPointNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except LOTONotAppliedError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    return LOTOActionResponse(
        success=True,
        point_id=point.point_id,
        status=point.status.value,
        message=f"LOTO removed from {point_id} by {request.performed_by}.",
    )
