"""Physics reference model of the SB-510 turbine — the "twin" in digital twin.

SB-510's turbines are "V236 class"; Vestas publishes no rotor, control or drivetrain
data, so the twin is the IEA 15 MW reference turbine (low-speed direct drive):
official IEA Wind Task 37 data, ``services/p1/turbine_models.py``.

Physics Layer
─────────────
Steady-state (10-min mean) operating point of a variable-speed,
pitch-regulated turbine, solved from first principles instead of read off a
power-curve table, so that power, rotor speed, pitch and generator losses are
mutually consistent and every fault leaves a physically correct signature:

  Aerodynamics   P_aero = ½·ρ·A·v³·k_aero·f·Cp(λ, β),   λ = ω·R / v
                 Cp(λ, β): ROSCO rotor-performance table of the IEA 15 MW
                 (CCBlade, λ 2–14.5, β −5…30°; beyond λ 14.5 the WISDEM line).
  Torque law     Q_gen = K·ω²,  K = ½·ρ₀·π·R⁵·k_aero·Cp(λ*, 0) / λ*³, λ* = 9.0
                 (ROSCO VS_TSRopt; Jonkman et al. 2009, NREL/TP-500-38060)
                 → steady state where ρ·f·Cp(λ, β)/λ³ = ρ₀·Cp(λ*, 0)/λ*³.
  Minimum pitch  β ≥ β_min(v), the ROSCO pitch-saturation schedule (3.44° at
                 3–4.3 m/s, 0 above 7.2 m/s).
  Speed limits   ω_min ≤ ω ≤ ω_rated (5.0 rpm; 7.518 rpm = the 95 m/s maximum tip
                 speed of the workbook Overview, as in the official table).
  Power limit    Constant power P_lim: the rotor first speeds up along the
                 Cp(λ) curve until ω_rated, then the pitch controller sheds the
                 surplus (β > 0).
  Drivetrain     Direct drive (no gearbox). P_el = P_mech·η_gen·η_conv with
                 η_gen = 96.55 % (generator at full load, NREL/TP-5000-75698
                 Table 5-4) and η_gen·η_conv = 95.756 % (ROSCO VS_GenEff, the
                 efficiency in the official power table). The generator loss
                 (1 − η_gen)·P_mech heats the stator winding (first order, τ 1.5 h).
  Density        ρ from measured pressure and temperature (ideal gas), as in
                 IEC 61400-12-1 — no separate density normalisation needed
                 because ρ enters the physics directly.

Calibration (DNV-RP-A204 "qualification of digital twins": a model is only as
good as its calibration and validation evidence)
──────────────────────────────────────────────────
The ROSCO surface (CCBlade) gives Cp(9, 0°) = 0.469, the WISDEM steady-state
table behind the official power curve 0.462. One scale factor k_aero (≈ 0.98)
is solved so the twin reaches rated power exactly at the table's rated wind
speed, 10.66 m/s (λ = 8.91 there: the tip-speed limit); the whole curve is then
validated against the official table (``reference_curve``, model card).

Fault parameters (the same model, perturbed)
────────────────────────────────────────────
  aero_factor f            multiplies Cp: icing, soiling, leading-edge erosion
  pitch_offset_deg         actual blade angle = reported angle + offset
  power_limit_mw           converter / generator thermal derating
  generator_loss_factor m  generator losses m·(1 − η_gen)·P_mech (winding,
                           insulation, magnet or bearing distress)
The anemometer fault lives in the measurement chain, not in the turbine, and
is applied by the plant simulator.

Code Layer
──────────
Fully vectorised (NumPy). The twin and the synthetic plant call the same
``evaluate`` — the twin with nominal parameters at the *measured* wind, the
plant with fault parameters at the *true* wind.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from functools import lru_cache

import numpy as np
from numpy.typing import NDArray
from scipy.signal import lfilter, lfilter_zi

from app.services.p1.turbine_models import get_turbine, rosco
from app.services.p4.turbine_power_curve import STANDARD_AIR_DENSITY, compute_swept_area_m2

FloatArray = NDArray[np.float64]

RPM_TO_RAD_S: float = 2.0 * math.pi / 60.0

# Operating-region codes (IEC 61400-1 control-region convention)
REGION_STOPPED = 0  # below cut-in or above cut-out
REGION_MIN_SPEED = 1  # "region 1½": rotor held at ω_min
REGION_OPTIMAL = 2  # region 2: λ tracking via K·ω² law
REGION_CONSTANT_POWER = 3  # "region 2½": power limited, rotor speeding up
REGION_PITCH = 4  # region 3: rated speed, pitch regulation

REGION_NAMES: dict[int, str] = {
    REGION_STOPPED: "stopped",
    REGION_MIN_SPEED: "minimum rotor speed",
    REGION_OPTIMAL: "optimal tip-speed ratio",
    REGION_CONSTANT_POWER: "constant power, speed rising",
    REGION_PITCH: "pitch regulated",
}

_TURBINE = get_turbine()
_SURFACE, _CONTROL = rosco()
_GEN = _CONTROL.report["generator"]
_BETA_QUANTUM_DEG = 0.05  # minimum-pitch values are grouped to this step for the λ solve

_BISECTION_STEPS = 32  # interval shrinks by 2⁻³² — far below sensor resolution
_PITCH_SEARCH_MAX_DEG = 45.0
_LAMBDA_SEARCH_MAX = 25.0


@dataclass(frozen=True)
class ReferenceModelParams:
    """Parameters of the reference model, with their provenance.

    Turbine, controller and generator data are the IEA 15 MW's (workbook,
    ROSCO, definition report). The winding thermal parameters are *illustrative*
    (no public IEA 15 MW thermal data) and are labelled as such in the model card.
    """

    rotor_radius_m: float = _TURBINE.rotor_radius_m
    rated_power_mw: float = _TURBINE.rated_mw
    cut_in_ms: float = _TURBINE.cut_in_ms
    rated_wind_ms: float = _TURBINE.rated_ms
    cut_out_ms: float = _TURBINE.cut_out_ms
    min_rotor_rpm: float = _TURBINE.min_rotor_rpm
    # rated speed of the official table = its 95 m/s maximum tip speed (7.518 rpm); the
    # ROSCO pitch-controller reference is 7.56 rpm
    rated_rotor_rpm: float = 95.0 / _TURBINE.rotor_radius_m * 30.0 / math.pi
    tsr_opt: float = _CONTROL.tsr_opt
    generator_efficiency: float = float(_GEN["efficiency_full_load"])
    converter_efficiency: float = _CONTROL.generator_efficiency / float(
        _GEN["efficiency_full_load"]
    )
    reference_density: float = STANDARD_AIR_DENSITY
    # Stator-winding thermal model (illustrative): T = T_amb + ΔT₀ + R_th·P_loss.
    # 10 + 0.125 × 540 kW ≈ 78 K above ambient at rated losses (0.54 MW): within the
    # IEC 60034-1 class-B rise, the usual design margin for class-F (155 °C) insulation.
    generator_temp_offset_k: float = 10.0
    generator_thermal_resistance_k_per_kw: float = 0.125
    generator_thermal_time_constant_s: float = 5400.0

    @property
    def swept_area_m2(self) -> float:
        return compute_swept_area_m2(2.0 * self.rotor_radius_m)

    @property
    def drivetrain_efficiency(self) -> float:
        return self.generator_efficiency * self.converter_efficiency


@dataclass(frozen=True)
class AeroCalibration:
    """Result of calibrating the ROSCO surface to the official power table."""

    lambda_opt: float  # tip-speed ratio the torque law tracks (ROSCO VS_TSRopt)
    cp_max_surface: float  # ROSCO Cp at (λ_opt, 0)
    k_aero: float  # scale so P(rated wind of the table) = P_rated
    torque_gain_nm_s2: float  # K in Q = K·ω² [N·m/(rad/s)²], rotor = generator side

    @property
    def cp_max(self) -> float:
        return self.k_aero * self.cp_max_surface


@dataclass
class FaultParams:
    """Turbine-side fault parameters; scalars or arrays broadcastable to the wind."""

    aero_factor: FloatArray | float = 1.0
    pitch_offset_deg: FloatArray | float = 0.0
    power_limit_mw: FloatArray | float = math.inf
    generator_loss_factor: FloatArray | float = 1.0


@dataclass(frozen=True)
class OperatingPoints:
    """Steady-state model outputs (all arrays share the input shape)."""

    operating: NDArray[np.bool_]
    power_mw: FloatArray  # electrical active power at generator terminals
    rotor_speed_rpm: FloatArray
    pitch_deg: FloatArray  # reported (encoder) pitch angle
    tip_speed_ratio: FloatArray
    cp: FloatArray  # effective power coefficient k_aero·f·Cp
    mech_power_mw: FloatArray
    generator_loss_kw: FloatArray
    region: NDArray[np.int8]
    extra: dict[str, FloatArray] = field(default_factory=dict)


DEFAULT_PARAMS = ReferenceModelParams()


# ── Calibration ───────────────────────────────────────────────────


@lru_cache(maxsize=4)
def calibrate(params: ReferenceModelParams = DEFAULT_PARAMS) -> AeroCalibration:
    """λ*, Cp(λ*, 0) and k_aero (cached; pure function of the parameters)."""
    lambda_opt = params.tsr_opt
    cp_max = float(_SURFACE.cp_array(lambda_opt, 0.0))
    # rated point of the table: tip-speed-limited rotor speed, ROSCO minimum pitch
    omega_r = params.rated_rotor_rpm * RPM_TO_RAD_S
    lam_r = min(lambda_opt, omega_r * params.rotor_radius_m / params.rated_wind_ms)
    beta_r = round(_CONTROL.minimum_pitch_deg(params.rated_wind_ms) / _BETA_QUANTUM_DEG) * (
        _BETA_QUANTUM_DEG
    )  # ROSCO peak shaving starts at rated (0.1°)
    cp_r = float(_SURFACE.cp_array(lam_r, beta_r))
    p_wind_rated = 0.5 * params.reference_density * params.swept_area_m2 * params.rated_wind_ms**3
    k_aero = params.rated_power_mw * 1e6 / (params.drivetrain_efficiency * p_wind_rated * cp_r)
    r = params.rotor_radius_m
    gain = 0.5 * params.reference_density * math.pi * r**5 * k_aero * cp_max / lambda_opt**3
    return AeroCalibration(
        lambda_opt=lambda_opt,
        cp_max_surface=cp_max,
        k_aero=k_aero,
        torque_gain_nm_s2=gain,
    )


@lru_cache(maxsize=512)
def _stable_lambda_floor(pitch_deg: float) -> float:
    """Lower edge of the stable K·ω² branch for a given blade angle.

    The equilibrium ρ·Cp(λ)/λ³ = const is stable only where Cp(λ)/λ³ falls
    with λ. Walking left from the Cp peak, the branch ends where that ratio
    stops rising (the stall side lies beyond it).
    """
    lam = np.linspace(2.0, 14.5, 2_501)
    cp = _SURFACE.cp_array(lam, pitch_deg)
    ratio = cp / lam**3
    i = int(np.argmax(cp))
    while i > 0 and ratio[i - 1] > ratio[i]:
        i -= 1
    return float(lam[i])


def _bisect_decreasing(
    func: object,
    lo: FloatArray,
    hi: FloatArray,
) -> FloatArray:
    """Vectorised bisection for a root of a function that is >0 at ``lo`` and ≤0 at ``hi``."""
    assert callable(func)
    a = lo.copy()
    b = hi.copy()
    for _ in range(_BISECTION_STEPS):
        mid = 0.5 * (a + b)
        positive = func(mid) > 0.0
        a = np.where(positive, mid, a)
        b = np.where(positive, b, mid)
    return 0.5 * (a + b)


# ── Steady-state operating point ──────────────────────────────────


def evaluate(
    wind_ms: FloatArray | float,
    air_density: FloatArray | float = STANDARD_AIR_DENSITY,
    faults: FaultParams | None = None,
    params: ReferenceModelParams = DEFAULT_PARAMS,
) -> OperatingPoints:
    """Solve the steady-state operating point for every wind sample.

    Args:
        wind_ms: rotor-effective wind speed [m/s] (any shape).
        air_density: air density [kg/m³], broadcastable to ``wind_ms``.
        faults: optional fault parameters (nominal turbine if None).
        params: model parameters.

    Returns:
        OperatingPoints with P ∈ [0, P_rated] (Rule 1) and zero output outside
        the cut-in/cut-out envelope.
    """
    cal = calibrate(params)
    f = faults or FaultParams()
    v = np.asarray(wind_ms, dtype=np.float64)
    shape = v.shape
    v = v.ravel()
    n = v.size

    def flat(x: FloatArray | float) -> FloatArray:
        return np.broadcast_to(np.asarray(x, dtype=np.float64), shape).ravel().copy()

    rho = flat(air_density)
    aero_f = np.clip(flat(f.aero_factor), 0.0, 1.5)
    offset = flat(f.pitch_offset_deg)
    p_lim = np.minimum(flat(f.power_limit_mw), params.rated_power_mw)
    loss_factor = np.maximum(flat(f.generator_loss_factor), 0.0)
    # ROSCO minimum-pitch schedule (quantised for the grouped λ solve)
    beta_min = (
        np.round(
            np.interp(v, _CONTROL.min_pitch_wind_ms, _CONTROL.min_pitch_deg) / _BETA_QUANTUM_DEG
        )
        * _BETA_QUANTUM_DEG
    )

    eta_gen = np.clip(1.0 - loss_factor * (1.0 - params.generator_efficiency), 0.5, 1.0)
    eta = eta_gen * params.converter_efficiency
    r = params.rotor_radius_m
    v_safe = np.maximum(v, 0.1)
    p_wind_w = 0.5 * rho * params.swept_area_m2 * v_safe**3
    scale = cal.k_aero * aero_f  # effective Cp multiplier

    def p_el_mw(idx: NDArray[np.intp], lam: FloatArray, beta: FloatArray) -> FloatArray:
        return np.asarray(
            eta[idx] * p_wind_w[idx] * scale[idx] * _SURFACE.cp_array(lam, beta) / 1e6
        )

    every = np.arange(n)

    # 1. K·ω² equilibrium: ρ·f·k·Cp(λ, β₀)/λ³ = ρ₀·k·Cp_max/λ_opt³, β₀ = β_min + offset
    target = params.reference_density * cal.cp_max / cal.lambda_opt**3
    beta0 = beta_min + offset
    # λ_eq depends only on (ρ·f, β₀): solve once per distinct pair, then scatter.
    keys = np.stack([rho * aero_f, beta0], axis=1)
    uniq, inverse = np.unique(keys, axis=0, return_inverse=True)
    inverse = inverse.ravel()
    u_density, u_offset = uniq[:, 0], uniq[:, 1]
    u_floor = np.array([_stable_lambda_floor(float(b)) for b in u_offset])

    def torque_balance(lam: FloatArray) -> FloatArray:
        return np.asarray(
            u_density * cal.k_aero * _SURFACE.cp_array(lam, u_offset) / lam**3 - target
        )

    u_lam = _bisect_decreasing(torque_balance, u_floor, np.full(len(uniq), _LAMBDA_SEARCH_MAX))
    # No stable equilibrium (heavy degradation): the rotor sits at the branch edge.
    u_lam = np.where(torque_balance(u_floor) > 0.0, u_lam, u_floor)
    lam_eq = u_lam[inverse]

    omega_min = params.min_rotor_rpm * RPM_TO_RAD_S
    omega_rated = params.rated_rotor_rpm * RPM_TO_RAD_S
    omega = np.clip(lam_eq * v_safe / r, omega_min, omega_rated)
    lam = omega * r / v_safe
    region = np.where(omega <= omega_min * (1 + 1e-9), REGION_MIN_SPEED, REGION_OPTIMAL).astype(
        np.int8
    )
    beta_actual = beta0.copy()
    power = p_el_mw(every, lam, beta_actual)

    # 2. Power limit: speed up at constant power, then pitch at rated speed.
    lim_idx = np.flatnonzero(power > p_lim)
    if lim_idx.size:
        lam_rated = omega_rated * r / v_safe[lim_idx]
        off_l = beta0[lim_idx]
        plim_l = p_lim[lim_idx]
        surplus_at_rated = p_el_mw(lim_idx, lam_rated, off_l) - plim_l
        su = surplus_at_rated <= 0.0  # limit reached before rated rotor speed
        pr = ~su

        if np.any(su):
            idx = lim_idx[su]

            def surplus_vs_lambda(x: FloatArray) -> FloatArray:
                return p_el_mw(idx, x, off_l[su]) - plim_l[su]

            lam[idx] = _bisect_decreasing(surplus_vs_lambda, lam[idx], lam_rated[su])
            region[idx] = REGION_CONSTANT_POWER

        if np.any(pr):
            idx = lim_idx[pr]
            lam_r = lam_rated[pr]

            def surplus_vs_pitch(b: FloatArray) -> FloatArray:
                return p_el_mw(idx, lam_r, b) - plim_l[pr]

            beta_actual[idx] = _bisect_decreasing(
                surplus_vs_pitch, off_l[pr], off_l[pr] + _PITCH_SEARCH_MAX_DEG
            )
            lam[idx] = lam_r
            region[idx] = REGION_PITCH

        power[lim_idx] = plim_l
        omega = lam * v_safe / r

    operating = (v >= params.cut_in_ms) & (v <= params.cut_out_ms) & (power > 0.0)
    power = np.where(operating, np.clip(power, 0.0, params.rated_power_mw), 0.0)
    omega = np.where(operating, omega, 0.0)
    pitch_reported = np.where(
        operating,
        np.maximum(beta_actual - offset, 0.0),
        np.where(v > params.cut_out_ms, 90.0, 0.0),  # feathered in storm stop
    )
    cp_eff = np.where(operating, scale * _SURFACE.cp_array(lam, beta_actual), 0.0)
    mech = np.where(operating, power / eta, 0.0)
    loss_kw = (1.0 - eta_gen) * mech * 1e3
    region = np.where(operating, region, REGION_STOPPED).astype(np.int8)

    def shaped(x: FloatArray) -> FloatArray:
        return np.asarray(x, dtype=np.float64).reshape(shape)

    return OperatingPoints(
        operating=operating.reshape(shape),
        power_mw=shaped(power),
        rotor_speed_rpm=shaped(omega / RPM_TO_RAD_S),
        pitch_deg=shaped(pitch_reported),
        tip_speed_ratio=shaped(np.where(operating, lam, 0.0)),
        cp=shaped(cp_eff),
        mech_power_mw=shaped(mech),
        generator_loss_kw=shaped(loss_kw),
        region=region.reshape(shape),
    )


# ── Generator stator-winding thermal model ────────────────────────


def generator_temperature(
    loss_kw: FloatArray,
    ambient_c: FloatArray,
    dt_s: float,
    params: ReferenceModelParams = DEFAULT_PARAMS,
) -> FloatArray:
    """First-order stator-winding temperature along axis 0 (time) [°C].

    T_ss = T_amb + ΔT₀ + R_th·P_loss;  T[k] = T[k−1] + α·(T_ss[k] − T[k−1]),
    α = 1 − exp(−Δt/τ). Starts in thermal equilibrium with the first sample.
    This is the normal-behaviour-model structure used for SCADA temperature
    monitoring (Tautz-Weinert & Watson 2017, IET RPG 11(4) 382–394).
    """
    t_ss = (
        np.asarray(ambient_c, dtype=np.float64)
        + params.generator_temp_offset_k
        + params.generator_thermal_resistance_k_per_kw * np.asarray(loss_kw, dtype=np.float64)
    )
    return first_order_lag(t_ss, dt_s, params.generator_thermal_time_constant_s)


def first_order_lag(x: FloatArray, dt_s: float, tau_s: float) -> FloatArray:
    """Discrete first-order lag along axis 0, started in equilibrium with x[0].

    y[k] = y[k−1] + α·(x[k] − y[k−1]),  α = 1 − exp(−Δt/τ).
    """
    x = np.asarray(x, dtype=np.float64)
    alpha = 1.0 - math.exp(-dt_s / tau_s)
    b = np.array([alpha])
    a = np.array([1.0, alpha - 1.0])
    zi = lfilter_zi(b, a)
    zi_full = np.expand_dims(zi, axis=tuple(range(1, x.ndim))) * x[0:1]
    out, _ = lfilter(b, a, x, axis=0, zi=zi_full)
    return np.asarray(out, dtype=np.float64)


# ── Reference curves (model card / validation) ────────────────────


@dataclass(frozen=True)
class ReferenceCurve:
    wind_ms: FloatArray
    power_mw: FloatArray
    rotor_speed_rpm: FloatArray
    pitch_deg: FloatArray
    tip_speed_ratio: FloatArray
    cp: FloatArray
    generator_loss_kw: FloatArray
    region: NDArray[np.int8]
    p1_table_power_mw: FloatArray  # official IEA 15 MW power table (as P1), for validation


@lru_cache(maxsize=1)
def reference_curve(step_ms: float = 0.25) -> ReferenceCurve:
    """Twin steady-state curves at ρ₀ = 1.225 kg/m³ over 0–27 m/s."""
    v = np.round(np.arange(0.0, 27.0 + step_ms / 2, step_ms), 4)
    op = evaluate(v)
    return ReferenceCurve(
        wind_ms=v,
        power_mw=op.power_mw,
        rotor_speed_rpm=op.rotor_speed_rpm,
        pitch_deg=op.pitch_deg,
        tip_speed_ratio=op.tip_speed_ratio,
        cp=op.cp,
        generator_loss_kw=op.generator_loss_kw,
        region=op.region,
        p1_table_power_mw=_TURBINE.power_curve_kw(v) / 1e3,
    )
