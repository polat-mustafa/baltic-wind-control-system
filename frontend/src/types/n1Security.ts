/**
 * N-1 security study types — mirror backend/app/schemas/n1_security.py.
 * Loading in % of rating, voltage in p.u., power in MW.
 */

export interface N1Request {
  generation_fraction: number;
  /** Omitted: the farm's (SB-510 or the X-Farm project). */
  grid_ssc_mva?: number;
}

export interface N1State {
  limiting_element: string;
  loading_pct: number;
  v_min_pu: number;
  v_max_pu: number;
  output_mw: number;
  export_mw: number;
  statcom_q_mvar: number;
  secure: boolean;
}

export interface N1Contingency {
  id: string;
  label: string;
  kind: "preventive" | "corrective";
  converged: boolean;
  immediate: N1State | null;
  after_action: N1State | null;
  lost_mw: number;
  runback_mw: number;
  runback_s: number;
  secure: boolean;
  output_scale: number;
}

export interface N1Response {
  generation_fraction: number;
  grid_ssc_mva: number;
  base_case: N1State | null;
  contingencies: N1Contingency[];
  n1_secure: boolean;
  firm_output_mw: number;
  runback_mw_per_s: number;
  voltage_band_pu: [number, number];
}

/** ANDES RMS event — mirror DynamicsRequest / DynamicsResponse. */
export type DynamicsEvent = "frequency" | "fault";

export interface DynamicsRequest {
  event: DynamicsEvent;
  load_trip_mw: number;
  retained_voltage_pu: number;
}

export interface DynamicsPoint {
  t: number;
  f_hz: number;
  v_poc: number;
  p_mw: number;
  q_mvar: number;
  iq_pu: number;
  p_expected_mw: number | null;
}

export interface DynamicsResponse {
  event: DynamicsEvent;
  p0_mw: number;
  series: DynamicsPoint[];
  load_trip_mw: number | null;
  f_max_hz: number | null;
  f_final_hz: number | null;
  p_min_mw: number | null;
  dp_final_mw: number | null;
  dp_expected_final_mw: number | null;
  response_delay_s: number | null;
  retained_voltage_pu: number | null;
  iq_max_pu: number | null;
  p_recovery_s: number | null;
  recovery_limit_s: number | null;
  stayed_connected: boolean | null;
}
