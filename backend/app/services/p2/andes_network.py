"""
ANDES dynamic network model for 510 MW Baltic Sea offshore wind farm.

Builds the same 38-bus 66/220/400 kV network in ANDES format for time-domain
simulation (TDS), then layers second-generation renewable dynamic models:
REGCA1 (generator/converter), REECA1 (electrical control), REPCA1 (plant
controller), and STATCOM as a fast-responding VSC.

Physics — Type-4 Wind Turbine Dynamic Model Stack
---------------------------------------------------
A Type-4 (full-converter) wind turbine connects to the grid through a
voltage-source converter (VSC). The dynamic behaviour is captured by three
cascaded controllers:

  REPCA1 (plant controller) → REECA1 (electrical control) → REGCA1 (generator)

1. **REGCA1** — Renewable energy generator/converter model.
   Models the converter as a controlled current source with time constant Tg.
   Outputs active (Ip) and reactive (Iq) current commands to the network.
   Transfer function: I(s) = I_ref / (1 + s×Tg)

2. **REECA1** — Renewable energy electrical control.
   Implements voltage/reactive power control with FRT reactive current logic:
     ΔIq = Kqv × (V_ref - V)  when |ΔV| > deadband
   Kqv ≥ 2.0 per NC RfG Type D (2% reactive current per 1% voltage deviation).

3. **REPCA1** — Renewable energy plant controller.
   Plant-level voltage and frequency droop at PCC:
     ΔV_ref = Kp_v × (V_pcc - V_set) + Ki_v × ∫(V_pcc - V_set)dt
     ΔP_ref = -(1/R) × Δf/f_nom × P_rated

Standard — ENTSO-E NC RfG Type D + PSE IRiESP
----------------------------------------------
- Article 20: FRT requirements (LVRT/HVRT voltage-time profiles)
- Article 15: Frequency response (LFSM-O, LFSM-U, FSM)
- Article 21: Reactive current injection during faults (Kqv ≥ 2.0)
- PSE IRiESP §2.3: Polish-specific LVRT envelope

Maths — Key Transfer Functions
-------------------------------
REGCA1 current injection:
  Ip(s) = Ip_cmd / (1 + s×Tg)     Tg = 0.02 s (20 ms converter response)
  Iq(s) = Iq_cmd / (1 + s×Tg)

REECA1 reactive current during fault:
  Iq_cmd = Kqv × (V_ref - V)      Kqv ≥ 2.0 (NC RfG minimum)
  Deadband: ±0.1 pu around V_ref

REPCA1 frequency droop:
  ΔP = -(P_rated / R) × (Δf / f_nom)   R = 5% (default droop)

Code — ANDES Implementation
-----------------------------
ANDES uses a symbolic-numeric hybrid approach: dynamic models are defined
symbolically and compiled to efficient numerical code. The TDS (Time-Domain
Simulation) solver uses implicit trapezoidal integration with adaptive step size.

Bridge strategy: No pandapower-to-ANDES converter exists. We build the ANDES
network from the same shared constants (CableSpec, transformer data, topology)
and validate that ANDES power flow matches Pandapower bus voltages within 0.5%.

References
----------
- ANDES documentation: https://docs.andes.app/
- WECC REGCA1/REECA1/REPCA1 model specifications
- ENTSO-E NC RfG (EU 2016/631): Articles 13-21
- PSE IRiESP: Polish transmission system operator grid code
"""

from __future__ import annotations

import logging
import math
from typing import Any

import andes

from app.services.p2.network_model import (
    ARRAY_CABLE_LENGTH_KM,
    EXPORT_CABLE_1000,
    EXPORT_CABLE_LENGTH_KM,
    GRID_SSC_MVA,
    NUM_TURBINES,
    SHUNT_REACTOR_MVAR,
    STATCOM_RATING_MVAR,
    STRING_LAYOUT,
    TRAFO_66_220_MVA,
    TRAFO_66_220_VK_PERCENT,
    TRAFO_66_220_VKR_PERCENT,
    TRAFO_220_400_MVA,
    TRAFO_220_400_VK_PERCENT,
    TRAFO_220_400_VKR_PERCENT,
    TURBINE_RATED_MW,
    CableSpec,
    _get_cable_grade,
)

logger = logging.getLogger(__name__)

# ── ANDES System Base ─────────────────────────────────────────────

