"""
Detailed harmonic model with converter Norton equivalents, and impedance-based stability
of the 34 grid-following converters against the SB-510 network (engineering audit B-5).

``power_quality`` lumps the array charging at OSS 66 kV and treats the converters as ideal
current sources — a first-order screen. This module is the next step a connection-stage
harmonic study takes (CIGRE TB 766 §4–5):

Network (positive sequence, 100 MVA base, per frequency f, h = f / 50 Hz)
-------------------------------------------------------------------------
  grid, onshore transformers, 2 × 108 km export cable (exact distributed π), the four
  shunt reactors — as in ``power_quality``;
  two OSS transformers, one per 66 kV busbar section (A: strings 1–3, B: 4–6), the bus
  coupler normally open (``coupler_closed`` ties them); the harmonic filter on section A;
  every 66 kV array section between turbines as its own exact π (graded 500…1000 mm²,
  R·√h for skin effect);
  every WTG step-up transformer (17 MVA, uk 9 %) to its converter terminal.

Converter (grid-side VSC, grid-following, per unit on the converter rating S_c = 17 MVA)
---------------------------------------------------------------------------------------
  Converter-side current control with filter inductance L_f, proportional gain
  K_p = α_c · L_f (α_c: current-loop bandwidth), a computation + PWM delay
  T_d = 1.5 / f_s (double-update sampling f_s = 2 f_sw), optional grid-voltage
  feed-forward F, and the filter capacitor C_f at the terminal with a series damping
  resistor R_d = 1 / (3 ω_r C_f) (ω_r: L_f–C_f–WTG-transformer resonance; the passive
  damping of high-power LCL filters, Peña-Alzola et al., IEEE TPEL 28(6), 2013). Its Norton
  admittance
  (Harnefors, Yepes & Wang, IEEE Trans. Ind. Electron. 63(10), 2016, eq. 6–8):

      Y_a(jω) = (1 − F e^(−jωT_d)) / (jω L_f + K_p e^(−jωT_d)),
      Y_c = Y_a + 1 / (R_d + 1 / (jω C_f))

  The resonant (PR) term that tracks 50 Hz and the PLL act near 50 Hz and are left out; the
  model is meant for the harmonic range (≥ 100 Hz). Re{Y_a} < 0 — the converter is
  *non-passive* and can destabilise a network resonance — above f = 1 / (4 T_d)
  (667 Hz for f_sw = 2 kHz) without feed-forward. Parameters are typical of MV full-scale
  converters, not a vendor's: the V236 / IEA-15 converter is not public.

Stability: generalized Nyquist criterion
----------------------------------------
With the passive network (C_f included) seen from the 34 converter terminals as the
impedance matrix Z(jω), the closed loop is stable iff det(I + Z·Y_a) does not encircle the
origin (both subsystems are stable alone: the network is passive, each current loop has
α_c T_d < π/2). For a real system the negative frequencies mirror the positive ones, so the
number of unstable closed-loop poles is −Δarg det(I + Z Y_a) / π over 0 < f < ∞; the
phase is followed on an adaptively refined grid. Since the 34 converters are identical,
det(I + Y_a Z) = Π (1 + Y_a λ_i): the eigenvalues λ_i of Z are the grid impedances the
converters' common modes see (the characteristic loci, MacFarlane & Postlethwaite 1977).
Their distance to −1 (vector margin) and the phase margin at |Y_a λ_i| = 1 are the
stability margins. Verified (tests) against the closed-loop poles of a rational model
(Padé delay) of one converter on an LC grid.

Harmonic emission with Norton models: each converter injects I_h (``power_quality``'s
illustrative emission) in parallel with Y_c; bus voltages are summed over the 34 sources
with the IEC 61000-3-6 exponent α: U_h = (Σ_k |Z_n,k I_h|^α)^(1/α).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import numpy as np
from numpy.typing import NDArray

from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    GRID_RX_RATIO,
    NUM_ONSHORE_TRANSFORMERS,
    SB510,
    TRAFO_66_220_VK_PERCENT,
    TRAFO_66_220_VKR_PERCENT,
    TRAFO_220_400_VK_PERCENT,
    TRAFO_220_400_VKR_PERCENT,
    WTG_TRAFO_VK_PERCENT,
    WTG_TRAFO_VKR_PERCENT,
    CableSpec,
    FarmSpec,
    _get_cable_grade,
)
from app.services.p2.power_quality import (
    DEFAULT_WTG_EMISSION_PCT,
    F0,
    OMEGA0,
    REACTOR_Q_FACTOR,
    S_BASE,
    THD_LIMIT,
    _voltage_tier,
    harmonic_filter_impedance_ohm,
    planning_level_pct,
    summation_exponent,
)

POC, ON220, OSS220, BUS_A, BUS_B = range(5)
BUS_NAMES = ("PSE 400 kV (POC)", "Onshore 220 kV", "OSS 220 kV", "OSS 66 kV A", "OSS 66 kV B")
BUS_KV = (400.0, 220.0, 220.0, 66.0, 66.0)
COUPLER_TIE_PU = 1e-6
F_MIN_HZ = 1.0
F_MAX_HZ = 20_000.0


@dataclass(frozen=True)
class ConverterModel:
    """Grid-side converter of one WTG (module docstring); per unit on its rating."""

    l_filter_pu: float = 0.15
    c_filter_pu: float = 0.08
    f_sw_hz: float = 2500.0
    bandwidth_hz: float = 250.0
    delay_samples: float = 1.5
    feedforward: float = 0.0  # 0: none, 1: unfiltered grid-voltage feed-forward
    damping_r_pu: float | None = None  # series R of the C_f branch; None: 1 / (3 ω_r C_f)

    @property
    def delay_s(self) -> float:
        return self.delay_samples / (2.0 * self.f_sw_hz)

    @property
    def kp_pu(self) -> float:
        return 2 * math.pi * self.bandwidth_hz / OMEGA0 * self.l_filter_pu

    @property
    def lcl_resonance_hz(self) -> float:
        """L_f – C_f – WTG transformer resonance on a stiff 66 kV bus."""
        l2 = WTG_TRAFO_VK_PERCENT / 100
        return F0 * math.sqrt((self.l_filter_pu + l2) / (self.l_filter_pu * l2 * self.c_filter_pu))

    @property
    def r_damp_pu(self) -> float:
        if self.damping_r_pu is not None:
            return self.damping_r_pu
        return 1.0 / (3.0 * self.lcl_resonance_hz / F0 * self.c_filter_pu)

    @property
    def non_passive_from_hz(self) -> float:
        """Without feed-forward Re{Y_a} < 0 once ω T_d > π/2, i.e. above f_s / 6."""
        return 1.0 / (4.0 * self.delay_s)

    def check(self) -> None:
        if 2 * math.pi * self.bandwidth_hz * self.delay_s >= math.pi / 2:
            raise ValueError("current loop unstable on its own (α_c·T_d ≥ π/2)")

    def filter_branch_pu(self, h: float | NDArray[np.float64]) -> Any:
        """Admittance of the damped C_f branch (R_d in series with C_f) [pu, own rating]."""
        return 1.0 / (self.r_damp_pu + 1.0 / (1j * np.asarray(h) * self.c_filter_pu))


DEFAULT_CONVERTER = ConverterModel()


def converter_admittance_pu(f_hz: NDArray[np.float64] | float, conv: ConverterModel) -> Any:
    """Active part Y_a of the Norton admittance [pu on the converter rating] (docstring)."""
    w = 2 * np.pi * np.asarray(f_hz, dtype=float)
    d = np.exp(-1j * w * conv.delay_s)
    return (1 - conv.feedforward * d) / (1j * w / OMEGA0 * conv.l_filter_pu + conv.kp_pu * d)


# ── Network ──────────────────────────────────────────────────────


@dataclass(frozen=True)
class _Layout:
    n_wtg: int
    mv: tuple[int, ...]  # 66 kV node of each WTG
    lv: tuple[int, ...]  # converter terminal of each WTG
    sections: tuple[tuple[int, int, CableSpec], ...]  # (from, to, cable)
    n_nodes: int


@lru_cache(maxsize=16)
def _layout(spec: FarmSpec) -> _Layout:
    n = spec.num_turbines
    mv = tuple(range(5, 5 + n))
    lv = tuple(range(5 + n, 5 + 2 * n))
    n_a = spec.section_a_strings
    sections, k = [], 0
    for s, length in enumerate(spec.string_layout):
        bus = BUS_A if s < n_a else BUS_B
        for pos in range(length):
            frm = bus if pos == 0 else mv[k - 1]
            sections.append((frm, mv[k], _get_cable_grade(length - pos, spec.turbine_rated_mw)))
            k += 1
    return _Layout(n, mv, lv, tuple(sections), 5 + 2 * n)


def _pi(
    cable: CableSpec, length_km: float, h: float, v_kv: float, n_par: int = 1
) -> tuple[complex, complex]:
    """(series Z, shunt Y at each end) [pu] of an exact distributed π at order h."""
    z_km = complex(cable.r_ac_ohm_per_km * math.sqrt(h), h * cable.x_ohm_per_km)
    y_km = complex(0.0, h * OMEGA0 * cable.c_nf_per_km * 1e-9)
    gamma, zc = np.sqrt(z_km * y_km), np.sqrt(z_km / y_km)
    gl = gamma * length_km
    z_base = v_kv**2 / S_BASE
    return complex(zc * np.sinh(gl) / n_par / z_base), complex(
        n_par * np.tanh(gl / 2) / zc * z_base
    )


def _trafo(vk: float, vkr: float, s_mva: float, h: float) -> complex:
    z, r = vk / 100 * S_BASE / s_mva, vkr / 100 * S_BASE / s_mva
    return complex(r * math.sqrt(h), h * math.sqrt(z * z - r * r))


def network_admittance(
    f_hz: float,
    spec: FarmSpec = SB510,
    conv: ConverterModel = DEFAULT_CONVERTER,
    grid_ssc_mva: float | None = None,
    coupler_closed: bool = False,
    with_filter_capacitors: bool = True,
) -> NDArray[np.complex128]:
    """Passive nodal admittance [pu, 100 MVA] at f (module docstring); C_f included."""
    h = f_hz / F0
    lay = _layout(spec)
    y = np.zeros((lay.n_nodes, lay.n_nodes), dtype=complex)

    def branch(a: int, b: int, z: complex) -> None:
        y[a, a] += 1 / z
        y[b, b] += 1 / z
        y[a, b] -= 1 / z
        y[b, a] -= 1 / z

    ssc = spec.grid_ssc_mva if grid_ssc_mva is None else grid_ssc_mva
    xg = S_BASE / ssc / math.sqrt(1 + GRID_RX_RATIO**2)
    y[POC, POC] += 1 / complex(GRID_RX_RATIO * xg * math.sqrt(h), h * xg)
    s_on = NUM_ONSHORE_TRANSFORMERS * spec.onshore_trafo_mva
    branch(POC, ON220, _trafo(TRAFO_220_400_VK_PERCENT, TRAFO_220_400_VKR_PERCENT, s_on, h))
    z_ex, y_ex = _pi(EXPORT_CABLE_1000, spec.export_length_km, h, 220.0, spec.num_export_cables)
    branch(ON220, OSS220, z_ex)
    y[ON220, ON220] += y_ex
    y[OSS220, OSS220] += y_ex
    if spec.reactor_mvar_per_end > 0:
        x_r = S_BASE / spec.reactor_mvar_per_end
        for node in (ON220, OSS220):
            y[node, node] += 1 / complex(h * x_r / REACTOR_Q_FACTOR, h * x_r)
    z_oss = _trafo(TRAFO_66_220_VK_PERCENT, TRAFO_66_220_VKR_PERCENT, spec.oss_trafo_mva, h)
    branch(OSS220, BUS_A, z_oss)
    branch(OSS220, BUS_B, z_oss)
    if coupler_closed:
        branch(BUS_A, BUS_B, complex(0.0, COUPLER_TIE_PU))
    if spec.harmonic_filter_mvar > 0:
        y[BUS_A, BUS_A] += (66.0**2 / S_BASE) / harmonic_filter_impedance_ohm(
            h, spec.harmonic_filter_mvar, spec.harmonic_filter_tuned_order
        )
    for frm, to, cable in lay.sections:
        z_s, y_s = _pi(cable, spec.array_cable_length_km, h, 66.0)
        branch(frm, to, z_s)
        y[frm, frm] += y_s
        y[to, to] += y_s
    z_wtg = _trafo(WTG_TRAFO_VK_PERCENT, WTG_TRAFO_VKR_PERCENT, spec.wtg_trafo_mva, h)
    y_cf = (
        complex(conv.filter_branch_pu(h)) * spec.wtg_trafo_mva / S_BASE
        if with_filter_capacitors
        else 0.0
    )
    for m, low in zip(lay.mv, lay.lv, strict=True):
        branch(m, low, z_wtg)
        y[low, low] += y_cf
    if not with_filter_capacitors:  # keep the converter terminals defined
        for low in lay.lv:
            y[low, low] += 1e-9
    return y


# ── Stability ────────────────────────────────────────────────────


def _return_difference_phase(
    freqs: NDArray[np.float64],
    spec: FarmSpec,
    conv: ConverterModel,
    grid_ssc_mva: float | None,
    coupler_closed: bool,
    n_in_service: int,
) -> NDArray[np.float64]:
    """arg det(I + Z Y_a) = arg det(Y + Y_a E) − arg det(Y) at each frequency [rad]."""
    lay = _layout(spec)
    on = list(lay.lv[:n_in_service])
    ya = converter_admittance_pu(freqs, conv) * spec.wtg_trafo_mva / S_BASE
    out = np.empty(len(freqs))
    for i, f in enumerate(freqs):
        y = network_admittance(float(f), spec, conv, grid_ssc_mva, coupler_closed)
        s0, _ = np.linalg.slogdet(y)
        y[on, on] += ya[i]
        s1, _ = np.linalg.slogdet(y)
        out[i] = float(np.angle(s1 / s0))
    return out


def _refined_phase(
    spec: FarmSpec,
    conv: ConverterModel,
    grid_ssc_mva: float | None,
    coupler_closed: bool,
    n_in_service: int,
    max_step_rad: float = math.pi / 6,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Phase of det(I + Z Y_a) on a grid refined until no step exceeds ``max_step_rad``."""
    f = np.unique(np.concatenate([np.geomspace(F_MIN_HZ, F_MAX_HZ, 600)]))
    ph = _return_difference_phase(f, spec, conv, grid_ssc_mva, coupler_closed, n_in_service)
    for _ in range(12):
        step = np.abs(np.angle(np.exp(1j * np.diff(ph))))
        bad = np.where(step > max_step_rad)[0]
        if len(bad) == 0:
            break
        mids = (f[bad] + f[bad + 1]) / 2
        pm = _return_difference_phase(mids, spec, conv, grid_ssc_mva, coupler_closed, n_in_service)
        order = np.argsort(np.concatenate([f, mids]))
        f = np.concatenate([f, mids])[order]
        ph = np.concatenate([ph, pm])[order]
    return f, np.unwrap(ph)


