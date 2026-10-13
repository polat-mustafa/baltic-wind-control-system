"""
EMT studies around the export-circuit energisation (engineering audit 2.2, after B-4).

``emt_energisation`` simulates one closing of CB-ON-220-01. Three questions need more:

1. Insulation co-ordination (IEC 60071-2). The far-end switching overvoltage depends on the
   closing instant and the pole scatter, so it is a statistical quantity. Many closings
   (closing angle over a half cycle, random pole scatter) give the 2 % value U_e2 by the
   phase-peak method (every phase's peak counts); the truncation value U_et = 1.25·U_e2 − 0.25
   (IEC 60071-2 eq. D.2) is the representative slow-front overvoltage of equipment without
   arresters (K_cd = 1, §3.3.2.2). With the safety factor K_s = 1.15 for internal insulation
   (§4.3.4) it becomes the required switching-impulse withstand U_rw, which range I
   (U_m ≤ 245 kV) equipment proves by the short-duration power-frequency and lightning tests:
   IEC 60071-2 Table 2 converts U_rw to them (GIS 0.7 / 1.25, liquid-immersed 0.5 / 1.10,
   solid 0.5 / 1.00) and IEC 60071-1 Table 2 gives the 245 kV levels (460 kV r.m.s. /
   1050 kV peak). Per unit is IEC 60071's U_s·√2/√3 (U_s = 245 kV); the source is set to
   U_s, the conservative operating voltage.
2. Transformer inrush. Energising an onshore 400/220 kV transformer from the PSE 400 kV
   side drives its core into saturation when the closing instant and the residual flux add
   up. Single-phase model: grid Thevenin (S_sc, R/X) in series with the magnetising branch,
   a two-slope flux–current curve (linear up to the knee, the air-core inductance beyond),
   integrated in the flux linkage. Check: with R = 0 the first peak equals Specht's
   closed form  î = √2·U / (X_s + X_air) · (2λ_N + λ_R − λ_k) / λ_N  (Specht 1951,
   AIEE Trans. 70; Bertagnolli, Short-circuit duty of power transformers, ABB 2007).
3. Temporary overvoltage after a fault is cleared: the cable and its reactor energised
   from shore, a bolted three-phase fault at the onshore 220 kV busbar for ``T_FAULT_S``,
   then cleared at the fault current's next zero (a breaker cannot chop it) — the discharged
   cable re-charges through the source and rings above its steady state.

APPROXIMATIONS (no vendor data): knee at 1.2 p.u. flux, air-core reactance 0.30 p.u. on the
transformer rating, residual flux 0.8 p.u. (the worst case usually assumed), pole scatter
uniform within 0–3 ms, no surge arresters, no frequency-dependent cable model (B-4 limits).
"""

from __future__ import annotations

import math
from functools import lru_cache

import numpy as np

from app.services.p2.network_model import (
    GRID_RX_RATIO,
    SB510,
    TRAFO_220_400_I0_PERCENT,
    TRAFO_220_400_VKR_PERCENT,
    FarmSpec,
)
from app.services.p5.emt_energisation import simulate_energisation

F_HZ = 50.0
OMEGA = 2 * math.pi * F_HZ

# ── 1. Statistical switching overvoltage → IEC 60071-2 ─────────────

US_KV = 245.0  # highest voltage for equipment of the 220 kV system (IEC 60038)
UN_KV = 220.0
PU_KV = US_KV * math.sqrt(2 / 3)  # IEC 60071 1 p.u. (peak, phase-to-earth)
K_S_INTERNAL = 1.15  # IEC 60071-2 §4.3.4
#: IEC 60071-2 Table 2 (range I): U_rw → short-duration power frequency (r.m.s.) / lightning
CONVERSION = {
    "GIS (220 kV switchgear)": (0.7, 1.25),
    "Liquid-immersed (transformers, reactors)": (0.5, 1.10),
    "Solid (XLPE cable)": (0.5, 1.00),
}
#: IEC 60071-1 Table 2, U_m = 245 kV, highest standard level
SDWV_KV, LIWV_KV = 460.0, 1050.0
N_CLOSINGS = 30
POLE_SCATTER_MAX_MS = 3.0
SWITCHING_WINDOW_S = 0.04


