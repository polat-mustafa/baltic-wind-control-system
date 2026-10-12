"""
Fault ride-through (FRT) of the 510 MW farm — quasi-static phasor model.

What is modelled
----------------
The radial chain PSE grid → 400/220 kV → 2 × 108 km export → 220/66 kV is
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

Shunt elements (engineering audit B-3): the export cable as the exact long-line π (its
624 Mvar of charging at 1 p.u., falling with U² in a dip and returning at clearance), the
shunt reactors in service at the pre-fault operating point (P2 dispatch), the array cable
charging and the harmonic filter at OSS 66 kV.

Unbalanced faults (``fault_kind``): symmetrical components. The positive, negative and zero
sequence networks of the chain are reduced to their bus impedance matrices; the converters
are positive-sequence current sources, in the negative sequence either open (K2 = 0, the
classic grid-following converter suppresses I2) or an inductive admittance K2·S_n (negative-
sequence current injection, VDE-AR-N 4120 / IEC 61400-21-1 style). At the faulted bus f:

    3ph   I1 = V1⁰/(Z1ff + Zf)
    2ph   I1 = −I2 = (V1⁰ − V2⁰)/(Z1ff + Z2ff + Zf)
    1ph   I1 = I2 = I0 = (V1⁰ + V2⁰ + V0⁰)/(Z1ff + Z2ff + Z0ff + 3Zf)

and every bus voltage follows from V = V⁰ − Z[:, f]·I_f in each sequence. Zero sequence:
grid X0/X1 = 1, onshore YNyn units pass it, the OSS units are delta on 220 kV (no path), the
66 kV star points are earthed through the NERs (``network_model.NER_OHM``), cables C0 = C1.
The PSE profile is applied to the positive-sequence POC voltage; the lowest phase voltage
and the negative-sequence voltage are reported.

This is an RMS screening model, not an EMT or full RMS dynamic study: no PLL, no DC-link,
no array cable impedance (the WTGs are aggregated at the 66 kV busbar). It shows the
quantities a grid-code check is built on — retained voltage at the connection point, the
reactive current the farm injects, the voltage support that current gives, the active
power recovery and the voltage after clearance — with real network data.

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
    SB510,
    FarmSpec,
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


@dataclass(frozen=True)
class _Networks:
    """Bus impedance matrices of the three sequence networks (4 nodes, p.u. on 100 MVA)
    and the grid source admittance in the positive sequence."""

    z1: np.ndarray
    z2: np.ndarray
    z0: np.ndarray
    y_grid: complex
    statcom_iq_pre: float  # STATCOM reactive current at the operating point [pu of rating]


def _branch(y: np.ndarray, a: int, b: int, z: complex) -> None:
    y[a, a] += 1.0 / z
    y[b, b] += 1.0 / z
    y[a, b] -= 1.0 / z
    y[b, a] -= 1.0 / z


def _networks(
    spec: FarmSpec,
    grid_ssc_mva: float,
    export_length_km: float | None,
    generation_fraction: float,
    k2_factor: float,
) -> _Networks:
    """Sequence networks with shunts at the pre-fault operating point (module docstring)."""
    import math

    import pandapower as pp

    from app.services.p2.load_flow import dispatch_with_reactor_switching
    from app.services.p2.network_model import (
        EXPORT_CABLE_1000,
        GRID_R0X0,
        GRID_X0X,
        NER_OHM,
        NUM_OSS_TRANSFORMERS,
        R_RETURN_EXPORT_OHM_PER_KM,
        array_charging_mvar,
        build_network,
        exact_pi_per_km,
    )

    length = spec.export_length_km if export_length_km is None else export_length_km
    z = series_impedances_pu(S_BASE_MVA, grid_ssc_mva, length, spec)
    # operating point: which reactors are in, what the STATCOM gives (P2 dispatch)
    net = build_network(
        export_length_km=length, grid_ssc_mva=grid_ssc_mva,
        generation_fraction=generation_fraction, spec=spec,
    )  # fmt: skip
    q_stc, _on = dispatch_with_reactor_switching(net, spec.statcom_mvar)
    pp.runpp(net, algorithm="nr", tolerance_mva=1e-8)
    on = net.shunt[net.shunt.name.str.startswith("Reactor_") & net.shunt.in_service]
    q_ons = float(on[on.name.str.startswith("Reactor_ONS")].q_mvar.sum())
    q_oss = float(on[on.name.str.startswith("Reactor_OSS")].q_mvar.sum())

    cab = EXPORT_CABLE_1000
    zb220 = 220.0**2 / S_BASE_MVA
    n = spec.num_export_cables
    r_km, x_km, c_km, g_km = exact_pi_per_km(cab, length, cab.r_ac_ohm_per_km)
    z_exp = complex(r_km, x_km) * length / n / zb220
    y_half = complex(g_km * 1e-6, 2 * math.pi * 50 * c_km * 1e-9) * length / 2 * n * zb220

    def base(seq: int) -> np.ndarray:
        y = np.zeros((4, 4), dtype=complex)
        _branch(y, 0, 1, z["onshore"])
        if seq == 0:  # zero sequence: screens/armour return
            z0_exp = complex(cab.r_ac_ohm_per_km + 3 * R_RETURN_EXPORT_OHM_PER_KM, cab.x_ohm_per_km)
            _branch(y, 1, 2, z0_exp * length / n / zb220)
        else:
            _branch(y, 1, 2, z_exp)
            _branch(y, 2, 3, z["oss"])
        y[1, 1] += y_half
        y[2, 2] += y_half
        # reactors (star-earthed: same admittance in every sequence), absorbing: −jQ/S
        y[1, 1] += -1j * q_ons / S_BASE_MVA
        y[2, 2] += -1j * q_oss / S_BASE_MVA
        # array cable charging and the harmonic filter at 66 kV (capacitive, C0 = C1)
        y[3, 3] += 1j * (array_charging_mvar(spec) + spec.harmonic_filter_mvar) / S_BASE_MVA
        return y

    zg = z["grid"]
    y1 = base(1)
    y1[0, 0] += 1.0 / zg
    y2 = base(2)
    y2[0, 0] += 1.0 / zg
    if k2_factor > 0:  # converters absorb negative-sequence current K2·ΔU2 (inductive)
        y2[3, 3] += -1j * k2_factor * spec.capacity_mw / S_BASE_MVA
        y2[2, 2] += -1j * k2_factor * spec.statcom_mvar / S_BASE_MVA
    y0 = base(0)
    x0 = GRID_X0X * zg.imag
    y0[0, 0] += 1.0 / complex(GRID_R0X0 * x0, x0)
    # OSS 66 kV star points: Z_T0 + 3·R_N to earth (the delta HV side blocks the 220 kV link)
    r_n = NER_OHM / NUM_OSS_TRANSFORMERS / (66.0**2 / S_BASE_MVA)
    y0[3, 3] += 1.0 / (z["oss"] + 3 * r_n)
    return _Networks(
        np.linalg.inv(y1),
        np.linalg.inv(y2),
        np.linalg.inv(y0),
        1.0 / zg,
        q_stc / spec.statcom_mvar if spec.statcom_mvar else 0.0,
    )


def _solve(
    nets: _Networks,
    e_grid: complex,
    converters: list[_Converter],
    v_guess: np.ndarray,
    fault: tuple[int, str, complex] | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Sequence voltages (V1, V2, V0) at the 4 buses for given converter currents, with an
    optional fault (node, kind, Z_f); fixed point on the converters' voltage angle."""
    v1 = v_guess.copy()
    zero = np.zeros(4, dtype=complex)
    v2, v0 = zero, zero
    for _ in range(40):
        i = np.zeros(4, dtype=complex)
        i[0] = e_grid * nets.y_grid
        for c in converters:
            i[c.node] += c.injection(v1[c.node])
        v1_oc = nets.z1 @ i
        if fault is None:
            v1_new, v2, v0 = v1_oc, zero, zero
        else:
            f, kind, zf = fault
            if kind == "3ph":
                i1 = v1_oc[f] / (nets.z1[f, f] + zf)
                i2 = i0 = 0j
            elif kind == "2ph":
                i1 = v1_oc[f] / (nets.z1[f, f] + nets.z2[f, f] + zf)
                i2, i0 = -i1, 0j
            else:  # 1ph
                i1 = v1_oc[f] / (nets.z1[f, f] + nets.z2[f, f] + nets.z0[f, f] + 3 * zf)
                i2 = i0 = i1
            v1_new = v1_oc - nets.z1[:, f] * i1
            v2 = -nets.z2[:, f] * i2
            v0 = -nets.z0[:, f] * i0
        if np.max(np.abs(v1_new - v1)) < 1e-9:
            return v1_new, v2, v0
        v1 = v1_new
    return v1, v2, v0