def unstable_pole_count(phase_unwrapped: NDArray[np.float64]) -> int:
    """Closed-loop RHP poles from arg det(I + L) over 0 < f < ∞ (module docstring)."""
    return max(0, round(-float(phase_unwrapped[-1] - phase_unwrapped[0]) / math.pi))


def standalone_stability(conv: ConverterModel = DEFAULT_CONVERTER) -> tuple[int, float]:
    """(unstable poles, vector margin) of one converter behind its WTG transformer on an
    ideal 66 kV bus — the type test a converter must pass before any farm study."""
    f = np.geomspace(F_MIN_HZ, F_MAX_HZ, 200_000)
    h = f / F0
    vk, vkr = WTG_TRAFO_VK_PERCENT / 100, WTG_TRAFO_VKR_PERCENT / 100
    z_tr = vkr * np.sqrt(h) + 1j * h * math.sqrt(vk * vk - vkr * vkr)
    z = 1 / (conv.filter_branch_pu(h) + 1 / z_tr)
    loop = converter_admittance_pu(f, conv) * z
    ph = np.unwrap(np.angle(1 + loop))
    return unstable_pole_count(ph), round(float(np.min(np.abs(1 + loop))), 3)


@dataclass(frozen=True)
class StabilityResult:
    stable: bool
    unstable_poles: int
    vector_margin: float  # min_i,f |1 + Y_a λ_i|
    vector_margin_hz: float
    phase_margin_deg: float  # min over crossings |Y_a λ_i| = 1 (180° if none)
    phase_margin_hz: float
    non_passive_from_hz: float
    critical_resonance_hz: float  # where the critical locus comes closest to −1
    loci_hz: tuple[float, ...]
    loci_min_distance: tuple[float, ...]  # min_i |1 + Y_a λ_i| per frequency (plot)


