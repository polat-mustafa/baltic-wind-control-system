"""Time-stepping turbine simulator — orchestrates all sub-models.

Physics Layer
─────────────
Combines aerodynamics, rotor dynamics, the direct-drive drivetrain, pitch control
and yaw control of the SB-510 turbine (IEA 15 MW, "V236 class") into a complete
turbine simulation.  Each timestep follows
the causal chain:

    Wind → Yaw → Aero → Pitch → Drivetrain → Rotor → Clamp

This models how a real turbine control system operates:
1. Wind hits the rotor (with yaw misalignment loss)
2. Aerodynamic forces produce torque
3. Pitch controller adjusts blade angle to regulate speed
4. The direct-drive generator and full converter turn it into electrical power
5. Rotor speed updates via Newton's 2nd law
6. Rule 1 clamp: 0 ≤ P ≤ 15 MW (non-negotiable)

Standards Layer
───────────────
- IEC 61400-1: Design requirements (load cases DLC 1.x)
- IEC 61400-25-2: SCADA data model for turbine state
- Rule 1 (project engineering rule): Power never exceeds rated

Maths Layer
───────────
- Euler integration for rotor speed: ω(t+dt) = ω(t) + α·dt, J = 3.543 × 10⁸ kg·m²
- ROSCO controllers (IEA 15 MW DISCON.IN): gain-scheduled pitch PI on rotor speed
  (ref 7.56 rpm, 2 °/s), generator-torque PI tracking λ_opt = 9 (5.0–7.52 rpm),
  constant 19.79 MN·m above rated; the wind-speed estimator is replaced by the
  known hub-height wind (perfect estimate)
- Yaw tracking: ψ(t+dt) = ψ(t) + yaw_rate·dt
- All state variables are real-valued, continuous functions of time

Code Layer
──────────
The simulator composes pure sub-model functions.  State is passed as
frozen dataclasses; the only mutation is the time-stepping loop in
run_simulation().
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from app.services.p1.turbine_models import get_turbine, rosco
from app.services.p4.turbine_power_curve import (
    STANDARD_AIR_DENSITY,
    TurbineSpec,
    get_turbine_spec,
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
    compute_torque_reference_rad_s,
)
from app.services.turbine_physics.pitch_control import (
    PitchConfig,
    PitchState,
    compute_pitch_command,
    compute_shutdown_pitch,
)
from app.services.turbine_physics.rotor_dynamics import (
    RotorConfig,
    RotorState,
    compute_angular_acceleration,
    compute_rotor_state,
    rad_s_to_rpm,
    rpm_to_rad_s,
    step_rotor_speed,
)
from app.services.turbine_physics.state_machine import (
    TurbineOperatingState,
    classify_wind_state,
)
from app.services.turbine_physics.yaw_control import (
    YawConfig,
    YawState,
    step_yaw,
)

_, _CONTROL = rosco()

# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class ControllerSignals:
    """ROSCO signal conditioning carried from one step to the next.

    - Measured speed → 2nd-order low-pass (F_LPFCornerFreq 1.008 rad/s, ζ 0.7)
    - TSR reference λ_opt·V/R → 1st-order low-pass (F_VSRefSpdCornerFreq 0.209 rad/s)
    - Setpoint smoother (SS_Mode 1): Δω = [(β − β_min)/30°·SS_VSGain
      − (P_rated − P)/P_rated·SS_PCGain]·ω_PC, low-passed at 0.628 rad/s. Δω > 0
      (pitch active) lowers the torque reference so the torque saturates at rated;
      Δω < 0 (power below rated) raises the pitch reference so the blades stay fine.
    """

    speed_rad_s: float  # filtered rotor speed [rad/s] (ROSCO GenSpeedF)
    speed_rate_rad_s2: float  # 2nd-order filter state [rad/s²]
    torque_ref_rad_s: float  # filtered TSR speed reference [rad/s]
    setpoint_shift_rad_s: float  # Δω of the setpoint smoother [rad/s]


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
    status: str  # IEC 61400-1 operating state (TurbineOperatingState value)
    signals: ControllerSignals  # ROSCO filter / setpoint-smoother states


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

    Bundles all sub-system configs and simulation parameters. With
    ``initial_rotor_speed_rpm=None`` the run starts on the steady operating point
    of the first wind sample (rotor speed and pitch from the official table,
    generator torque = aerodynamic torque), so no start-up transient is simulated.
    """

    dt: float = 0.1  # Timestep [s] — 10 Hz is typical for turbine control
    spec: TurbineSpec = field(default_factory=get_turbine_spec)
    air_density_kg_m3: float = STANDARD_AIR_DENSITY
    rotor_config: RotorConfig = field(default_factory=RotorConfig)
    drivetrain_config: DrivetrainConfig = field(default_factory=DrivetrainConfig)
    pitch_config: PitchConfig = field(default_factory=PitchConfig)
    yaw_config: YawConfig = field(default_factory=YawConfig)
    initial_rotor_speed_rpm: float | None = None  # None → steady operating point
    initial_nacelle_dir_deg: float = 0.0  # Facing North


