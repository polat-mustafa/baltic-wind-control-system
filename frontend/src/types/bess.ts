/**
 * BESS API types — mirror backend/app/schemas/bess.py.
 * 50 MW / 200 MWh LFP; battery power positive = discharging.
 */

export interface FrequencyResponseRequest {
  frequency_trace_hz: number[];
  fcr_capacity_mw: number;
  ffr_threshold_hz: number | null;
  initial_soc_pct: number;
}

export interface FrequencyResponseResult {
  time_s: number[];
  frequency_hz: number[];
  bess_power_mw: number[];
  soc_percent: number[];
  nadir_hz: number;
  nadir_time_s: number;
  energy_delivered_mwh: number;
  energy_absorbed_mwh: number;
  fcr_endurance_min: number;
  fcr_activated: boolean;
  ffr_activated: boolean;
  assessment: string;
}

export interface RampSmoothingRequest {
  wind_power_trace_mw: number[];
  max_ramp_rate_mw_per_min: number;
  initial_soc_pct: number;
}

export interface RampSmoothingResult {
  wind_power_mw: number[];
  bess_power_mw: number[];
  smoothed_output_mw: number[];
  soc_percent: number[];
  ramp_violations_before: number;
  ramp_violations_after: number;
  peak_bess_charge_mw: number;
  peak_bess_discharge_mw: number;
  assessment: string;
}

export interface DegradationYearPoint {
  year: number;
  soh_percent: number;
  cycle_loss_pct: number;
  calendar_loss_pct: number;
  cumulative_cycles: number;
  capacity_mwh: number;
}

export interface DegradationRequest {
  years: number;
  annual_cycles: number;
  avg_dod_pct: number;
}

export interface DegradationResponse {
  projection: DegradationYearPoint[];
  eol_year: number;
  eol_reached: boolean;
  total_cycles_to_eol: number;
  replacement_cost_m_eur: number;
  lcoe_contribution_eur_mwh: number;
  assessment: string;
}

export interface BESSDispatchRequest {
  p_target_mw: number;
  p_available_wtg_mw: number;
  current_soc_pct: number;
}

export interface BESSDispatchResponse {
  p_target_mw: number;
  p_wtg_dispatch_mw: number;
  p_bess_mw: number;
  p_poc_mw: number;
  soc_after_pct: number;
  bess_mode: string;
  dispatch_feasible: boolean;
  notes: string;
}