def characteristic_margins(
    spec: FarmSpec = SB510,
    conv: ConverterModel = DEFAULT_CONVERTER,
    grid_ssc_mva: float | None = None,
    coupler_closed: bool = False,
    n_in_service: int | None = None,
    freqs: NDArray[np.float64] | None = None,
) -> tuple[NDArray[np.float64], NDArray[np.complex128]]:
    """(f, Y_a λ_i(f)) — the characteristic loci of the 34-converter minor loop."""
    lay = _layout(spec)
    n_on = lay.n_wtg if n_in_service is None else n_in_service
    f = np.arange(50.0, 3000.0 + 1e-9, 2.0) if freqs is None else freqs
    ya = converter_admittance_pu(f, conv) * spec.wtg_trafo_mva / S_BASE
    on = list(lay.lv[:n_on])
    loci = np.empty((len(f), n_on), dtype=complex)
    for i, fi in enumerate(f):
        z = np.linalg.inv(network_admittance(float(fi), spec, conv, grid_ssc_mva, coupler_closed))
        loci[i] = ya[i] * np.linalg.eigvals(z[np.ix_(on, on)])
    return f, loci


@lru_cache(maxsize=32)
def assess_stability(
    spec: FarmSpec = SB510,
    conv: ConverterModel = DEFAULT_CONVERTER,
    grid_ssc_mva: float | None = None,
    coupler_closed: bool = False,
    n_in_service: int | None = None,
) -> StabilityResult:
    """Generalized Nyquist verdict and characteristic-loci margins (module docstring)."""
    conv.check()
    lay = _layout(spec)
    n_on = lay.n_wtg if n_in_service is None else n_in_service
    _, ph = _refined_phase(spec, conv, grid_ssc_mva, coupler_closed, n_on)
    poles = unstable_pole_count(ph)
    f, loci = characteristic_margins(spec, conv, grid_ssc_mva, coupler_closed, n_on)
    dist = np.abs(1 + loci)
    i_min = np.unravel_index(int(np.argmin(dist)), dist.shape)
    pm, pm_f = 180.0, 0.0
    mag = np.abs(loci)
    for j in range(loci.shape[1]):
        cross = np.where(np.diff(np.sign(mag[:, j] - 1.0)) != 0)[0]
        for c in cross:
            margin = 180.0 - abs(math.degrees(float(np.angle(loci[c, j]))))
            if margin < pm:
                pm, pm_f = margin, float(f[c])
    per_f = dist.min(axis=1)
    return StabilityResult(
        stable=poles == 0,
        unstable_poles=poles,
        vector_margin=round(float(dist[i_min]), 3),
        vector_margin_hz=float(f[i_min[0]]),
        phase_margin_deg=round(pm, 1),
        phase_margin_hz=pm_f,
        non_passive_from_hz=round(conv.non_passive_from_hz, 1) if conv.feedforward == 0 else 0.0,
        critical_resonance_hz=float(f[i_min[0]]),
        loci_hz=tuple(float(x) for x in f[::5]),
        loci_min_distance=tuple(round(float(x), 4) for x in per_f[::5]),
    )