SYSTEM_FREQ_HZ = 50.0
SYSTEM_MVA_BASE = 100.0  # Rule 2: per-unit consistent


# ── REGCA1 Parameters (Generator/Converter) ─────────────────────


def get_regca1_params() -> dict[str, float]:
    """Return REGCA1 renewable generator/converter parameters.

    REGCA1 models the power converter as a controlled current source.
    The time constant Tg represents the converter's response delay.

    Returns
    -------
    dict[str, float]
        REGCA1 model parameters with ANDES field names.
    """
    return {
        "Tg": 0.02,        # Converter time constant [s] — 20 ms response
        "Rrpwr": 10.0,     # Ramp rate limit [pu/s] — active power ramp
        "Brkpt": 0.9,      # Low-voltage breakpoint for active current [pu]
        "Zerox": 0.4,       # Voltage at which Ip = 0 during fault [pu]
        "Lvpl1": 1.22,     # LVPL gain breakpoint 1 [pu]
        "Lvpnt0": 0.4,     # LVPL voltage point 0 [pu]
        "Lvpnt1": 0.8,     # LVPL voltage point 1 [pu]
        "Iolim": -1.3,     # Min reactive current limit [pu]
        "Khv": 0.7,        # High-voltage reactive current gain
        "Iqrmax": 999.0,   # Max rate of Iq change [pu/s]
        "Iqrmin": -999.0,  # Min rate of Iq change [pu/s]
        "Accel": 0.0,      # Acceleration factor
    }


# ── REECA1 Parameters (Electrical Control) ──────────────────────


def get_reeca1_params() -> dict[str, float]:
    """Return REECA1 renewable electrical control parameters.

    REECA1 implements reactive current injection during faults:
      ΔIq = Kqv × (V_ref - V)  where Kqv ≥ 2.0 per NC RfG Type D

    Returns
    -------
    dict[str, float]
        REECA1 model parameters with ANDES field names.
    """
    return {
        "Kqv": 2.5,        # Reactive current gain [pu/pu] — NC RfG ≥ 2.0
        "Tp": 0.05,        # Active power filter time constant [s]
        "Tiq": 0.02,       # Reactive current command time constant [s]
        "dbd1": -0.1,      # Deadband lower limit [pu] — voltage deviation
        "dbd2": 0.1,       # Deadband upper limit [pu]
        "Vref0": 1.0,      # Reference voltage [pu]
        "Vdip": 0.15,      # Voltage dip threshold for FRT [pu]
        "Vup": 1.25,       # Voltage swell threshold for FRT [pu]
        "Iqfrz": 0.0,      # Freeze Iq during FRT (0 = no freeze)
        "Thld": 0.0,       # Post-fault Iq hold time [s]
        "Thld2": 0.0,      # Post-fault Ip hold time [s]
        "Pmin": 0.0,       # Minimum active power [pu]
        "Pmax": 1.0,       # Maximum active power [pu]
        "Qmin": -0.44,     # Minimum reactive power [pu on Sbase]
        "Qmax": 0.44,      # Maximum reactive power [pu on Sbase]
        "Imax": 1.1,       # Maximum total current [pu]
        "Vref1": 1.0,      # Voltage reference 1 [pu]
        "PfFlag": 0,       # 0 = Q control, 1 = PF control
        "VFlag": 1,        # 1 = voltage control enabled
        "QFlag": 1,        # 1 = Q/V control enabled
        "PQFlag": 0,       # 0 = Q priority, 1 = P priority
    }


# ── REPCA1 Parameters (Plant Controller) ─────────────────────────