A = np.exp(2j * np.pi / 3)


def _phase_min(v1: complex, v2: complex, v0: complex) -> float:
    """Lowest of the three phase voltages [p.u.] from the sequence components."""
    return float(
        min(abs(v0 + v1 + v2), abs(v0 + A * A * v1 + A * v2), abs(v0 + A * v1 + A * A * v2))
    )


def _pre_fault_voltage_control(
    nets: _Networks, converters: list[_Converter], wtg: _Converter
) -> np.ndarray:
    """Set the WTG reactive current so the 66 kV busbar sits at 1.0 pu (bisection), with
    the STATCOM at its dispatched output — the plant controller's steady state."""
    lo, hi = -WTG_Q_LIMIT_PU, WTG_Q_LIMIT_PU
    v = np.ones(4, dtype=complex)
    for _ in range(40):
        wtg.iq = 0.5 * (lo + hi)
        v, _v2, _v0 = _solve(nets, 1.0 + 0j, converters, v)
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
    export_length_km: float | None = None,
    grid_ssc_mva: float | None = None,
    k_factor: float = 2.0,
    swell_pu: float = 1.20,
    p_ramp_pu_s: float = DEFAULT_P_RAMP_PU_S,
    spec: FarmSpec = SB510,
    fault_kind: str = "3ph",
    k2_factor: float = 0.0,
) -> FRTSimulationResponse:
    """Simulate a fault (LVRT: 3ph, 2ph or 1ph) or a grid voltage swell (HVRT).

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
    export_length_km : float | None
        Export cable length [km]; None = the spec's.
    spec : FarmSpec
        Farm design (capacity, STATCOM, impedances). Default: SB-510.
    fault_kind : str
        "3ph" (balanced), "2ph" (phase–phase) or "1ph" (phase–earth). LVRT only.
    k2_factor : float
        Negative-sequence current gain of the converters (0 = I2 suppressed).
    """
    grid_ssc_mva = spec.grid_ssc_mva if grid_ssc_mva is None else grid_ssc_mva
    if fault_bus not in BUSES:
        msg = f"fault_bus must be one of {', '.join(BUSES)}, got '{fault_bus}'"
        raise DomainValidationError(msg)
    if not K_FACTOR_RANGE[0] <= k_factor <= K_FACTOR_RANGE[1]:
        msg = f"k_factor must be within {K_FACTOR_RANGE[0]}–{K_FACTOR_RANGE[1]}"
        raise DomainValidationError(msg)

    if fault_kind not in ("3ph", "2ph", "1ph"):
        raise DomainValidationError("fault_kind must be '3ph', '2ph' or '1ph'")
    if not 0.0 <= k2_factor <= 6.0:
        raise DomainValidationError("k2_factor must be within 0–6")
    nets = _networks(spec, grid_ssc_mva, export_length_km, generation_fraction, k2_factor)
    fault_node = BUSES.index(fault_bus)
    z_f = complex(0.1, 1.0) * max(fault_impedance_pu, 1e-6)  # mostly reactive, as before
    fault = (fault_node, fault_kind, z_f) if frt_type == FRTType.LVRT else None

    p_pre_pu = generation_fraction  # WTG active current ≈ P at U ≈ 1 pu
    wtg = _Converter(spec.capacity_mw, WTG_NODE, ip=p_pre_pu)
    statcom = _Converter(spec.statcom_mvar, STATCOM_NODE, ip=0.0, iq=nets.statcom_iq_pre)
    converters = [wtg, statcom]

    t_fault = PRE_FAULT_S
    t_clear = t_fault + fault_duration_s
    times = np.arange(0.0, t_clear + POST_FAULT_S + DT_S / 2, DT_S)
    decay = np.exp(-DT_S / IQ_RISE_TAU_S)

    # Pre-fault: WTGs in voltage control hold their terminals at 1.0 pu
    v = _pre_fault_voltage_control(nets, converters, wtg)
    v_pre = v.copy()
    u_ref = {c.node: abs(v_pre[c.node]) for c in converters}
    iq_pre = {c.node: c.iq for c in converters}

    series: list[FRTTimePoint] = []
    recovering = False
    for t in times:
        faulted = t_fault <= t < t_clear
        f_now = fault if faulted else None
        e_grid = complex(swell_pu if (faulted and frt_type == FRTType.HVRT) else 1.0)

        # Voltage the converters measure now (their currents are still the old ones);
        # they control on the positive-sequence voltage
        v, v2, v0 = _solve(nets, e_grid, converters, v, f_now)

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
        v, v2, v0 = _solve(nets, e_grid, converters, v, f_now)

        u_wtg = abs(v[WTG_NODE])
        series.append(
            FRTTimePoint(
                time_s=round(float(t), 4),
                voltage_pu=round(float(abs(v[POC_NODE])), 4),
                negative_sequence_pu=round(float(abs(v2[POC_NODE])), 4),
                phase_min_pu=round(_phase_min(v[POC_NODE], v2[POC_NODE], v0[POC_NODE]), 4),
                terminal_voltage_pu=round(float(u_wtg), 4),
                active_power_mw=round(float(u_wtg * wtg.ip * wtg.s_mva), 2),
                reactive_power_mvar=round(float(u_wtg * wtg.iq * wtg.s_mva), 2),
                reactive_current_pu=round(float(wtg.iq), 4),
                statcom_q_mvar=round(float(abs(v[STATCOM_NODE]) * statcom.iq * statcom.s_mva), 1),
            )
        )

    during = [p for p in series if t_fault <= p.time_s < t_clear]
    after = [p for p in series if p.time_s >= t_clear]
    p_pre_mw = p_pre_pu * spec.capacity_mw
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
    passive, _p2, _p0 = _solve(nets, complex(1.0 if lvrt else swell_pu), no_iq, v_pre, fault)
    post = [p for p in after if p.time_s <= t_clear + 0.5]

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
        fault_kind=fault_kind if lvrt else "swell",
        min_phase_voltage_pu=min(p.phase_min_pu for p in during),
        max_negative_sequence_pu=max(p.negative_sequence_pu for p in during),
        post_clearance_peak_pu=max(
            (max(p.voltage_pu, p.terminal_voltage_pu) for p in post), default=0.0
        ),
    )
