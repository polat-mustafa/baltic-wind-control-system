"""Aerodynamic model of the SB-510 turbine — IEA 15 MW reference rotor ("V236 class").

Physics Layer
─────────────
Wind kinetic energy → rotor torque via aerodynamic coefficients.

The power extracted by a wind turbine rotor is:

    P_aero = ½ · ρ · A · V³ · Cp(λ, β)

where:
    ρ   = air density [kg/m³]
    A   = rotor swept area [m²] (D 241.35 m → 45,750 m²)
    V   = wind speed [m/s]
    Cp  = power coefficient (function of tip-speed ratio λ and pitch angle β)

Standards Layer
───────────────
- IEC 61400-12-1: Power performance measurements
- Betz limit: Cp ≤ 16/27 ≈ 0.593 (theoretical maximum)

Maths Layer
───────────
- Tip-speed ratio: λ = ω·R / V  (ω in rad/s, R = rotor radius)
- Cp(λ, β), Ct(λ, β): the official ROSCO performance table of the IEA 15 MW rotor
  (``Cp_Ct_Cq.IEA15MW.txt``, CCBlade steady BEM, λ 2–14.5, β −5…30°), bilinear
  interpolation — see ``p1.turbine_models.RotorSurface``. Cp_max = 0.469 at λ 9, β 0°.
- Negative Cp is kept: a feathered blade at high λ brakes the rotor. Beyond λ 14.5
  the WISDEM operating line is used only on the minimum-pitch schedule; a pitched-out
  blade keeps the λ = 14.5 table value.
- Beyond the table (β > 30° while feathering to 90°) only the braking part of the
  30° column is used — a feathered blade can slow the rotor but cannot drive it.
- Aerodynamic torque: Q_aero = P_aero / ω; below the table (λ < 2, start-up) the
  torque coefficient Cq = Cp/λ of λ = 2 is held: Q = ½·ρ·A·R·V²·Cq
- Thrust: F = ½·ρ·A·V²·Ct

Code Layer
──────────
All functions are pure (no side effects, no mutation).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from app.services.p1.turbine_models import rosco
from app.services.p4.turbine_power_curve import (
    STANDARD_AIR_DENSITY,
    TurbineSpec,
    compute_swept_area_m2,
    get_turbine_spec,
)

# ── Physical constants ──────────────────────────────────────────────────

BETZ_LIMIT: float = 16.0 / 27.0  # ≈ 0.593, theoretical max Cp


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
    cp: float  # Power coefficient [dimensionless] (negative = braking)
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

    The tip-speed ratio relates the blade tip speed to the free-stream wind
    speed. The IEA 15 MW rotor peaks at λ = 9 (ROSCO VS_TSRopt).

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


def _coefficients(tip_speed_ratio: float, pitch_angle_deg: float) -> tuple[float, float]:
    """(Cp, Ct) from the ROSCO table, braking (negative Cp) kept."""
    surface, control = rosco()
    beta_table_max = float(surface.pitch_deg[-1])
    lam = tip_speed_ratio
    # Beyond λ 14.5 the surface follows the WISDEM operating line, which only holds at
    # the minimum-pitch schedule; a pitched-out blade keeps the table-edge value.
    if lam > surface.tsr[-1] and pitch_angle_deg > float(control.min_pitch_deg.max()):
        lam = float(surface.tsr[-1])
    cp, ct = surface.coefficients(lam, min(pitch_angle_deg, beta_table_max), clip_negative=False)
    if pitch_angle_deg > beta_table_max:
        cp = min(cp, 0.0)  # feathered past the table: braking only
    return cp, max(ct, 0.0)


def compute_cp(tip_speed_ratio: float, pitch_angle_deg: float) -> float:
    """Power coefficient Cp(λ, β) of the IEA 15 MW rotor (ROSCO table).

    Cp_max = 0.469 at λ = 9, β = 0°. Negative values mean the blades brake the
    rotor (high λ at large pitch). Always below the Betz limit.

    Args:
        tip_speed_ratio: λ [dimensionless].
        pitch_angle_deg: β [degrees].

    Returns:
        Power coefficient Cp [dimensionless].
    """
    return _coefficients(tip_speed_ratio, pitch_angle_deg)[0]


def compute_ct(tip_speed_ratio: float, pitch_angle_deg: float) -> float:
    """Thrust coefficient Ct(λ, β) of the IEA 15 MW rotor (ROSCO table).

    Ct ≈ 0.8 at the region-2 optimum, falling as the blades pitch to feather.

    Args:
        tip_speed_ratio: λ [dimensionless].
        pitch_angle_deg: β [degrees].

    Returns:
        Thrust coefficient Ct [dimensionless], ≥ 0.
    """
    return _coefficients(tip_speed_ratio, pitch_angle_deg)[1]


def compute_aerodynamic_state(
    wind_speed_ms: float,
    rotor_speed_rpm: float,
    pitch_angle_deg: float,
    spec: TurbineSpec | None = None,
    air_density_kg_m3: float = STANDARD_AIR_DENSITY,
) -> AerodynamicState:
    """Compute complete aerodynamic state for one instant.

    1. Tip-speed ratio λ = ωR/V
    2. Cp(λ, β), Ct(λ, β) from the ROSCO table
    3. Aerodynamic power P = ½·ρ·A·V³·Cp
    4. Aerodynamic torque Q = P / ω
    5. Thrust force F = ½·ρ·A·V²·Ct

    Args:
        wind_speed_ms: Free-stream wind speed [m/s].
        rotor_speed_rpm: Rotor angular speed [rpm].
        pitch_angle_deg: Blade pitch angle [degrees].
        spec: Turbine specification (defaults to the SB-510 turbine, IEA 15 MW).
        air_density_kg_m3: Air density [kg/m³] (defaults to 1.225).

    Returns:
        Complete AerodynamicState snapshot.
    """
    if spec is None:
        spec = get_turbine_spec()

    radius_m = spec.rotor_diameter_m / 2.0
    swept_area_m2 = compute_swept_area_m2(spec.rotor_diameter_m)

    tsr = compute_tip_speed_ratio(rotor_speed_rpm, wind_speed_ms, radius_m)
    cp, ct = _coefficients(tsr, pitch_angle_deg) if tsr > 0.0 else (0.0, 0.0)

    if wind_speed_ms <= 0.0:
        aero_power_w = 0.0
        thrust_force_n = 0.0
    else:
        aero_power_w = 0.5 * air_density_kg_m3 * swept_area_m2 * wind_speed_ms**3 * cp
        thrust_force_n = 0.5 * air_density_kg_m3 * swept_area_m2 * wind_speed_ms**2 * ct

    omega_rad_s = rotor_speed_rpm * 2.0 * math.pi / 60.0
    lam_min = float(rosco()[0].tsr[0])
    if tsr >= lam_min:
        aero_torque_nm = aero_power_w / omega_rad_s
    elif wind_speed_ms > 0.0:
        # Below the table (start-up, λ < 2): hold the torque coefficient Cq = Cp/λ of
        # λ = 2, so a rotor at standstill still feels the wind's starting torque.
        cq = _coefficients(lam_min, pitch_angle_deg)[0] / lam_min
        aero_torque_nm = 0.5 * air_density_kg_m3 * swept_area_m2 * radius_m * wind_speed_ms**2 * cq
        aero_power_w = aero_torque_nm * omega_rad_s
        cp = cq * tsr
    else:
        aero_torque_nm = 0.0

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
