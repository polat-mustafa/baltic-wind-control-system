/** Types for /api/v1/lifecycle (backend app/schemas/lifecycle.py). Days from campaign start, M€. */

export type VesselId = "HLV" | "WTIV" | "CLV" | "CTV" | "SURVEY";

export interface Percentiles {
  p10: number;
  p50: number;
  p90: number;
}

export interface VesselLimit {
  vessel: VesselId;
  hs_m: number;
  wind_ms: number;
}

export interface CampaignRequest {
  mode: "install" | "remove";
  n_turbines: number;
  strings?: number[];
  array_km?: number;
  export_km: number;
  /** Installation port to the site by sea [km]; backend default = SB-510 (Rønne). */
  port_km?: number;
  foundation: "monopile" | "jacket";
  start_date: string;
  alpha: number;
  runs: number;
  seed?: number;
  remove_foundations?: "cut" | "full";
  remove_array?: boolean;
  remove_export?: boolean;
  remove_scour?: boolean;
  limits?: VesselLimit[];
}

export interface Milestone {
  id: string;
  label: string;
  days: Percentiles;
  date_p50: string;
  date_p90: string;
}

export interface CampaignActivity {
  id: string;
  name: string;
  vessel: VesselId;
  units: number;
  op_hours: number;
  trip_every: number;
  /** Port round trip: loading at the quay + sailing out and back [h]. */
  trip_hours: number;
  start_day: number;
  end_day: number;
  wow_days: number;
  end_days: Percentiles;
  wow_share_pct: number;
  duration_days: Percentiles;
}

export interface CampaignVessel {
  id: VesselId;
  name: string;
  role: string;
  hs_limit_m: number;
  wind_limit_ms: number;
  wind_reference: string;
  day_rate_keur: number;
  mobilisation_keur: number;
  /** Transit speed [km/h] (NREL ORBIT vessel library, WOMBAT CTV). */
  transit_kmh: number;
  workable_pct_by_month: (number | null)[];
  window_hours: number;
  window_pct_by_month: (number | null)[];
  charter_days: Percentiles;
  wow_days: Percentiles;
  cost_meur: Percentiles;
}

export interface CampaignResult {
  mode: "install" | "remove";
  start_date: string;
  alpha: number;
  runs: number;
  seed: number;
  n_turbines: number;
  strings: number[];
  unfinished_runs: number;
  total_days: Percentiles;
  cost_meur: Percentiles;
  milestones: Milestone[];
  activities: CampaignActivity[];
  vessels: CampaignVessel[];
  months: string[];
  assumptions: string[];
}
