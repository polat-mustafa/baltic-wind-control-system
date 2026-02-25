"""
NC RfG Type D dynamic compliance orchestrator for 510 MW offshore wind farm.

Top-level entry point that runs all P2B dynamic simulations and produces
a complete compliance report for ENTSO-E NC RfG Type D requirements.

Physics — Dynamic Compliance Overview
---------------------------------------
A Type D generating facility (>75 MW at ≥110 kV) must demonstrate compliance
with all dynamic requirements before grid connection:

1. **Fault Ride-Through (FRT)**: Stay connected during grid faults, inject
   reactive current, recover active power quickly.

2. **Frequency Response**: Reduce power during overfrequency (LFSM-O),
   increase power during underfrequency (LFSM-U), provide droop response
   (FSM), and withstand rapid frequency changes (RoCoF).

3. **Sub-Synchronous Oscillation (SSO)**: No adverse interaction between
   converter controls and the AC network at sub-synchronous frequencies.

4. **Converter Stability**: Demonstrate stable operation at the actual
   grid strength (SCR) and under contingency conditions.

Standard — ENTSO-E NC RfG Type D
-----------------------------------
- Article 13: General requirements (frequency, voltage, RoCoF)
- Article 14: Voltage stability (reactive power capability)
- Article 15: Frequency stability (LFSM-O, LFSM-U, FSM)
- Article 20: Fault ride-through (LVRT/HVRT profiles)
- Article 21: Reactive current injection during faults
- PSE IRiESP: Polish-specific adaptations and voltage-time profiles

Maths — Compliance Matrix
---------------------------
Each check produces a boolean pass/fail:
  overall_compliant = LVRT ∧ HVRT ∧ LFSM-O ∧ LFSM-U ∧ FSM ∧ RoCoF ∧ SSO

All checks must pass for the generating facility to receive grid connection
approval from the TSO (PSE).

Code — Orchestration Pattern
-------------------------------
The orchestrator:
1. Runs each P2B simulation module in sequence
2. Collects results into a unified report
3. Determines overall compliance
4. Returns a DynamicComplianceResponse schema

All simulation parameters use defaults from the Baltic Wind Alpha
specification unless overridden by the caller.

References
----------
- ENTSO-E NC RfG (EU 2016/631): Articles 13–21
- PSE IRiESP: Polish transmission grid code
- CIGRE TB 671: Connection of wind farms to weak AC networks
"""

from __future__ import annotations

import logging

from app.schemas.grid import (
    DynamicComplianceResponse,
    FrequencyMode,
    FRTType,
)
from app.services.p2.converter_comparison import get_comparison_response
from app.services.p2.frequency_response import run_frequency_response
from app.services.p2.frt_simulation import run_frt_simulation
from app.services.p2.network_model import EXPORT_CABLE_LENGTH_KM, GRID_SSC_MVA
from app.services.p2.sso_analysis import run_sso_screening

logger = logging.getLogger(__name__)


def run_full_compliance_assessment(
    export_length_km: float = EXPORT_CABLE_LENGTH_KM,
    grid_ssc_mva: float = GRID_SSC_MVA,
    generation_fraction: float = 1.0,
) -> DynamicComplianceResponse:
    """Run complete NC RfG Type D dynamic compliance assessment.

    Executes all P2B simulations in sequence:
    1. LVRT simulation (three-phase fault at OSS 66 kV)
    2. HVRT simulation (voltage swell at OSS 66 kV)
    3. LFSM-O (overfrequency power reduction)
    4. LFSM-U (underfrequency power increase)
    5. FSM (droop-based frequency response)
    6. RoCoF withstand (2 Hz/s for 500 ms)
    7. SSO screening (impedance + eigenvalue analysis)
    8. GFL vs GFM converter comparison

    Parameters
    ----------
    export_length_km : float
        Export cable length [km]. Default: 45.0.
    grid_ssc_mva : float
        Grid short-circuit power [MVA]. Default: 10,000.
    generation_fraction : float
        Operating generation level for simulations. Default: 1.0.

    Returns
    -------
    DynamicComplianceResponse
        Complete compliance report with per-check results and overall verdict.
    """
    logger.info("Starting NC RfG Type D dynamic compliance assessment")

    # ── 1. LVRT ───────────────────────────────────────────────────
    logger.info("Running LVRT simulation...")
    lvrt = run_frt_simulation(
        frt_type=FRTType.LVRT,
        fault_bus="OSS_66kV",
        fault_impedance_pu=0.05,
        fault_duration_s=0.150,
        generation_fraction=generation_fraction,
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
    )

    # ── 2. HVRT ───────────────────────────────────────────────────
    logger.info("Running HVRT simulation...")
    hvrt = run_frt_simulation(
        frt_type=FRTType.HVRT,
        fault_bus="OSS_66kV",
        fault_duration_s=0.100,
        generation_fraction=generation_fraction,
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
    )

    # ── 3. LFSM-O ────────────────────────────────────────────────
    logger.info("Running LFSM-O simulation...")
    lfsm_o = run_frequency_response(
        mode=FrequencyMode.LFSM_O,
        freq_step_hz=0.5,
        droop_pct=5.0,
        generation_fraction=generation_fraction,
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
    )

    # ── 4. LFSM-U ────────────────────────────────────────────────
    logger.info("Running LFSM-U simulation...")
    lfsm_u = run_frequency_response(
        mode=FrequencyMode.LFSM_U,
        freq_step_hz=0.5,
        droop_pct=5.0,
        generation_fraction=0.8,  # 80% to have headroom for increase
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
    )

    # ── 5. FSM ────────────────────────────────────────────────────
    logger.info("Running FSM droop simulation...")
    fsm = run_frequency_response(
        mode=FrequencyMode.FSM,
        freq_step_hz=0.3,
        droop_pct=5.0,
        generation_fraction=generation_fraction,
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
    )

    # ── 6. RoCoF ──────────────────────────────────────────────────
    logger.info("Running RoCoF withstand simulation...")
    rocof = run_frequency_response(
        mode=FrequencyMode.ROCOF,
        generation_fraction=generation_fraction,
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
    )

    # ── 7. SSO Screening ─────────────────────────────────────────
    logger.info("Running SSO screening...")
    sso = run_sso_screening(
        export_length_km=export_length_km,
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=generation_fraction,
    )

    # ── 8. Converter Comparison ───────────────────────────────────
    logger.info("Running GFL vs GFM comparison...")
    converter = get_comparison_response(
        scenario="nominal_grid",
        grid_ssc_mva=grid_ssc_mva,
        generation_fraction=generation_fraction,
        export_length_km=export_length_km,
    )

    # ── Overall Compliance ────────────────────────────────────────
    overall = (
        lvrt.stayed_connected
        and lvrt.reactive_current_compliant
        and lvrt.recovery_compliant
        and hvrt.stayed_connected
        and lfsm_o.compliant
        and lfsm_u.compliant
        and fsm.compliant
        and rocof.compliant
        and sso.stable
    )

    logger.info(
        "Dynamic compliance assessment complete — overall: %s",
        "PASS" if overall else "FAIL",
    )

    return DynamicComplianceResponse(
        lvrt=lvrt,
        hvrt=hvrt,
        lfsm_o=lfsm_o,
        lfsm_u=lfsm_u,
        fsm=fsm,
        rocof=rocof,
        sso=sso,
        converter_comparison=converter,
        overall_compliant=overall,
    )
