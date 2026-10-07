"""
Grid-following (GFL) vs grid-forming (GFM) converters after a grid phase jump.

Model
-----
The 34 WTGs are one aggregate converter (S_n = 510 MVA) behind the series
impedance of the farm and the PSE grid (``network_model.series_impedances_pu``,
re-based to S_n). At t = 0.1 s the grid voltage angle jumps by Δθ — the
standard synchronisation test for converters (a nearby line trip or fault
clearance does this). Time step 50 µs, quasi-static network (phasors).

Grid strength is judged where the converters are, not only at the POC:

    SCR_POC      = S_sc / P_n                        (PSE 400 kV)
    SCR_terminal = 1 / |Z_grid + Z_trafos + Z_cable|  [p.u. on S_n]

The two transformer stages (2 × 300 MVA each) and 45 km of cable add ≈ 0.25 p.u.,
so a strong 10 GVA grid (SCR_POC ≈ 20) is only SCR ≈ 3.3 at the 66 kV busbar.

GFL — current source synchronised by a PLL
  i_dq → i*_dq with a 5 ms current loop (unity-PF active current + the
  reactive current that holds 1.0 p.u. before the event).
  v_dq = E·e^{j(θ_g − θ)} + (R + jX(1 + Δω/ω₀))·i_dq + (X/ω₀)·di_dq/dt
  PLL: Δω = K_p·v_q + ∫K_i·v_q,  dθ/dt = Δω   (10 Hz, ζ = 0.707)
  The PLL must find an angle with v_q = 0. That needs X·i_d ≤ E — the
  weaker the grid, the closer the operating angle is to 90° and the smaller
  the phase jump that throws the PLL out of step.

GFM — virtual synchronous machine (voltage source behind X_f = 0.15 p.u.)
  2H·dΔω/dt = P_ref − P_e − D·Δω,   dδ/dt = ω₀·Δω     (H = 4 s, D = 80 p.u.)
  A phase jump instantly changes P_e (synchronising power K_s·Δθ): the
  inertial response a GFL unit does not give. In a strong grid K_s is large,
  so the current spike can hit the converter limit (1.2 p.u.); the model then
  holds the current magnitude at the limit.

Not modelled: DC link and machine side, outer voltage loops, inner-loop and
LCL dynamics, saturation of the PLL frequency, controller interaction
between turbines. The trends (GFL needs a strong grid, GFM gives inertia but
is current-limited in stiff grids) are the established ones (see Rosso et
al., IEEE Open J. Ind. Appl. 2021; Wang & Blaabjerg, IEEE TPEL 35(5) 2020).

References
----------
- CIGRE TB 671 (2016): Connection of wind farms to weak AC networks
- NGESO Grid Code GC0137 (2022): GB grid forming capability (phase-jump tests)
- R. Rosso, X. Wang, M. Liserre, X. Lu, S. Engelken, "Grid-forming converters:
  control approaches, grid-synchronization, and future trends — a review",
  IEEE Open Journal of Industry Applications 2 (2021) 93–109
- X. Wang, M. G. Taul, H. Wu, Y. Liao, F. Blaabjerg, F. Huang, "Grid-
  synchronization stability of converter-based resources — an overview",
  IEEE Open Journal of Industry Applications 1 (2020) 115–134
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from app.schemas.grid import (
    ConverterComparisonResponse,
    ConverterResult,
    ConverterTimePoint,
    ConverterType,
)
from app.services.p2.network_model import (
    GRID_SSC_MVA,
    SB510,
    FarmSpec,
    series_impedances_pu,
)

OMEGA0 = 2.0 * math.pi * 50.0  # rad/s
F0_HZ = 50.0

# GFL
GFL_CURRENT_TAU_S = 0.005
GFL_PLL_BW_HZ = 10.0
GFL_PLL_ZETA = 0.707
# GFM
GFM_INERTIA_H = 4.0  # s
GFM_DAMPING_D = 80.0  # p.u. power per p.u. speed
GFM_FILTER_Z = complex(0.005, 0.15)  # p.u. on S_n
GFM_CURRENT_LIMIT_PU = 1.2

# Simulation
DT_S = 50e-6
T_EVENT_S = 0.1
T_END_S = 2.0
OUTPUT_STEP_S = 0.002
SETTLING_BAND = 0.02  # ±2 % of rated power
POLE_SLIP_RAD = math.pi  # angle more than 180° away from the new equilibrium → lost step

STRONG_GRID_SSC_MVA = GRID_SSC_MVA
WEAK_GRID_SSC_MVA = 2_000.0
VERY_WEAK_GRID_SSC_MVA = 700.0  # SCR_POC ≈ 1.4 → ≈ 1.0 at the 66 kV busbar
SCENARIO_SSC_MVA = {
    "strong_grid": STRONG_GRID_SSC_MVA,
    "weak_grid": WEAK_GRID_SSC_MVA,
    "very_weak_grid": VERY_WEAK_GRID_SSC_MVA,
}
DEFAULT_PHASE_JUMP_DEG = 20.0


@dataclass
class _Trace:
    p: np.ndarray
    f_hz: np.ndarray
    i_pu: np.ndarray
    v_pu: np.ndarray
    lost_sync: bool


def grid_impedance_pu(
    grid_ssc_mva: float, export_length_km: float | None = None, spec: FarmSpec = SB510
) -> complex:
    """Grid + farm series impedance seen from the 66 kV busbar [p.u. on the farm rating]."""
    return sum(
        series_impedances_pu(spec.capacity_mw, grid_ssc_mva, export_length_km, spec).values(),
        start=0j,
    )


def _simulate_gfl(z: complex, p_ref: float, jump_rad: float) -> _Trace:
    r, x = z.real, z.imag
    # Pre-event equilibrium. In the PLL frame v_dq = e^{-jθ} + z·i_dq must have
    # v_q = 0 → sin θ = x·i_d + r·i_q. Q = −v_d·i_q, so i_q < 0 is capacitive;
    # pick i_q so that |v| = 1 p.u. (the plant controller's steady state).
    theta, iq = 0.0, 0.0
    for _ in range(200):
        s_theta = x * p_ref + r * iq
        if abs(s_theta) >= 1.0:  # no angle with v_q = 0: GFL cannot synchronise at all
            n = round(T_END_S / DT_S)
            return _Trace(np.zeros(n), np.full(n, F0_HZ), np.zeros(n), np.zeros(n), True)
        theta = math.asin(s_theta)
        v = np.exp(-1j * theta) + z * complex(p_ref, iq)
        iq -= 0.5 * (1.0 - abs(v)) / x
    theta0 = theta
    i_ref = complex(p_ref, iq)
    i = i_ref
    kp = 2.0 * GFL_PLL_ZETA * 2.0 * math.pi * GFL_PLL_BW_HZ
    ki = (2.0 * math.pi * GFL_PLL_BW_HZ) ** 2
    x_int, dw = 0.0, 0.0

    n = round(T_END_S / DT_S)
    p = np.empty(n)
    f = np.empty(n)
    cur = np.empty(n)
    vm = np.empty(n)
    lost = False
    for k in range(n):
        theta_g = jump_rad if k * DT_S >= T_EVENT_S else 0.0
        di = (i_ref - i) / GFL_CURRENT_TAU_S
        # v_q has a term that depends on Δω itself (jωL·i); solve that loop exactly
        v0 = np.exp(1j * (theta_g - theta)) + complex(r, x) * i + x / OMEGA0 * di
        gain = x * i.real / OMEGA0  # ∂v_q/∂Δω
        vq = (v0.imag + gain * x_int) / (1.0 - kp * gain)
        dw = kp * vq + x_int
        v = complex(v0.real - x * i.imag * dw / OMEGA0, vq)
        x_int += ki * vq * DT_S
        theta += dw * DT_S
        i += di * DT_S
        p[k] = (v * i.conjugate()).real
        f[k] = F0_HZ + dw / (2.0 * math.pi)
        cur[k] = abs(i)
        vm[k] = abs(v)
        # Pole slip: the PLL angle runs more than 180° past where it should settle
        if abs(theta - theta0 - (theta_g if theta_g else 0.0)) > POLE_SLIP_RAD or not math.isfinite(
            vq
        ):
            lost = True
            p[k:], f[k:], cur[k:], vm[k:] = np.nan, np.nan, np.nan, np.nan  # trace ends at the slip
            break
    return _Trace(p, f, cur, vm, lost)


def _simulate_gfm(z: complex, p_ref: float, jump_rad: float) -> _Trace:
    z_tot = z + GFM_FILTER_Z
    # Pre-event: choose EMF magnitude and angle so P = p_ref and |v_terminal| = 1
    emf, delta = 1.0, 0.0
    for _ in range(200):
        i = (emf * np.exp(1j * delta) - 1.0) / z_tot
        v = 1.0 + z * i
        s = emf * np.exp(1j * delta) * i.conjugate()
        delta += 0.5 * (p_ref - s.real) / max(abs(emf / z_tot), 1e-6)
        emf += 0.5 * (1.0 - abs(v))
    dw = 0.0
    delta0 = delta

    n = round(T_END_S / DT_S)
    p = np.empty(n)
    f = np.empty(n)
    cur = np.empty(n)
    vm = np.empty(n)
    lost = False
    for k in range(n):
        e_grid = np.exp(1j * (jump_rad if k * DT_S >= T_EVENT_S else 0.0))
        e_conv = emf * np.exp(1j * delta)
        i = (e_conv - e_grid) / z_tot
        if abs(i) > GFM_CURRENT_LIMIT_PU:
            i *= GFM_CURRENT_LIMIT_PU / abs(i)  # current-limited: same angle, capped magnitude
        v = e_grid + z * i
        p_e = (v * i.conjugate()).real
        dw += (p_ref - p_e - GFM_DAMPING_D * dw) / (2.0 * GFM_INERTIA_H) * DT_S
        delta += OMEGA0 * dw * DT_S
        p[k], f[k], cur[k], vm[k] = p_e, F0_HZ * (1.0 + dw), abs(i), abs(v)
        if abs(delta - delta0 - (jump_rad if k * DT_S >= T_EVENT_S else 0.0)) > POLE_SLIP_RAD:
            lost = True
            p[k:], f[k:], cur[k:], vm[k:] = np.nan, np.nan, np.nan, np.nan  # trace ends at the slip
            break
    return _Trace(p, f, cur, vm, lost)


def _finite(x: float, digits: int) -> float | None:
    """None after a pole slip (the trace stops; the chart shows a gap)."""
    return round(float(x), digits) if np.isfinite(x) else None


def _result(
    kind: ConverterType,
    trace: _Trace,
    p_ref: float,
    grid_ssc_mva: float,
    scr_t: float,
    capacity_mw: float = SB510.capacity_mw,
) -> ConverterResult:
    k0 = round(T_EVENT_S / DT_S)
    after = slice(k0, None)
    outside = np.flatnonzero(~(np.abs(trace.p[after] - p_ref) <= SETTLING_BAND))
    settled = not trace.lost_sync and abs(trace.p[-1] - p_ref) <= SETTLING_BAND
    settling = (outside[-1] + 1) * DT_S if outside.size else 0.0
    return ConverterResult(
        converter_type=kind,
        grid_ssc_mva=grid_ssc_mva,
        scr=round(grid_ssc_mva / capacity_mw, 2),
        scr_terminal=round(scr_t, 2),
        stable=settled,
        voltage_deviation_pu=round(
            float(np.nanmax(np.abs(trace.v_pu[after] - trace.v_pu[k0 - 1]))), 4
        ),
        settling_time_s=round(settling, 3) if settled else T_END_S - T_EVENT_S,
        frequency_deviation_hz=round(float(np.nanmax(np.abs(trace.f_hz[after] - F0_HZ))), 3),
        peak_current_pu=round(float(np.nanmax(trace.i_pu)), 3),
        power_swing_mw=round(float(np.nanmax(np.abs(trace.p[after] - p_ref))) * capacity_mw, 1),
    )


def run_converter_comparison(
    scenario: str = "strong_grid",
    grid_ssc_mva: float = STRONG_GRID_SSC_MVA,
    generation_fraction: float = 1.0,
    export_length_km: float | None = None,
    phase_jump_deg: float = DEFAULT_PHASE_JUMP_DEG,
    spec: FarmSpec = SB510,
) -> tuple[ConverterResult, ConverterResult]:
    """GFL and GFM results for one grid strength (``scenario`` is a label only)."""
    response = get_comparison_response(
        scenario, grid_ssc_mva, generation_fraction, export_length_km, phase_jump_deg, spec
    )
    return response.gfl_result, response.gfm_result


def run_weak_grid_comparison(
    grid_ssc_mva: float = WEAK_GRID_SSC_MVA,
    generation_fraction: float = 1.0,
    export_length_km: float | None = None,
) -> tuple[ConverterResult, ConverterResult]:
    """Same comparison at a 2 GVA grid (SCR_POC ≈ 3.9)."""
    return run_converter_comparison(
        "weak_grid", grid_ssc_mva, generation_fraction, export_length_km
    )


def get_comparison_response(
    scenario: str,
    grid_ssc_mva: float = STRONG_GRID_SSC_MVA,
    generation_fraction: float = 1.0,
    export_length_km: float | None = None,
    phase_jump_deg: float = DEFAULT_PHASE_JUMP_DEG,
    spec: FarmSpec = SB510,
) -> ConverterComparisonResponse:
    """Simulate both converters and describe what the traces show."""
    cap = spec.capacity_mw
    z = grid_impedance_pu(grid_ssc_mva, export_length_km, spec)
    scr_t = 1.0 / abs(z)
    p_ref = max(generation_fraction, 0.05)
    jump = math.radians(phase_jump_deg)
    gfl = _simulate_gfl(z, p_ref, jump)
    gfm = _simulate_gfm(z, p_ref, jump)
    gfl_r = _result(ConverterType.GFL, gfl, p_ref, grid_ssc_mva, scr_t, cap)
    gfm_r = _result(ConverterType.GFM, gfm, p_ref, grid_ssc_mva, scr_t, cap)

    step = round(OUTPUT_STEP_S / DT_S)
    series = [
        ConverterTimePoint(
            time_s=round(k * DT_S, 4),
            gfl_p_mw=_finite(gfl.p[k] * cap, 1),
            gfm_p_mw=_finite(gfm.p[k] * cap, 1),
            gfl_f_hz=_finite(gfl.f_hz[k], 4),
            gfm_f_hz=_finite(gfm.f_hz[k], 4),
            gfl_i_pu=_finite(gfl.i_pu[k], 3),
            gfm_i_pu=_finite(gfm.i_pu[k], 3),
        )
        for k in range(0, len(gfl.p), step)
    ]
    return ConverterComparisonResponse(
        scenario=scenario,
        gfl_result=gfl_r,
        gfm_result=gfm_r,
        gfm_advantage=_describe(gfl_r, gfm_r, phase_jump_deg),
        phase_jump_deg=phase_jump_deg,
        time_series=series,
    )


def _describe(gfl: ConverterResult, gfm: ConverterResult, jump_deg: float) -> str:
    """Plain summary of the simulated behaviour (no claims beyond the traces)."""
    head = (
        f"{jump_deg:.0f}° grid phase jump, SCR {gfl.scr:.1f} at the POC → "
        f"{gfl.scr_terminal:.1f} at the 66 kV busbar. "
    )
    gfl_txt = (
        "No GFL operating point: x·P_ref exceeds the grid EMF (SCR at the busbar < 1)."
        if gfl.peak_current_pu == 0.0
        else "GFL lost synchronism: its PLL angle slipped a pole after the jump."
        if not gfl.stable
        else f"GFL re-synchronised in {gfl.settling_time_s:.2f} s with only a "
        f"{gfl.power_swing_mw:.0f} MW power swing — a current source gives no inertial response."
    )
    if not gfm.stable:
        gfm_txt = " GFM did not settle within the simulated window."
    else:
        limited = gfm.peak_current_pu >= GFM_CURRENT_LIMIT_PU - 1e-3
        gfm_txt = (
            f" GFM answered at once with a {gfm.power_swing_mw:.0f} MW synchronising-power "
            f"swing (virtual inertia H = {GFM_INERTIA_H:.0f} s)"
            + (
                f" and hit its {GFM_CURRENT_LIMIT_PU:.1f} p.u. current limit — the stiff-grid "
                "weakness of voltage-source control."
                if limited
                else f"; peak current {gfm.peak_current_pu:.2f} p.u."
            )
        )
    return head + gfl_txt + gfm_txt
