"""
Electromagnetic-transient (EMT) study of energising export cable 1 (engineering audit B-4).

The switching programme closes CB-ON-220-01 onto the 108 km cable together with its
onshore line reactor (180 Mvar on 312 Mvar of charging: 58 % compensation). Two effects
are invisible to a load flow and need instantaneous values:

- Zero-missing: the breaker current is the cable's capacitive current minus the reactor's
  inductive current. A pole that closes near a voltage zero gives the reactor a DC offset
  of up to its full peak current, decaying with the reactor's L/R (seconds). Above 50 %
  compensation that offset exceeds the remaining AC current, so the breaker current does
  not cross zero — a breaker asked to open then cannot interrupt (CIGRE TB 556).
- Switching overvoltage at the open far end: the cable charges through the source
  inductance and rings above the Ferranti steady state.

Model (per phase, positive-sequence parameters; the three poles close at their own instants,
120° apart): grid Thevenin source behind the onshore transformers (from the IEC 60909
fault level at the onshore 220 kV busbar), the cable as ``SECTIONS`` cascaded π sections of
the exact-π per-km data (``network_model.exact_pi_per_km``), the line reactor (X/R 400) on
the cable side of the breaker, an optional pre-insertion resistor (``R_PIR`` for ``T_PIR``).
Integration: Dommel's trapezoidal companion models (the EMTP method), Δt = 20 µs.

Verification (tests/test_emt_energisation.py): an LC circuit energised at the voltage peak
rings at 1/(2π√LC) up to ≈ 2 p.u.; the open cable's steady state matches the load-flow
snapshot of the same state (``energisation.network_snapshot``) and the Ferranti rise.

Not modelled: frequency-dependent cable parameters (the travelling-wave detail of the first
milliseconds), mutual coupling between phases, surge arresters, breaker arc dynamics.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import numpy as np
from scipy.linalg import lu_factor, lu_solve

from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    SB510,
    FarmSpec,
    exact_pi_per_km,
)

F_HZ = 50.0
OMEGA = 2 * math.pi * F_HZ
DT_S = 20e-6
SECTIONS = 30
REACTOR_XR = 400.0  # typical EHV shunt reactor quality factor (losses ≈ 0.25 % of rating)
SOURCE_XR = 15.0
R_PIR_OHM = 400.0  # pre-insertion resistor of the breaker
T_PIR_S = 0.010  # inserted for half a cycle before the main contacts close
R_FAULT_OHM = 0.1  # bolted fault at the onshore busbar (TOV study)


@dataclass(frozen=True)
class EnergisationResult:
    closing_times_ms: tuple[float, float, float]  # pole closing instants after t = 0
    breaker_current_a: np.ndarray  # (3, n)
    reactor_current_a: np.ndarray  # (3, n)
    far_end_voltage_kv: np.ndarray  # (3, n) phase-to-earth
    busbar_voltage_kv: np.ndarray  # (3, n) onshore 220 kV busbar, phase-to-earth
    time_s: np.ndarray
    dc_over_ac: tuple[float, float, float]  # largest |DC| / 50 Hz amplitude after closing
    zero_missing_ms: tuple[float, float, float]  # how long |DC| > the 50 Hz amplitude
    zero_missing: bool
    peak_far_end_pu: float  # of the nominal phase-to-earth peak
    steady_far_end_pu: float  # Ferranti, from the last cycle
    steady_breaker_current_a: float  # RMS, last cycle


def _source_inductance_h(spec: FarmSpec) -> tuple[float, float]:
    """Grid + onshore transformers seen from the onshore 220 kV busbar (IEC 60909 max)."""
    from app.services.p2.short_circuit import calc_short_circuit

    ik = next(
        b.ikss_ka for b in calc_short_circuit("max", spec=spec).bus_results
        if b.bus_name == "Onshore_220kV"
    )  # fmt: skip
    z = 1.1 * 220e3 / math.sqrt(3) / (ik * 1e3)
    x = z / math.sqrt(1 + 1 / SOURCE_XR**2)
    return x / OMEGA, x / SOURCE_XR


def simulate_energisation(
    closing_angle_deg: float = 0.0,
    pole_scatter_ms: tuple[float, float, float] = (0.0, 1.0, 2.0),
    pre_insertion: bool = False,
    with_reactor: bool = True,
    duration_s: float = 1.0,
    spec: FarmSpec = SB510,
    length_km: float | None = None,
    fault_window_s: tuple[float, float] | None = None,
) -> EnergisationResult:
    """Energise one export circuit from shore, far end open.

    ``closing_angle_deg``: phase-a source-voltage angle at the first pole's closing (0 = a
    voltage zero, the worst case for the reactor's DC offset; 90 = a voltage peak, the
    point-on-wave remedy). ``pole_scatter_ms``: mechanical scatter of the three poles.
    ``fault_window_s``: a bolted three-phase fault (``R_FAULT_OHM``) at the onshore busbar
    between these instants (``emt_studies`` TOV after fault clearing).
    """
    length = spec.export_length_km if length_km is None else length_km
    cab = EXPORT_CABLE_1000
    r_km, x_km, c_km, _g = exact_pi_per_km(cab, length, cab.r_ac_ohm_per_km)
    seg = length / SECTIONS
    r_s, l_s = r_km * seg, x_km * seg / OMEGA
    c_half = c_km * 1e-9 * seg / 2
    l_src, r_src = _source_inductance_h(spec)
    u_peak = 220e3 * math.sqrt(2 / 3)
    # line reactor: Q at 220 kV → L = U² / (ω·Q)
    l_r = (220e3**2) / (OMEGA * spec.reactor_unit_mvar * 1e6) if with_reactor else 0.0
    r_r = OMEGA * l_r / REACTOR_XR if with_reactor else 0.0

    # Nodes: 0 source-side busbar, 1 cable start (breaker load side), 2..SECTIONS+1 cable.
    n_nodes = SECTIONS + 2
    far = n_nodes - 1
    steps = round(duration_s / DT_S)
    t = np.arange(steps) * DT_S
    t0 = (closing_angle_deg / 360.0) / F_HZ  # first pole closes at this phase angle of a
    close_t = tuple(t0 + ms / 1000.0 for ms in pole_scatter_ms)

    i_brk = np.zeros((3, steps))
    i_rct = np.zeros((3, steps))
    v_far = np.zeros((3, steps))
    v_bus = np.zeros((3, steps))
    g_l = DT_S / (2 * l_src)
    for ph in range(3):
        shift = -2 * math.pi * ph / 3
        # branch states (trapezoidal): source RL, series RL per section, reactor RL
        i_src = 0.0
        i_ser = np.zeros(SECTIONS)
        i_r = 0.0
        v = np.zeros(n_nodes)

        def matrix(
            closed: bool, r_brk: float, faulted: bool
        ) -> tuple[np.ndarray, float, float, float]:
            g = np.zeros((n_nodes, n_nodes))
            if faulted:
                g[0, 0] += 1.0 / R_FAULT_OHM
            # source branch: E – R_src – L_src → node 0, companion: series R+L
            g_src = 1.0 / (r_src + 1.0 / g_l)
            g[0, 0] += g_src
            if closed:
                gb = 1.0 / r_brk
                g[0, 0] += gb
                g[1, 1] += gb
                g[0, 1] -= gb
                g[1, 0] -= gb
            else:
                g[0, 0] += 1e-9
                g[1, 1] += 1e-9
            g_rl = 1.0 / (r_s + 2 * l_s / DT_S)
            g_c = 2 * c_half / DT_S
            for k in range(SECTIONS):
                a, b = k + 1, k + 2
                g[a, a] += g_rl + g_c
                g[b, b] += g_rl + g_c
                g[a, b] -= g_rl
                g[b, a] -= g_rl
            g_rct = 1.0 / (r_r + 2 * l_r / DT_S) if with_reactor else 0.0
            g[1, 1] += g_rct
            return g, g_src, g_rl, g_rct

        mats: dict[tuple[bool, float, bool], tuple[Any, ...]] = {}
        fault_on = False  # the fault branch conducts until its current crosses zero
        hist_c = np.zeros(n_nodes)  # capacitor history currents (node to ground)
        v_prev2_bus = 0.0
        v_prev = np.zeros(n_nodes)
        e_prev = 0.0
        for k in range(steps):
            tk = t[k]
            closed = tk >= close_t[ph]
            pir = pre_insertion and closed and tk < close_t[ph] + T_PIR_S
            r_brk = R_PIR_OHM if pir else 1e-3
            if fault_window_s is not None:
                if not fault_on and fault_window_s[0] <= tk < fault_window_s[1]:
                    fault_on = True
                elif fault_on and tk >= fault_window_s[1] and v_prev[0] * v_prev2_bus <= 0:
                    fault_on = False  # the breaker interrupts at a current zero
            faulted = fault_on
            key = (closed, r_brk, faulted)
            if key not in mats:
                g, g_src, g_rl, g_rct = matrix(closed, r_brk, faulted)
                mats[key] = (lu_factor(g), g_src, g_rl, g_rct)
            lu, g_src, g_rl, g_rct = mats[key]
            e = u_peak * math.sin(OMEGA * tk + shift)
            # Trapezoidal companion of series R–L: i(t) = G·v(t) + I_hist with
            # I_hist = i(t−Δt) + G'·v(t−Δt) − … ; implemented via the exact recurrences:
            rhs = np.zeros(n_nodes)
            # source R-L between ideal source and node 0
            k_src = (2 * l_src / DT_S - r_src) / (2 * l_src / DT_S + r_src)
            h_src = k_src * i_src + g_src * (e_prev - v_prev[0])
            rhs[0] += g_src * e + h_src
            # series sections
            k_ser = (2 * l_s / DT_S - r_s) / (2 * l_s / DT_S + r_s)
            h_ser = k_ser * i_ser + g_rl * (v_prev[1:-1] - v_prev[2:])
            rhs[1:-1] -= h_ser
            rhs[2:] += h_ser
            # capacitors to ground: i = G_c·v − (G_c·v_prev + i_prev)
            rhs += hist_c
            # reactor at node 1
            if with_reactor:
                k_r = (2 * l_r / DT_S - r_r) / (2 * l_r / DT_S + r_r)
                h_r = k_r * i_r + g_rct * v_prev[1]
                rhs[1] -= h_r
            v = lu_solve(lu, rhs)
            # update branch currents
            i_src = g_src * (e - v[0]) + h_src
            i_ser = g_rl * (v[1:-1] - v[2:]) + h_ser
            if with_reactor:
                i_r = g_rct * v[1] + h_r
            g_c = 2 * c_half / DT_S
            cap_nodes = np.zeros(n_nodes)
            cap_nodes[1:] = 2.0  # every cable node has two half-capacitances except ends
            cap_nodes[1] = 1.0
            cap_nodes[-1] = 1.0
            i_cap = cap_nodes * g_c * v - hist_c
            hist_c = cap_nodes * g_c * v + i_cap
            # breaker current = what flows from node 0 into node 1
            i_brk[ph, k] = (v[0] - v[1]) / r_brk if closed else 0.0
            i_rct[ph, k] = i_r
            v_far[ph, k] = v[far]
            v_bus[ph, k] = v[0]
            v_prev2_bus = v_prev[0]
            v_prev, e_prev = v, e

    # Zero-missing: the breaker current's 50 Hz amplitude against its DC offset, in sliding
    # one-cycle windows from one cycle after each pole closes (the inrush ringing of the
    # first cycle crosses zero at its own frequency, then decays). A breaker interrupts at a
    # current zero; while |DC| exceeds the 50 Hz amplitude there is none.
    n_cyc = round(1 / F_HZ / DT_S)
    ratios: list[float] = []
    missing: list[float] = []
    w = np.exp(-1j * OMEGA * np.arange(n_cyc) * DT_S)
    for ph in range(3):
        k0 = int(np.searchsorted(t, close_t[ph])) + n_cyc
        worst, dur = 0.0, 0.0
        for k in range(k0, steps - n_cyc, n_cyc // 4):
            win = i_brk[ph, k : k + n_cyc]
            dc = float(win.mean())
            ac = 2 * abs(np.sum(win * w)) / n_cyc
            ratio = abs(dc) / max(ac, 1e-9)
            worst = max(worst, ratio)
            if ratio > 1.0:
                dur = (k + n_cyc - k0 + n_cyc) * DT_S * 1e3
        ratios.append(round(float(worst), 3))
        missing.append(round(dur, 1))
    last = slice(steps - round(1 / F_HZ / DT_S), steps)
    peak = float(np.max(np.abs(v_far))) / u_peak
    steady = float(np.max(np.abs(v_far[:, last]))) / u_peak
    i_rms = float(np.sqrt(np.mean(i_brk[0, last] ** 2)))
    return EnergisationResult(
        closing_times_ms=tuple(round(c * 1e3, 2) for c in close_t),  # type: ignore[arg-type]
        breaker_current_a=i_brk,
        reactor_current_a=i_rct,
        far_end_voltage_kv=v_far / 1e3,
        busbar_voltage_kv=v_bus / 1e3,
        time_s=t,
        dc_over_ac=tuple(ratios),  # type: ignore[arg-type]
        zero_missing_ms=tuple(missing),  # type: ignore[arg-type]
        zero_missing=any(m > 0 for m in missing),
        peak_far_end_pu=round(peak, 3),
        steady_far_end_pu=round(steady, 4),
        steady_breaker_current_a=round(i_rms, 1),
    )
