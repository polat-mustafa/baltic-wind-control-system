"""P4 sub-router: Turbine specification and power curve endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.forecast import (
    PowerCurveRequest,
    PowerCurveResponse,
    TurbineSpecSchema,
)
from app.services.p1.turbine_models import get_turbine
from app.services.p4.turbine_power_curve import TurbineSpec, build_power_curve, get_turbine_spec

router = APIRouter()


def _schema(spec: TurbineSpec) -> TurbineSpecSchema:
    return TurbineSpecSchema(
        name=spec.name,
        rotor_diameter_m=spec.rotor_diameter_m,
        hub_height_m=spec.hub_height_m,
        rated_power_mw=spec.rated_power_mw,
        cut_in_speed_ms=spec.cut_in_speed_ms,
        rated_speed_ms=spec.rated_speed_ms,
        cut_out_speed_ms=spec.cut_out_speed_ms,
        num_blades=spec.num_blades,
        cp_max=spec.cp_max,
        ct_rated=spec.ct_rated,
        drivetrain=spec.drivetrain,
        min_rotor_rpm=spec.min_rotor_rpm,
        max_rotor_rpm=spec.max_rotor_rpm,
        source=get_turbine(spec.model_id).source,
    )


@router.get("/turbine-spec", response_model=TurbineSpecSchema)
async def turbine_spec() -> TurbineSpecSchema:
    """SB-510 turbine ("V236 class") = IEA 15 MW reference turbine (official table)."""
    return _schema(get_turbine_spec())


@router.post("/power-curve", response_model=PowerCurveResponse)
async def generate_power_curve(request: PowerCurveRequest) -> PowerCurveResponse:
    """IEC 61400-12-1 power curve of the SB-510 turbine at the requested air density."""
    result = build_power_curve(
        wind_step_ms=request.wind_step_ms,
        air_density_kg_m3=request.air_density_kg_m3,
    )
    return PowerCurveResponse(
        spec=_schema(result.spec),
        wind_speeds_ms=result.wind_speeds_ms.tolist(),
        power_mw=result.power_mw.tolist(),
        ct=result.ct.tolist(),
        swept_area_m2=result.swept_area_m2,
        air_density_kg_m3=result.air_density_kg_m3,
        num_points=len(result.wind_speeds_ms),
    )
