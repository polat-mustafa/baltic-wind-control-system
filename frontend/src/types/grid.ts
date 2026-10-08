/**
 * TypeScript interfaces for P2 HV Grid Integration API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/grid.py Pydantic schemas.
 */

// ── Network Spec ──────────────────────────────────────────────────

/** Electrical design of the modelled farm (backend network_model.FarmSpec / design()). */
export interface NetworkSpec {
  name: string;
  /** reference = SB-510; project = the own farm sent in the X-Farm header. */
  source: "reference" | "project";
  total_capacity_mw: number;
  num_turbines: number;
  num_strings: number;
  string_layout: number[];
  section_a_strings: number;
  max_turbines_per_string: number;
  array_voltage_kv: number;
  export_voltage_kv: number;
  grid_voltage_kv: number;
  array_cable_length_km: number;
  export_length_km: number;
  num_export_cables: number;
  /** Charging power of all export circuits, ωCV²L [MVAR]. */
  cable_q_mvar: number;
  num_oss_transformers: number;
  oss_trafo_mva: number;
  num_onshore_transformers: number;
  onshore_trafo_mva: number;
  grid_ssc_mva: number;
  /** PSE 400 kV connection point (site assessment; SB-510: Krzemienica). */
  grid_node?: string;
  statcom_rating_mvar: number;
  num_reactors: number;
  reactor_unit_mvar: number;
  reactor_total_mvar: number;
}

// ── Load Flow ─────────────────────────────────────────────────────

export interface BusResult {
  name: string;
  vn_kv: number;
  /** 0 when the bus is de-energised (e.g. the tripped string in N-1). */
  vm_pu: number;
  va_deg: number;
  /** Net injection, generating positive [MW]. */
  p_mw: number;
  /** Net injection, generating positive [MVAR] (Rule 4). */
  q_mvar: number;
}

export interface LineResult {
  name: string;
  from_bus: string;
  to_bus: string;
  loading_percent: number;
  p_from_mw: number;
  q_from_mvar: number;
  pl_mw: number;
  ql_mvar: number;
}

export interface TransformerResult {
  name: string;
  loading_percent: number;
  p_hv_mw: number;
  q_hv_mvar: number;
  pl_mw: number;
  ql_mvar: number;
}

export type LoadFlowScenario =
  | "full_load"
  | "partial_load"
  | "no_load"
  | "n_minus_1";

export interface LoadFlowResult {
  scenario: LoadFlowScenario;
  converged: boolean;
  v_min_pu: number;
  v_max_pu: number;
  total_loss_mw: number;
  total_generation_mw: number;
  /** Delivered to PSE 400 kV [MW]. */
  poc_p_mw: number;
  /** Delivered to PSE 400 kV [MVAR], generating positive. */
  poc_q_mvar: number;
  statcom_q_mvar: number;
  voltage_compliant: boolean;
  buses: BusResult[];
  lines: LineResult[];
  transformers: TransformerResult[];
}

// ── Short-Circuit (IEC 60909) ────────────────────────────────────

export interface ShortCircuitBusResult {
  bus_name: string;
  vn_kv: number;
  ikss_ka: number;
  ip_ka: number;
  /** Short-circuit power Sk'' [MVA] (field name kept from pandapower). */
  skss_mw: number;
  /** Rated breaking current [kA]. */
  breaker_ka: number;
  /** Rated making current = 2.5 × breaking [kA]. */
  making_ka: number;
}

export interface ShortCircuitResult {
  case: string;
  voltage_factor_c: number;
  bus_results: ShortCircuitBusResult[];
  max_ikss_ka: number;
  max_ikss_bus: string;
  breaker_adequate: boolean;
}

// ── STATCOM Sizing ───────────────────────────────────────────────

