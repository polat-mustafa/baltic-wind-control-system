"""Rotor dynamics model — rotational inertia and speed integration.

Physics Layer
─────────────
Newton's second law for rotation governs rotor acceleration:

    J · dω/dt = Q_aero - Q_gen - Q_friction

where:
    J         = rotor + generator-rotor moment of inertia [kg·m²]
    ω         = angular speed [rad/s]
    Q_aero    = aerodynamic torque from wind [N·m]
    Q_gen     = generator air-gap torque [N·m] (direct drive: same shaft, no gearing)
    Q_friction = bearing friction torque [N·m]

When Q_aero > Q_gen + Q_friction, the rotor accelerates.
When Q_aero < Q_gen + Q_friction, the rotor decelerates.

Standards Layer
───────────────
- IEC 61400-1: Design requirements for wind turbines
- IEA 15 MW reference turbine (Gaertner et al. 2020, NREL/TP-5000-75698): low-speed
  direct drive, rotor 5.0–7.56 rpm (ROSCO VS_MinOMSpd / PC_RefSpd), overspeed
  shutdown 9.07 rpm (ROSCO SD_MaxGenSpd)

Maths Layer
───────────
- Euler integration: ω(t+dt) = ω(t) + α·dt
- Kinetic energy: E = ½·J·ω²
- Speed is only bounded below by standstill (ω ≥ 0); the controllers hold the speed
  range and the state machine trips on overspeed — no artificial clamp.

Code Layer
──────────
Pure functions with frozen dataclass outputs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.services.p1.turbine_models import rosco

_, _CONTROL = rosco()

# ── IEA 15 MW rotor constants ───────────────────────────────────────────

ROTOR_INERTIA_KG_M2: float = _CONTROL.total_inertia_kg_m2
"""Drivetrain moment of inertia about the shaft [kg·m²] — 3.543 × 10⁸.

Rigid rotor (3 blades + hub) 3.5246 × 10⁸ kg·m² (report §5.7) plus the outer
generator rotor 1.837 × 10⁶ kg·m² (ElastoDyn GenIner). Direct drive: the generator
turns at rotor speed, so its inertia is added without the N² gear-ratio factor.
"""

FRICTION_TORQUE_NM: float = 0.0
"""Bearing friction torque [N·m].

The reference model (ElastoDyn) has no friction term — main-bearing and generator
losses are inside the generator efficiency. Kept as an explicit input for exercises.
"""

MIN_ROTOR_SPEED_RPM: float = _CONTROL.min_speed_rad_s * 30.0 / math.pi
"""Minimum rotor speed [rpm] — 5.0 (ROSCO VS_MinOMSpd). Below λ_opt·V/R at low wind
the torque controller holds this speed (region 1.5) to keep the rotor clear of the
tower's natural frequency (3P exclusion zone)."""

MAX_ROTOR_SPEED_RPM: float = _CONTROL.pitch_ref_speed_rad_s * 30.0 / math.pi
"""Rated rotor speed [rpm] — 7.56 (ROSCO PC_RefSpd, the pitch-controller reference).

The tip-speed limit of 95 m/s gives 7.52 rpm (ROSCO VS_RefSpd, the torque-controller
reference); the pitch loop regulates slightly above it so the two loops do not fight.
"""

OVERSPEED_SHUTDOWN_RPM: float = _CONTROL.overspeed_shutdown_rpm
"""Overspeed shutdown [rpm] — 9.07 (ROSCO SD_MaxGenSpd, 1.2 × rated)."""


# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class RotorState:
    """Rotor dynamic state at one instant.

    Immutable snapshot of rotor speed, acceleration, and energy.
    """

    speed_rpm: float  # Rotor speed [rpm]
    speed_rad_s: float  # Rotor speed [rad/s]  (= rpm × 2π/60)
    angular_acceleration: float  # α [rad/s²]
    net_torque: float  # Q_net = Q_aero - Q_gen - Q_friction [N·m]
    kinetic_energy_mj: float  # ½·J·ω² [MJ]


@dataclass(frozen=True)
class RotorConfig:
    """Configuration for rotor dynamics integration (IEA 15 MW defaults)."""

    inertia_kg_m2: float = ROTOR_INERTIA_KG_M2
    friction_torque_nm: float = FRICTION_TORQUE_NM
    min_speed_rpm: float = MIN_ROTOR_SPEED_RPM
    max_speed_rpm: float = MAX_ROTOR_SPEED_RPM