def bandwidth_limit_hz(
    spec: FarmSpec = SB510,
    conv: ConverterModel = DEFAULT_CONVERTER,
    grid_ssc_mva: float | None = None,
    lo: float = 50.0,
    hi: float | None = None,
) -> float | None:
    """Highest current-loop bandwidth [Hz] that keeps the farm stable (bisection, 5 Hz);
    ``None`` if even ``lo`` is unstable. Upper bound: the loop's own limit α_c T_d < π/2."""
    from dataclasses import replace

    hi = hi if hi is not None else 0.95 / (4 * conv.delay_s)

    def ok(bw: float) -> bool:
        return assess_stability(spec, replace(conv, bandwidth_hz=round(bw, 1)), grid_ssc_mva).stable

    if not ok(lo):
        return None
    if ok(hi):
        return round(hi, 1)
    while hi - lo > 5.0:
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if ok(mid) else (lo, mid)
    return round(lo, 1)


# ── Harmonic emission with Norton models ─────────────────────────


def harmonic_voltages(
    spec: FarmSpec = SB510,
    conv: ConverterModel = DEFAULT_CONVERTER,
    grid_ssc_mva: float | None = None,
    coupler_closed: bool = False,
    norton: bool = True,
    emission_pct: dict[int, float] | None = None,
) -> list[dict[str, Any]]:
    """Harmonic voltage [% of U1] at every main bus, per order, vs. its planning level.

    ``norton=False``: ideal current sources and no C_f — the lumped screen's assumption on
    the detailed network, to show what the converter admittance changes.
    """
    lay = _layout(spec)
    emission = DEFAULT_WTG_EMISSION_PCT if emission_pct is None else emission_pct
    i_wtg = spec.turbine_rated_mw / S_BASE
    rows = []
    for order in sorted(emission):
        f = order * F0
        y = network_admittance(f, spec, conv, grid_ssc_mva, coupler_closed, norton)
        if norton:
            ya = converter_admittance_pu(f, conv) * spec.wtg_trafo_mva / S_BASE
            idx = list(lay.lv)
            y[idx, idx] += ya
        z = np.linalg.inv(y)
        a = summation_exponent(order)
        i_h = i_wtg * emission[order] / 100
        for node in range(5):
            v = float(np.sum((np.abs(z[node, list(lay.lv)]) * i_h) ** a) ** (1 / a)) * 100
            tier = _voltage_tier(BUS_KV[node])
            limit = planning_level_pct(order, tier)
            rows.append(
                {
                    "bus": BUS_NAMES[node],
                    "order": order,
                    "voltage_pct": round(v, 4),
                    "limit_pct": limit,
                    "utilisation_pct": round(v / limit * 100, 1),
                }
            )
    return rows