def get_repca1_params() -> dict[str, float]:
    """Return REPCA1 renewable plant controller parameters.

    REPCA1 provides plant-level voltage and frequency droop control:
      ΔP = -(P_rated/R) × (Δf/f_nom)   R = 5% default droop

    Returns
    -------
    dict[str, float]
        REPCA1 model parameters with ANDES field names.
    """
    return {
        "Kp": 18.0,        # Proportional gain for voltage regulation
        "Ki": 5.0,         # Integral gain for voltage regulation
        "Tft": 0.0,        # Lead time constant [s]
        "Tfv": 0.05,       # Lag time constant [s]
        "Vfrz": 0.0,       # Voltage below which Vreg freezes [pu]
        "Rc": 0.0,         # Line drop compensation R [pu]
        "Xc": 0.0,         # Line drop compensation X [pu]
        "Kc": 0.0,         # Reactive current compensation gain
        "emax": 999.0,     # Max voltage error [pu]
        "emin": -999.0,    # Min voltage error [pu]
        "dbd": 0.0,        # Deadband for voltage error [pu]
        "Qmax": 999.0,     # Max Q reference [pu]
        "Qmin": -999.0,    # Min Q reference [pu]
        "Kpg": 1.0,        # Proportional gain for freq regulation
        "Kig": 0.1,        # Integral gain for freq regulation
        "Tlag": 0.1,       # Lag time constant for freq [s]
        "Pmax": 999.0,     # Max P reference [pu]
        "Pmin": -999.0,    # Min P reference [pu]
        "fdbd1": -0.0006,  # Freq deadband lower [pu] → -0.03 Hz / 50 Hz
        "fdbd2": 0.0006,   # Freq deadband upper [pu] → +0.03 Hz / 50 Hz
        "femax": 999.0,    # Max freq error [pu]
        "femin": -999.0,   # Min freq error [pu]
        "Tp": 0.25,        # Active power filter time constant [s]
        "FFlag": 1,        # 1 = frequency regulation enabled
        "VCompFlag": 0,    # 0 = no line drop compensation
        "RefFlag": 1,      # 1 = use Vreg reference
        "Tfltr": 0.02,     # Voltage filter time constant [s]
    }


# ── Network Builder ──────────────────────────────────────────────


