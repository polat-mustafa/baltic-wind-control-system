"""Time-stepping turbine simulator — orchestrates all sub-models.

Physics Layer
─────────────
Combines aerodynamics, rotor dynamics, drivetrain, pitch control, and
yaw control into a complete turbine simulation.  Each timestep follows
the causal chain:

    Wind → Yaw → Aero → Pitch → Drivetrain → Rotor → Clamp

This models how a real turbine control system operates:
1. Wind hits the rotor (with yaw misalignment loss)
2. Aerodynamic forces produce torque
3. Pitch controller adjusts blade angle to regulate speed
4. Drivetrain converts mechanical to electrical power
5. Rotor speed updates via Newton's 2nd law
6. Rule 1 clamp: 0 ≤ P ≤ 15 MW (non-negotiable)

Standards Layer
───────────────
- IEC 61400-1: Design requirements (load cases DLC 1.x)
- IEC 61400-25-2: SCADA data model for turbine state
- Rule 1 (project engineering rule): Power never exceeds rated

Maths Layer
───────────
- Euler integration for rotor speed: ω(t+dt) = ω(t) + α·dt
- PI pitch control: β = Kp·e + Ki·∫e·dt
- Yaw tracking: ψ(t+dt) = ψ(t) + yaw_rate·dt
- All state variables are real-valued, continuous functions of time

Code Layer
──────────
The simulator composes pure sub-model functions.  State is passed as
frozen dataclasses; the only mutation is the time-stepping loop in
run_simulation().
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p4.turbine_power_curve import (
    STANDARD_AIR_DENSITY,
    TurbineSpec,
    get_v236_spec,
)
from app.services.turbine_physics.aerodynamics import (
    AerodynamicState,
    compute_aerodynamic_state,
)
from app.services.turbine_physics.drivetrain import (
    DrivetrainConfig,
    DrivetrainState,
    compute_drivetrain_state,
    compute_generator_torque_nm,
)
from app.services.turbine_physics.pitch_control import (
    PitchConfig,
    PitchState,
    compute_pitch_command,
)
from app.services.turbine_physics.rotor_dynamics import (
    RotorConfig,
    RotorState,
    compute_angular_acceleration,
    compute_rotor_state,
    step_rotor_speed,
)
from app.services.turbine_physics.yaw_control import (
    YawConfig,
    YawState,
    step_yaw,
)

# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class TurbineState:
    """Complete turbine state at one instant.

    Combines all sub-system states into a single immutable snapshot.
    This corresponds to a SCADA data frame at one timestamp.
    """

    time_s: float  # Simulation time [s]
    wind_speed_ms: float  # Input wind speed [m/s]
    wind_dir_deg: float  # Input wind direction [deg]
    aero: AerodynamicState  # Aerodynamic state
    rotor: RotorState  # Rotor dynamics state
    drivetrain: DrivetrainState  # Drivetrain state
    pitch: PitchState  # Pitch controller state
    yaw: YawState  # Yaw system state
    electrical_power_mw: float  # Final clamped electrical output [MW]
    status: str  # "operating", "below_cut_in", "above_cut_out", "shutdown"


@dataclass(frozen=True)
class SimulationSummary:
    """Summary statistics for a completed simulation."""

    total_energy_mwh: float  # Total energy produced [MWh]
    mean_power_mw: float  # Mean electrical power [MW]
    max_power_mw: float  # Peak electrical power [MW]
    capacity_factor: float  # Mean power / rated power [0-1]
    mean_rotor_speed_rpm: float  # Mean rotor speed [rpm]
    mean_pitch_deg: float  # Mean pitch angle [deg]
    mean_yaw_error_deg: float  # Mean absolute yaw error [deg]
    duration_s: float  # Total simulation time [s]
    num_steps: int  # Number of timesteps


@dataclass(frozen=True)
class SimulationResult:
    """Complete simulation output with time series and summary.

    Arrays are parallel — index i corresponds to the same instant.
    """

    time_s: NDArray[np.float64]
    wind_speed_ms: NDArray[np.float64]
    wind_dir_deg: NDArray[np.float64]
    rotor_speed_rpm: NDArray[np.float64]
    pitch_angle_deg: NDArray[np.float64]
    electrical_power_mw: NDArray[np.float64]
    aero_power_mw: NDArray[np.float64]
    tip_speed_ratio: NDArray[np.float64]
    cp: NDArray[np.float64]
    yaw_error_deg: NDArray[np.float64]
    gen_speed_rpm: NDArray[np.float64]
    nacelle_dir_deg: NDArray[np.float64]
    status: list[str]
    summary: SimulationSummary


@dataclass(frozen=True)
class SimulationConfig:
    """Configuration for the turbine simulator.

    Bundles all sub-system configs and simulation parameters.
    """

    dt: float = 0.1  # Timestep [s] — 10 Hz is typical for turbine control
    spec: TurbineSpec = field(default_factory=get_v236_spec)
    air_density_kg_m3: float = STANDARD_AIR_DENSITY
    rotor_config: RotorConfig = field(default_factory=RotorConfig)
    drivetrain_config: DrivetrainConfig = field(default_factory=DrivetrainConfig)
    pitch_config: PitchConfig = field(default_factory=PitchConfig)
    yaw_config: YawConfig = field(default_factory=YawConfig)
    initial_rotor_speed_rpm: float = 7.0  # Start near rated
    initial_nacelle_dir_deg: float = 0.0  # Facing North


# ── Core simulation functions ──────────────────────────────────────────


def _determine_status(wind_speed_ms: float, spec: TurbineSpec, is_shutdown: bool = False) -> str:
    """Determine turbine operating status based on wind speed."""
    if is_shutdown:
        return "shutdown"
    if wind_speed_ms < spec.cut_in_speed_ms:
        return "below_cut_in"
    if wind_speed_ms > spec.cut_out_speed_ms:
        return "above_cut_out"
    return "operating"


def step_turbine(
    prev_state: TurbineState,
    wind_speed_ms: float,
    wind_dir_deg: float,
    dt: float,
    config: SimulationConfig,
) -> TurbineState:
    """Advance turbine state by one timestep.

    Execution order follows the physical causal chain:
    1. Yaw: align nacelle to wind
    2. Aero: compute torque (with yaw loss)
    3. Pitch: regulate blade angle
    4. Drivetrain: compute generator torque
    5. Rotor: update speed (Euler integration)
    6. Rule 1: clamp power to [0, rated]

    Args:
        prev_state: Previous timestep state.
        wind_speed_ms: Current wind speed [m/s].
        wind_dir_deg: Current wind direction [deg].
        dt: Timestep [seconds].
        config: Simulation configuration.

    Returns:
        New TurbineState for the current timestep.
    """
    new_time = prev_state.time_s + dt
    status = _determine_status(wind_speed_ms, config.spec)

    # ── Outside operating range → coast down ────────────────────────
    if status in ("below_cut_in", "above_cut_out"):
        # No aerodynamic power, generator disconnected
        yaw_state = step_yaw(prev_state.yaw.nacelle_dir_deg, wind_dir_deg, dt, config.yaw_config)
        aero_state = compute_aerodynamic_state(
            wind_speed_ms,
            prev_state.rotor.speed_rpm,
            0.0,
            config.spec,
            config.air_density_kg_m3,
        )
        pitch_state = PitchState(
            angle_deg=prev_state.pitch.angle_deg,
            rate_deg_s=0.0,
            error_rpm=0.0,
            integral=0.0,
            region="idle",
        )
        drivetrain_state = compute_drivetrain_state(
            prev_state.rotor.speed_rpm, 0.0, 0.0, config.drivetrain_config
        )
        rotor_state = compute_rotor_state(prev_state.rotor.speed_rpm, 0.0, 0.0, config.rotor_config)

        return TurbineState(
            time_s=new_time,
            wind_speed_ms=wind_speed_ms,
            wind_dir_deg=wind_dir_deg,
            aero=aero_state,
            rotor=rotor_state,
            drivetrain=drivetrain_state,
            pitch=pitch_state,
            yaw=yaw_state,
            electrical_power_mw=0.0,
            status=status,
        )

    # ── Normal operation ────────────────────────────────────────────

    # 1. Yaw control — align nacelle to wind
    yaw_state = step_yaw(prev_state.yaw.nacelle_dir_deg, wind_dir_deg, dt, config.yaw_config)

    # 2. Aerodynamics — compute torque (with yaw loss)
    aero_state = compute_aerodynamic_state(
        wind_speed_ms,
        prev_state.rotor.speed_rpm,
        prev_state.pitch.angle_deg,
        config.spec,
        config.air_density_kg_m3,
    )

    # Apply yaw loss to aerodynamic power and torque
    yaw_factor = yaw_state.power_loss_factor
    effective_aero_power = aero_state.aero_power_w * yaw_factor
    effective_aero_torque = aero_state.aero_torque_nm * yaw_factor

    # 3. Pitch control — regulate blade angle
    pitch_state = compute_pitch_command(
        prev_state.rotor.speed_rpm,
        prev_state.pitch.angle_deg,
        prev_state.pitch.integral,
        dt,
        config.pitch_config,
    )

    # 4. Drivetrain — compute generator torque
    rated_power_w = config.spec.rated_power_mw * 1e6
    target_power = min(effective_aero_power, rated_power_w)
    gen_torque = compute_generator_torque_nm(
        target_power, prev_state.rotor.speed_rpm, config.drivetrain_config
    )

    drivetrain_state = compute_drivetrain_state(
        prev_state.rotor.speed_rpm,
        effective_aero_torque,
        gen_torque,
        config.drivetrain_config,
    )

    # 5. Rotor dynamics — update speed via Euler integration
    alpha = compute_angular_acceleration(
        effective_aero_torque,
        gen_torque,
        config.rotor_config.friction_torque_nm,
        config.rotor_config.inertia_kg_m2,
    )
    new_rpm = step_rotor_speed(prev_state.rotor.speed_rpm, alpha, dt, config.rotor_config)
    rotor_state = compute_rotor_state(
        new_rpm, effective_aero_torque, gen_torque, config.rotor_config
    )

    # 6. Rule 1: 0 ≤ P ≤ 15 MW (non-negotiable engineering constraint)
    electrical_power_mw = drivetrain_state.elec_power_w / 1e6
    electrical_power_mw = max(0.0, min(electrical_power_mw, config.spec.rated_power_mw))

    return TurbineState(
        time_s=new_time,
        wind_speed_ms=wind_speed_ms,
        wind_dir_deg=wind_dir_deg,
        aero=aero_state,
        rotor=rotor_state,
        drivetrain=drivetrain_state,
        pitch=pitch_state,
        yaw=yaw_state,
        electrical_power_mw=electrical_power_mw,
        status=status,
    )


def _build_initial_state(config: SimulationConfig) -> TurbineState:
    """Create the initial turbine state at t=0."""
    aero = compute_aerodynamic_state(
        0.0,
        config.initial_rotor_speed_rpm,
        0.0,
        config.spec,
        config.air_density_kg_m3,
    )
    rotor = compute_rotor_state(config.initial_rotor_speed_rpm, 0.0, 0.0, config.rotor_config)
    drivetrain = compute_drivetrain_state(
        config.initial_rotor_speed_rpm, 0.0, 0.0, config.drivetrain_config
    )
    pitch = PitchState(angle_deg=0.0, rate_deg_s=0.0, error_rpm=0.0, integral=0.0, region="idle")
    yaw = YawState(
        nacelle_dir_deg=config.initial_nacelle_dir_deg,
        wind_dir_deg=0.0,
        error_deg=0.0,
        rate_deg_s=0.0,
        power_loss_factor=1.0,
        is_yawing=False,
    )

    return TurbineState(
        time_s=0.0,
        wind_speed_ms=0.0,
        wind_dir_deg=0.0,
        aero=aero,
        rotor=rotor,
        drivetrain=drivetrain,
        pitch=pitch,
        yaw=yaw,
        electrical_power_mw=0.0,
        status="idle",
    )


def _compute_summary(
    time_s: NDArray[np.float64],
    power_mw: NDArray[np.float64],
    rotor_rpm: NDArray[np.float64],
    pitch_deg: NDArray[np.float64],
    yaw_error: NDArray[np.float64],
    rated_power_mw: float,
) -> SimulationSummary:
    """Compute summary statistics from simulation arrays."""
    duration = float(time_s[-1] - time_s[0]) if len(time_s) > 1 else 0.0

    total_energy = float(np.trapezoid(power_mw, time_s)) / 3600.0  # MW·s → MWh
    mean_power = float(np.mean(power_mw))
    max_power = float(np.max(power_mw))
    capacity_factor = mean_power / rated_power_mw if rated_power_mw > 0 else 0.0

    return SimulationSummary(
        total_energy_mwh=total_energy,
        mean_power_mw=mean_power,
        max_power_mw=max_power,
        capacity_factor=capacity_factor,
        mean_rotor_speed_rpm=float(np.mean(rotor_rpm)),
        mean_pitch_deg=float(np.mean(pitch_deg)),
        mean_yaw_error_deg=float(np.mean(np.abs(yaw_error))),
        duration_s=duration,
        num_steps=len(time_s),
    )


def run_simulation(
    wind_speeds_ms: list[float] | NDArray[np.float64],
    wind_dirs_deg: list[float] | NDArray[np.float64] | None = None,
    config: SimulationConfig | None = None,
) -> SimulationResult:
    """Run a full turbine simulation over a wind time series.

    Each element in wind_speeds_ms corresponds to one timestep (dt apart).
    If wind_dirs_deg is None, assumes constant direction = 0° (no yaw error).

    Args:
        wind_speeds_ms: Wind speed time series [m/s].
        wind_dirs_deg: Wind direction time series [deg] (optional).
        config: Simulation configuration.

    Returns:
        SimulationResult with parallel time-series arrays and summary.
    """
    if config is None:
        config = SimulationConfig()

    ws = np.asarray(wind_speeds_ms, dtype=np.float64)
    n = len(ws)

    if wind_dirs_deg is None:
        wd = np.zeros(n, dtype=np.float64)
    else:
        wd = np.asarray(wind_dirs_deg, dtype=np.float64)

    # Pre-allocate output arrays
    time_arr = np.zeros(n, dtype=np.float64)
    ws_arr = np.zeros(n, dtype=np.float64)
    wd_arr = np.zeros(n, dtype=np.float64)
    rpm_arr = np.zeros(n, dtype=np.float64)
    pitch_arr = np.zeros(n, dtype=np.float64)
    power_arr = np.zeros(n, dtype=np.float64)
    aero_power_arr = np.zeros(n, dtype=np.float64)
    tsr_arr = np.zeros(n, dtype=np.float64)
    cp_arr = np.zeros(n, dtype=np.float64)
    yaw_err_arr = np.zeros(n, dtype=np.float64)
    gen_rpm_arr = np.zeros(n, dtype=np.float64)
    nacelle_arr = np.zeros(n, dtype=np.float64)
    status_list: list[str] = []

    # Initialize
    state = _build_initial_state(config)

    for i in range(n):
        state = step_turbine(state, float(ws[i]), float(wd[i]), config.dt, config)

        time_arr[i] = state.time_s
        ws_arr[i] = state.wind_speed_ms
        wd_arr[i] = state.wind_dir_deg
        rpm_arr[i] = state.rotor.speed_rpm
        pitch_arr[i] = state.pitch.angle_deg
        power_arr[i] = state.electrical_power_mw
        aero_power_arr[i] = state.aero.aero_power_w / 1e6
        tsr_arr[i] = state.aero.tip_speed_ratio
        cp_arr[i] = state.aero.cp
        yaw_err_arr[i] = state.yaw.error_deg
        gen_rpm_arr[i] = state.drivetrain.gen_speed_rpm
        nacelle_arr[i] = state.yaw.nacelle_dir_deg
        status_list.append(state.status)

    summary = _compute_summary(
        time_arr,
        power_arr,
        rpm_arr,
        pitch_arr,
        yaw_err_arr,
        config.spec.rated_power_mw,
    )

    return SimulationResult(
        time_s=time_arr,
        wind_speed_ms=ws_arr,
        wind_dir_deg=wd_arr,
        rotor_speed_rpm=rpm_arr,
        pitch_angle_deg=pitch_arr,
        electrical_power_mw=power_arr,
        aero_power_mw=aero_power_arr,
        tip_speed_ratio=tsr_arr,
        cp=cp_arr,
        yaw_error_deg=yaw_err_arr,
        gen_speed_rpm=gen_rpm_arr,
        nacelle_dir_deg=nacelle_arr,
        status=status_list,
        summary=summary,
    )


def run_step_response(
    v_init_ms: float = 8.0,
    v_final_ms: float = 14.0,
    ramp_s: float = 10.0,
    total_s: float = 120.0,
    config: SimulationConfig | None = None,
) -> SimulationResult:
    """Run a step-response simulation: wind ramps from v_init to v_final.

    Useful for analyzing turbine response to wind speed changes:
    - Below-to-above rated transition
    - Pitch controller settling time
    - Rotor speed regulation quality

    The wind profile is:
        t < ramp_s:     V = v_init + (v_final - v_init) · t / ramp_s
        t ≥ ramp_s:     V = v_final

    Args:
        v_init_ms: Initial wind speed [m/s].
        v_final_ms: Final wind speed [m/s].
        ramp_s: Ramp duration [s].
        total_s: Total simulation time [s].
        config: Simulation configuration.

    Returns:
        SimulationResult with step-response time series.
    """
    if config is None:
        config = SimulationConfig()

    n_steps = int(total_s / config.dt)

    # Generate wind speed ramp
    wind_speeds = []
    for i in range(n_steps):
        t = i * config.dt
        v = v_init_ms + (v_final_ms - v_init_ms) * t / ramp_s if t < ramp_s else v_final_ms
        wind_speeds.append(v)

    return run_simulation(wind_speeds, config=config)
