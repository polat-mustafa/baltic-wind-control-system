"""Pitch control model — blade angle regulation.

Physics Layer
─────────────
Blade pitch angle β controls the aerodynamic power coefficient Cp.
Two operating regions exist:

    Region 2 (below rated wind):  β = 0° (fine pitch, maximize Cp)
    Region 3 (above rated wind):  β increases via PI controller to shed power

The pitch actuator has physical limits:
    - Range: 0° (fine) to 90° (feathered/emergency stop)
    - Rate limit: ±8 °/s (hydraulic actuator constraint)

Standards Layer
───────────────
- IEC 61400-1 §7.6: Control system requirements
- IEC 61400-25: Communications for monitoring and control
- Emergency feathering to 90° is a safety function (SIL 2)

Maths Layer
───────────
PI controller for above-rated regulation:

    e(t) = ω_rotor - ω_rated           (speed error)
    β(t) = Kp · e(t) + Ki · ∫e(τ)dτ   (PI output)

    dβ/dt ∈ [-rate_limit, +rate_limit]  (rate constraint)
    β ∈ [0°, 90°]                       (physical bounds)

Code Layer
──────────
Pure functions with frozen dataclass outputs.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.services.turbine_physics.rotor_dynamics import MAX_ROTOR_SPEED_RPM

# ── PI controller constants ────────────────────────────────────────────

KP: float = 0.006
"""Proportional gain [deg/rpm → effectively deg·s/rad].

Tuned for the V236: moderate response without oscillation.
Higher Kp → faster pitch response but risk of instability.
"""

KI: float = 0.001
"""Integral gain [deg/(rpm·s)].

Eliminates steady-state speed error.  Must be small enough to avoid
integral windup during transients.
"""

PITCH_RATE_LIMIT_DEG_S: float = 8.0
"""Maximum pitch rate [deg/s].

Limited by the hydraulic pitch actuator.  Emergency feathering may
use a higher rate (up to 12 °/s) via accumulator assist.
"""

PITCH_MIN_DEG: float = 0.0
"""Minimum pitch angle [deg] — fine pitch for maximum power capture."""

PITCH_MAX_DEG: float = 90.0
"""Maximum pitch angle [deg] — fully feathered for emergency stop."""


# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class PitchState:
    """Pitch controller state at one instant.

    Includes the PI controller internals for continuity across timesteps.
    """

    angle_deg: float  # Current pitch angle [deg]
    rate_deg_s: float  # Current pitch rate [deg/s]
    error_rpm: float  # Speed error: ω_actual - ω_rated [rpm]
    integral: float  # Accumulated integral term [rpm·s]
    region: str  # Operating region: "below_rated" or "above_rated"


@dataclass(frozen=True)
class PitchConfig:
    """Configuration for pitch controller.

    All parameters have sensible defaults for the V236-15.0 MW.
    """

    kp: float = KP
    ki: float = KI
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
) -> PitchState:
    """Compute pitch angle command for one timestep.

    Below rated wind speed:
        Pitch stays at 0° (fine pitch) to maximize energy capture.
        Integral term is reset to prevent windup.

    Above rated wind speed:
        PI controller adjusts pitch to maintain rated rotor speed:
            e = ω_actual - ω_rated
            β_cmd = Kp·e + Ki·∫e·dt

    The pitch rate is limited to ±rate_limit to model actuator dynamics.

    Args:
        current_speed_rpm: Current rotor speed [rpm].
        current_pitch_deg: Current pitch angle [deg].
        integral: Accumulated integral term from previous step [rpm·s].
        dt: Timestep [seconds].
        config: Pitch controller configuration.

    Returns:
        PitchState with new angle, rate, error, integral, and region.
    """
    if config is None:
        config = PitchConfig()

    error = current_speed_rpm - config.rated_speed_rpm

    # ── Region 2: below rated → fine pitch ──────────────────────────
    if error <= 0.0:
        # Drive pitch back to 0° at rate limit
        if current_pitch_deg <= 0.0:
            return PitchState(
                angle_deg=0.0,
                rate_deg_s=0.0,
                error_rpm=error,
                integral=0.0,  # Reset integral to prevent windup
                region="below_rated",
            )

        # Ramp down to 0°
        rate = -config.rate_limit_deg_s
        new_pitch = max(0.0, current_pitch_deg + rate * dt)
        return PitchState(
            angle_deg=new_pitch,
            rate_deg_s=rate if new_pitch > 0.0 else 0.0,
            error_rpm=error,
            integral=0.0,
            region="below_rated",
        )

    # ── Region 3: above rated → PI pitch control ───────────────────
    new_integral = integral + error * dt

    # PI output: desired pitch angle
    pitch_cmd = config.kp * error + config.ki * new_integral

    # Clamp to bounds
    pitch_cmd = max(config.min_deg, min(pitch_cmd, config.max_deg))

    # Rate limiting
    delta = pitch_cmd - current_pitch_deg
    max_delta = config.rate_limit_deg_s * dt
    if abs(delta) > max_delta:
        delta = max_delta if delta > 0 else -max_delta

    new_pitch = current_pitch_deg + delta
    new_pitch = max(config.min_deg, min(new_pitch, config.max_deg))

    rate = delta / dt if dt > 0 else 0.0

    return PitchState(
        angle_deg=new_pitch,
        rate_deg_s=rate,
        error_rpm=error,
        integral=new_integral,
        region="above_rated",
    )


def compute_shutdown_pitch(
    current_pitch_deg: float,
    dt: float,
    rate_limit_deg_s: float = PITCH_RATE_LIMIT_DEG_S,
) -> float:
    """Compute emergency feathering pitch command.

    During emergency shutdown, blades pitch to 90° (fully feathered)
    at the maximum rate.  This is a safety function that stops the
    rotor even in extreme wind conditions.

    In a real turbine, feathering is backed by hydraulic accumulators
    that can operate independently of the control system power supply.

    Args:
        current_pitch_deg: Current pitch angle [deg].
        dt: Timestep [seconds].
        rate_limit_deg_s: Maximum pitch rate [deg/s].

    Returns:
        New pitch angle [deg], moving toward 90°.
    """
    if current_pitch_deg >= PITCH_MAX_DEG:
        return PITCH_MAX_DEG

    new_pitch = current_pitch_deg + rate_limit_deg_s * dt
    return min(new_pitch, PITCH_MAX_DEG)