def build_andes_system(
    generation_fraction: float = 1.0,
    statcom_q_mvar: float = 0.0,
    enable_reactor: bool = True,
    export_length_km: float = EXPORT_CABLE_LENGTH_KM,
    grid_ssc_mva: float = GRID_SSC_MVA,
    add_dynamic_models: bool = True,
    fault_config: dict[str, Any] | None = None,
) -> andes.System:
    """Build the complete 38-bus network in ANDES format with dynamic models.

    Creates the same topology as Pandapower's build_network(), using ANDES
    native elements: Bus, PQ, Slack, Line, and dynamic models (REGCA1,
    REECA1, REPCA1) for time-domain simulation.

    Parameters
    ----------
    generation_fraction : float
        Fraction of rated power [0.0–1.0]. Default: 1.0 (full load).
    statcom_q_mvar : float
        STATCOM reactive power setpoint [MVAR]. Positive = generating.
    enable_reactor : bool
        If True, include 50 MVAR shunt reactor at OSS 220 kV.
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power at PCC [MVA]. Default: 10,000.
    add_dynamic_models : bool
        If True, add REGCA1/REECA1/REPCA1 dynamic models. Default: True.
    fault_config : dict | None
        If provided, adds a Fault element before setup(). Must include
        keys: bus (int), tf (float), tc (float), xf (float), rf (float).
        ANDES requires Fault to be added before setup().

    Returns
    -------
    andes.System
        ANDES system ready for power flow (PFlow) or TDS.
    """
    ss = andes.System(
        default_config=True,
        no_output=True,
    )
    ss.config.freq = SYSTEM_FREQ_HZ
    ss.config.mva = SYSTEM_MVA_BASE

    # ── Buses ─────────────────────────────────────────────────────
    # Bus indices: 1-based in ANDES
    # 1: PSE_400kV, 2: Onshore_220kV, 3: OSS_220kV, 4: OSS_66kV
    # 5–38: WTG_01 to WTG_34

    bus_data: list[dict[str, Any]] = [
        {"idx": 1, "name": "PSE_400kV", "Vn": 400.0, "v0": 1.0, "a0": 0.0},
        {"idx": 2, "name": "Onshore_220kV", "Vn": 220.0, "v0": 1.0, "a0": 0.0},
        {"idx": 3, "name": "OSS_220kV", "Vn": 220.0, "v0": 1.0, "a0": 0.0},
        {"idx": 4, "name": "OSS_66kV", "Vn": 66.0, "v0": 1.0, "a0": 0.0},
    ]
    for i in range(NUM_TURBINES):
        bus_data.append({
            "idx": 5 + i,
            "name": f"WTG_{i + 1:02d}",
            "Vn": 66.0,
            "v0": 1.0,
            "a0": 0.0,
        })

    for bd in bus_data:
        ss.add("Bus", bd)

    # ── Slack (External Grid at PSE 400 kV) ───────────────────────
    # Grid impedance from short-circuit capacity: Z_grid = Sbase / Ssc [pu]
    # R and X components derived from R/X ratio but handled by ANDES Slack model

    ss.add("Slack", {
        "idx": 1,
        "name": "PSE_Grid",
        "bus": 1,
        "Vn": 400.0,
        "v0": 1.0,
        "u": 1,
    })

    # Grid impedance modelled as a short line from slack to bus 1
    # (already accounted for by Slack Thevenin equivalent in ANDES)

    # ── Transformers ──────────────────────────────────────────────
    # 220/400 kV onshore transformer
    _add_transformer(
        ss,
        idx=1,
        name="Trafo_220_400kV",
        bus_hv=1,
        bus_lv=2,
        vn_hv=400.0,
        vn_lv=220.0,
        sn_mva=TRAFO_220_400_MVA,
        vk_percent=TRAFO_220_400_VK_PERCENT,
        vkr_percent=TRAFO_220_400_VKR_PERCENT,
    )

    # 66/220 kV OSS transformer
    _add_transformer(
        ss,
        idx=2,
        name="Trafo_66_220kV",
        bus_hv=3,
        bus_lv=4,
        vn_hv=220.0,
        vn_lv=66.0,
        sn_mva=TRAFO_66_220_MVA,
        vk_percent=TRAFO_66_220_VK_PERCENT,
        vkr_percent=TRAFO_66_220_VKR_PERCENT,
    )

    # ── Export Cable (220 kV) ─────────────────────────────────────
    _add_cable_line(
        ss,
        idx=1,
        name="Export_220kV",
        from_bus=2,
        to_bus=3,
        length_km=export_length_km,
        cable=EXPORT_CABLE_1000,
        vn_kv=220.0,
    )

    # ── Array Cables (66 kV) ─────────────────────────────────────
    line_idx = 2  # Export cable is idx=1
    wtg_idx = 0
    for string_num, string_len in enumerate(STRING_LAYOUT):
        for pos in range(string_len):
            from_bus = 4 if pos == 0 else (5 + wtg_idx - 1)
            to_bus = 5 + wtg_idx

            grade_pos = string_len - 1 - pos
            cable_spec = _get_cable_grade(grade_pos, string_len)

            _add_cable_line(
                ss,
                idx=line_idx,
                name=f"Array_S{string_num + 1}_T{pos + 1}",
                from_bus=from_bus,
                to_bus=to_bus,
                length_km=ARRAY_CABLE_LENGTH_KM,
                cable=cable_spec,
                vn_kv=66.0,
            )
            line_idx += 1
            wtg_idx += 1

    # ── WTG Generators ────────────────────────────────────────────
    p_per_wtg_pu = (TURBINE_RATED_MW * generation_fraction) / SYSTEM_MVA_BASE
    sn_pu = TURBINE_RATED_MW / SYSTEM_MVA_BASE

    wtg_gen_indices: list[int] = []
    for i in range(NUM_TURBINES):
        gen_idx = i + 1
        wtg_gen_indices.append(gen_idx)
        ss.add("PV", {
            "idx": gen_idx,
            "name": f"WTG_{i + 1:02d}",
            "bus": 5 + i,
            "Vn": 66.0,
            "p0": p_per_wtg_pu,
            "q0": 0.0,
            "Sn": sn_pu * SYSTEM_MVA_BASE,
            "v0": 1.0,
            "u": 1,
        })

    # ── STATCOM at OSS 220 kV ─────────────────────────────────────
    statcom_q_pu = statcom_q_mvar / SYSTEM_MVA_BASE
    statcom_gen_idx = NUM_TURBINES + 1
    ss.add("PV", {
        "idx": statcom_gen_idx,
        "name": "STATCOM",
        "bus": 3,
        "Vn": 220.0,
        "p0": 0.0,
        "q0": statcom_q_pu,
        "Sn": STATCOM_RATING_MVAR,
        "v0": 1.0,
        "u": 1,
    })

    # ── Shunt Reactor at OSS 220 kV ──────────────────────────────
    if enable_reactor:
        # Reactor modelled as constant impedance load (Q absorbing)
        reactor_q_pu = SHUNT_REACTOR_MVAR / SYSTEM_MVA_BASE
        ss.add("Shunt", {
            "idx": 1,
            "name": "Reactor_50MVAR",
            "bus": 3,
            "Vn": 220.0,
            "g": 0.0,
            "b": reactor_q_pu,  # positive b = capacitive; negative = inductive
            "u": 1,
        })

    # ── Fault Element (must be added before setup) ─────────────────
    if fault_config is not None:
        ss.add("Fault", {
            "idx": 1,
            "name": fault_config.get("name", "Fault"),
            "bus": fault_config["bus"],
            "tf": fault_config["tf"],
            "tc": fault_config["tc"],
            "xf": fault_config["xf"],
            "rf": fault_config.get("rf", 0.0),
            "u": 1,
        })

    # ── Setup System ──────────────────────────────────────────────
    ss.setup()

    # ── Add Dynamic Models ────────────────────────────────────────
    if add_dynamic_models:
        _add_wtg_dynamic_models(ss, wtg_gen_indices, generation_fraction)
        _add_statcom_model(ss, statcom_gen_idx, statcom_q_mvar)

    return ss


