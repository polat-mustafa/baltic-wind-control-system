"""Turbine Physics API endpoints.

Provides REST endpoints for dynamic turbine simulation:
- POST /simulate: Run simulation with arbitrary wind time series
- POST /step-response: Run step-response analysis (wind ramp)
- POST /aerodynamic-state: Compute single-point aerodynamic state
- GET  /cp-surface: Get Cp(λ, β) surface for visualization
- GET  /config: Get module configuration (all constants)

All endpoints follow the convention: /api/v1/turbine-physics/{resource}
"""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.turbine_physics import (
    AerodynamicStateRequest,
    AerodynamicStateResponse,
    CpSurfaceResponse,
    SimulationRequest,
    SimulationResponse,
    SimulationSummaryResponse,
    StepResponseRequest,
    TurbinePhysicsConfigResponse,
)
from app.services.p1.turbine_models import rosco
from app.services.p4.turbine_power_curve import get_turbine_spec
from app.services.turbine_physics.aerodynamics import (
    BETZ_LIMIT,
    compute_aerodynamic_state,
)
from app.services.turbine_physics.drivetrain import (
    CONVERTER_EFFICIENCY,
    DRIVETRAIN,
    GENERATOR_EFFICIENCY,
    GENERATOR_POLES,
    GENERATOR_VOLTAGE_V,
    RATED_TORQUE_NM,
)
from app.services.turbine_physics.pitch_control import (
    GAIN_SCHEDULE_KI,
    GAIN_SCHEDULE_KP_S,
    GAIN_SCHEDULE_PITCH_DEG,
    PITCH_RATE_LIMIT_DEG_S,
)
from app.services.turbine_physics.rotor_dynamics import (
    MAX_ROTOR_SPEED_RPM,
    MIN_ROTOR_SPEED_RPM,
    OVERSPEED_SHUTDOWN_RPM,
    ROTOR_INERTIA_KG_M2,
)
from app.services.turbine_physics.simulator import (
    SimulationConfig,
    run_simulation,
    run_step_response,
)
from app.services.turbine_physics.yaw_control import (
    DEADBAND_DEG,
    POWER_LOSS_EXPONENT,
    YAW_RATE_DEG_S,
)

router = APIRouter(
    prefix="/api/v1/turbine-physics",
    tags=["Turbine Physics"],
)


@router.post("/simulate", response_model=SimulationResponse)
async def simulate(req: SimulationRequest) -> SimulationResponse:
    """Run turbine simulation with arbitrary wind time series.

    Accepts a wind speed array (one value per timestep) and returns
    full time-series of all turbine variables: rotor speed, pitch,
    power, Cp, yaw error, etc.

    The simulation uses Euler integration with the configured timestep,
    composing aerodynamics, pitch control, yaw control, drivetrain,
    and rotor dynamics models.
    """
    config = SimulationConfig(
        dt=req.dt,
        air_density_kg_m3=req.air_density_kg_m3,
        initial_rotor_speed_rpm=req.initial_rotor_speed_rpm,
    )

    result = run_simulation(
        wind_speeds_ms=req.wind_speeds_ms,
        wind_dirs_deg=req.wind_dirs_deg,
        config=config,
    )

    return SimulationResponse(
        time_s=result.time_s.tolist(),
        wind_speed_ms=result.wind_speed_ms.tolist(),
        wind_dir_deg=result.wind_dir_deg.tolist(),
        rotor_speed_rpm=result.rotor_speed_rpm.tolist(),
        pitch_angle_deg=result.pitch_angle_deg.tolist(),
        electrical_power_mw=result.electrical_power_mw.tolist(),
        aero_power_mw=result.aero_power_mw.tolist(),
        tip_speed_ratio=result.tip_speed_ratio.tolist(),
        cp=result.cp.tolist(),
        yaw_error_deg=result.yaw_error_deg.tolist(),
        gen_speed_rpm=result.gen_speed_rpm.tolist(),
        nacelle_dir_deg=result.nacelle_dir_deg.tolist(),
        status=result.status,
        summary=SimulationSummaryResponse(
            total_energy_mwh=result.summary.total_energy_mwh,
            mean_power_mw=result.summary.mean_power_mw,
            max_power_mw=result.summary.max_power_mw,
            capacity_factor=result.summary.capacity_factor,
            mean_rotor_speed_rpm=result.summary.mean_rotor_speed_rpm,
            mean_pitch_deg=result.summary.mean_pitch_deg,
            mean_yaw_error_deg=result.summary.mean_yaw_error_deg,
            duration_s=result.summary.duration_s,
            num_steps=result.summary.num_steps,
        ),
    )


