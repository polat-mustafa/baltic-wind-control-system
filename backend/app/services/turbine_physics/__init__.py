"""Turbine Physics Module — dynamic simulation of the V236-15.0 MW.

This package provides time-stepping physics simulation for a wind turbine:
- Aerodynamics: Cp(λ,β) surface, tip-speed ratio, aero power/torque
- Rotor dynamics: Newton's 2nd law for rotation, Euler integration
- Drivetrain: Gearbox ratio, generator, efficiency losses
- Pitch control: PI controller for above-rated regulation
- Yaw control: Nacelle alignment, cos³ power loss

Usage:
    from app.services.turbine_physics import run_simulation, SimulationConfig

    result = run_simulation(wind_speeds=[8, 10, 12, 14, 12, 10])
    print(f"Energy: {result.summary.total_energy_mwh:.2f} MWh")
"""

# Aerodynamics
from app.services.turbine_physics.aerodynamics import (
    AerodynamicState,
    compute_aerodynamic_state,
    compute_cp,
    compute_ct,
    compute_tip_speed_ratio,
)

# Drivetrain
from app.services.turbine_physics.drivetrain import (
    DrivetrainConfig,
    DrivetrainState,
    compute_drivetrain_state,
    compute_generator_speed_rpm,
    compute_generator_torque_nm,
)

# Pitch control
from app.services.turbine_physics.pitch_control import (
    PitchConfig,
    PitchState,
    compute_pitch_command,
    compute_shutdown_pitch,
)

# Rotor dynamics
from app.services.turbine_physics.rotor_dynamics import (
    RotorConfig,
    RotorState,
    compute_angular_acceleration,
    compute_kinetic_energy_mj,
    compute_rotor_state,
    rpm_to_rad_s,
    step_rotor_speed,
)

# Simulator
from app.services.turbine_physics.simulator import (
    SimulationConfig,
    SimulationResult,
    SimulationSummary,
    TurbineState,
    run_simulation,
    run_step_response,
    step_turbine,
)

# Yaw control
from app.services.turbine_physics.yaw_control import (
    YawConfig,
    YawState,
    compute_yaw_error_deg,
    compute_yaw_power_loss,
    step_yaw,
)

__all__ = [
    # Aerodynamics
    "AerodynamicState",
    # Drivetrain
    "DrivetrainConfig",
    "DrivetrainState",
    # Pitch control
    "PitchConfig",
    "PitchState",
    # Rotor dynamics
    "RotorConfig",
    "RotorState",
    # Simulator
    "SimulationConfig",
    "SimulationResult",
    "SimulationSummary",
    "TurbineState",
    # Yaw control
    "YawConfig",
    "YawState",
    "compute_aerodynamic_state",
    "compute_angular_acceleration",
    "compute_cp",
    "compute_ct",
    "compute_drivetrain_state",
    "compute_generator_speed_rpm",
    "compute_generator_torque_nm",
    "compute_kinetic_energy_mj",
    "compute_pitch_command",
    "compute_rotor_state",
    "compute_shutdown_pitch",
    "compute_tip_speed_ratio",
    "compute_yaw_error_deg",
    "compute_yaw_power_loss",
    "rpm_to_rad_s",
    "run_simulation",
    "run_step_response",
    "step_rotor_speed",
    "step_turbine",
    "step_yaw",
]
