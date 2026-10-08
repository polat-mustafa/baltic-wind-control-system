"""
Planning & P2X API.

POST /api/v1/grid/planning/export — HVAC 220 kV vs VSC-HVDC ±320 kV over
10–200 km: AC cable capacity, charging Mvar and annual losses.
POST /api/v1/grid/planning/p2x — electrolyser on the energy above a grid
connection limit: absorbed energy, hydrogen, full-load hours and LCOH.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.exceptions import ValidationError as DomainValidationError
from app.routers.farm_spec import FarmSpecDep
from app.schemas.planning import ExportRequest, ExportResponse, P2XRequest, P2XResponse
from app.services.p2.planning import export_comparison, p2x_study

router = APIRouter(tags=["P2 Planning"])


@router.post("/planning/export", response_model=ExportResponse, summary="HVAC vs HVDC export")
async def planning_export(body: ExportRequest, spec: FarmSpecDep) -> ExportResponse:
    return ExportResponse(**export_comparison(body.design_length_km, spec))


@router.post("/planning/p2x", response_model=P2XResponse, summary="Electrolyser on surplus energy")
async def planning_p2x(body: P2XRequest, spec: FarmSpecDep) -> P2XResponse:
    if body.connection_mw > spec.capacity_mw:
        raise DomainValidationError(
            f"connection_mw must not exceed the farm rating ({spec.capacity_mw:.0f} MW)"
        )
    return P2XResponse(
        **p2x_study(body.connection_mw, body.electrolyser_mw, body.capex_eur_per_kw, spec)
    )