export interface STATCOMSizingResult {
  cable_q_mvar: number;
  reactor_q_mvar: number;
  /** Rise along the open-ended cable itself, 1/cos(βL) − 1. */
  ferranti_rise_pu: number;
  /** Rise with no compensation: charging current through transformers + grid. */
  uncompensated_rise_pu: number;
  statcom_rating_mvar: number;
  statcom_q_range_min_mvar: number;
  statcom_q_range_max_mvar: number;
  compensation_adequate: boolean;
  without_compensation_v_max_pu: number;
  /** Worst STATCOM Q with one shunt reactor out [MVAR], negative = absorbing */
  reactor_n1_statcom_q_mvar: number;
  /** One reactor out: voltage compliant and STATCOM not saturated */
  reactor_n1_secure: boolean;
  /** Reactive range deliverable at the PSE 400 kV POC at P_max [MVAR]. */
  poc_q_max_mvar: number;
  poc_q_min_mvar: number;
  /** PSE requirement +0.40 / −0.35 · P_max [MVAR]. */
  pse_q_max_mvar: number;
  pse_q_min_mvar: number;
  pse_q_range_met: boolean;
  wtg_q_capability_mvar: number;
}

// ── FRT Simulation ───────────────────────────────────────────────

export type FRTType = "lvrt" | "hvrt";

export type FaultBus = "PSE_400kV" | "Onshore_220kV" | "OSS_220kV" | "OSS_66kV";

export interface FRTParams {
  faultBus: FaultBus;
  /** Fault impedance on 100 MVA base [pu], 0 = bolted. */
  faultImpedancePu: number;
  faultDurationS: number;
  kFactor: number;
}

export interface FRTTimePoint {
  time_s: number;
  /** Connection point (PSE 400 kV) voltage [pu]. */
  voltage_pu: number;
  /** WTG terminals (aggregated at OSS 66 kV) [pu]. */
  terminal_voltage_pu: number;
  active_power_mw: number;
  reactive_power_mvar: number;
  reactive_current_pu: number;
  statcom_q_mvar: number;
}

export interface FRTEnvelopePoint {
  time_s: number;
  voltage_pu: number;
}

export interface FRTSimulationResult {
  frt_type: FRTType;
  fault_bus: string;
  fault_duration_s: number;
  stayed_connected: boolean;
  reactive_current_compliant: boolean;
  reactive_current_gain: number;
  recovery_time_s: number;
  recovery_compliant: boolean;
  statcom_peak_q_mvar: number;
  k_factor: number;
  retained_voltage_pu: number;
  terminal_voltage_pu: number;
  passive_voltage_pu: number;
  recovery_limit_s: number;
  /** PSE type-D profile in simulation time (LVRT only). */
  envelope: FRTEnvelopePoint[];
  time_series: FRTTimePoint[];
}

// ── Converter Comparison ────────────────────────────────────────

export type ConverterType = "gfl" | "gfm";

export type GridStrength = "strong_grid" | "weak_grid" | "very_weak_grid";

export interface ConverterResult {
  converter_type: ConverterType;
  grid_ssc_mva: number;
  /** SCR at the PSE 400 kV POC. */
  scr: number;
  /** SCR at the 66 kV busbar (farm impedance included). */
  scr_terminal: number;
  stable: boolean;
  voltage_deviation_pu: number;
  settling_time_s: number;
  frequency_deviation_hz: number;
  peak_current_pu: number;
  power_swing_mw: number;
}

/** Values are null after that converter lost synchronism (the trace stops). */
export interface ConverterTimePoint {
  time_s: number;
  gfl_p_mw: number | null;
  gfm_p_mw: number | null;
  gfl_f_hz: number | null;
  gfm_f_hz: number | null;
  gfl_i_pu: number | null;
  gfm_i_pu: number | null;
}

export interface ConverterComparisonResult {
  scenario: string;
  gfl_result: ConverterResult;
  gfm_result: ConverterResult;
  gfm_advantage: string;
  phase_jump_deg: number;
  time_series: ConverterTimePoint[];
}
