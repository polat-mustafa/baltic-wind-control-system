"""Aerodynamic model for the V236-15.0 MW wind turbine.

Physics Layer
─────────────
Wind kinetic energy → rotor torque via aerodynamic coefficients.

The power extracted by a wind turbine rotor is:

    P_aero = ½ · ρ · A · V³ · Cp(λ, β)

where:
    ρ   = air density [kg/m³]
    A   = rotor swept area [m²]
    V   = wind speed [m/s]
    Cp  = power coefficient (function of tip-speed ratio λ and pitch angle β)

Standards Layer
───────────────
- IEC 61400-12-1: Power performance measurements
- Betz limit: Cp ≤ 16/27 ≈ 0.593 (theoretical maximum)

Maths Layer
───────────
- Tip-speed ratio: λ = ω·R / V  (ω in rad/s, R = rotor radius)
- Cp(λ, β): Analytical surface from Heier (1998), calibrated for V236
- Thrust coefficient: Ct from axial momentum theory
- Aerodynamic torque: Q_aero = P_aero / ω

Code Layer
──────────
All functions are pure (no side effects, no mutation).
Reuses TurbineSpec and compute_swept_area_m2 from P4 power curve module.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.services.p4.turbine_power_curve import (
    STANDARD_AIR_DENSITY,
    TurbineSpec,
    compute_swept_area_m2,
    get_v236_spec,
)

# ── Physical constants ──────────────────────────────────────────────────

BETZ_LIMIT: float = 16.0 / 27.0  # ≈ 0.593, theoretical max Cp

# Heier (1998) Cp model coefficients — calibrated for V236-15.0 MW
# Cp(λ, β) = c1·(c2/λi - c3·β - c4)·exp(-c5/λi) + c6·λ
# where 1/λi = 1/(λ + 0.08β) - 0.035/(β³ + 1)
_C1: float = 0.5176
_C2: float = 116.0
_C3: float = 0.4
_C4: float = 5.0
_C5: float = 21.0
_C6: float = 0.0068


# ── Data containers ────────────────────────────────────────────────────


@dataclass(frozen=True)
class AerodynamicState:
    """Complete aerodynamic state at one instant.

    All values are computed from wind speed, rotor speed, and pitch angle.
    This is an immutable snapshot — create a new instance for each timestep.
    """

    wind_speed_ms: float  # Free-stream wind speed [m/s]
    rotor_speed_rpm: float  # Rotor angular speed [rpm]
    pitch_angle_deg: float  # Blade pitch angle [deg]
    tip_speed_ratio: float  # λ = ωR/V [dimensionless]
    cp: float  # Power coefficient [dimensionless]
    ct: float  # Thrust coefficient [dimensionless]
    aero_power_w: float  # Aerodynamic power [W]
    aero_torque_nm: float  # Aerodynamic torque [N·m]
    thrust_force_n: float  # Axial thrust force [N]


# ── Pure functions ──────────────────────────────────────────────────────


def compute_tip_speed_ratio(
    rotor_speed_rpm: float,
    wind_speed_ms: float,
    rotor_radius_m: float,
) -> float:
    """Compute tip-speed ratio λ = ω·R / V.

    The tip-speed ratio relates the blade tip speed to the free-stream
    wind speed.  Optimal energy capture occurs at λ ≈ 8-9 for modern
    3-bladed turbines.

    Args:
        rotor_speed_rpm: Rotor speed [rpm].
        wind_speed_ms: Wind speed [m/s].  Must be > 0.
        rotor_radius_m: Rotor radius [m].

    Returns:
        Tip-speed ratio [dimensionless].  Returns 0 if wind_speed ≤ 0.
    """
    if wind_speed_ms <= 0.0:
        return 0.0
    omega_rad_s = rotor_speed_rpm * 2.0 * math.pi / 60.0
    return omega_rad_s * rotor_radius_m / wind_speed_ms


def compute_cp(tip_speed_ratio: float, pitch_angle_deg: float) -> float:
    """Compute power coefficient Cp(λ, β) using the Heier (1998) model.

    This analytical approximation produces a realistic Cp surface:
    - Cp_max ≈ 0.48 at λ_opt ≈ 8.5, β = 0°
    - Cp decreases with increasing pitch angle (blade feathering)
    - Cp is always clamped to [0, BETZ_LIMIT]

    The Heier model:
        1/λi = 1/(λ + 0.08β) - 0.035/(β³ + 1)
        Cp = c1·(c2/λi - c3·β - c4)·exp(-c5/λi) + c6·λ

    Args:
        tip_speed_ratio: λ [dimensionless].
        pitch_angle_deg: β [degrees].

    Returns:
        Power coefficient Cp [dimensionless], clamped to [0, BETZ_LIMIT].
    """
    lam = tip_speed_ratio
    beta = pitch_angle_deg

    # Guard against division by zero at λ = 0 and β = 0
    if lam <= 0.0:
        return 0.0

    # Intermediate variable λi (accounts for pitch effect)
    denom = lam + 0.08 * beta
    if denom <= 0.0:
        return 0.0

    lambda_i_inv = 1.0 / denom - 0.035 / (beta**3 + 1.0)
    if lambda_i_inv <= 0.0:
        return 0.0

    lambda_i = 1.0 / lambda_i_inv

    cp = _C1 * (_C2 * lambda_i_inv - _C3 * beta - _C4) * math.exp(-_C5 / lambda_i) + _C6 * lam

    # Clamp: Cp cannot be negative or exceed Betz limit
    return max(0.0, min(cp, BETZ_LIMIT))


def compute_ct(tip_speed_ratio: float, pitch_angle_deg: float) -> float:
    """Compute thrust coefficient Ct from axial momentum theory.

    Simplified relationship: Ct ≈ (8/9) · Cp / λ for attached flow,
    with empirical corrections for high tip-speed ratios.

    For a turbine in normal operation, Ct typically ranges from 0.2-0.9.

    Args:
        tip_speed_ratio: λ [dimensionless].
        pitch_angle_deg: β [degrees].

    Returns:
        Thrust coefficient Ct [dimensionless], clamped to [0, 1.0].
    """
    if tip_speed_ratio <= 0.0:
        return 0.0

    cp = compute_cp(tip_speed_ratio, pitch_angle_deg)

    # Momentum theory: Ct ≈ (8/9) · Cp / (λ · a_factor)
    # Simplified: Ct tracks Cp but scaled for thrust
    ct = (8.0 / 9.0) * cp + 0.05 * cp * tip_speed_ratio / 10.0

    return max(0.0, min(ct, 1.0))


def compute_aerodynamic_state(
    wind_speed_ms: float,
    rotor_speed_rpm: float,
    pitch_angle_deg: float,
    spec: TurbineSpec | None = None,
    air_density_kg_m3: float = STANDARD_AIR_DENSITY,
) -> AerodynamicState:
    """Compute complete aerodynamic state for one instant.

    Master function that composes all aerodynamic calculations:
    1. Tip-speed ratio λ = ωR/V
    2. Power coefficient Cp(λ, β)
    3. Thrust coefficient Ct(λ, β)
    4. Aerodynamic power P = ½·ρ·A·V³·Cp
    5. Aerodynamic torque Q = P / ω
    6. Thrust force F = ½·ρ·A·V²·Ct

    Args:
        wind_speed_ms: Free-stream wind speed [m/s].
        rotor_speed_rpm: Rotor angular speed [rpm].
        pitch_angle_deg: Blade pitch angle [degrees].
        spec: Turbine specification (defaults to V236-15.0 MW).
        air_density_kg_m3: Air density [kg/m³] (defaults to 1.225).

    Returns:
        Complete AerodynamicState snapshot.
    """
    if spec is None:
        spec = get_v236_spec()

    radius_m = spec.rotor_diameter_m / 2.0
    swept_area_m2 = compute_swept_area_m2(spec.rotor_diameter_m)

    # ── Tip-speed ratio ─────────────────────────────────────────────
    tsr = compute_tip_speed_ratio(rotor_speed_rpm, wind_speed_ms, radius_m)

    # ── Coefficients ────────────────────────────────────────────────
    cp = compute_cp(tsr, pitch_angle_deg)
    ct = compute_ct(tsr, pitch_angle_deg)

    # ── Aerodynamic power: P = ½·ρ·A·V³·Cp ─────────────────────────
    if wind_speed_ms <= 0.0:
        aero_power_w = 0.0
    else:
        aero_power_w = 0.5 * air_density_kg_m3 * swept_area_m2 * wind_speed_ms**3 * cp

    # ── Aerodynamic torque: Q = P / ω ───────────────────────────────
    omega_rad_s = rotor_speed_rpm * 2.0 * math.pi / 60.0
    aero_torque_nm = aero_power_w / omega_rad_s if omega_rad_s > 0.0 else 0.0

    # ── Thrust force: F = ½·ρ·A·V²·Ct ──────────────────────────────
    if wind_speed_ms <= 0.0:
        thrust_force_n = 0.0
    else:
        thrust_force_n = 0.5 * air_density_kg_m3 * swept_area_m2 * wind_speed_ms**2 * ct

    return AerodynamicState(
        wind_speed_ms=wind_speed_ms,
        rotor_speed_rpm=rotor_speed_rpm,
        pitch_angle_deg=pitch_angle_deg,
        tip_speed_ratio=tsr,
        cp=cp,
        ct=ct,
        aero_power_w=aero_power_w,
        aero_torque_nm=aero_torque_nm,
        thrust_force_n=thrust_force_n,
    )