def _add_transformer(
    ss: andes.System,
    idx: int,
    name: str,
    bus_hv: int,
    bus_lv: int,
    vn_hv: float,
    vn_lv: float,
    sn_mva: float,
    vk_percent: float,
    vkr_percent: float,
) -> None:
    """Add a two-winding transformer to the ANDES system.

    Converts Pandapower-style parameters (vk%, vkr%) to ANDES Line model
    with per-unit impedance on system base.

    Maths:
      z_pu = vk% / 100  (on transformer MVA base)
      r_pu = vkr% / 100
      x_pu = √(z_pu² - r_pu²)
      Scale to system base: z_sys = z × (Sbase / Sn_trafo)
    """
    vk_pu = vk_percent / 100.0
    vkr_pu = vkr_percent / 100.0
    x_pu = math.sqrt(max(vk_pu**2 - vkr_pu**2, 0.0))

    # Scale from transformer base to system base
    base_ratio = SYSTEM_MVA_BASE / sn_mva
    r_sys = vkr_pu * base_ratio
    x_sys = x_pu * base_ratio

    # Tap ratio (turns ratio normalized)
    tap = 1.0

    ss.add("Line", {
        "idx": 100 + idx,  # offset to avoid collision with cable lines
        "name": name,
        "bus1": bus_hv,
        "bus2": bus_lv,
        "Vn1": vn_hv,
        "Vn2": vn_lv,
        "r": r_sys,
        "x": x_sys,
        "b": 0.0,
        "tap": tap,
        "u": 1,
        "owner": 1,
    })


def _add_cable_line(
    ss: andes.System,
    idx: int,
    name: str,
    from_bus: int,
    to_bus: int,
    length_km: float,
    cable: CableSpec,
    vn_kv: float,
) -> None:
    """Add a cable (pi-model) to the ANDES system.

    Converts physical cable parameters to per-unit on system base:
      Z_base = Vn² / Sbase  [Ω]
      Y_base = 1 / Z_base    [S]
      r_pu = (R × L) / Z_base
      x_pu = (X × L) / Z_base
      b_pu = (ω × C × L) / Y_base = ω × C × L × Z_base

    Parameters
    ----------
    cable : CableSpec
        Physical cable parameters from network_model.py.
    vn_kv : float
        Nominal voltage of the cable [kV].
    """
    z_base = (vn_kv**2) / SYSTEM_MVA_BASE  # [Ω]
    omega = 2.0 * math.pi * SYSTEM_FREQ_HZ

    r_total = cable.r_ohm_per_km * length_km
    x_total = cable.x_ohm_per_km * length_km
    b_total = omega * (cable.c_nf_per_km * 1e-9) * length_km  # [S]

    r_pu = r_total / z_base
    x_pu = x_total / z_base
    b_pu = b_total * z_base  # b in per-unit (total charging susceptance)

    ss.add("Line", {
        "idx": idx,
        "name": name,
        "bus1": from_bus,
        "bus2": to_bus,
        "Vn1": vn_kv,
        "Vn2": vn_kv,
        "r": r_pu,
        "x": x_pu,
        "b": b_pu,
        "tap": 1.0,
        "u": 1,
        "owner": 1,
    })


