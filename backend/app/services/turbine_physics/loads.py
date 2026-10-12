"""
Tower fore-aft loads of the SB-510 turbine in turbulent wind (engineering audit B-7).

The ROSCO-controlled rotor of ``simulator`` is coupled to the first fore-aft mode of the
tower on its jacket (``support_structure.fore_aft_mode``): the rotor sees the wind
relative to the moving hub, so its thrust slope ∂F/∂V damps the tower (aerodynamic
damping) — the coupling that dominates fore-aft fatigue of pitch-regulated turbines.

  m q̈ + c q̇ + k q = p·F(V − p q̇, ω, β)        (q: tower-top displacement [m])
  M_base = F·arm − L q̈                           (interface bending moment [N·m])

m, k, p, L, arm from the frame FE model; structural damping 1 % of critical (IEA 15 MW
tower, Gaertner et al. 2020, NREL/TP-5000-75698, Table 5-1). The linear tower is stepped
exactly (zero-order hold on the force) at the simulator's 0.1 s.

Wind: IEC 61400-1 ed. 4 normal turbulence model at hub height, Kaimal spectrum
(L_k = 8.1 Λ₁ = 340.2 m), class B (I_ref 0.14 — the IEA 15 MW's design class IB). The
rotor responds to the rotor-effective wind, not the hub point: the Kaimal spectrum is
multiplied by the disc-averaged IEC exponential coherence
  Coh(r, f) = exp(−12 √((f r / V)² + (0.12 r / L_c)²)),  L_c = 340.2 m
(IEC 61400-1 Annex C, as TurbSim applies it for the OpenFAST reference loads), averaged
over 64 equal-area points of the 241 m rotor disc. Its f → 0 limit is below 1
(exp(−1.44 r/L_c)), so even slow fluctuations are partly averaged out: the rotor-effective
TI is ≈ 0.5 × the hub-point NTM value.
Not modelled: rotational sampling (1P/3P from turbulence), blade and drivetrain
flexibility, waves (fatigue on a 50 m jacket is wind-dominated at the tower base),
gravity P-δ.

Fatigue: rainflow counting per ASTM E1049-85 (residual as half cycles), damage-equivalent
load DEL = (Σ n_i S_i^m / N_eq)^(1/m) at N_eq = 1 Hz × duration, Wöhler slope m = 4
(welded steel, DNV-RP-C203). Lifetime DEL weights the 10-minute DELs of the wind-speed
bins with the site's Weibull distribution.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass
from functools import lru_cache

import numpy as np
from numpy.typing import NDArray
from scipy.linalg import expm

from app.services.site_assessment.wind_climate import SB510_WEIBULL_A, SB510_WEIBULL_K
from app.services.turbine_physics.simulator import (
    SimulationConfig,
    _build_initial_state,
    step_turbine,
)
from app.services.turbine_physics.support_structure import ForeAftMode, fore_aft_mode

I_REF_CLASS_B = 0.14
LAMBDA_1_M = 42.0  # IEC 61400-1: 0.7 · min(z_hub, 60 m)
L_KAIMAL_M = 8.1 * LAMBDA_1_M
L_COHERENCE_M = 8.1 * LAMBDA_1_M
STRUCTURAL_DAMPING = 0.01
WOHLER_M = 4.0
DT_S = 0.1
TRANSIENT_S = 60.0
ROTOR_RADIUS_M = 241.35 / 2


def ntm_sigma(v_hub: float, i_ref: float = I_REF_CLASS_B) -> float:
    """IEC 61400-1 NTM standard deviation σ₁ = I_ref (0.75 V_hub + 5.6) [m/s]."""
    return i_ref * (0.75 * v_hub + 5.6)


@lru_cache(maxsize=1)
def _disc_points(n_rings: int = 4, per_ring: int = 16) -> NDArray[np.float64]:
    """Equal-area points on the rotor disc [m] (centroids of n_rings × per_ring cells)."""
    pts = []
    for i in range(n_rings):
        r = ROTOR_RADIUS_M * math.sqrt((i + 0.5) / n_rings)
        for j in range(per_ring):
            a = 2 * math.pi * (j + 0.5 * (i % 2)) / per_ring
            pts.append((r * math.cos(a), r * math.sin(a)))
    return np.array(pts)


def rotor_averaging(f_hz: NDArray[np.float64], v_hub: float) -> NDArray[np.float64]:
    """Disc average of the IEC coherence, χ(f) ∈ (0, 1] (module docstring)."""
    p = _disc_points()
    d = np.sqrt(((p[:, None, :] - p[None, :, :]) ** 2).sum(-1)).ravel()
    fr = np.outer(f_hz, d) / v_hub
    coh = np.exp(-12 * np.sqrt(fr**2 + (0.12 * d / L_COHERENCE_M) ** 2))
    return np.asarray(coh.mean(axis=1))


def turbulent_wind(
    v_hub: float,
    duration_s: float,
    seed: int = 0,
    i_ref: float = I_REF_CLASS_B,
    rotor_effective: bool = True,
    dt: float = DT_S,
) -> NDArray[np.float64]:
    """Longitudinal wind [m/s] at dt: Kaimal spectrum, NTM σ, random phases."""
    n = round(duration_s / dt)
    f = np.asarray(np.fft.rfftfreq(n, dt)[1:], dtype=np.float64)
    sigma = ntm_sigma(v_hub, i_ref)
    s = 4 * sigma**2 * L_KAIMAL_M / v_hub / (1 + 6 * f * L_KAIMAL_M / v_hub) ** (5 / 3)
    if rotor_effective:
        s = s * rotor_averaging(f, v_hub)
    df = f[0]
    rng = np.random.default_rng(seed)
    amp = np.sqrt(2 * s * df) * n / 2
    spec = np.concatenate(([0.0], amp * np.exp(2j * np.pi * rng.random(len(f)))))
    u = np.fft.irfft(spec, n)
    return v_hub + u


# ── Rainflow and DEL ─────────────────────────────────────────────


def _turning_points(x: NDArray[np.float64]) -> list[float]:
    tp = [float(x[0])]
    for a, b in itertools.pairwise(x[1:]):
        prev = tp[-1]
        if (a - prev) * (b - a) < 0:
            tp.append(float(a))
    tp.append(float(x[-1]))
    return tp


def rainflow(x: NDArray[np.float64] | list[float]) -> list[tuple[float, float]]:
    """(range, count) pairs per ASTM E1049-85 §5.4.4; count 0.5 for half cycles."""
    stack: list[float] = []
    out: list[tuple[float, float]] = []
    for p in _turning_points(np.asarray(x, dtype=float)):
        stack.append(p)
        while len(stack) >= 3:
            x_rng = abs(stack[-1] - stack[-2])
            y_rng = abs(stack[-2] - stack[-3])
            if x_rng < y_rng:
                break
            if len(stack) == 3:
                out.append((y_rng, 0.5))
                stack.pop(0)
            else:
                out.append((y_rng, 1.0))
                last = stack.pop()
                stack.pop()
                stack.pop()
                stack.append(last)
    out.extend((abs(b - a), 0.5) for a, b in itertools.pairwise(stack))
    return out


def damage_equivalent_load(x: NDArray[np.float64], duration_s: float, m: float = WOHLER_M) -> float:
    """1 Hz DEL of a load series [same unit as x] (module docstring)."""
    cycles = rainflow(x)
    return float((sum(n * r**m for r, n in cycles) / duration_s) ** (1 / m))


# ── Coupled simulation ───────────────────────────────────────────


@dataclass(frozen=True)
class LoadsResult:
    wind_mean_ms: float
    turbulence_intensity: float
    time_s: NDArray[np.float64]
    wind_ms: NDArray[np.float64]
    thrust_n: NDArray[np.float64]
    tower_top_m: NDArray[np.float64]
    base_moment_nm: NDArray[np.float64]
    power_mw: NDArray[np.float64]
    del_base_moment_nm: float
    mean_base_moment_nm: float
    max_base_moment_nm: float
    max_tower_top_m: float


def _discrete_tower(mode: ForeAftMode, zeta: float, dt: float) -> tuple[np.ndarray, np.ndarray]:
    m, k = mode.modal_mass_kg, mode.stiffness_n_m
    c = 2 * zeta * math.sqrt(k * m)
    a = np.array([[0.0, 1.0], [-k / m, -c / m]])
    ad = expm(a * dt)
    bd = np.linalg.solve(a, (ad - np.eye(2)) @ np.array([0.0, 1.0 / m]))
    return ad, bd


def simulate_loads(
    wind_ms: NDArray[np.float64],
    zeta: float = STRUCTURAL_DAMPING,
    q0_m: float | None = None,
    discard_s: float = TRANSIENT_S,
) -> LoadsResult:
    """Coupled rotor + tower fore-aft run over a wind series at 0.1 s (module docstring)."""
    mode = fore_aft_mode()
    cfg = SimulationConfig(dt=DT_S)
    state = _build_initial_state(cfg, float(wind_ms[0]))
    ad, bd = _discrete_tower(mode, zeta, DT_S)
    p = mode.hub_participation
    n = len(wind_ms)
    thrust = np.empty(n)
    q_arr = np.empty(n)
    m_base = np.empty(n)
    power = np.empty(n)
    x = np.zeros(2)
    first = True
    for i in range(n):
        v_rel = float(wind_ms[i]) - p * x[1]
        state = step_turbine(state, v_rel, 0.0, DT_S, cfg)
        f = state.aero.thrust_force_n
        if first:  # start on the static deflection of the first thrust
            x[0] = p * f / mode.stiffness_n_m if q0_m is None else q0_m
            first = False
        acc = (p * f - 2 * zeta * math.sqrt(mode.stiffness_n_m * mode.modal_mass_kg) * x[1]
               - mode.stiffness_n_m * x[0]) / mode.modal_mass_kg  # fmt: skip
        thrust[i] = f
        q_arr[i] = x[0]
        m_base[i] = f * mode.arm_m - mode.inertial_moment_kg_m * acc
        power[i] = state.electrical_power_mw
        x = ad @ x + bd * p * f
    t = np.arange(n) * DT_S
    keep = t >= discard_s
    dur = float(keep.sum()) * DT_S
    mb = m_base[keep]
    w = wind_ms[keep]
    return LoadsResult(
        wind_mean_ms=float(w.mean()),
        turbulence_intensity=float(w.std() / w.mean()),
        time_s=np.asarray(t[keep] - discard_s, dtype=np.float64),
        wind_ms=w,
        thrust_n=thrust[keep],
        tower_top_m=q_arr[keep],
        base_moment_nm=mb,
        power_mw=power[keep],
        del_base_moment_nm=damage_equivalent_load(mb, dur),
        mean_base_moment_nm=float(mb.mean()),
        max_base_moment_nm=float(mb.max()),
        max_tower_top_m=float(q_arr[keep].max()),
    )


def free_decay_damping(v_hub: float, q_offset_m: float = 0.3, duration_s: float = 60.0) -> float:
    """Total fore-aft damping ratio in steady wind (structural + aerodynamic), from the
    logarithmic decrement of a free decay started ``q_offset_m`` off equilibrium."""
    n = int(duration_s / DT_S)
    steady = simulate_loads(np.full(n, v_hub), discard_s=0.0)
    q_eq = float(np.median(steady.tower_top_m[-100:]))
    run = simulate_loads(np.full(n, v_hub), q0_m=q_eq + q_offset_m, discard_s=0.0)
    y = run.tower_top_m - q_eq
    peaks = [i for i in range(1, len(y) - 1) if y[i] > y[i - 1] and y[i] >= y[i + 1] and y[i] > 0]
    if len(peaks) < 3:
        return 1.0  # over-damped within the window
    delta = math.log(y[peaks[0]] / y[peaks[2]]) / 2
    return delta / math.sqrt(4 * math.pi**2 + delta**2)


@dataclass(frozen=True)
class FatigueSummary:
    bins_ms: tuple[float, ...]
    del_10min_mnm: tuple[float, ...]
    probability: tuple[float, ...]
    lifetime_del_mnm: float  # Weibull-weighted 1 Hz DEL over the operating bins
    wohler_m: float


@lru_cache(maxsize=4)
def lifetime_del(
    weibull_a: float = SB510_WEIBULL_A,
    weibull_k: float = SB510_WEIBULL_K,
    bins: tuple[float, ...] = (5.0, 8.0, 11.0, 14.0, 17.0, 20.0, 23.0),
    seeds: int = 2,
    i_ref: float = I_REF_CLASS_B,
) -> FatigueSummary:
    """Tower-base fore-aft DEL per wind bin (10 min, ``seeds`` seeds each) and the
    lifetime-equivalent DEL weighted by the Weibull bin probabilities (operating time only)."""
    dels, probs = [], []
    half = (bins[1] - bins[0]) / 2
    for v in bins:
        d = [
            simulate_loads(
                turbulent_wind(v, 600.0 + TRANSIENT_S, seed=s, i_ref=i_ref)
            ).del_base_moment_nm
            for s in range(seeds)
        ]
        dels.append((sum(x**WOHLER_M for x in d) / len(d)) ** (1 / WOHLER_M))

        def cdf(x: float) -> float:
            return 1 - math.exp(-((max(x, 0.0) / weibull_a) ** weibull_k))

        probs.append(cdf(v + half) - cdf(v - half))
    tot = sum(probs)
    life = (sum(p / tot * d**WOHLER_M for p, d in zip(probs, dels, strict=True))) ** (1 / WOHLER_M)
    return FatigueSummary(
        bins_ms=bins,
        del_10min_mnm=tuple(round(d / 1e6, 1) for d in dels),
        probability=tuple(round(p, 4) for p in probs),
        lifetime_del_mnm=round(life / 1e6, 1),
        wohler_m=WOHLER_M,
    )