@lru_cache(maxsize=2)
def switching_overvoltage_statistics(pre_insertion: bool = False) -> dict[str, object]:
    """Far-end peak of every phase over ``N_CLOSINGS`` closings; U_e2, U_et (phase-peak)."""
    rng = np.random.default_rng(60071)
    peaks: list[float] = []
    for k in range(N_CLOSINGS):
        angle = 180.0 * k / N_CLOSINGS
        scatter = rng.uniform(0.0, POLE_SCATTER_MAX_MS, 3)
        scatter -= scatter.min()  # the first pole defines the closing angle
        r = simulate_energisation(
            closing_angle_deg=angle,
            pole_scatter_ms=(float(scatter[0]), float(scatter[1]), float(scatter[2])),
            pre_insertion=pre_insertion,
            duration_s=SWITCHING_WINDOW_S,
        )
        u_peak = UN_KV * math.sqrt(2 / 3)  # simulated source = 1 p.u. of its own nominal
        peaks += [float(np.max(np.abs(r.far_end_voltage_kv[ph]))) / u_peak for ph in range(3)]
    arr = np.array(peaks)
    ue2 = float(np.percentile(arr, 98))
    return {
        "closings": N_CLOSINGS,
        "phase_peaks_pu": [round(p, 3) for p in sorted(peaks)],
        "max_pu": round(float(arr.max()), 3),
        "ue2_pu": round(ue2, 3),
        "uet_pu": round(1.25 * ue2 - 0.25, 3),
    }


def insulation_coordination(pre_insertion: bool = False) -> dict[str, object]:
    """IEC 60071-2 for the 220 kV export equipment, no arresters (K_cd = 1)."""
    stats = switching_overvoltage_statistics(pre_insertion)
    uet = float(stats["uet_pu"])  # type: ignore[arg-type]
    urp_kv = uet * PU_KV
    urw_kv = urp_kv * K_S_INTERNAL
    rows = []
    for name, (k_pf, k_li) in CONVERSION.items():
        pf, li = k_pf * urw_kv, k_li * urw_kv
        rows.append(
            {
                "insulation": name,
                "required_sdwv_kv": round(pf, 1),
                "required_liwv_kv": round(li, 1),
                "margin_sdwv": round(SDWV_KV / pf, 2),
                "margin_liwv": round(LIWV_KV / li, 2),
                "ok": pf <= SDWV_KV and li <= LIWV_KV,
            }
        )
    return {
        "switching": stats,
        "urp_kv": round(urp_kv, 1),
        "urw_kv": round(urw_kv, 1),
        "rated_sdwv_kv": SDWV_KV,
        "rated_liwv_kv": LIWV_KV,
        "equipment": rows,
        "ok": all(r["ok"] for r in rows),
    }


# ── 2. Transformer inrush ────────────────────────────────────────

KNEE_PU = 1.2
X_AIR_PU = 0.30
RESIDUAL_PU = 0.8
INRUSH_DT_S = 20e-6


def specht_peak_a(
    u_kv: float, x_series_ohm: float, x_air_ohm: float, residual_pu: float, knee_pu: float
) -> float:
    """Closed-form first inrush peak (R = 0, closing at a voltage zero) [A]."""
    return (
        math.sqrt(2)
        * u_kv
        * 1e3
        / math.sqrt(3)
        / (x_series_ohm + x_air_ohm)
        * (2 + residual_pu - knee_pu)
    )