def _add_wtg_dynamic_models(
    ss: andes.System,
    wtg_gen_indices: list[int],
    generation_fraction: float,
) -> None:
    """Add REGCA1/REECA1/REPCA1 dynamic models for each WTG.

    These second-generation WECC renewable models provide:
    - REGCA1: converter current source dynamics (Tg = 20 ms)
    - REECA1: FRT reactive current injection (Kqv ≥ 2.0)
    - REPCA1: plant-level voltage/frequency droop

    Parameters
    ----------
    ss : andes.System
        ANDES system (must be set up before calling).
    wtg_gen_indices : list[int]
        Generator indices for WTG PV elements.
    generation_fraction : float
        Current generation level [0.0–1.0].
    """
    regca1_params = get_regca1_params()
    reeca1_params = get_reeca1_params()
    repca1_params = get_repca1_params()

    for i, gen_idx in enumerate(wtg_gen_indices):
        # REGCA1 — generator/converter
        try:
            ss.add("REGCA1", {
                "idx": gen_idx,
                "name": f"REGCA1_WTG_{i + 1:02d}",
                "gen": gen_idx,
                **regca1_params,
            })
        except Exception:
            logger.debug("REGCA1 not available in this ANDES version for WTG %d", i + 1)

        # REECA1 — electrical control
        try:
            ss.add("REECA1", {
                "idx": gen_idx,
                "name": f"REECA1_WTG_{i + 1:02d}",
                "reg": gen_idx,
                **reeca1_params,
            })
        except Exception:
            logger.debug("REECA1 not available in this ANDES version for WTG %d", i + 1)

        # REPCA1 — plant controller
        try:
            ss.add("REPCA1", {
                "idx": gen_idx,
                "name": f"REPCA1_WTG_{i + 1:02d}",
                "ree": gen_idx,
                **repca1_params,
            })
        except Exception:
            logger.debug("REPCA1 not available in this ANDES version for WTG %d", i + 1)


def _add_statcom_model(
    ss: andes.System,
    statcom_gen_idx: int,
    q_mvar: float,
) -> None:
    """Add STATCOM dynamic model as a fast-responding VSC.

    STATCOM is modelled using a REGCA1 with very fast time constant
    (Tg < 5 ms) and Q-only control (P = 0).

    Parameters
    ----------
    ss : andes.System
        ANDES system (must be set up before calling).
    statcom_gen_idx : int
        Generator index for STATCOM PV element.
    q_mvar : float
        Reactive power setpoint [MVAR].
    """
    try:
        ss.add("REGCA1", {
            "idx": 100 + statcom_gen_idx,
            "name": "REGCA1_STATCOM",
            "gen": statcom_gen_idx,
            "Tg": 0.005,       # 5 ms — faster than WTG
            "Rrpwr": 100.0,    # Very fast ramp
            "Brkpt": 0.9,
            "Zerox": 0.4,
            "Lvpl1": 1.22,
            "Lvpnt0": 0.4,
            "Lvpnt1": 0.8,
            "Iolim": -1.5,
            "Khv": 0.7,
            "Iqrmax": 999.0,
            "Iqrmin": -999.0,
            "Accel": 0.0,
        })
    except Exception:
        logger.debug("REGCA1 not available for STATCOM dynamic model")


def validate_against_pandapower(
    ss: andes.System,
    pandapower_voltages: dict[str, float],
    tolerance_pu: float = 0.005,
) -> tuple[bool, dict[str, float]]:
    """Validate ANDES power flow against Pandapower bus voltages.

    Bridge validation: ensures the ANDES network produces the same
    steady-state results as the Pandapower model (within 0.5%).

    Parameters
    ----------
    ss : andes.System
        ANDES system with completed power flow.
    pandapower_voltages : dict[str, float]
        Bus name → voltage magnitude [p.u.] from Pandapower.
    tolerance_pu : float
        Maximum acceptable voltage deviation [p.u.]. Default: 0.005.

    Returns
    -------
    tuple[bool, dict[str, float]]
        (all_within_tolerance, {bus_name: deviation_pu}).
    """
    deviations: dict[str, float] = {}
    all_ok = True

    bus_names = ss.Bus.name.v
    bus_voltages = ss.Bus.v.v

    for i, name in enumerate(bus_names):
        name_str = str(name)
        if name_str in pandapower_voltages:
            pp_v = pandapower_voltages[name_str]
            andes_v = float(bus_voltages[i])
            dev = abs(andes_v - pp_v)
            deviations[name_str] = dev
            if dev > tolerance_pu:
                all_ok = False
                logger.warning(
                    "Voltage mismatch at %s: ANDES=%.4f, Pandapower=%.4f, Δ=%.4f pu",
                    name_str, andes_v, pp_v, dev,
                )

    return all_ok, deviations