# ── Core simulation functions ──────────────────────────────────────────


def _low_pass(previous: float, target: float, corner_rad_s: float, dt: float) -> float:
    """First-order low-pass y += (1 − e^(−ωc·dt))·(u − y) (exact for a held input)."""
    return previous + (1.0 - math.exp(-corner_rad_s * dt)) * (target - previous)


def _condition_signals(
    prev: TurbineState, wind_speed_ms: float, radius_m: float, dt: float
) -> tuple[ControllerSignals, float, float]:
    """ROSCO ComputeVariablesSetpoints + SetpointSmoother for one step.

    Returns the new signal states, the torque-controller reference [rad/s] and the
    pitch-controller reference [rad/s].
    """
    c = _CONTROL
    sig = prev.signals
    omega = rpm_to_rad_s(prev.rotor.speed_rpm)

    # 2nd-order low-pass on the measured speed (semi-implicit Euler)
    wc, zeta = c.speed_filter_corner_rad_s, c.speed_filter_damping
    rate = sig.speed_rate_rad_s2 + dt * (
        wc**2 * (omega - sig.speed_rad_s) - 2.0 * zeta * wc * sig.speed_rate_rad_s2
    )
    speed = sig.speed_rad_s + dt * rate

    # Setpoint smoother — 0.524 rad (30°) normalises the pitch term, as in ROSCO
    beta_min = c.minimum_pitch_deg(wind_speed_ms)
    raw_shift = (
        math.radians(prev.pitch.angle_deg - beta_min) / 0.524 * c.setpoint_smoother_vs_gain
        - (c.rated_power_w - prev.electrical_power_mw * 1e6)
        / c.rated_power_w
        * c.setpoint_smoother_pc_gain
    ) * c.pitch_ref_speed_rad_s
    shift = _low_pass(sig.setpoint_shift_rad_s, raw_shift, c.setpoint_smoother_corner_rad_s, dt)
    pitch_ref = c.pitch_ref_speed_rad_s - min(shift, 0.0)

    # TSR reference: filter, limit to [ω_min, ω_rated], lower by the smoother
    tsr_ref = compute_torque_reference_rad_s(wind_speed_ms, radius_m)
    torque_ref_filtered = _low_pass(sig.torque_ref_rad_s, tsr_ref, c.vs_ref_corner_rad_s, dt)
    torque_ref = min(max(torque_ref_filtered, c.min_speed_rad_s), c.rated_speed_rad_s)
    torque_ref = max(torque_ref - max(shift, 0.0), c.min_speed_rad_s)

    signals = ControllerSignals(
        speed_rad_s=speed,
        speed_rate_rad_s2=rate,
        torque_ref_rad_s=torque_ref_filtered,
        setpoint_shift_rad_s=shift,
    )
    return signals, torque_ref, pitch_ref


