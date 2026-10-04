/**
 * N-1 security study types — mirror backend/app/schemas/n1_security.py.
 * Loading in % of rating, voltage in p.u., power in MW.
 */

export interface N1Request {
  generation_fraction: number;
  grid_ssc_mva: number;
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