@router.post("/step-response", response_model=SimulationResponse)
async def step_response(req: StepResponseRequest) -> SimulationResponse:
    """Run step-response simulation: wind ramps from v_init to v_final.

    Useful for analyzing turbine dynamic response:
    - Pitch controller settling time
    - Rotor speed regulation quality
    - Below-to-above rated transitions

    The wind profile ramps linearly over ramp_s, then holds at v_final.
    """
    config = SimulationConfig(dt=req.dt)

    result = run_step_response(
        v_init_ms=req.v_init_ms,
        v_final_ms=req.v_final_ms,
        ramp_s=req.ramp_s,
        total_s=req.total_s,
        config=config,
    )

    return SimulationResponse(
        time_s=result.time_s.tolist(),
        wind_speed_ms=result.wind_speed_ms.tolist(),
        wind_dir_deg=result.wind_dir_deg.tolist(),
        rotor_speed_rpm=result.rotor_speed_rpm.tolist(),
        pitch_angle_deg=result.pitch_angle_deg.tolist(),
        electrical_power_mw=result.electrical_power_mw.tolist(),
        aero_power_mw=result.aero_power_mw.tolist(),
        tip_speed_ratio=result.tip_speed_ratio.tolist(),
        cp=result.cp.tolist(),
        yaw_error_deg=result.yaw_error_deg.tolist(),
        gen_speed_rpm=result.gen_speed_rpm.tolist(),
        nacelle_dir_deg=result.nacelle_dir_deg.tolist(),
        status=result.status,
        summary=SimulationSummaryResponse(
            total_energy_mwh=result.summary.total_energy_mwh,
            mean_power_mw=result.summary.mean_power_mw,
            max_power_mw=result.summary.max_power_mw,
            capacity_factor=result.summary.capacity_factor,
            mean_rotor_speed_rpm=result.summary.mean_rotor_speed_rpm,
            mean_pitch_deg=result.summary.mean_pitch_deg,
            mean_yaw_error_deg=result.summary.mean_yaw_error_deg,
            duration_s=result.summary.duration_s,
            num_steps=result.summary.num_steps,
        ),
    )


@router.post("/aerodynamic-state", response_model=AerodynamicStateResponse)
async def aerodynamic_state(
    req: AerodynamicStateRequest,
) -> AerodynamicStateResponse:
    """Compute single-point aerodynamic state.

    Returns Cp, Ct, aerodynamic power, torque, and thrust for a given
    wind speed, rotor speed, and pitch angle combination.

    Useful for exploring the operating envelope of the turbine.
    """
    state = compute_aerodynamic_state(
        wind_speed_ms=req.wind_speed_ms,
        rotor_speed_rpm=req.rotor_speed_rpm,
        pitch_angle_deg=req.pitch_angle_deg,
        air_density_kg_m3=req.air_density_kg_m3,
    )

    return AerodynamicStateResponse(
        wind_speed_ms=state.wind_speed_ms,
        rotor_speed_rpm=state.rotor_speed_rpm,
        pitch_angle_deg=state.pitch_angle_deg,
        tip_speed_ratio=state.tip_speed_ratio,
        cp=state.cp,
        ct=state.ct,
        aero_power_mw=state.aero_power_w / 1e6,
        aero_torque_nm=state.aero_torque_nm,
        thrust_force_kn=state.thrust_force_n / 1e3,
    )


@router.get("/cp-surface", response_model=CpSurfaceResponse)
async def cp_surface() -> CpSurfaceResponse:
    """Get the Cp(λ, β) surface of the IEA 15 MW rotor for 3D visualization.

    The official ROSCO performance table (CCBlade steady BEM): λ 2–14.5 and
    β 0–30°. Cp_max = 0.469 at λ = 9 — the target of the torque controller.
    """
    surface, control = rosco()
    betas = surface.pitch_deg[surface.pitch_deg >= 0.0]
    lambdas = surface.tsr
    cp_matrix = [[round(float(c), 6) for c in surface.cp_array(lambdas, b)] for b in betas]

    return CpSurfaceResponse(
        tip_speed_ratios=lambdas.tolist(),
        pitch_angles_deg=betas.tolist(),
        cp_matrix=cp_matrix,
        cp_max=round(float(surface.cp_array(control.tsr_opt, 0.0)), 4),
        lambda_opt=control.tsr_opt,
        betz_limit=round(BETZ_LIMIT, 6),
        source=surface.source,
    )


@router.get("/config", response_model=TurbinePhysicsConfigResponse)
async def get_config() -> TurbinePhysicsConfigResponse:
    """Get complete module configuration.

    Returns all turbine physics constants and controller parameters.
    Useful for UI display, documentation, and educational transparency.
    """
    spec = get_turbine_spec()

    return TurbinePhysicsConfigResponse(
        turbine_name=spec.name,
        rotor_diameter_m=spec.rotor_diameter_m,
        rated_power_mw=spec.rated_power_mw,
        cut_in_speed_ms=spec.cut_in_speed_ms,
        rated_speed_ms=spec.rated_speed_ms,
        cut_out_speed_ms=spec.cut_out_speed_ms,
        rotor_inertia_kg_m2=ROTOR_INERTIA_KG_M2,
        min_rotor_speed_rpm=MIN_ROTOR_SPEED_RPM,
        max_rotor_speed_rpm=MAX_ROTOR_SPEED_RPM,
        overspeed_shutdown_rpm=OVERSPEED_SHUTDOWN_RPM,
        drivetrain=DRIVETRAIN,
        generator_poles=GENERATOR_POLES,
        generator_voltage_v=GENERATOR_VOLTAGE_V,
        generator_efficiency=GENERATOR_EFFICIENCY,
        converter_efficiency=CONVERTER_EFFICIENCY,
        rated_torque_nm=RATED_TORQUE_NM,
        tsr_opt=rosco()[1].tsr_opt,
        pitch_gain_schedule_deg=GAIN_SCHEDULE_PITCH_DEG.tolist(),
        pitch_kp_s=GAIN_SCHEDULE_KP_S.tolist(),
        pitch_ki=GAIN_SCHEDULE_KI.tolist(),
        pitch_rate_limit_deg_s=PITCH_RATE_LIMIT_DEG_S,
        yaw_rate_deg_s=YAW_RATE_DEG_S,
        yaw_deadband_deg=DEADBAND_DEG,
        yaw_power_loss_exponent=POWER_LOSS_EXPONENT,
        source=rosco()[1].source,
    )
