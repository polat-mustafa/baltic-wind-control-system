"""Drivetrain model — direct-drive PMSG, full-power converter and torque controller.

Physics Layer
─────────────
The IEA 15 MW reference turbine has no gearbox: the hub drives the outer rotor of a
200-pole permanent-magnet synchronous generator on the same shaft, so generator
speed = rotor speed (5.0–7.56 rpm). A full-power converter decouples the 12.6 Hz
stator from the 50 Hz grid:

    Rotor (7.56 rpm) ═ PMSG (100 pole pairs, 12.6 Hz, 4.77 kV) → AC/DC/AC → transformer

    P_elec = Q_gen · ω · η_gen · η_conv

Standards Layer
───────────────
- Gaertner et al. (2020), NREL/TP-5000-75698, Table 5-4 (generator design) and
  ROSCO DISCON.IN of the IEA-15-240-RWT v1.1.18 (controller)
- IEC 60034-1: Rotating electrical machines — rating and efficiency

Maths Layer
───────────
- Electrical frequency: f = (p/2) · n / 60 = 100 × 7.56 / 60 = 12.6 Hz
- Torque control (ROSCO VS_ControlMode 2, TSR tracking):
    ω_ref = clamp(LPF(λ_opt · V / R), ω_min, ω_rated) − Δω_SS     λ_opt = 9
    Q_gen = PI(ω_ref − ω) with Kp = −3.61 × 10⁷ N·m·s, Ki = −4.50 × 10⁶ N·m
    saturated to [0, 19.79 MN·m] (VS_RtTq → constant torque above rated),
    rate-limited to 4.5 MN·m/s (VS_MaxRat)
- Electrical power: P_elec = Q_gen · ω · η, limited to rated by the converter

Code Layer
──────────
Pure functions with frozen dataclass outputs.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.p1.turbine_models import get_turbine, rosco
from app.services.turbine_physics.rotor_dynamics import rpm_to_rad_s

_, _CONTROL = rosco()
_GEN = _CONTROL.report["generator"]

# ── IEA 15 MW drivetrain constants ──────────────────────────────────────

DRIVETRAIN: str = get_turbine().drivetrain
"""'Low speed, Direct drive' — no gearbox; generator speed = rotor speed."""

GENERATOR_POLES: int = int(_GEN["poles"])
"""200 poles (100 pole pairs), radial-flux outer rotor, air-gap radius 5.08 m (Table 5-4)."""

GENERATOR_VOLTAGE_V: float = float(_GEN["line_voltage_rms_v"])
"""Generator line voltage [V rms] — 4,770 V at rated (Table 5-4). The converter and
the nacelle transformer step it to the 66 kV array."""

GENERATOR_EFFICIENCY: float = float(_GEN["efficiency_full_load"])
"""Generator efficiency at full load — 96.55 % (Table 5-4): copper, iron and
magnet losses of the direct-drive PMSG."""

CONVERTER_EFFICIENCY: float = _CONTROL.generator_efficiency / GENERATOR_EFFICIENCY
"""Full-power converter efficiency — 99.18 %, so that η_gen · η_conv equals the
95.756 % mechanical-to-electrical efficiency of the controller (ROSCO VS_GenEff)."""

NACELLE_MASS_KG: float = get_turbine().masses_t["nacelle"] * 1e3
"""Nacelle mass [kg] — 673 t without the rotor (WISDEM table; generator 369 t)."""

RATED_TORQUE_NM: float = _CONTROL.rated_torque_nm
"""Generator torque above rated — 19.79 MN·m (ROSCO VS_RtTq, constant-torque mode)."""

TORQUE_RATE_LIMIT_NM_S: float = _CONTROL.max_torque_rate_nm_s
"""Torque rate limit — 4.5 MN·m/s (ROSCO VS_MaxRat)."""


# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class DrivetrainState:
    """Complete drivetrain state at one instant.

    Tracks power flow from rotor shaft to the converter's grid terminals.
    """

    rotor_torque_nm: float  # Aerodynamic torque on rotor [N·m]
    gen_speed_rpm: float  # Generator speed [rpm] (= rotor speed, direct drive)
    gen_torque_nm: float  # Generator air-gap torque [N·m]
    mech_power_w: float  # Aerodynamic power at the rotor shaft [W]
    elec_power_w: float  # Electrical power output [W]
    losses_w: float  # Generator + converter losses [W]
    gen_frequency_hz: float = 0.0  # Stator electrical frequency [Hz]
    torque_integral_nm: float = 0.0  # Torque-controller PI integral state [N·m]


@dataclass(frozen=True)
class DrivetrainConfig:
    """Configuration for the drivetrain model (IEA 15 MW defaults)."""

    generator_efficiency: float = GENERATOR_EFFICIENCY
    converter_efficiency: float = CONVERTER_EFFICIENCY
    rated_power_w: float = _CONTROL.rated_power_w
    rated_torque_nm: float = RATED_TORQUE_NM
    torque_rate_limit_nm_s: float = TORQUE_RATE_LIMIT_NM_S
    tsr_opt: float = _CONTROL.tsr_opt
    min_speed_rad_s: float = _CONTROL.min_speed_rad_s
    rated_speed_rad_s: float = _CONTROL.rated_speed_rad_s
    vs_kp: float = _CONTROL.vs_kp
    vs_ki: float = _CONTROL.vs_ki

    @property
    def efficiency(self) -> float:
        """Mechanical → electrical efficiency η_gen · η_conv (95.756 %)."""
        return self.generator_efficiency * self.converter_efficiency


# ── Pure functions ──────────────────────────────────────────────────────


def compute_generator_frequency_hz(rotor_speed_rpm: float, poles: int = GENERATOR_POLES) -> float:
    """Stator electrical frequency f = (p/2) · n / 60.

    At rated: 100 pole pairs × 7.56 rpm / 60 = 12.6 Hz — why a direct drive needs a
    full-power converter to reach the 50 Hz grid.
    """
    return poles / 2.0 * rotor_speed_rpm / 60.0


def compute_torque_reference_rad_s(
    wind_speed_ms: float, rotor_radius_m: float, config: DrivetrainConfig | None = None
) -> float:
    """TSR-tracking speed reference λ_opt·V/R [rad/s], before filtering and limits.

    ROSCO feeds this with its Kalman-filter wind-speed estimate; the simulator
    uses the rotor-effective wind speed directly (a perfect estimator). The
    simulator low-pass filters it and limits it to [ω_min, ω_rated].
    """
    if config is None:
        config = DrivetrainConfig()
    return config.tsr_opt * max(wind_speed_ms, 0.0) / rotor_radius_m


def compute_generator_torque_nm(
    rotor_speed_rad_s: float,
    reference_rad_s: float,
    prev_torque_nm: float,
    integral_nm: float,
    dt: float,
    config: DrivetrainConfig | None = None,
) -> tuple[float, float]:
    """One step of the ROSCO generator-torque controller (TSR tracking, PI).

    Below rated the PI drives ω to λ_opt·V/R (λ_opt = 9, Cp_max) — or holds the
    5.0 rpm minimum at low wind. Above rated the setpoint smoother lowers the
    reference, the integral saturates at VS_RtTq and the torque stays constant at
    19.79 MN·m while the pitch loop regulates speed. The converter also caps the
    torque at P_rated / (η·ω), so P ≤ 15 MW (Rule 1).

    Args:
        rotor_speed_rad_s: Filtered rotor (= generator) speed [rad/s].
        reference_rad_s: Torque-controller speed reference [rad/s].
        prev_torque_nm: Torque command of the previous step [N·m].
        integral_nm: PI integral state [N·m].
        dt: Timestep [s].
        config: Drivetrain configuration.

    Returns:
        (torque command [N·m], new integral state [N·m]).
    """
    if config is None:
        config = DrivetrainConfig()
    error = reference_rad_s - rotor_speed_rad_s

    # ROSCO PIController: saturated integral, then saturated output
    t_max = config.rated_torque_nm
    integral = min(max(integral_nm + dt * config.vs_ki * error, 0.0), t_max)
    torque = min(max(config.vs_kp * error + integral, 0.0), t_max)

    # Torque rate limit (VS_MaxRat) and the converter's power limit
    max_step = config.torque_rate_limit_nm_s * dt
    torque = min(max(torque, prev_torque_nm - max_step), prev_torque_nm + max_step)
    if rotor_speed_rad_s > 0.0:
        torque = min(torque, config.rated_power_w / (config.efficiency * rotor_speed_rad_s))
    return max(torque, 0.0), integral


def compute_drivetrain_state(
    rotor_speed_rpm: float,
    aero_torque_nm: float,
    gen_torque_nm: float,
    config: DrivetrainConfig | None = None,
    torque_integral_nm: float = 0.0,
) -> DrivetrainState:
    """Compute complete drivetrain state at one instant.

        P_mech = Q_aero · ω                 (shaft power from the wind)
        P_elec = Q_gen · ω · η_gen · η_conv (power the converter delivers)
        P_loss = Q_gen · ω · (1 − η)        (generator + converter heat)

    P_mech − Q_gen·ω is the power that accelerates (or, negative, decelerates)
    the rotor — it is stored as kinetic energy, not lost.

    Args:
        rotor_speed_rpm: Rotor speed [rpm].
        aero_torque_nm: Aerodynamic torque from wind [N·m].
        gen_torque_nm: Generator air-gap torque [N·m].
        config: Drivetrain configuration.
        torque_integral_nm: Torque-controller integral state to carry forward [N·m].

    Returns:
        Complete DrivetrainState snapshot.
    """
    if config is None:
        config = DrivetrainConfig()

    omega_rotor = rpm_to_rad_s(rotor_speed_rpm)
    gap_power_w = max(gen_torque_nm * omega_rotor, 0.0)
    elec_power_w = gap_power_w * config.efficiency

    return DrivetrainState(
        rotor_torque_nm=aero_torque_nm,
        gen_speed_rpm=rotor_speed_rpm,
        gen_torque_nm=gen_torque_nm,
        mech_power_w=aero_torque_nm * omega_rotor,
        elec_power_w=elec_power_w,
        losses_w=gap_power_w - elec_power_w,
        gen_frequency_hz=compute_generator_frequency_hz(rotor_speed_rpm),
        torque_integral_nm=torque_integral_nm,
    )
