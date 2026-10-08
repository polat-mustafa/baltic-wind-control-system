"""
RMS dynamic simulation of the 510 MW farm in ANDES with the WECC
second-generation generic renewable models.

Why this model
--------------
Grid-code compliance of a power park module is shown with RMS (positive-
sequence) simulation of a plant model; the WECC generic models REGCA1
(converter), REECA1 (electrical control) and REPCA1 (plant controller) are the
public, vendor-neutral set used for that. ANDES (Cui, Li, Tomsovic, IEEE Trans.
Power Syst. 36(2) 2021) implements them in open source, so every parameter is
visible. A vendor-specific, validated model in PowerFactory or PSS/E (RMS) and
PSCAD (EMT) is what PSE receives for a real connection; this is the generic,
educational counterpart.

Network (system base 100 MVA, same data as ``network_model``)
-------------------------------------------------------------
  GRID 400 kV ── onshore 2 × 300 MVA ── 2 × 108 km 220 kV ── OSS 2 × 300 MVA ── OSS 66 kV
      │                                     (C, 2 × 120 MVAR reactors at each end)
  GENCLS + TGOV1 + area load                                    │ collector equivalent
                                                                WTG 66 kV: 510 MW
                                                                REGCA1/REECA1/REPCA1

- Plant: one aggregated generator (WECC single-machine equivalent). Collector
  equivalent impedance Z_eq = Σ Z_k·(n_k/N)² (Muljadi et al., IEEE PES GM
  2006): each segment weighted by the square of the share of current it carries.
- Grid: a synchronous area equivalent so that frequency can move — GENCLS
  with inertia H and a TGOV1 governor (5 % droop), plus the area load. Its
  transient reactance sets the short-circuit power at the 400 kV POC. The area
  size is chosen so that the load-loss event gives a visible over-frequency;
  it stands in for a disturbance, it is not a model of Continental Europe.
- STATCOM: not modelled; the plant controller holds the POC voltage.

Events
------
- ``frequency``: a block of area load trips at t = 1 s → frequency rises above
  50.2 Hz → REPCA1 frequency droop (LFSM-O, 5 % of Pmax, deadband 200 mHz,
  PSE values) reduces the plant output.
- ``fault``: three-phase fault at the 400 kV POC for 150 ms (PSE type D
  profile: 0 p.u. for 150 ms, 0.85 p.u. at 2.5 s) → REECA1 switches to
  reactive-current priority and injects Iq = Kqv·ΔV. A bolted fault (0 p.u.)
  makes the RMS equations singular, so the deepest dip simulated is 0.05 p.u.

Base handling: ANDES keeps converter currents on the 100 MVA system base and
converts parameters that carry ``Sn``, but not the gains Kqv and the Iqinj
limits, nor the REPCA1 droop (REPCA1 has no ``Sn``). Those are scaled here.

Parameters marked "typical" are generic-model defaults, not vendor data.

Reference
---------
- H. Cui, F. Li, K. Tomsovic, "Hybrid symbolic-numeric framework for power
  system modeling and analysis", IEEE Trans. Power Systems 36(2) 2021 1373–1384
- WECC Renewable Energy Modeling Task Force, "WECC Second Generation Wind
  Turbine Models" (2014) — REGC_A / REEC_A / REPC_A
- E. Muljadi et al., "Equivalencing the collector system of a large wind power
  plant", IEEE PES General Meeting 2006
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, Literal

import numpy as np

from app.services.p2.frt_simulation import (
    PSE_FRT_PROFILE,
    RECOVERY_FRACTION,
    RECOVERY_LIMIT_S,
)
from app.services.p2.network_model import (
    EXPORT_CABLE_1000,
    GRID_SSC_MVA,
    SB510,
    FarmSpec,
    _get_cable_grade,
    series_impedances_pu,
)

logger = logging.getLogger(__name__)

S_BASE = 100.0  # MVA
F0 = 50.0
OMEGA0 = 2.0 * np.pi * F0

# PSE / NC RfG plant settings (verified PSE values, see PPC tab)
LFSM_O_THRESHOLD_HZ = 50.2
DROOP = 0.05  # on Pmax

# Synchronous area equivalent for the frequency event (illustrative, not Continental Europe)
AREA_MVA = 20_000.0
AREA_H_S = 5.0  # s
AREA_XD1 = 0.3  # transient reactance on AREA_MVA (typical)
AREA_LOAD_MW = 18_000.0
GOVERNOR_DROOP = 0.05
DEFAULT_LOAD_TRIP_MW = 3_000.0

T_EVENT_S = 1.0

# REECA1 voltage-dependent current limits (flat 1.1 p.u.: no derating — typical)
_VDL = {
    **{f"Vq{i}": v for i, v in enumerate((0.2, 0.5, 0.8, 1.2), 1)},
    **{f"Iq{i}": 1.1 for i in range(1, 5)},
    **{f"Vp{i}": v for i, v in enumerate((0.2, 0.5, 0.8, 1.2), 1)},
    **{f"Ip{i}": 1.1 for i in range(1, 5)},
}
FAULT_DURATION_S = 0.150  # PSE type D: 0 p.u. for 150 ms
MIN_RETAINED_PU = 0.05  # bolted fault → singular RMS equations
KQV = 2.0  # reactive current gain, PSE range 2–10 (typical lower end)

Event = Literal["frequency", "fault"]


def collector_equivalent_pu(spec: FarmSpec = SB510) -> tuple[complex, float]:
    """Series impedance and total charging of the 66 kV array [p.u. on 100 MVA].

    Muljadi et al. 2006: Z_eq = Σ Z_k·(n_k/N)², n_k = turbines whose current
    flows through segment k. Charging susceptances simply add.
    """
    z_base = 66.0**2 / S_BASE
    n_total = spec.num_turbines
    seg_km = spec.array_cable_length_km
    z_eq, b_eq = 0j, 0.0
    for length in spec.string_layout:
        for pos in range(length):  # pos 0 = segment at the OSS, carries `length` WTGs
            cable = _get_cable_grade(length - pos, spec.turbine_rated_mw)
            n_k = length - pos
            z_seg = complex(cable.r_ac_ohm_per_km, cable.x_ohm_per_km) * seg_km
            z_eq += z_seg / z_base * (n_k / n_total) ** 2
            b_eq += OMEGA0 * cable.c_nf_per_km * 1e-9 * seg_km * z_base
    return z_eq, b_eq


def build_system(
    grid_ssc_mva: float = GRID_SSC_MVA,
    generation_fraction: float = 1.0,
    load_trip_mw: float = 0.0,
    spec: FarmSpec = SB510,
) -> Any:
    """ANDES system of the farm and the area equivalent (not yet set up)."""
    import andes

    cap = spec.capacity_mw
    k_sys = cap / S_BASE  # plant rating → system base

    ss = andes.System()
    buses = [("AREA_400", 400.0), ("POC_400", 400.0), ("ONS_220", 220.0), ("OSS_220", 220.0),
             ("OSS_66", 66.0), ("WTG_66", 66.0)]  # fmt: skip
    for idx, (name, vn) in enumerate(buses):
        ss.add("Bus", {"idx": idx, "name": name, "Vn": vn, "v0": 1.0})

    z = series_impedances_pu(S_BASE, grid_ssc_mva, spec=spec)
    b_export = (
        OMEGA0
        * EXPORT_CABLE_1000.c_nf_per_km
        * 1e-9
        * spec.export_length_km
        * spec.num_export_cables
    ) * (220.0**2 / S_BASE)
    z_col, b_col = collector_equivalent_pu(spec)

    def branch(
        idx: str, b1: int, b2: int, zz: complex, vn1: float, vn2: float, b: float = 0.0
    ) -> None:
        ss.add(
            "Line",
            {"idx": idx, "bus1": b1, "bus2": b2, "r": zz.real, "x": zz.imag, "b": b,
             "Vn1": vn1, "Vn2": vn2, "trans": int(vn1 != vn2)},
        )  # fmt: skip

    # area machine x_d' + this tie = PSE short-circuit impedance at the POC
    x_tie = S_BASE / grid_ssc_mva - AREA_XD1 * S_BASE / AREA_MVA
    branch("GRID_TIE", 0, 1, complex(0.1 * x_tie, x_tie), 400.0, 400.0)
    branch("TR_ONS", 1, 2, z["onshore"], 400.0, 220.0)
    branch("EXPORT", 2, 3, z["export"], 220.0, 220.0, b_export)
    branch("TR_OSS", 3, 4, z["oss"], 220.0, 66.0)
    branch("COLLECTOR", 4, 5, z_col, 66.0, 66.0, b_col)
    if spec.reactor_mvar_per_end > 0:  # one bank at each export end: onshore 2, OSS 3
        b_end = -spec.reactor_mvar_per_end / S_BASE
        for shunt, bus in (("REACTORS_ONS", 2), ("REACTORS_OSS", 3)):
            ss.add("Shunt", {"idx": shunt, "bus": bus, "Vn": 220.0, "b": b_end})

    # Synchronous area: slack generator → GENCLS + TGOV1, area load
    p_farm = cap * generation_fraction
    ss.add("Slack", {"idx": "AREA", "bus": 0, "Vn": 400.0, "Sn": AREA_MVA, "v0": 1.0, "a0": 0.0,
                     "p0": (AREA_LOAD_MW - p_farm) / S_BASE})  # fmt: skip
    ss.add("GENCLS", {"idx": "AREA_SM", "bus": 0, "gen": "AREA", "Vn": 400.0, "Sn": AREA_MVA,
                      "M": 2.0 * AREA_H_S, "D": 0.0, "xd1": AREA_XD1})  # fmt: skip
    ss.add("TGOV1", {"idx": "AREA_GOV", "syn": "AREA_SM", "R": GOVERNOR_DROOP, "T1": 0.5,
                     "T2": 3.0, "T3": 10.0, "VMAX": 1.2, "VMIN": 0.0})  # fmt: skip
    ss.add("PQ", {"idx": "AREA_LOAD", "bus": 0, "Vn": 400.0,
                  "p0": (AREA_LOAD_MW - load_trip_mw) / S_BASE, "q0": 0.0})  # fmt: skip
    if load_trip_mw > 0:
        ss.add(
            "PQ",
            {"idx": "TRIP_LOAD", "bus": 0, "Vn": 400.0, "p0": load_trip_mw / S_BASE, "q0": 0.0},
        )

    # Aggregated plant
    ss.add("PV", {"idx": "PLANT", "bus": 5, "Vn": 66.0, "Sn": cap, "v0": 1.0,
                  "p0": p_farm / S_BASE, "qmax": 0.33 * cap / S_BASE,
                  "qmin": -0.33 * cap / S_BASE})  # fmt: skip
    ss.add("REGCA1", {"idx": "PLANT_GC", "bus": 5, "gen": "PLANT", "Sn": cap,
                      "Tg": 0.02, "Lvplsw": 0, "Iolim": -1.1})  # fmt: skip
    ss.add("REECA1", {"idx": "PLANT_EC", "reg": "PLANT_GC", "Sn": cap,
                      "Vdip": 0.85, "Vup": 1.2, "dbd1": -0.1, "dbd2": 0.1, "Trv": 0.02,
                      # ANDES keeps currents on the system base but does not rescale
                      # Kqv and the Iqinj limits: convert them from the plant rating
                      "Kqv": KQV * k_sys, "Iqh1": 1.1 * k_sys, "Iql1": -1.1 * k_sys,
                      "Imax": 1.1, "PQFLAG": 0,  # reactive-current priority in a dip
                      "PFFLAG": 0, "VFLAG": 0, "QFLAG": 0, "PFLAG": 0, **_VDL,
                      "PMAX": 1.0, "PMIN": 0.0, "dPmax": 1.0, "dPmin": -1.0,
                      "Tpord": 0.02})  # fmt: skip
    ss.add("BusFreq", {"idx": "F_POC", "bus": 1})
    ss.add("REPCA1", {"idx": "PLANT_PC", "ree": "PLANT_EC", "line": "COLLECTOR", "busr": 1,
                      "busf": "F_POC", "Rc": 0.0, "Xc": 0.0,
                      "VCFlag": 1, "RefFlag": 1, "Fflag": 1, "PLflag": 1,
                      "fdbd1": -(LFSM_O_THRESHOLD_HZ - F0) / F0,
                      "fdbd2": (LFSM_O_THRESHOLD_HZ - F0) / F0,
                      # REPCA1 works on the system base: ΔP[100 MVA] = Ddn·Δf[p.u.]
                      "Ddn": cap / S_BASE / DROOP, "Dup": 0.0,
                      "Kpg": 0.1, "Kig": 0.5, "Tp": 0.05, "Tg": 0.1,
                      # limits on the increment Pext (system base), not on P itself
                      "Pmax": 0.0, "Pmin": -p_farm / S_BASE,
                      "femax": 99.0, "femin": -99.0})  # fmt: skip
    return ss


def _series(ss: Any, step_s: float, capacity_mw: float) -> dict[str, np.ndarray]:
    """Time series from the TDS result, resampled at ``step_s``."""
    ts = ss.dae.ts
    t = np.asarray(ts.t)
    grid = np.arange(0.0, t[-1] + 1e-9, step_s)

    def col(var: Any, i: int = 0, states: bool = False) -> np.ndarray:
        data = ts.x if states else ts.y
        return np.asarray(np.interp(grid, t, data[:, var.a[i]]), dtype=float)

    return {
        "t": grid,
        "f_hz": col(ss.BusFreq.f) * F0,
        "v_poc": col(ss.Bus.v, 1),
        "p_mw": col(ss.REGCA1.Pe) * S_BASE,
        "q_mvar": col(ss.REGCA1.Qe) * S_BASE,
        # REGCA1 states are on the system base → reactive current on the plant rating
        "iq_pu": col(ss.REGCA1.S1_y, states=True) * S_BASE / capacity_mw,
    }


@lru_cache(maxsize=32)
def run_event(
    event: Event,
    load_trip_mw: float = DEFAULT_LOAD_TRIP_MW,
    retained_voltage_pu: float = 0.0,
    grid_ssc_mva: float = GRID_SSC_MVA,
    spec: FarmSpec = SB510,
) -> dict[str, Any]:
    """Simulate one event and compare it with the PSE requirement."""
    import andes

    andes.config_logger(stream_level=logging.ERROR)
    ss = build_system(grid_ssc_mva, 1.0, load_trip_mw if event == "frequency" else 0.0, spec)
    if event == "frequency":
        ss.add("Toggle", {"model": "PQ", "dev": "TRIP_LOAD", "t": T_EVENT_S})
        t_end, step = 20.0, 0.05
    else:
        # fault reactance for the requested retained POC voltage: V ≈ x_f / (x_f + x_th)
        x_th = S_BASE / grid_ssc_mva
        v = min(max(retained_voltage_pu, MIN_RETAINED_PU), 0.8)
        x_f = max(x_th * v / (1.0 - v), 1e-4)
        ss.add(
            "Fault",
            {"bus": 1, "tf": T_EVENT_S, "tc": T_EVENT_S + FAULT_DURATION_S, "xf": x_f, "rf": 0.0},
        )
        t_end, step = 5.0, 0.005
    ss.setup()
    ss.PFlow.run()
    if not ss.PFlow.converged:
        msg = "ANDES power flow did not converge"
        raise RuntimeError(msg)
    ss.TDS.config.tf = t_end
    ss.TDS.config.tstep = 0.005 if event == "fault" else 0.01
    ss.TDS.config.no_tqdm = 1
    ss.TDS.run()
    if ss.exit_code != 0:
        msg = f"ANDES time-domain simulation failed (exit code {ss.exit_code})"
        raise RuntimeError(msg)

    s = _series(ss, step, spec.capacity_mw)
    p0 = float(s["p_mw"][0])
    after = s["t"] >= T_EVENT_S
    out: dict[str, Any] = {"event": event, "p0_mw": round(p0, 1)}
    if event == "frequency":
        # static LFSM-O characteristic of the measured frequency (what the plant should settle to)
        expected = (
            p0 - spec.capacity_mw / DROOP * np.maximum(s["f_hz"] - LFSM_O_THRESHOLD_HZ, 0.0) / F0
        )
        above = np.flatnonzero(after & (s["f_hz"] > LFSM_O_THRESHOLD_HZ))
        moved = np.flatnonzero(after & (s["p_mw"] < p0 - 0.01 * p0))
        out |= {
            "load_trip_mw": load_trip_mw,
            "f_max_hz": round(float(s["f_hz"].max()), 3),
            "f_final_hz": round(float(s["f_hz"][-1]), 3),
            "p_min_mw": round(float(s["p_mw"].min()), 1),
            "dp_final_mw": round(float(s["p_mw"][-1]) - p0, 1),
            "dp_expected_final_mw": round(float(expected[-1]) - p0, 1),
            # from f crossing 50.2 Hz to a 1 % output reduction
            "response_delay_s": round(float(s["t"][moved[0]] - s["t"][above[0]]), 2)
            if above.size and moved.size
            else None,
        }
        s["p_expected_mw"] = expected
    else:
        cleared = s["t"] >= T_EVENT_S + FAULT_DURATION_S
        recovered = np.flatnonzero(cleared & (s["p_mw"] >= RECOVERY_FRACTION * p0))
        during = after & ~cleared
        out |= {
            "retained_voltage_pu": round(float(s["v_poc"][during].min()), 3),
            "iq_max_pu": round(float(s["iq_pu"][during].max()), 3),
            "p_recovery_s": round(float(s["t"][recovered[0]] - (T_EVENT_S + FAULT_DURATION_S)), 3)
            if recovered.size
            else None,
            "recovery_limit_s": RECOVERY_LIMIT_S,
            "stayed_connected": bool(
                np.all(s["v_poc"][~during & after] >= _profile(s["t"][~during & after]))
            ),
        }
    out["series"] = [{k: round(float(v[i]), 4) for k, v in s.items()} for i in range(len(s["t"]))]
    return out


def _profile(t: np.ndarray) -> np.ndarray:
    """PSE FRT envelope (U at the POC must stay above it) against simulation time."""
    tt, uu = zip(*PSE_FRT_PROFILE, strict=True)
    return np.interp(t - T_EVENT_S, tt, uu, left=0.0, right=uu[-1])
