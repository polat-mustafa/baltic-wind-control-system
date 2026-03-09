"""Yaw control model — nacelle alignment to wind direction.

Physics Layer
─────────────
The nacelle must face into the wind for maximum energy capture.
Misalignment reduces power by cos^n(γ), where:

    γ = wind direction - nacelle direction  (yaw error)
    n ≈ 3 for power loss (cos³ is the standard approximation)

Yaw motors turn the nacelle slowly (0.3 °/s) to track wind direction.
A deadband prevents continuous hunting in turbulent conditions.

Standards Layer
───────────────
- IEC 61400-1 §7.6.4: Yaw system design requirements
- DNV-ST-0437: Loads and site conditions (yaw misalignment loads)
- Typical yaw error in normal operation: ≤ ±8°

Maths Layer
───────────
- Yaw error: γ = wrap_to_±180(wind_dir - nacelle_dir)
- Power loss factor: f = cos^n(|γ|)
- Yaw rate: dψ/dt ∈ {-yaw_rate, 0, +yaw_rate}  (discrete: left, stop, right)
- Deadband: |γ| < deadband → no yaw action

Code Layer
──────────
Pure functions with frozen dataclass outputs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

# ── Yaw system constants ───────────────────────────────────────────────

YAW_RATE_DEG_S: float = 0.3
"""Maximum yaw rate [deg/s].

The V236 uses electric yaw drives (4 motors) turning the nacelle on a
yaw bearing.  0.3 °/s is typical — slow to minimize structural loads.
A full 180° turn takes 10 minutes.
"""

DEADBAND_DEG: float = 8.0
"""Yaw deadband [deg].

The yaw system ignores misalignment smaller than ±8°.
This prevents continuous hunting in turbulent wind conditions
and reduces mechanical wear on the yaw bearing and drives.
"""

POWER_LOSS_EXPONENT: float = 3.0
"""Exponent for yaw misalignment power loss.

Power ∝ cos^n(yaw), where n = 3 is the standard approximation.
At yaw = 8°:  cos³(8°) = 0.971 → only 2.9% loss (acceptable).
At yaw = 30°: cos³(30°) = 0.650 → 35% loss (must correct).
"""


# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class YawState:
    """Yaw system state at one instant."""

    nacelle_dir_deg: float  # Nacelle heading [deg, 0=North, clockwise]
    wind_dir_deg: float  # Wind direction [deg, 0=North, clockwise]
    error_deg: float  # Yaw error [deg, -180 to +180]
    rate_deg_s: float  # Current yaw rate [deg/s]
    power_loss_factor: float  # cos^n(|error|), ∈ [0, 1]
    is_yawing: bool  # True if actively tracking


@dataclass(frozen=True)
class YawConfig:
    """Configuration for yaw control system."""

    yaw_rate_deg_s: float = YAW_RATE_DEG_S
    deadband_deg: float = DEADBAND_DEG
    power_loss_exponent: float = POWER_LOSS_EXPONENT


# ── Pure functions ──────────────────────────────────────────────────────


def compute_yaw_error_deg(
    nacelle_dir_deg: float,
    wind_dir_deg: float,
) -> float:
    """Compute shortest angular difference between nacelle and wind.

    Returns the yaw error in [-180, +180] degrees, handling the
    wrap-around at 0°/360°.

    Positive error means wind is clockwise from nacelle → yaw right.
    Negative error means wind is counter-clockwise → yaw left.

    Examples:
        nacelle=350°, wind=10°  → error = +20°  (yaw right)
        nacelle=10°, wind=350°  → error = -20°  (yaw left)
        nacelle=0°, wind=180°   → error = +180° (worst case)

    Args:
        nacelle_dir_deg: Nacelle heading [deg].
        wind_dir_deg: Wind direction [deg].

    Returns:
        Yaw error [deg], in range [-180, +180].
    """
    diff = wind_dir_deg - nacelle_dir_deg
    # Wrap to [-180, +180]
    diff = (diff + 180.0) % 360.0 - 180.0
    return diff


def compute_yaw_power_loss(
    yaw_error_deg: float,
    exponent: float = POWER_LOSS_EXPONENT,
) -> float:
    """Compute power loss factor due to yaw misalignment.

    f = cos^n(|γ|)

    This models the reduction in effective swept area and the change
    in local angle of attack across the rotor disk.

    Args:
        yaw_error_deg: Yaw error [deg].
        exponent: Power loss exponent (default 3.0).

    Returns:
        Power loss factor [0, 1].  1.0 = no loss, 0.0 = total loss.
    """
    gamma_rad = math.radians(abs(yaw_error_deg))
    cos_gamma = math.cos(gamma_rad)
    # Clamp: cos can be negative for |γ| > 90° → no useful power
    return float(max(0.0, cos_gamma**exponent))


def step_yaw(
    nacelle_dir_deg: float,
    wind_dir_deg: float,
    dt: float,
    config: YawConfig | None = None,
) -> YawState:
    """Advance yaw system by one timestep.

    Logic:
    1. Compute yaw error (shortest angular path)
    2. If |error| < deadband → hold position (no yaw)
    3. If |error| ≥ deadband → yaw toward wind at rate limit
    4. Compute power loss factor

    Args:
        nacelle_dir_deg: Current nacelle heading [deg].
        wind_dir_deg: Current wind direction [deg].
        dt: Timestep [seconds].
        config: Yaw system configuration.

    Returns:
        YawState with updated nacelle direction and status.
    """
    if config is None:
        config = YawConfig()

    error = compute_yaw_error_deg(nacelle_dir_deg, wind_dir_deg)

    # ── Deadband check ──────────────────────────────────────────────
    if abs(error) < config.deadband_deg:
        # Within deadband — hold position
        power_loss = compute_yaw_power_loss(error, config.power_loss_exponent)
        return YawState(
            nacelle_dir_deg=nacelle_dir_deg,
            wind_dir_deg=wind_dir_deg,
            error_deg=error,
            rate_deg_s=0.0,
            power_loss_factor=power_loss,
            is_yawing=False,
        )

    # ── Active yaw tracking ────────────────────────────────────────
    # Determine direction: positive error → yaw right (increase heading)
    max_delta = config.yaw_rate_deg_s * dt

    if error > 0:
        delta = min(error, max_delta)
        rate = config.yaw_rate_deg_s
    else:
        delta = max(error, -max_delta)
        rate = -config.yaw_rate_deg_s

    new_nacelle = (nacelle_dir_deg + delta) % 360.0

    # Recompute error after yaw movement
    new_error = compute_yaw_error_deg(new_nacelle, wind_dir_deg)
    power_loss = compute_yaw_power_loss(new_error, config.power_loss_exponent)

    return YawState(
        nacelle_dir_deg=new_nacelle,
        wind_dir_deg=wind_dir_deg,
        error_deg=new_error,
        rate_deg_s=rate,
        power_loss_factor=power_loss,
        is_yawing=True,
    )
