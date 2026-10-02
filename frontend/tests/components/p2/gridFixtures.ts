/**
 * Small, physically consistent P2 grid results for component tests
 * (numbers taken from the backend's default runs, trimmed).
 */

import type {
  ConverterComparisonResult,
  FRTSimulationResult,
  LoadFlowResult,
  LoadFlowScenario,
  ShortCircuitResult,
  STATCOMSizingResult,
} from "../../../src/types/grid";

const bus = (name: string, vn_kv: number, vm_pu: number) => ({ name, vn_kv, vm_pu, va_deg: 0, p_mw: 0, q_mvar: 0 });

function loadFlow(scenario: LoadFlowScenario, gen: number, v: number, loading: number): LoadFlowResult {
  return {
    scenario,
    converged: true,
    v_min_pu: v - 0.002,
    v_max_pu: v + 0.002,
    total_loss_mw: gen * 0.0125,
    total_generation_mw: gen,
    poc_p_mw: gen * 0.9875,
    poc_q_mvar: -42,
    statcom_q_mvar: 55.5,
    voltage_compliant: true,
    buses: [
      bus("PSE_400kV", 400, 1.0),
      bus("Onshore_220kV", 220, v),
      { ...bus("OSS_220kV", 220, v), q_mvar: -184 },
      bus("OSS_66kV", 66, v),
      bus("WTG_01", 66, v),
      bus("WTG_06", 66, scenario === "n_minus_1" ? 0 : v - 0.002),
    ],
    lines: [
      { name: "Export_220kV", from_bus: "Onshore_220kV", to_bus: "OSS_220kV", loading_percent: loading, p_from_mw: -gen, q_from_mvar: -18, pl_mw: 2.9, ql_mvar: -245 },
      { name: "Array_S1_T1", from_bus: "OSS_66kV", to_bus: "WTG_01", loading_percent: loading + 10, p_from_mw: -gen / 6, q_from_mvar: -2, pl_mw: 0.09, ql_mvar: -0.2 },
    ],
    transformers: [
      { name: "Trafo_220_400kV", loading_percent: loading + 7, p_hv_mw: -gen, q_hv_mvar: 42, pl_mw: 0.95, ql_mvar: 60 },
      { name: "Trafo_66_220kV", loading_percent: loading + 8, p_hv_mw: -gen, q_hv_mvar: 43, pl_mw: 1.2, ql_mvar: 54 },
    ],
  };
}

export const loadFlowResults: LoadFlowResult[] = [
  loadFlow("full_load", 510, 0.998, 76.9),
  loadFlow("partial_load", 255, 1.0, 48.3),
  loadFlow("no_load", 0, 1.006, 31.2),
  loadFlow("n_minus_1", 435, 0.999, 68.0),
];

export const shortCircuit: ShortCircuitResult = {
  case: "max",
  voltage_factor_c: 1.1,
  max_ikss_ka: 21.42,
  max_ikss_bus: "OSS_66kV",
  breaker_adequate: true,
  bus_results: [
    { bus_name: "PSE_400kV", vn_kv: 400, ikss_ka: 15.34, ip_ka: 36.9, skss_mw: 10630, breaker_ka: 50, making_ka: 125 },
    { bus_name: "OSS_66kV", vn_kv: 66, ikss_ka: 21.42, ip_ka: 50.48, skss_mw: 2449, breaker_ka: 25, making_ka: 62.5 },
  ],
};

export const statcomSizing: STATCOMSizingResult = {
  cable_q_mvar: 260,
  reactor_q_mvar: 240,
  ferranti_rise_pu: 0.0071,
  uncompensated_rise_pu: 0.0808,
  statcom_rating_mvar: 120,
  statcom_q_range_min_mvar: -120,
  statcom_q_range_max_mvar: 120,
  compensation_adequate: true,
  without_compensation_v_max_pu: 1.0808,
  reactor_n1_statcom_q_mvar: -80,
  reactor_n1_secure: true,
  poc_q_max_mvar: 373.6,
  poc_q_min_mvar: -422.9,
  pse_q_max_mvar: 204,
  pse_q_min_mvar: -178.5,
  pse_q_range_met: true,
  wtg_q_capability_mvar: 4.95,
};