def simulate_inrush(
    spec: FarmSpec = SB510,
    residual_pu: float = RESIDUAL_PU,
    closing_angle_deg: float = 0.0,
    duration_s: float = 1.0,
    lossless: bool = False,
) -> dict[str, object]:
    """Energise one onshore 400/220 kV transformer (no load) from the 400 kV grid.

    Phase a of the source voltage e = √2·U/√3·sin(ωt + θ); the flux linkage of the source
    side λ_s obeys dλ_s/dt = e − R·i, and λ_s = L_s·i + λ_m with i = f(λ_m) the two-slope
    magnetising curve. ``closing_angle_deg`` 0 = voltage zero (worst with positive residual
    flux), 90 = voltage peak (λ_m starts at its steady-state value: no inrush if λ_R = 0)."""
    u_kv = 400.0
    s_va = spec.onshore_trafo_mva * 1e6
    z_base = (u_kv * 1e3) ** 2 / s_va
    z_grid = (u_kv * 1e3) ** 2 / (spec.grid_ssc_mva * 1e6) * 1.1  # IEC 60909 c_max
    x_s = z_grid / math.sqrt(1 + GRID_RX_RATIO**2)
    r = 0.0 if lossless else x_s * GRID_RX_RATIO + TRAFO_220_400_VKR_PERCENT / 100 * z_base / 2
    l_s = x_s / OMEGA
    x_air = X_AIR_PU * z_base
    l_air = x_air / OMEGA
    u_pk = math.sqrt(2) * u_kv * 1e3 / math.sqrt(3)
    lam_n = u_pk / OMEGA  # rated flux linkage (peak)
    i_rated_pk = math.sqrt(2) * s_va / (math.sqrt(3) * u_kv * 1e3)
    l_m = lam_n / (TRAFO_220_400_I0_PERCENT / 100 * i_rated_pk)
    lam_k = KNEE_PU * lam_n
    i_k = lam_k / l_m

    def f(lam: float) -> float:
        a = abs(lam)
        i = a / l_m if a <= lam_k else i_k + (a - lam_k) / l_air
        return math.copysign(i, lam)

    def lam_m_of(lam_s: float) -> float:
        """Invert λ_s = L_s·f(λ_m) + λ_m (piecewise linear, monotone)."""
        a = abs(lam_s)
        a_k = lam_k + l_s * i_k
        if a <= a_k:
            m = a / (1 + l_s / l_m)
        else:
            # a = l_s·(i_k + (m − λ_k)/l_air) + m
            m = (a - l_s * i_k + l_s * lam_k / l_air) / (1 + l_s / l_air)
        return math.copysign(m, lam_s)

    theta = math.radians(closing_angle_deg)
    # Steady flux lags the voltage by 90°: λ(t) = −λ_N·cos(ωt + θ). Closing at θ the flux
    # starts at the residual value and carries the offset λ_R + λ_N·cos θ.
    steps = round(duration_s / INRUSH_DT_S)
    t = np.arange(steps) * INRUSH_DT_S
    lam_s = residual_pu * lam_n  # unloaded: i ≈ 0 so λ_s ≈ λ_m at closing
    i_out = np.empty(steps)
    for k in range(steps):
        lam_m = lam_m_of(lam_s)
        i = f(lam_m)
        i_out[k] = i
        e0 = u_pk * math.sin(OMEGA * t[k] + theta)
        e1 = u_pk * math.sin(OMEGA * (t[k] + INRUSH_DT_S) + theta)
        # Heun step on λ_s
        d0 = e0 - r * i
        pred = lam_s + INRUSH_DT_S * d0
        d1 = e1 - r * f(lam_m_of(pred))
        lam_s += 0.5 * INRUSH_DT_S * (d0 + d1)
    n_cyc = round(1 / F_HZ / INRUSH_DT_S)
    first = i_out[:n_cyc]
    spectrum = np.fft.rfft(first)
    h1, h2 = abs(spectrum[1]), abs(spectrum[2])
    last = i_out[-n_cyc:]
    peak = float(np.max(np.abs(i_out)))
    return {
        "first_peak_a": round(peak, 1),
        "first_peak_pu_of_rated": round(peak / i_rated_pk, 2),
        "rated_peak_a": round(i_rated_pk, 1),
        "specht_peak_a": round(specht_peak_a(u_kv, x_s, x_air, residual_pu, KNEE_PU), 1),
        "second_harmonic_ratio": round(float(h2 / max(h1, 1e-9)), 3),
        "peak_after_s_a": round(float(np.max(np.abs(last))), 1),
        "time_ms": [round(float(x) * 1e3, 1) for x in t[::25][: round(0.3 / INRUSH_DT_S / 25)]],
        "current_a": [round(float(x), 1) for x in i_out[::25][: round(0.3 / INRUSH_DT_S / 25)]],
    }


# ── 3. TOV after a cleared busbar fault ──────────────────────────

T_FAULT_ON_S = 0.30
T_FAULT_S = 0.10  # zone-1 clearing at 220 kV


@lru_cache(maxsize=1)
def tov_after_fault_clearing() -> dict[str, float]:
    """Cable 1 + reactor energised from shore; three-phase busbar fault for 100 ms."""
    r = simulate_energisation(
        closing_angle_deg=90.0,
        duration_s=T_FAULT_ON_S + T_FAULT_S + 0.3,
        fault_window_s=(T_FAULT_ON_S, T_FAULT_ON_S + T_FAULT_S),
    )
    u_peak_kv = UN_KV * math.sqrt(2 / 3)
    after = r.time_s >= T_FAULT_ON_S + T_FAULT_S
    v = np.abs(r.far_end_voltage_kv[:, after]) / u_peak_kv
    before = (r.time_s > T_FAULT_ON_S - 0.02) & (r.time_s < T_FAULT_ON_S)
    steady = float(np.max(np.abs(r.far_end_voltage_kv[:, before]))) / u_peak_kv
    return {
        "steady_far_end_pu": round(steady, 3),
        "peak_after_clearing_pu": round(float(v.max()), 3),
        "peak_after_clearing_kv": round(float(v.max()) * u_peak_kv, 1),
        "fault_duration_ms": T_FAULT_S * 1e3,
    }
