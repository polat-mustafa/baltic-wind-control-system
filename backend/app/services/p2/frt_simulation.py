"""
Fault ride-through (FRT) of the 510 MW farm — quasi-static phasor model.

What is modelled
----------------
The radial chain PSE grid → 400/220 kV → 2 × 45 km export → 220/66 kV is
reduced to its series impedances (``network_model.series_impedances_pu``,
100 MVA base). A fault adds a shunt impedance Z_f at the chosen bus. Every
5 ms the nodal equations are solved

    Y · V = I_grid + I_farm + I_statcom

with the grid as a Thevenin source (E behind Z_grid), the 34 WTGs as one
aggregate current source at OSS 66 kV and the STATCOM as a current source at
OSS 220 kV. Each converter follows the PSE fast-fault-current characteristic:

    ΔIq = K · ΔU   when |ΔU| > 0.1 pu (dead band),   ΔU = 1 − U  [pu]
    Iq has priority, |I| ≤ I_max;   Ip = min(Ip_pre, √(I_max² − Iq²))

and reaches its target with a first-order lag τ = 26 ms (90 % in 60 ms).
After clearance the WTG active current ramps back at a set rate once the
terminal voltage is ≥ 0.9 pu.

This is an RMS screening model, not an EMT or full RMS dynamic study: no
PLL, no DC-link, no array cable impedance (the WTGs are aggregated at the
66 kV busbar), no cable capacitance, balanced faults only. It shows the
quantities a grid-code check is built on — retained voltage at the
connection point, the reactive current the farm injects, the voltage support
that current gives, and the active power recovery — with real network data.

PSE requirements used (PSE, "Wymogi ogólnego stosowania wynikające z NC RfG",
18-12-2018 — power park module, type D)
--------------------------------------------------------------------------
- Art. 16(3)(a): FRT profile at the connection point, symmetric faults:
  U_ret = U_clear = U_rec1 = 0.00 pu, t_clear = t_rec1 = t_rec2 = 0.15 s,
  U_rec2 = 0.85 pu, t_rec3 = 2.5 s. The module may disconnect only if the
  voltage falls below this profile.
- Art. 20(2)(b): additional fast fault (reactive) current with adjustable
  K = 2…10; 90 % within 60 ms, target within 100 ms (−10 % / +20 %).
  Below 0.2 Un at the WTG terminals no additional current is required.
- Art. 20(3)(a): active power recovery starts when U ≥ 0.9 Un; 90 % of the
  pre-fault power within 5 s of fault clearance.
- HVRT: PSE's 2018 requirements set no short-time overvoltage ride-through
  profile for power park modules (only continuous ranges, e.g. 1.118–1.15 pu
  for 60 min at 110–300 kV). The HVRT case is an illustrative swell; the
  check is that the converters stay within an assumed 1.30 pu terminal
  withstand.

Convention: generating Q positive (Rule 4); Iq > 0 = capacitive (voltage
raising), Iq < 0 = inductive (voltage lowering).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.core.exceptions import ValidationError as DomainValidationError
from app.schemas.grid import (
    FRTEnvelopePoint,
    FRTSimulationResponse,
    FRTTimePoint,
    FRTType,
)
from app.services.p2.network_model import (
    EXPORT_CABLE_LENGTH_KM,
    GRID_SSC_MVA,
    STATCOM_RATING_MVAR,
    TOTAL_CAPACITY_MW,
    series_impedances_pu,
)

S_BASE_MVA = 100.0  # Rule 2

# Buses in radial order from the grid; index = node in the nodal model
BUSES = ("PSE_400kV", "Onshore_220kV", "OSS_220kV", "OSS_66kV")
POC_NODE = 0  # connection point to PSE = 400 kV busbar
STATCOM_NODE = 2
WTG_NODE = 3

# ── PSE requirements (power park module, type D) ──────────────────
PSE_FRT_PROFILE = ((0.0, 0.0), (0.15, 0.0), (2.5, 0.85))  # (t after fault [s], U [pu])
PSE_FRT_PROFILE_END_S = 2.5
K_FACTOR_RANGE = (2.0, 10.0)
DEAD_BAND_PU = 0.10
NO_INJECTION_BELOW_PU = 0.20  # Iq not *required* below 0.2 Un (still delivered here)
IQ_RISE_TAU_S = 0.060 / np.log(10.0)  # first-order lag: 90 % in 60 ms
RECOVERY_START_PU = 0.90
RECOVERY_FRACTION = 0.90
RECOVERY_LIMIT_S = 5.0

# ── Converter / simulation settings ───────────────────────────────
I_MAX_PU = 1.0  # converter current limit [pu of rating]
WTG_Q_LIMIT_PU = 0.33  # steady-state WTG reactive current range (cos φ ≈ 0.95), assumed
DEFAULT_P_RAMP_PU_S = 1.0  # post-fault active power ramp [pu of rating per s]
HVRT_WITHSTAND_PU = 1.30  # assumed converter terminal overvoltage withstand
PRE_FAULT_S = 0.20
POST_FAULT_S = PSE_FRT_PROFILE_END_S + 0.30
DT_S = 0.005


@dataclass
class _Converter:
    """Aggregate converter: rating, node and its current state (V-aligned frame)."""

    s_mva: float
    node: int
    ip: float  # active current [pu of rating]
    iq: float = 0.0  # reactive current [pu of rating], > 0 capacitive

    def injection(self, v: complex) -> complex:
        """Current injected into the network [pu on S_BASE]."""
        angle = v / abs(v) if abs(v) > 1e-6 else 1.0 + 0j
        return (self.ip - 1j * self.iq) * angle * self.s_mva / S_BASE_MVA


def pse_frt_profile(t_after_fault_s: float) -> float:
    """PSE type-D profile: lowest POC voltage [pu] the farm must ride through."""
    (_, u0), (t1, u1), (t2, u2) = PSE_FRT_PROFILE
    if t_after_fault_s <= t1:
        return u0
    if t_after_fault_s >= t2:
        return u2
    return u1 + (u2 - u1) * (t_after_fault_s - t1) / (t2 - t1)


def iq_target(du_pu: float, k_factor: float) -> float:
    """Reactive current set-point Iq = K·ΔU outside the ±0.1 pu dead band [pu of rating].

    ΔU = U_pre − U: a dip (ΔU > 0) gives capacitive Iq, a swell inductive Iq.
    """
    if abs(du_pu) <= DEAD_BAND_PU:
        return 0.0
    return float(np.clip(k_factor * du_pu, -I_MAX_PU, I_MAX_PU))


def _admittance(z_series: dict[str, complex]) -> np.ndarray:
    """Nodal admittance matrix of the radial chain incl. the grid source impedance."""
    y = np.zeros((4, 4), dtype=complex)
    y[0, 0] += 1.0 / z_series["grid"]
    for a, z in ((0, z_series["onshore"]), (1, z_series["export"]), (2, z_series["oss"])):
        b = a + 1
        y[a, a] += 1.0 / z
        y[b, b] += 1.0 / z
        y[a, b] -= 1.0 / z
        y[b, a] -= 1.0 / z
    return y


def _solve(
    y: np.ndarray,
    e_grid: complex,
    z_grid: complex,
    converters: list[_Converter],
    v_guess: np.ndarray,
) -> np.ndarray:
    """Node voltages for given converter currents (fixed point on the angle)."""
    v = v_guess.copy()
    for _ in range(30):
        i = np.zeros(4, dtype=complex)
        i[0] = e_grid / z_grid
        for c in converters:
            i[c.node] += c.injection(v[c.node])
        v_new = np.linalg.solve(y, i)
        if np.max(np.abs(v_new - v)) < 1e-9:
            return v_new
        v = v_new
    return v


def _pre_fault_voltage_control(
    y: np.ndarray, z_grid: complex, converters: list[_Converter], wtg: _Converter
) -> np.ndarray:
    """Set the WTG reactive current so the 66 kV busbar sits at 1.0 pu (bisection).

    Stands in for the plant controller: in the real network the cable charging,
    shunt reactors and STATCOM settle the voltage; here the WTGs do it within
    ±WTG_Q_LIMIT_PU.
    """
    lo, hi = -WTG_Q_LIMIT_PU, WTG_Q_LIMIT_PU
    v = np.ones(4, dtype=complex)
    for _ in range(40):
        wtg.iq = 0.5 * (lo + hi)
        v = _solve(y, 1.0 + 0j, z_grid, converters, v)
        if abs(v[wtg.node]) < 1.0:
            lo = wtg.iq
        else:
            hi = wtg.iq
    return v


def run_frt_simulation(
    frt_type: FRTType = FRTType.LVRT,
    fault_bus: str = "PSE_400kV",
    fault_impedance_pu: float = 0.005,
    fault_duration_s: float = 0.150,
    generation_fraction: float = 1.0,
    export_length_km: float = EXPORT_CABLE_LENGTH_KM,
    grid_ssc_mva: float = GRID_SSC_MVA,
    k_factor: float = 2.0,
    swell_pu: float = 1.20,
    p_ramp_pu_s: float = DEFAULT_P_RAMP_PU_S,
) -> FRTSimulationResponse:
    """Simulate a balanced fault (LVRT) or a grid voltage swell (HVRT).

    Parameters
    ----------
    fault_bus : str
        One of ``BUSES``. LVRT only.
    fault_impedance_pu : float
        Fault impedance on 100 MVA base [pu]; 0 = bolted. LVRT only.
    k_factor : float
        PSE fast-fault-current gain K (2…10).
    swell_pu : float
        Grid EMF during the HVRT event [pu].
    p_ramp_pu_s : float
        Post-fault active power ramp of the WTGs [pu/s].
    """
    if fault_bus not in BUSES:
        msg = f"fault_bus must be one of {', '.join(BUSES)}, got '{fault_bus}'"
        raise DomainValidationError(msg)
    if not K_FACTOR_RANGE[0] <= k_factor <= K_FACTOR_RANGE[1]:
        msg = f"k_factor must be within {K_FACTOR_RANGE[0]}–{K_FACTOR_RANGE[1]}"
        raise DomainValidationError(msg)

    z = series_impedances_pu(S_BASE_MVA, grid_ssc_mva, export_length_km)
    y_normal = _admittance(z)
    y_fault = y_normal.copy()
    fault_node = BUSES.index(fault_bus)
    if frt_type == FRTType.LVRT:
        y_fault[fault_node, fault_node] += 1.0 / complex(0.1, 1.0) / max(fault_impedance_pu, 1e-6)

    p_pre_pu = generation_fraction  # WTG active current ≈ P at U ≈ 1 pu
    wtg = _Converter(TOTAL_CAPACITY_MW, WTG_NODE, ip=p_pre_pu)
    statcom = _Converter(STATCOM_RATING_MVAR, STATCOM_NODE, ip=0.0)
    converters = [wtg, statcom]

    t_fault = PRE_FAULT_S
    t_clear = t_fault + fault_duration_s
    times = np.arange(0.0, t_clear + POST_FAULT_S + DT_S / 2, DT_S)
    decay = np.exp(-DT_S / IQ_RISE_TAU_S)

    # Pre-fault: WTGs in voltage control hold their terminals at 1.0 pu
    v = _pre_fault_voltage_control(y_normal, z["grid"], converters, wtg)
    v_pre = v.copy()
    u_ref = {c.node: abs(v_pre[c.node]) for c in converters}
    iq_pre = {c.node: c.iq for c in converters}

    series: list[FRTTimePoint] = []
    recovering = False
    for t in times:
        faulted = t_fault <= t < t_clear
        y = y_fault if faulted else y_normal
        e_grid = complex(swell_pu if (faulted and frt_type == FRTType.HVRT) else 1.0)

        # Voltage the converters measure now (their currents are still the old ones)
        v = _solve(y, e_grid, z["grid"], converters, v)

        for c in converters:
            # PSE: the K·ΔU current is *additional* to the pre-fault reactive current
            target = iq_pre[c.node] + iq_target(u_ref[c.node] - abs(v[c.node]), k_factor)
            target = float(np.clip(target, -I_MAX_PU, I_MAX_PU))
            c.iq = target + (c.iq - target) * decay
        # Active current: reactive priority during the event, ramp back afterwards
        u_wtg = abs(v[WTG_NODE])
        headroom = float(np.sqrt(max(I_MAX_PU**2 - wtg.iq**2, 0.0)))
        if faulted:
            wtg.ip = min(wtg.ip, headroom, p_pre_pu)
            recovering = False
        elif t >= t_clear:
            recovering = recovering or u_wtg >= RECOVERY_START_PU
            if recovering:
                wtg.ip = min(wtg.ip + p_ramp_pu_s * DT_S, p_pre_pu, headroom)
        v = _solve(y, e_grid, z["grid"], converters, v)

        u_wtg = abs(v[WTG_NODE])
        series.append(
            FRTTimePoint(
                time_s=round(float(t), 4),
                voltage_pu=round(float(abs(v[POC_NODE])), 4),
                terminal_voltage_pu=round(float(u_wtg), 4),
                active_power_mw=round(float(u_wtg * wtg.ip * wtg.s_mva), 2),
                reactive_power_mvar=round(float(u_wtg * wtg.iq * wtg.s_mva), 2),
                reactive_current_pu=round(float(wtg.iq), 4),
                statcom_q_mvar=round(float(abs(v[STATCOM_NODE]) * statcom.iq * statcom.s_mva), 1),
            )
        )

    during = [p for p in series if t_fault <= p.time_s < t_clear]
    after = [p for p in series if p.time_s >= t_clear]
    p_pre_mw = p_pre_pu * TOTAL_CAPACITY_MW
    lvrt = frt_type == FRTType.LVRT

    # Envelope: the farm must ride through as long as U_POC stays on/above it
    envelope = [
        FRTEnvelopePoint(time_s=round(t_fault + t, 3), voltage_pu=u) for t, u in PSE_FRT_PROFILE
    ] + [FRTEnvelopePoint(time_s=round(float(times[-1]), 3), voltage_pu=PSE_FRT_PROFILE[-1][1])]
    if lvrt:
        above_profile = all(
            p.voltage_pu >= pse_frt_profile(p.time_s - t_fault) - 1e-4
            for p in series
            if p.time_s >= t_fault
        )
        extreme = min(during, key=lambda p: p.voltage_pu)
    else:
        above_profile = max(p.terminal_voltage_pu for p in series) <= HVRT_WITHSTAND_PU
        extreme = max(during, key=lambda p: p.voltage_pu)

    # Fast fault current at the end of the event, vs the PSE characteristic
    end = during[-1]
    du = u_ref[WTG_NODE] - end.terminal_voltage_pu
    # Additional current K·ΔU, capped where the total reaches the rated current
    iq0 = iq_pre[WTG_NODE]
    required = float(np.clip(iq0 + iq_target(du, k_factor), -I_MAX_PU, I_MAX_PU)) - iq0
    delivered = end.reactive_current_pu - iq0
    gain = delivered / du if abs(du) > DEAD_BAND_PU else 0.0
    iq_ok = abs(required) < 1e-9 or (
        np.sign(delivered) == np.sign(required) and 0.9 * abs(required) <= abs(delivered)
    )

    recovery_time = next(
        (p.time_s - t_clear for p in after if p.active_power_mw >= RECOVERY_FRACTION * p_pre_mw),
        float("inf"),
    )
    # Same active current, no reactive current → what the injection is worth
    no_iq = [_Converter(c.s_mva, c.node, ip=c.ip) for c in converters]
    no_iq[0].ip = end.active_power_mw / max(end.terminal_voltage_pu, 1e-3) / wtg.s_mva
    passive = _solve(y_fault, complex(1.0 if lvrt else swell_pu), z["grid"], no_iq, v_pre)

    return FRTSimulationResponse(
        frt_type=frt_type,
        fault_bus=fault_bus if lvrt else "PSE grid (swell)",
        fault_duration_s=fault_duration_s,
        stayed_connected=above_profile,
        reactive_current_compliant=bool(iq_ok),
        reactive_current_gain=round(gain, 2),
        recovery_time_s=round(recovery_time, 3) if p_pre_mw > 0 else 0.0,
        recovery_compliant=p_pre_mw <= 0 or recovery_time <= RECOVERY_LIMIT_S,
        statcom_peak_q_mvar=max((p.statcom_q_mvar for p in during), key=abs),
        k_factor=k_factor,
        retained_voltage_pu=extreme.voltage_pu,
        terminal_voltage_pu=extreme.terminal_voltage_pu,
        passive_voltage_pu=round(float(abs(passive[POC_NODE])), 4),
        recovery_limit_s=RECOVERY_LIMIT_S,
        envelope=envelope if lvrt else [],
        time_series=series,
    )


def check_reactive_current_compliance(
    time_series: list[FRTTimePoint],
    t_fault: float,
    t_clear: float,
    k_qv_min: float = K_FACTOR_RANGE[0],
) -> tuple[bool, float]:
    """Measured gain ΔIq/ΔU at the deepest point of the event vs ``k_qv_min``.

    Current limiting caps ΔIq at I_max, so deep dips are judged against the
    capped requirement min(K·ΔU, I_max).
    """
    pre = [p for p in time_series if p.time_s < t_fault]
    fault = [p for p in time_series if t_fault <= p.time_s <= t_clear]
    if not pre or not fault:
        return False, 0.0
    worst = max(fault, key=lambda p: abs(pre[-1].voltage_pu - p.voltage_pu))
    du = pre[-1].voltage_pu - worst.voltage_pu
    if abs(du) <= DEAD_BAND_PU:
        return True, 0.0
    d_iq = worst.reactive_current_pu - pre[-1].reactive_current_pu
    gain = d_iq / du
    required = min(k_qv_min * abs(du), I_MAX_PU)
    return bool(gain > 0 and 0.9 * required <= abs(d_iq)), gain


def check_active_power_recovery(
    time_series: list[FRTTimePoint],
    t_clear: float,
    pre_fault_p_mw: float,
    threshold: float = RECOVERY_FRACTION,
    max_recovery_time: float = RECOVERY_LIMIT_S,
) -> tuple[bool, float]:
    """PSE Art. 20(3)(a): ≥ 90 % of pre-fault P within 5 s of clearance."""
    if pre_fault_p_mw <= 0.0:
        return True, 0.0
    for p in time_series:
        if p.time_s > t_clear and p.active_power_mw >= threshold * pre_fault_p_mw:
            recovery = p.time_s - t_clear
            return recovery <= max_recovery_time, recovery
    return False, float("inf")