def thd_by_bus(rows: list[dict[str, Any]]) -> dict[str, dict[str, float]]:
    out: dict[str, dict[str, float]] = {}
    for node, name in enumerate(BUS_NAMES):
        thd = math.sqrt(sum(r["voltage_pct"] ** 2 for r in rows if r["bus"] == name))
        tier = _voltage_tier(BUS_KV[node])
        out[name] = {"thd_pct": round(thd, 3), "limit_pct": THD_LIMIT[tier]}
    return out


def driving_point_scan(
    node: int = BUS_A,
    spec: FarmSpec = SB510,
    conv: ConverterModel = DEFAULT_CONVERTER,
    grid_ssc_mva: float | None = None,
    norton: bool = True,
    f_max_hz: float = 2500.0,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """|Z(f)| [Ω] seen at a main bus, with or without the converters' admittances."""
    lay = _layout(spec)
    f = np.arange(F0, f_max_hz + 1e-9, 5.0)
    out = np.empty(len(f))
    for i, fi in enumerate(f):
        y = network_admittance(float(fi), spec, conv, grid_ssc_mva, False, norton)
        if norton:
            y[list(lay.lv), list(lay.lv)] += (
                converter_admittance_pu(fi, conv) * spec.wtg_trafo_mva / S_BASE
            )
        out[i] = abs(np.linalg.inv(y)[node, node]) * BUS_KV[node] ** 2 / S_BASE
    return f, out
