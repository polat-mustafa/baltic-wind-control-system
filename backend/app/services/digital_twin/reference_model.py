"""Physics reference model of the V236-15.0 MW — the "twin" in digital twin.

Physics Layer
─────────────
Steady-state (10-min mean) operating point of a variable-speed,
pitch-regulated turbine, solved from first principles instead of read off a
power-curve table, so that power, rotor speed, pitch and drivetrain losses are
mutually consistent and every fault leaves a physically correct signature:

  Aerodynamics   P_aero = ½·ρ·A·v³·k_aero·f·Cp(λ, β),   λ = ω·R / v
                 Cp(λ, β): Heier (1998) surface from ``turbine_physics``.
  Torque law     Q_gen = K·ω²,  K = ½·ρ₀·π·R⁵·Cp_max / λ_opt³
                 (optimal-mode gain: Burton et al., Wind Energy Handbook;
                 Jonkman et al. 2009, NREL/TP-500-38060)
                 → steady state where ρ·f·Cp(λ, β)/λ³ = ρ₀·Cp_max/λ_opt³.
  Speed limits   ω_min ≤ ω ≤ ω_rated (4.0 / 8.33 rpm, ``rotor_dynamics``).
  Power limit    Constant power P_lim: the rotor first speeds up along the
                 Cp(λ) curve (λ > λ_opt) until ω_rated, then the pitch
                 controller sheds the surplus (β > 0).
  Drivetrain     P_el = P_mech·η_gb·η_gen (0.97 · 0.975, ``drivetrain``);
                 gearbox loss (1 − η_gb)·P_mech is the heat source of the
                 gearbox-bearing thermal model (first order, τ = 1 h).
  Density        ρ from measured pressure and temperature (ideal gas), as in
                 IEC 61400-12-1 — no separate density normalisation needed
                 because ρ enters the physics directly.

Calibration (DNV-RP-A204 "qualification of digital twins": a model is only as
good as its calibration and validation evidence)
──────────────────────────────────────────────────
The Heier surface is generic, not V236-specific. One scale factor k_aero is
solved so the model reaches rated power exactly at the published rated wind
speed of 11.1 m/s (``TurbineSpec.rated_speed_ms``). k_aero lumps the losses
the generic surface does not know (blade-specific aerodynamics, converter and
transformer losses). With that single constant the below-rated curve follows
the legacy V236 approximate table (P ∝ v³, legacy_v236_table.py) except below
≈ 6 m/s, where the 4 rpm minimum rotor speed forces λ > λ_opt; the deviation is
reported in the model card.

Fault parameters (the same model, perturbed)
────────────────────────────────────────────
  aero_factor f          multiplies Cp: icing, soiling, leading-edge erosion
  pitch_offset_deg       actual blade angle = reported angle + offset
  power_limit_mw         converter / generator thermal derating
  gearbox_loss_factor m  gearbox losses m·(1 − η_gb)·P_mech (gear/bearing distress)
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

from app.services.digital_twin.legacy_v236_table import legacy_v236_power_kw
from app.services.p4.turbine_power_curve import (
    STANDARD_AIR_DENSITY,
    compute_swept_area_m2,
    get_v236_spec,
)
from app.services.turbine_physics.aerodynamics import compute_cp_array
from app.services.turbine_physics.drivetrain import (
    GEARBOX_EFFICIENCY,
    GEARBOX_RATIO,
    GENERATOR_EFFICIENCY,
)
from app.services.turbine_physics.rotor_dynamics import (
    MAX_ROTOR_SPEED_RPM,
    MIN_ROTOR_SPEED_RPM,
)

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

_BISECTION_STEPS = 32  # interval shrinks by 2⁻³² — far below sensor resolution
_PITCH_SEARCH_MAX_DEG = 45.0
_LAMBDA_SEARCH_MAX = 25.0


@dataclass(frozen=True)
class ReferenceModelParams:
    """Parameters of the V236 reference model, with their provenance.

    Turbine data come from the shared ``TurbineSpec``/``turbine_physics``
    constants. The gearbox thermal parameters are *illustrative* (no public
    V236 data) and are labelled as such in the model card.
    """

    rotor_radius_m: float = get_v236_spec().rotor_diameter_m / 2.0
    rated_power_mw: float = get_v236_spec().rated_power_mw
    cut_in_ms: float = get_v236_spec().cut_in_speed_ms
    rated_wind_ms: float = get_v236_spec().rated_speed_ms
    cut_out_ms: float = get_v236_spec().cut_out_speed_ms
    min_rotor_rpm: float = MIN_ROTOR_SPEED_RPM
    rated_rotor_rpm: float = MAX_ROTOR_SPEED_RPM
    gearbox_ratio: float = GEARBOX_RATIO
    gearbox_efficiency: float = GEARBOX_EFFICIENCY
    generator_efficiency: float = GENERATOR_EFFICIENCY
    reference_density: float = STANDARD_AIR_DENSITY
    # Gearbox-bearing thermal model (illustrative): T = T_amb + ΔT₀ + R_th·P_loss
    gearbox_temp_offset_k: float = 15.0
    gearbox_thermal_resistance_k_per_kw: float = 0.0735  # ≈ +35 K at rated losses
    gearbox_thermal_time_constant_s: float = 3600.0

    @property
    def swept_area_m2(self) -> float:
        return compute_swept_area_m2(2.0 * self.rotor_radius_m)

    @property
    def drivetrain_efficiency(self) -> float:
        return self.gearbox_efficiency * self.generator_efficiency


@dataclass(frozen=True)
class AeroCalibration:
    """Result of calibrating the generic Heier surface to the V236."""

    lambda_opt: float  # tip-speed ratio of maximum Cp at β = 0
    cp_max_heier: float  # Heier Cp at (λ_opt, 0)
    k_aero: float  # scale so P(11.1 m/s) = P_rated
    torque_gain_nm_s2: float  # K in Q = K·ω² [N·m/(rad/s)²], rotor side

    @property
    def cp_max(self) -> float:
        return self.k_aero * self.cp_max_heier


@dataclass
class FaultParams:
    """Turbine-side fault parameters; scalars or arrays broadcastable to the wind."""

    aero_factor: FloatArray | float = 1.0
    pitch_offset_deg: FloatArray | float = 0.0
    power_limit_mw: FloatArray | float = math.inf
    gearbox_loss_factor: FloatArray | float = 1.0


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
    gearbox_loss_kw: FloatArray
    region: NDArray[np.int8]
    extra: dict[str, FloatArray] = field(default_factory=dict)


DEFAULT_PARAMS = ReferenceModelParams()


# ── Calibration ───────────────────────────────────────────────────


@lru_cache(maxsize=4)
def calibrate(params: ReferenceModelParams = DEFAULT_PARAMS) -> AeroCalibration:
    """Find λ_opt, Cp_max and k_aero (cached; pure function of the parameters)."""
    lam = np.linspace(4.0, 14.0, 10_001)
    cp = compute_cp_array(lam, 0.0)
    i = int(np.argmax(cp))
    lambda_opt = float(lam[i])
    cp_max = float(cp[i])

    p_wind_rated = 0.5 * params.reference_density * params.swept_area_m2 * params.rated_wind_ms**3
    k_aero = params.rated_power_mw * 1e6 / (params.drivetrain_efficiency * p_wind_rated * cp_max)
    r = params.rotor_radius_m
    gain = 0.5 * params.reference_density * math.pi * r**5 * k_aero * cp_max / lambda_opt**3
    return AeroCalibration(
        lambda_opt=lambda_opt,
        cp_max_heier=cp_max,
        k_aero=k_aero,
        torque_gain_nm_s2=gain,
    )


@lru_cache(maxsize=64)
def _stable_lambda_floor(pitch_deg: float) -> float:
    """Lower edge of the stable K·ω² branch for a given blade angle.

    The equilibrium ρ·Cp(λ)/λ³ = const is stable only where Cp(λ)/λ³ falls
    with λ. Walking left from the Cp peak, the branch ends where that ratio
    stops rising (the stall side lies beyond it).
    """
    lam = np.linspace(1.0, 14.0, 2_601)
    ratio = compute_cp_array(lam, pitch_deg) / lam**3
    i = int(np.argmax(compute_cp_array(lam, pitch_deg)))
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
    loss_factor = np.maximum(flat(f.gearbox_loss_factor), 0.0)

    eta_gb = np.clip(1.0 - loss_factor * (1.0 - params.gearbox_efficiency), 0.5, 1.0)
    eta = eta_gb * params.generator_efficiency
    r = params.rotor_radius_m
    v_safe = np.maximum(v, 0.1)
    p_wind_w = 0.5 * rho * params.swept_area_m2 * v_safe**3
    scale = cal.k_aero * aero_f  # effective Cp multiplier

    def p_el_mw(idx: NDArray[np.intp], lam: FloatArray, beta: FloatArray) -> FloatArray:
        return np.asarray(eta[idx] * p_wind_w[idx] * scale[idx] * compute_cp_array(lam, beta) / 1e6)

    every = np.arange(n)

    # 1. K·ω² equilibrium: ρ·f·k·Cp(λ, β₀)/λ³ = ρ₀·k·Cp_max/λ_opt³
    target = params.reference_density * cal.cp_max / cal.lambda_opt**3
    # λ_eq depends only on (ρ·f, β₀): solve once per distinct pair, then scatter.
    keys = np.stack([rho * aero_f, offset], axis=1)
    uniq, inverse = np.unique(keys, axis=0, return_inverse=True)
    inverse = inverse.ravel()
    u_density, u_offset = uniq[:, 0], uniq[:, 1]
    u_floor = np.array([_stable_lambda_floor(float(b)) for b in u_offset])

    def torque_balance(lam: FloatArray) -> FloatArray:
        return np.asarray(
            u_density * cal.k_aero * compute_cp_array(lam, u_offset) / lam**3 - target
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
    beta_actual = offset.copy()
    power = p_el_mw(every, lam, beta_actual)

    # 2. Power limit: speed up at constant power, then pitch at rated speed.
    lim_idx = np.flatnonzero(power > p_lim)
    if lim_idx.size:
        lam_rated = omega_rated * r / v_safe[lim_idx]
        off_l = offset[lim_idx]
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
    cp_eff = np.where(operating, scale * compute_cp_array(lam, beta_actual), 0.0)
    mech = np.where(operating, power / eta, 0.0)
    loss_kw = (1.0 - eta_gb) * mech * 1e3
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
        gearbox_loss_kw=shaped(loss_kw),
        region=region.reshape(shape),
    )


# ── Gearbox thermal model ─────────────────────────────────────────


def gearbox_temperature(
    loss_kw: FloatArray,
    ambient_c: FloatArray,
    dt_s: float,
    params: ReferenceModelParams = DEFAULT_PARAMS,
) -> FloatArray:
    """First-order gearbox-bearing temperature along axis 0 (time) [°C].

    T_ss = T_amb + ΔT₀ + R_th·P_loss;  T[k] = T[k−1] + α·(T_ss[k] − T[k−1]),
    α = 1 − exp(−Δt/τ). Starts in thermal equilibrium with the first sample.
    This is the normal-behaviour-model structure used for SCADA temperature
    monitoring (Tautz-Weinert & Watson 2017, IET RPG 11(4) 382–394).
    """
    t_ss = (
        np.asarray(ambient_c, dtype=np.float64)
        + params.gearbox_temp_offset_k
        + params.gearbox_thermal_resistance_k_per_kw * np.asarray(loss_kw, dtype=np.float64)
    )
    return first_order_lag(t_ss, dt_s, params.gearbox_thermal_time_constant_s)


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
    gearbox_loss_kw: FloatArray
    region: NDArray[np.int8]
    p1_table_power_mw: FloatArray  # legacy V236 approximate table (former P1), for validation


@lru_cache(maxsize=1)
def reference_curve(step_ms: float = 0.25) -> ReferenceCurve:
    """Twin steady-state curves at ρ₀ = 1.225 kg/m³ over 0–32 m/s."""
    v = np.round(np.arange(0.0, 32.0 + step_ms / 2, step_ms), 4)
    op = evaluate(v)
    return ReferenceCurve(
        wind_ms=v,
        power_mw=op.power_mw,
        rotor_speed_rpm=op.rotor_speed_rpm,
        pitch_deg=op.pitch_deg,
        tip_speed_ratio=op.tip_speed_ratio,
        cp=op.cp,
        gearbox_loss_kw=op.gearbox_loss_kw,
        region=op.region,
        p1_table_power_mw=legacy_v236_power_kw(v) / 1e3,
    )