def _determine_status(wind_speed_ms: float, spec: TurbineSpec, is_shutdown: bool = False) -> str:
    """Determine turbine operating status using IEC 61400-1 state machine.

    Delegates to ``classify_wind_state()`` which maps wind speed to the
    appropriate IEC 61400-1 §7.4 state.  The returned string is the
    TurbineOperatingState enum value (e.g. ``"power_production"``).

    For full state-machine behaviour (faults, commands, overspeed) use
    ``state_machine.next_state()`` directly with ``StateMachineInput``.
    """
    if is_shutdown:
        return TurbineOperatingState.EMERGENCY_SHUTDOWN.value
    return classify_wind_state(
        wind_speed_ms,
        cut_in_ms=spec.cut_in_speed_ms,
        cut_out_ms=spec.cut_out_speed_ms,
    ).value


def step_turbine(
    prev_state: TurbineState,
    wind_speed_ms: float,
    wind_dir_deg: float,
    dt: float,
    config: SimulationConfig,
) -> TurbineState:
    """Advance turbine state by one timestep.

    Execution order follows the physical causal chain:
    1. Yaw: align nacelle to wind (cos³ loss on the rotor torque)
    2. Aero: torque from Cp(λ, β) at the previous speed and pitch
    3. Controllers (ROSCO): pitch PI on speed, generator torque PI (TSR tracking);
       outside the operating range the blades feather at 2 °/s while the generator
       torque brakes the rotor towards the 5 rpm minimum, then unloads
    4. Rotor: J·dω/dt = Q_aero − Q_gen (Euler)
    5. Rule 1: 0 ≤ P ≤ 15 MW (the converter's power limit; clamp kept as a guard)

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
    producing = status == TurbineOperatingState.POWER_PRODUCTION.value
    rpm = prev_state.rotor.speed_rpm
    radius_m = config.spec.rotor_diameter_m / 2.0

    # 1. Yaw control — align nacelle to wind
    yaw_state = step_yaw(prev_state.yaw.nacelle_dir_deg, wind_dir_deg, dt, config.yaw_config)

    # 2. Aerodynamics at the previous speed and pitch, reduced by yaw misalignment
    aero_state = compute_aerodynamic_state(
        wind_speed_ms, rpm, prev_state.pitch.angle_deg, config.spec, config.air_density_kg_m3
    )
    aero_torque = aero_state.aero_torque_nm * yaw_state.power_loss_factor

    # 3. Controllers (ROSCO) on the filtered speed
    signals, torque_ref, pitch_ref = _condition_signals(prev_state, wind_speed_ms, radius_m, dt)
    if producing:
        pitch_state = compute_pitch_command(
            rad_s_to_rpm(signals.speed_rad_s),
            prev_state.pitch.angle_deg,
            prev_state.pitch.integral,
            dt,
            config.pitch_config,
            wind_speed_ms=wind_speed_ms,
            reference_rpm=rad_s_to_rpm(pitch_ref),
        )
        gen_torque, torque_integral = compute_generator_torque_nm(
            signals.speed_rad_s,
            torque_ref,
            prev_state.drivetrain.gen_torque_nm,
            prev_state.drivetrain.torque_integral_nm,
            dt,
            config.drivetrain_config,
        )
    else:
        # IEC 61400-1 DLC 4.x / 6.x: feather and let the rotor idle
        new_pitch = compute_shutdown_pitch(
            prev_state.pitch.angle_deg, dt, config.pitch_config.rate_limit_deg_s
        )
        pitch_state = PitchState(
            angle_deg=new_pitch,
            rate_deg_s=(new_pitch - prev_state.pitch.angle_deg) / dt if dt > 0 else 0.0,
            error_rpm=0.0,
            integral=new_pitch,
            region="feathering" if new_pitch < config.pitch_config.max_deg else "idle",
        )
        # The generator keeps braking (torque PI on the 5 rpm minimum speed) while the
        # blades feather; once the feathered blades brake the rotor it unloads to 0.
        gen_torque, torque_integral = compute_generator_torque_nm(
            signals.speed_rad_s,
            config.drivetrain_config.min_speed_rad_s,
            prev_state.drivetrain.gen_torque_nm,
            prev_state.drivetrain.torque_integral_nm,
            dt,
            config.drivetrain_config,
        )

    drivetrain_state = compute_drivetrain_state(
        rpm, aero_torque, gen_torque, config.drivetrain_config, torque_integral
    )

    # 4. Rotor dynamics — J·dω/dt = Q_aero − Q_gen (direct drive, one shaft)
    alpha = compute_angular_acceleration(
        aero_torque,
        gen_torque,
        config.rotor_config.friction_torque_nm,
        config.rotor_config.inertia_kg_m2,
    )
    new_rpm = step_rotor_speed(rpm, alpha, dt, config.rotor_config)
    rotor_state = compute_rotor_state(new_rpm, aero_torque, gen_torque, config.rotor_config)

    # 5. Rule 1: 0 ≤ P ≤ 15 MW (non-negotiable engineering constraint)
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
        signals=signals,
    )


def _build_initial_state(config: SimulationConfig, wind_speed_ms: float = 0.0) -> TurbineState:
    """Create the initial turbine state at t=0.

    Default: the steady operating point of the first wind sample — rotor speed and
    pitch from the official IEA 15 MW table, generator torque equal to the
    aerodynamic torque, controller integrals at their outputs. Outside 3–25 m/s the
    turbine starts parked (rotor at rest, blades feathered at 90°). An explicit
    ``initial_rotor_speed_rpm`` starts from that speed with the generator unloaded
    instead (a start-up transient).
    """
    turbine = get_turbine(config.spec.model_id)
    in_range = config.spec.cut_in_speed_ms <= wind_speed_ms <= config.spec.cut_out_speed_ms
    point = turbine.operating_point(min(max(wind_speed_ms, turbine.cut_in_ms), turbine.cut_out_ms))
    steady = config.initial_rotor_speed_rpm is None
    if steady:
        rpm = point["rotor_rpm"] if in_range else 0.0
    else:
        rpm = float(config.initial_rotor_speed_rpm or 0.0)
    pitch = point["pitch_deg"] if in_range else config.pitch_config.max_deg
    aero = compute_aerodynamic_state(
        wind_speed_ms, rpm, pitch, config.spec, config.air_density_kg_m3
    )
    torque = aero.aero_torque_nm if steady and in_range else 0.0
    rotor = compute_rotor_state(rpm, aero.aero_torque_nm, torque, config.rotor_config)
    drivetrain = compute_drivetrain_state(
        rpm, aero.aero_torque_nm, torque, config.drivetrain_config, torque
    )
    pitch_state = PitchState(
        angle_deg=pitch, rate_deg_s=0.0, error_rpm=0.0, integral=pitch, region="idle"
    )
    signals = ControllerSignals(
        speed_rad_s=rpm_to_rad_s(rpm),
        speed_rate_rad_s2=0.0,
        torque_ref_rad_s=compute_torque_reference_rad_s(
            wind_speed_ms, config.spec.rotor_diameter_m / 2.0
        ),
        setpoint_shift_rad_s=0.0,
    )
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
        wind_speed_ms=wind_speed_ms,
        wind_dir_deg=0.0,
        aero=aero,
        rotor=rotor,
        drivetrain=drivetrain,
        pitch=pitch_state,
        yaw=yaw,
        electrical_power_mw=drivetrain.elec_power_w / 1e6,
        status=TurbineOperatingState.PARKED_STANDBY.value,
        signals=signals,
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
    state = _build_initial_state(config, float(ws[0]) if n else 0.0)

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
