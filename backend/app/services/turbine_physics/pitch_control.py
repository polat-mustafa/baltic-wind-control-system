"""Pitch control model — blade angle regulation (ROSCO, IEA 15 MW).

Physics Layer
─────────────
Blade pitch angle β controls the aerodynamic power coefficient Cp.
Two operating regions exist:

    Region 2 (below rated wind):  β follows the minimum-pitch schedule (0–3.4°)
    Region 3 (above rated wind):  β increases via a gain-scheduled PI to hold speed

The pitch actuator has physical limits:
    - Range: 0° (fine) to 90° (feathered)
    - Rate limit: ±2 °/s (ROSCO PC_MaxRat, IEA 15 MW)

Standards Layer
───────────────
- IEC 61400-1 §7.6: Control system requirements
- ROSCO (Abbas et al. 2022, Wind Energ. Sci. 7, 53–73) — DISCON.IN of the
  IEA-15-240-RWT v1.1.18: PC_GS_* gain schedule, PS_BldPitchMin, PC_RefSpd
- Emergency feathering to 90° is a safety function (IEC 61400-1 §8.3)

Maths Layer
───────────
ROSCO PI controller on the rotor-speed error (direct drive: generator = rotor):

    e(t) = ω_ref − ω                    [rad/s], ω_ref = 7.56 rpm (PC_RefSpd)
    I(t) = sat(I + Ki(β)·e·dt)          [rad], saturated to [β_min(V), 90°]
    β(t) = sat(Kp(β)·e + I)             gains scheduled on pitch (Kp < 0, Ki < 0)

    β_min(V): minimum-pitch schedule (3.44° at 3–4.3 m/s, 0° from 7.2 to 10.6 m/s,
              then peak shaving: 0.8° at 11 m/s … 15.1° at 25 m/s) — limits thrust
    dβ/dt ∈ [−2, +2] °/s

Code Layer
──────────
Pure functions with frozen dataclass outputs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.services.p1.turbine_models import rosco
from app.services.turbine_physics.rotor_dynamics import MAX_ROTOR_SPEED_RPM, rpm_to_rad_s

_, _CONTROL = rosco()

# ── ROSCO constants ────────────────────────────────────────────────────

PITCH_RATE_LIMIT_DEG_S: float = _CONTROL.pitch_max_rate_deg_s
"""Maximum pitch rate [deg/s] — 2.0 (ROSCO PC_MaxRat 0.0349 rad/s)."""

PITCH_MIN_DEG: float = _CONTROL.pitch_min_deg
"""Fine pitch [deg] — 0 (ROSCO PC_MinPit); the min-pitch schedule may lift it."""

PITCH_MAX_DEG: float = 90.0
"""Fully feathered [deg] — ROSCO PC_MaxPit 1.57 rad."""

GAIN_SCHEDULE_PITCH_DEG = _CONTROL.gain_schedule_pitch_deg
GAIN_SCHEDULE_KP_S = _CONTROL.gain_schedule_kp_s
GAIN_SCHEDULE_KI = _CONTROL.gain_schedule_ki


# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class PitchState:
    """Pitch controller state at one instant.

    Includes the PI controller internals for continuity across timesteps.
    """

    angle_deg: float  # Current pitch angle [deg]
    rate_deg_s: float  # Current pitch rate [deg/s]
    error_rpm: float  # Speed error: ω_actual − ω_ref [rpm]
    integral: float  # PI integral term [deg of pitch]
    region: str  # "below_rated", "above_rated", "feathering" or "idle"


@dataclass(frozen=True)
class PitchConfig:
    """Configuration for the pitch controller (IEA 15 MW ROSCO defaults)."""

    rate_limit_deg_s: float = PITCH_RATE_LIMIT_DEG_S
    min_deg: float = PITCH_MIN_DEG
    max_deg: float = PITCH_MAX_DEG
    rated_speed_rpm: float = MAX_ROTOR_SPEED_RPM


# ── Pure functions ──────────────────────────────────────────────────────


def compute_pitch_command(
    current_speed_rpm: float,
    current_pitch_deg: float,
    integral: float,
    dt: float,
    config: PitchConfig | None = None,
    wind_speed_ms: float | None = None,
    reference_rpm: float | None = None,
) -> PitchState:
    """Compute the pitch angle for one timestep (ROSCO gain-scheduled PI).

    Below rated the rotor runs slower than 7.56 rpm, the error is positive and the
    integral winds down onto β_min(V) — the blades sit on the minimum-pitch
    schedule. Above rated the rotor speeds up, the error turns negative and the
    PI pitches the blades out to shed the surplus aerodynamic power.

    Args:
        current_speed_rpm: Current rotor speed [rpm].
        current_pitch_deg: Current pitch angle [deg].
        integral: PI integral state from the previous step [deg].
        dt: Timestep [seconds].
        config: Pitch controller configuration.
        wind_speed_ms: Rotor-effective wind speed for the minimum-pitch schedule
            [m/s]; ``None`` uses the fixed fine pitch.
        reference_rpm: Speed reference [rpm] (the setpoint smoother may raise it);
            ``None`` uses ``config.rated_speed_rpm``.

    Returns:
        PitchState with new angle, rate, error, integral, and region.
    """
    if config is None:
        config = PitchConfig()

    beta_min = config.min_deg
    if wind_speed_ms is not None:
        beta_min = max(beta_min, _CONTROL.minimum_pitch_deg(wind_speed_ms))

    ref_rpm = config.rated_speed_rpm if reference_rpm is None else reference_rpm
    error_rad_s = rpm_to_rad_s(ref_rpm) - rpm_to_rad_s(current_speed_rpm)
    kp_s, ki = _CONTROL.pitch_gains(current_pitch_deg)
    to_deg = 180.0 / math.pi

    new_integral = min(max(integral + dt * ki * error_rad_s * to_deg, beta_min), config.max_deg)
    command = min(max(kp_s * error_rad_s * to_deg + new_integral, beta_min), config.max_deg)

    # Actuator rate limit (PC_MaxRat)
    max_delta = config.rate_limit_deg_s * dt
    delta = min(max(command - current_pitch_deg, -max_delta), max_delta)
    new_pitch = current_pitch_deg + delta

    return PitchState(
        angle_deg=new_pitch,
        rate_deg_s=delta / dt if dt > 0 else 0.0,
        error_rpm=current_speed_rpm - ref_rpm,
        integral=new_integral,
        region="above_rated" if command > beta_min + 1e-6 else "below_rated",
    )


def compute_shutdown_pitch(
    current_pitch_deg: float,
    dt: float,
    rate_limit_deg_s: float = PITCH_RATE_LIMIT_DEG_S,
) -> float:
    """Compute the feathering pitch command for a shutdown.

    Blades pitch to 90° (fully feathered) at the actuator's rate limit
    (2 °/s for the IEA 15 MW; the reference controller has no faster
    emergency rate). Feathered blades turn the aerodynamic torque negative
    and the rotor slows down.

    Args:
        current_pitch_deg: Current pitch angle [deg].
        dt: Timestep [seconds].
        rate_limit_deg_s: Maximum pitch rate [deg/s].

    Returns:
        New pitch angle [deg], moving toward 90°.
    """
    return min(current_pitch_deg + rate_limit_deg_s * dt, PITCH_MAX_DEG)