const frtPoint = (time_s: number, v: number, vt: number, p: number, q: number, iq: number) => ({
  time_s,
  voltage_pu: v,
  terminal_voltage_pu: vt,
  active_power_mw: p,
  reactive_power_mvar: q,
  reactive_current_pu: iq,
  statcom_q_mvar: iq * 70,
});

export const frtResult: FRTSimulationResult = {
  frt_type: "lvrt",
  fault_bus: "PSE_400kV",
  fault_duration_s: 0.15,
  stayed_connected: true,
  reactive_current_compliant: true,
  reactive_current_gain: 2.0,
  recovery_time_s: 0.455,
  recovery_compliant: true,
  statcom_peak_q_mvar: 58.9,
  k_factor: 2,
  retained_voltage_pu: 0.327,
  terminal_voltage_pu: 0.304,
  passive_voltage_pu: 0.333,
  recovery_limit_s: 5,
  envelope: [
    { time_s: 0.2, voltage_pu: 0 },
    { time_s: 0.35, voltage_pu: 0 },
    { time_s: 2.7, voltage_pu: 0.85 },
    { time_s: 2.95, voltage_pu: 0.85 },
  ],
  time_series: [
    frtPoint(0, 1, 1, 510, 54, 0.1),
    frtPoint(0.2, 0.327, 0.304, 140, 30, 0.2),
    frtPoint(0.34, 0.348, 0.564, 169, 232, 0.81),
    frtPoint(0.36, 1.016, 1.089, 335, 141, 0.25),
    frtPoint(1.0, 1, 1, 510, 54, 0.1),
  ],
};

export const converterComparison: ConverterComparisonResult = {
  scenario: "strong_grid",
  phase_jump_deg: 20,
  gfm_advantage: "20° grid phase jump, SCR 19.6 at the POC → 3.3 at the 66 kV busbar.",
  gfl_result: {
    converter_type: "gfl",
    grid_ssc_mva: 10000,
    scr: 19.61,
    scr_terminal: 3.29,
    stable: true,
    voltage_deviation_pu: 0.115,
    settling_time_s: 0.006,
    frequency_deviation_hz: 5.33,
    peak_current_pu: 1.006,
    power_swing_mw: 10.3,
  },
  gfm_result: {
    converter_type: "gfm",
    grid_ssc_mva: 10000,
    scr: 19.61,
    scr_terminal: 3.29,
    stable: true,
    voltage_deviation_pu: 0.02,
    settling_time_s: 0.626,
    frequency_deviation_hz: 0.27,
    peak_current_pu: 1.105,
    power_swing_mw: 391.1,
  },
  time_series: [
    { time_s: 0, gfl_p_mw: 510, gfm_p_mw: 510, gfl_f_hz: 50, gfm_f_hz: 50, gfl_i_pu: 1, gfm_i_pu: 1 },
    { time_s: 0.1, gfl_p_mw: 505, gfm_p_mw: 900, gfl_f_hz: 55, gfm_f_hz: 49.8, gfl_i_pu: 1, gfm_i_pu: 1.1 },
    { time_s: 1.0, gfl_p_mw: 510, gfm_p_mw: 510, gfl_f_hz: 50, gfm_f_hz: 50, gfl_i_pu: 1, gfm_i_pu: 1 },
  ],
};

/** Everything a grid panel may read from the store, as returned by a mocked useGridStore(). */
export const gridState = {
  loadFlowResults,
  shortCircuit,
  statcomSizing,
  frtResult,
  converterComparison,
  activeScenario: "full_load" as LoadFlowScenario,
  frtType: "lvrt" as const,
  frtParams: { faultBus: "PSE_400kV" as const, faultImpedancePu: 0.005, faultDurationS: 0.15, kFactor: 2 },
  converterScenario: "strong_grid" as const,
  phaseJumpDeg: 20,
  frtLoading: false,
  converterLoading: false,
  setActiveScenario: () => {},
  setFrtType: () => {},
  setFrtParams: () => {},
  setConverterScenario: () => {},
  setPhaseJumpDeg: () => {},
  runFrt: async () => {},
  runConverter: async () => {},
};
