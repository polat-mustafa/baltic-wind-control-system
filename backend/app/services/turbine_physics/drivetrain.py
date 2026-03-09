"""Drivetrain model — gearbox and generator power conversion.

Physics Layer
─────────────
The drivetrain converts low-speed rotor rotation into high-speed generator
rotation, then into electrical power:

    Rotor (8.6 rpm) → Gearbox (×36) → Generator (309.6 rpm) → Grid

Power losses occur at each stage:
    P_elec = P_mech × η_gearbox × η_generator

Standards Layer
───────────────
- IEC 61400-4: Design requirements for wind turbine gearboxes
- V236-15.0 MW uses a medium-speed drivetrain (ratio ≈ 1:36)

Maths Layer
───────────
- Generator speed: ω_gen = ω_rotor × N_gear
- Generator torque: Q_gen = P_target / (ω_rotor × N_gear × η_gear)
- Mechanical power: P_mech = Q_aero × ω_rotor
- Electrical power: P_elec = P_mech × η_gear × η_gen
- Total losses: P_loss = P_mech - P_elec

Code Layer
──────────
Pure functions with frozen dataclass outputs.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.turbine_physics.rotor_dynamics import rpm_to_rad_s

# ── V236-15.0 MW drivetrain constants ───────────────────────────────────

GEARBOX_RATIO: float = 36.0
"""Gearbox speed-up ratio (output/input).

The V236 medium-speed drivetrain multiplies rotor speed by 36:
- Rotor: 8.6 rpm → Generator: 309.6 rpm
- Lower ratio than traditional high-speed (≈100:1) for reliability.
"""

GEARBOX_EFFICIENCY: float = 0.97
"""Gearbox mechanical efficiency [dimensionless].

97% is typical for a well-designed 2-stage planetary gearbox.
The 3% loss is converted to heat and removed by the oil cooling system.
"""

GENERATOR_EFFICIENCY: float = 0.975
"""Generator electrical efficiency [dimensionless].

97.5% accounts for copper losses (I²R), iron losses (hysteresis/eddy),
and stray load losses.  Modern permanent-magnet generators achieve this
across a wide speed range.
"""


# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class DrivetrainState:
    """Complete drivetrain state at one instant.

    Tracks power flow from rotor shaft to generator terminals.
    """

    rotor_torque_nm: float  # Aerodynamic torque on rotor [N·m]
    gen_speed_rpm: float  # Generator shaft speed [rpm]
    gen_torque_nm: float  # Generator reaction torque [N·m]
    mech_power_w: float  # Mechanical power at rotor [W]
    elec_power_w: float  # Electrical power output [W]
    losses_w: float  # Total drivetrain losses [W]


@dataclass(frozen=True)
class DrivetrainConfig:
    """Configuration for drivetrain model.

    All parameters have sensible defaults for the V236-15.0 MW.
    """

    gearbox_ratio: float = GEARBOX_RATIO
    gearbox_efficiency: float = GEARBOX_EFFICIENCY
    generator_efficiency: float = GENERATOR_EFFICIENCY


# ── Pure functions ──────────────────────────────────────────────────────


def compute_generator_speed_rpm(
    rotor_speed_rpm: float,
    gearbox_ratio: float = GEARBOX_RATIO,
) -> float:
    """Compute generator shaft speed from rotor speed.

    ω_gen = ω_rotor × N_gear

    At rated: 8.6 rpm × 36 = 309.6 rpm

    Args:
        rotor_speed_rpm: Rotor speed [rpm].
        gearbox_ratio: Gearbox speed-up ratio.

    Returns:
        Generator shaft speed [rpm].
    """
    return rotor_speed_rpm * gearbox_ratio


def compute_generator_torque_nm(
    target_power_w: float,
    rotor_speed_rpm: float,
    config: DrivetrainConfig | None = None,
) -> float:
    """Compute generator reaction torque for a target electrical power.

    The generator controller adjusts torque to extract the desired power:

        Q_gen = P_target / (ω_rotor × η_total)

    where η_total = η_gearbox × η_generator.

    In below-rated operation, target_power tracks the optimal power curve.
    In above-rated operation, target_power is clamped to rated power.

    Args:
        target_power_w: Desired electrical power output [W].
        rotor_speed_rpm: Current rotor speed [rpm].
        config: Drivetrain configuration.

    Returns:
        Generator reaction torque referred to rotor side [N·m].
        Returns 0 if rotor speed is zero (prevents division by zero).
    """
    if config is None:
        config = DrivetrainConfig()

    omega_rotor = rpm_to_rad_s(rotor_speed_rpm)
    if omega_rotor <= 0.0:
        return 0.0

    eta_total = config.gearbox_efficiency * config.generator_efficiency
    return target_power_w / (omega_rotor * eta_total)


def compute_drivetrain_state(
    rotor_speed_rpm: float,
    aero_torque_nm: float,
    gen_torque_nm: float,
    config: DrivetrainConfig | None = None,
) -> DrivetrainState:
    """Compute complete drivetrain state at one instant.

    Power flow: Rotor → Gearbox → Generator → Grid

        P_mech = Q_aero × ω_rotor
        P_elec = P_mech × η_gear × η_gen  (if gen_torque provides the load)

    In practice, P_elec is determined by the generator torque demand:
        P_elec = Q_gen × ω_rotor × η_total

    Args:
        rotor_speed_rpm: Rotor speed [rpm].
        aero_torque_nm: Aerodynamic torque from wind [N·m].
        gen_torque_nm: Generator reaction torque [N·m].
        config: Drivetrain configuration.

    Returns:
        Complete DrivetrainState snapshot.
    """
    if config is None:
        config = DrivetrainConfig()

    omega_rotor = rpm_to_rad_s(rotor_speed_rpm)

    # Mechanical power at rotor shaft
    mech_power_w = aero_torque_nm * omega_rotor

    # Generator shaft speed
    gen_speed_rpm = compute_generator_speed_rpm(rotor_speed_rpm, config.gearbox_ratio)

    # Electrical power = generator torque × rotor speed × total efficiency
    eta_total = config.gearbox_efficiency * config.generator_efficiency
    elec_power_w = gen_torque_nm * omega_rotor * eta_total

    # Clamp electrical power: can't generate more than mechanical input
    elec_power_w = max(0.0, min(elec_power_w, mech_power_w * eta_total))

    # Total losses
    losses_w = mech_power_w - elec_power_w if mech_power_w > 0 else 0.0

    return DrivetrainState(
        rotor_torque_nm=aero_torque_nm,
        gen_speed_rpm=gen_speed_rpm,
        gen_torque_nm=gen_torque_nm,
        mech_power_w=mech_power_w,
        elec_power_w=elec_power_w,
        losses_w=losses_w,
    )
