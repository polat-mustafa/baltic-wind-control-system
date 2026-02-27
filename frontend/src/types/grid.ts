/**
 * TypeScript interfaces for P2 HV Grid Integration API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/grid.py Pydantic schemas.
 */

// ── Network Spec ──────────────────────────────────────────────────

export interface NetworkSpec {
  total_capacity_mw: number;
  num_turbines: number;
  num_strings: number;
  string_layout: number[];
  array_voltage_kv: number;
  export_voltage_kv: number;
  grid_voltage_kv: number;
  export_length_km: number;
  grid_ssc_mva: number;
  statcom_rating_mvar: number;
}

// ── Load Flow ─────────────────────────────────────────────────────

export interface BusResult {
  name: string;
  vn_kv: number;
  vm_pu: number;
  va_deg: number;
  p_mw: number;
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
  skss_mw: number;
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
  ferranti_rise_pu: number;
  statcom_rating_mvar: number;
  statcom_q_range_min_mvar: number;
  statcom_q_range_max_mvar: number;
  compensation_adequate: boolean;
  without_compensation_v_max_pu: number;
}

// ── FRT Simulation ───────────────────────────────────────────────

export type FRTType = "lvrt" | "hvrt";

export interface FRTTimePoint {
  time_s: number;
  voltage_pu: number;
  active_power_mw: number;
  reactive_power_mvar: number;
  reactive_current_pu: number;
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
  time_series: FRTTimePoint[];
}

// ── Converter Comparison ────────────────────────────────────────

export type ConverterType = "gfl" | "gfm";

export interface ConverterResult {
  converter_type: ConverterType;
  grid_ssc_mva: number;
  scr: number;
  stable: boolean;
  voltage_deviation_pu: number;
  settling_time_s: number;
  frequency_deviation_hz: number;
}

export interface ConverterComparisonResult {
  scenario: string;
  gfl_result: ConverterResult;
  gfm_result: ConverterResult;
  gfm_advantage: string;
}