# ── Pure functions ──────────────────────────────────────────────────────


def rpm_to_rad_s(rpm: float) -> float:
    """Convert revolutions per minute to radians per second.

    ω [rad/s] = rpm × 2π / 60
    """
    return rpm * 2.0 * math.pi / 60.0


def rad_s_to_rpm(rad_s: float) -> float:
    """Convert radians per second to revolutions per minute.

    rpm = ω [rad/s] × 60 / 2π
    """
    return rad_s * 60.0 / (2.0 * math.pi)


def compute_angular_acceleration(
    aero_torque_nm: float,
    gen_torque_nm: float,
    friction_torque_nm: float,
    inertia_kg_m2: float,
) -> float:
    """Compute rotor angular acceleration from Newton's 2nd law.

    α = (Q_aero - Q_gen - Q_friction) / J

    Positive α → rotor speeds up (wind torque exceeds generator load).
    Negative α → rotor slows down (generator load exceeds wind torque).

    Args:
        aero_torque_nm: Aerodynamic torque from wind [N·m].
        gen_torque_nm: Generator reaction torque [N·m].
        friction_torque_nm: Mechanical friction torque [N·m].
        inertia_kg_m2: Moment of inertia [kg·m²].

    Returns:
        Angular acceleration α [rad/s²].
    """
    net_torque = aero_torque_nm - gen_torque_nm - friction_torque_nm
    return net_torque / inertia_kg_m2


def compute_kinetic_energy_mj(
    speed_rad_s: float,
    inertia_kg_m2: float,
) -> float:
    """Compute rotor kinetic energy.

    E = ½ · J · ω²

    At rated speed (7.56 rpm ≈ 0.792 rad/s) with J = 3.543 × 10⁸ kg·m²:
    E = ½ × 3.543e8 × 0.792² ≈ 111 MJ ≈ 31 kWh — 7.4 s of rated power, the
    reserve behind synthetic inertia and short ride-through.

    Args:
        speed_rad_s: Rotor speed [rad/s].
        inertia_kg_m2: Moment of inertia [kg·m²].

    Returns:
        Kinetic energy [MJ].
    """
    energy_j = 0.5 * inertia_kg_m2 * speed_rad_s**2
    return energy_j / 1e6  # Convert J → MJ


def step_rotor_speed(
    current_rpm: float,
    angular_acceleration: float,
    dt: float,
    config: RotorConfig | None = None,
) -> float:
    """Advance rotor speed by one timestep using Euler integration.

    ω(t + dt) = ω(t) + α · dt

    Only standstill bounds the result (ω ≥ 0): speed limits are the job of the
    torque and pitch controllers and of the overspeed trip, not of the integrator.

    Args:
        current_rpm: Current rotor speed [rpm].
        angular_acceleration: α [rad/s²] from compute_angular_acceleration.
        dt: Timestep [seconds].
        config: Rotor configuration (kept for API symmetry).

    Returns:
        New rotor speed [rpm], ≥ 0.
    """
    new_rad_s = rpm_to_rad_s(current_rpm) + angular_acceleration * dt
    return max(0.0, rad_s_to_rpm(new_rad_s))


def compute_rotor_state(
    speed_rpm: float,
    aero_torque_nm: float,
    gen_torque_nm: float,
    config: RotorConfig | None = None,
) -> RotorState:
    """Compute complete rotor state at one instant.

    Args:
        speed_rpm: Current rotor speed [rpm].
        aero_torque_nm: Aerodynamic torque [N·m].
        gen_torque_nm: Generator reaction torque [N·m].
        config: Rotor configuration (defaults to IEA 15 MW values).

    Returns:
        Complete RotorState snapshot.
    """
    if config is None:
        config = RotorConfig()

    speed_rad_s = rpm_to_rad_s(speed_rpm)
    alpha = compute_angular_acceleration(
        aero_torque_nm,
        gen_torque_nm,
        config.friction_torque_nm,
        config.inertia_kg_m2,
    )
    net_torque = aero_torque_nm - gen_torque_nm - config.friction_torque_nm
    ke_mj = compute_kinetic_energy_mj(speed_rad_s, config.inertia_kg_m2)

    return RotorState(
        speed_rpm=speed_rpm,
        speed_rad_s=speed_rad_s,
        angular_acceleration=alpha,
        net_torque=net_torque,
        kinetic_energy_mj=ke_mj,
    )
