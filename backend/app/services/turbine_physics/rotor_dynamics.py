"""Rotor dynamics model — rotational inertia and speed integration.

Physics Layer
─────────────
Newton's second law for rotation governs rotor acceleration:

    J · dω/dt = Q_aero - Q_gen - Q_friction

where:
    J         = rotor moment of inertia [kg·m²]
    ω         = angular speed [rad/s]
    Q_aero    = aerodynamic torque from wind [N·m]
    Q_gen     = generator reaction torque [N·m]
    Q_friction = mechanical friction torque [N·m]

When Q_aero > Q_gen + Q_friction, the rotor accelerates.
When Q_aero < Q_gen + Q_friction, the rotor decelerates.

Standards Layer
───────────────
- IEC 61400-1: Design requirements for wind turbines
- V236-15.0 MW: rotor speed range 4.0–8.6 rpm (variable speed)

Maths Layer
───────────
- Euler integration: ω(t+dt) = ω(t) + α·dt
- Kinetic energy: E = ½·J·ω²
- Speed clamping: ω ∈ [ω_min, ω_max]

Code Layer
──────────
Pure functions with frozen dataclass outputs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ── V236-15.0 MW rotor constants ────────────────────────────────────────

ROTOR_INERTIA_KG_M2: float = 160e6
"""Rotor moment of inertia [kg·m²].

The V236 has 118 m blades with significant mass at the tips.
J ≈ 160 x 10⁶ kg·m² is representative for this class of turbine.
For comparison: a car wheel is ~0.5 kg·m², a V236 rotor is 320 million x heavier.
"""

FRICTION_TORQUE_NM: float = 50_000.0
"""Mechanical friction torque [N·m].

Accounts for bearing friction and windage losses in the drivetrain.
Small relative to aerodynamic torque (~20 MN·m at rated) but prevents
the rotor from spinning indefinitely with zero wind.
"""

MIN_ROTOR_SPEED_RPM: float = 4.0
"""Minimum rotor speed [rpm].  Below this, the generator disconnects."""

MAX_ROTOR_SPEED_RPM: float = 8.6
"""Maximum rotor speed [rpm].  V236 rated rotor speed at 12.5 m/s."""


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
    """Configuration for rotor dynamics integration.

    All parameters have sensible defaults for the V236-15.0 MW.
    """

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
        inertia_kg_m2: Rotor moment of inertia [kg·m²].

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

    At rated speed (8.6 rpm ≈ 0.9 rad/s) with J = 160e6 kg·m²:
    E = ½ × 160e6 × 0.9² ≈ 64.8 MJ ≈ 18 kWh

    This stored energy provides short-term ride-through capability
    during wind gusts and grid disturbances.

    Args:
        speed_rad_s: Rotor speed [rad/s].
        inertia_kg_m2: Rotor moment of inertia [kg·m²].

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

    The result is clamped to [min_speed, max_speed] to prevent
    unrealistic speeds.  In a real turbine, speed limits are enforced
    by the pitch controller and mechanical brakes.

    Args:
        current_rpm: Current rotor speed [rpm].
        angular_acceleration: α [rad/s²] from compute_angular_acceleration.
        dt: Timestep [seconds].
        config: Rotor configuration (defaults to V236 values).

    Returns:
        New rotor speed [rpm], clamped to configured limits.
    """
    if config is None:
        config = RotorConfig()

    current_rad_s = rpm_to_rad_s(current_rpm)
    new_rad_s = current_rad_s + angular_acceleration * dt
    new_rpm = rad_s_to_rpm(new_rad_s)

    # Clamp to operating range
    return max(config.min_speed_rpm, min(new_rpm, config.max_speed_rpm))


def compute_rotor_state(
    speed_rpm: float,
    aero_torque_nm: float,
    gen_torque_nm: float,
    config: RotorConfig | None = None,
) -> RotorState:
    """Compute complete rotor state at one instant.

    Combines speed conversion, acceleration calculation, and energy
    computation into a single immutable snapshot.

    Args:
        speed_rpm: Current rotor speed [rpm].
        aero_torque_nm: Aerodynamic torque [N·m].
        gen_torque_nm: Generator reaction torque [N·m].
        config: Rotor configuration (defaults to V236 values).

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
