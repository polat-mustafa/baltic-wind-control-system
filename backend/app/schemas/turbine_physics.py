"""Pydantic schemas for Turbine Physics simulation endpoints.

Request and response models for dynamic turbine simulation:
- Time-series simulation (arbitrary wind input)
- Step-response analysis (wind speed ramp)
- Single aerodynamic state computation
- Cp surface data for visualization
- Module configuration export
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# ── Request Schemas ────────────────────────────────────────────────────


class SimulationRequest(BaseModel):
    """Request for a full turbine simulation."""

    wind_speeds_ms: list[float] = Field(
        description="Wind speed time series [m/s], one value per timestep",
        min_length=2,
    )
    wind_dirs_deg: list[float] | None = Field(
        default=None,
        description="Wind direction time series [deg]. If omitted, 0° throughout",
    )
    dt: float = Field(
        default=0.1,
        ge=0.01,
        le=10.0,
        description="Timestep [s]. Default: 0.1 (10 Hz control loop)",
    )
    initial_rotor_speed_rpm: float = Field(
        default=7.0,
        ge=0.0,
        le=15.0,
        description="Initial rotor speed [rpm]",
    )
    air_density_kg_m3: float = Field(
        default=1.225,
        ge=0.8,
        le=1.6,
        description="Air density [kg/m³]. Default: 1.225 (standard)",
    )


class StepResponseRequest(BaseModel):
    """Request for a step-response simulation."""

    v_init_ms: float = Field(
        default=8.0,
        ge=0.0,
        le=35.0,
        description="Initial wind speed [m/s]",
    )
    v_final_ms: float = Field(
        default=14.0,
        ge=0.0,
        le=35.0,
        description="Final wind speed [m/s]",
    )
    ramp_s: float = Field(
        default=10.0,
        ge=0.1,
        le=300.0,
        description="Ramp duration [s]",
    )
    total_s: float = Field(
        default=120.0,
        ge=1.0,
        le=3600.0,
        description="Total simulation time [s]",
    )
    dt: float = Field(
        default=0.1,
        ge=0.01,
        le=10.0,
        description="Timestep [s]",
    )


class AerodynamicStateRequest(BaseModel):
    """Request for a single aerodynamic state computation."""

    wind_speed_ms: float = Field(ge=0.0, le=50.0, description="Wind speed [m/s]")
    rotor_speed_rpm: float = Field(ge=0.0, le=15.0, description="Rotor speed [rpm]")
    pitch_angle_deg: float = Field(
        default=0.0,
        ge=0.0,
        le=90.0,
        description="Blade pitch angle [deg]",
    )
    air_density_kg_m3: float = Field(
        default=1.225,
        ge=0.8,
        le=1.6,
        description="Air density [kg/m³]",
    )


# ── Response Schemas ───────────────────────────────────────────────────


class SimulationSummaryResponse(BaseModel):
    """Summary statistics from a simulation run."""

    total_energy_mwh: float = Field(description="Total energy produced [MWh]")
    mean_power_mw: float = Field(description="Mean electrical power [MW]")
    max_power_mw: float = Field(description="Peak electrical power [MW]")
    capacity_factor: float = Field(description="Mean power / rated power [0-1]")
    mean_rotor_speed_rpm: float = Field(description="Mean rotor speed [rpm]")
    mean_pitch_deg: float = Field(description="Mean pitch angle [deg]")
    mean_yaw_error_deg: float = Field(description="Mean absolute yaw error [deg]")
    duration_s: float = Field(description="Total simulation time [s]")
    num_steps: int = Field(description="Number of timesteps")


class SimulationResponse(BaseModel):
    """Full simulation response with time-series data and summary."""

    time_s: list[float] = Field(description="Time array [s]")
    wind_speed_ms: list[float] = Field(description="Wind speed array [m/s]")
    wind_dir_deg: list[float] = Field(description="Wind direction array [deg]")
    rotor_speed_rpm: list[float] = Field(description="Rotor speed array [rpm]")
    pitch_angle_deg: list[float] = Field(description="Pitch angle array [deg]")
    electrical_power_mw: list[float] = Field(description="Electrical power array [MW]")
    aero_power_mw: list[float] = Field(description="Aerodynamic power array [MW]")
    tip_speed_ratio: list[float] = Field(description="Tip-speed ratio array [-]")
    cp: list[float] = Field(description="Power coefficient array [-]")
    yaw_error_deg: list[float] = Field(description="Yaw error array [deg]")
    gen_speed_rpm: list[float] = Field(description="Generator speed array [rpm]")
    nacelle_dir_deg: list[float] = Field(description="Nacelle direction array [deg]")
    status: list[str] = Field(description="Turbine status at each step")
    summary: SimulationSummaryResponse


class AerodynamicStateResponse(BaseModel):
    """Single aerodynamic state snapshot."""

    wind_speed_ms: float = Field(description="Wind speed [m/s]")
    rotor_speed_rpm: float = Field(description="Rotor speed [rpm]")
    pitch_angle_deg: float = Field(description="Pitch angle [deg]")
    tip_speed_ratio: float = Field(description="Tip-speed ratio [-]")
    cp: float = Field(description="Power coefficient [-]")
    ct: float = Field(description="Thrust coefficient [-]")
    aero_power_mw: float = Field(description="Aerodynamic power [MW]")
    aero_torque_nm: float = Field(description="Aerodynamic torque [N·m]")
    thrust_force_kn: float = Field(description="Thrust force [kN]")


class CpSurfaceResponse(BaseModel):
    """Cp(λ, β) surface data for 3D visualization."""

    tip_speed_ratios: list[float] = Field(description="λ values [dimensionless]")
    pitch_angles_deg: list[float] = Field(description="β values [deg]")
    cp_matrix: list[list[float]] = Field(description="Cp values [len(β) x len(λ)] matrix")
    cp_max: float = Field(description="Maximum Cp value found")
    lambda_opt: float = Field(description="Optimal tip-speed ratio at β=0")
    betz_limit: float = Field(description="Theoretical Betz limit (16/27)")


class TurbinePhysicsConfigResponse(BaseModel):
    """Complete module configuration for transparency."""

    turbine_name: str = Field(description="Turbine model name")
    rotor_diameter_m: float = Field(description="Rotor diameter [m]")
    rated_power_mw: float = Field(description="Rated power [MW]")
    cut_in_speed_ms: float = Field(description="Cut-in wind speed [m/s]")
    rated_speed_ms: float = Field(description="Rated wind speed [m/s]")
    cut_out_speed_ms: float = Field(description="Cut-out wind speed [m/s]")
    rotor_inertia_kg_m2: float = Field(description="Rotor inertia [kg·m²]")
    min_rotor_speed_rpm: float = Field(description="Min rotor speed [rpm]")
    max_rotor_speed_rpm: float = Field(description="Max rotor speed [rpm]")
    gearbox_ratio: float = Field(description="Gearbox speed-up ratio")
    gearbox_efficiency: float = Field(description="Gearbox efficiency [-]")
    generator_efficiency: float = Field(description="Generator efficiency [-]")
    pitch_kp: float = Field(description="Pitch PI proportional gain")
    pitch_ki: float = Field(description="Pitch PI integral gain")
    pitch_rate_limit_deg_s: float = Field(description="Pitch rate limit [deg/s]")
    yaw_rate_deg_s: float = Field(description="Yaw rate [deg/s]")
    yaw_deadband_deg: float = Field(description="Yaw deadband [deg]")
    yaw_power_loss_exponent: float = Field(description="Yaw cos^n exponent")
