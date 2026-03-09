"""P4 sub-router: Turbine specification and power curve endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.forecast import (
    PowerCurveRequest,
    PowerCurveResponse,
    TurbineSpecSchema,
)
from app.services.p4.turbine_power_curve import build_power_curve, get_v236_spec

router = APIRouter()


@router.get("/turbine-spec", response_model=TurbineSpecSchema)
async def get_turbine_spec() -> TurbineSpecSchema:
    """Return V236-15.0 MW turbine specifications."""
    spec = get_v236_spec()
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
    )


@router.post("/power-curve", response_model=PowerCurveResponse)
async def generate_power_curve(request: PowerCurveRequest) -> PowerCurveResponse:
    """Generate IEC 61400-12-1 power curve for V236-15.0 MW."""
    result = build_power_curve(
        wind_step_ms=request.wind_step_ms,
        air_density_kg_m3=request.air_density_kg_m3,
    )
    return PowerCurveResponse(
        spec=TurbineSpecSchema(
            name=result.spec.name,
            rotor_diameter_m=result.spec.rotor_diameter_m,
            hub_height_m=result.spec.hub_height_m,
            rated_power_mw=result.spec.rated_power_mw,
            cut_in_speed_ms=result.spec.cut_in_speed_ms,
            rated_speed_ms=result.spec.rated_speed_ms,
            cut_out_speed_ms=result.spec.cut_out_speed_ms,
            num_blades=result.spec.num_blades,
            cp_max=result.spec.cp_max,
            ct_rated=result.spec.ct_rated,
        ),
        wind_speeds_ms=result.wind_speeds_ms.tolist(),
        power_mw=result.power_mw.tolist(),
        ct=result.ct.tolist(),
        swept_area_m2=result.swept_area_m2,
        air_density_kg_m3=result.air_density_kg_m3,
        num_points=len(result.wind_speeds_ms),
    )
