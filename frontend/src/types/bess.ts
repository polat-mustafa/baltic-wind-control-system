/**
 * TypeScript interfaces for BESS (Battery Energy Storage System) API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/bess.py Pydantic schemas.
 * Spec: 50 MW / 200 MWh LFP, C-rate 0.25, SOC window 10-90%.
 */

// ── BESS Status ───────────────────────────────────────────────────

export interface BESSStatusResponse {
  soc_percent: number;
  power_mw: number;
  reactive_mvar: number;
  mode: string;
  temperature_c: number;
  soh_percent: number;
  cycle_count: number;
  capacity_fade_pct: number;
  rated_power_mw: number;
  rated_energy_mwh: number;
  available_energy_mwh: number;
  alarms_active: boolean;
  assessment?: string;
}

// ── Frequency Response ────────────────────────────────────────────

export interface FrequencyResponseRequest {
  frequency_trace_hz: number[];
  fcr_droop_pct: number;
  ffr_threshold_hz: number;
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
  fcr_activated: boolean;
  ffr_activated: boolean;
  assessment: string;
}

// ── Ramp Smoothing ────────────────────────────────────────────────

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

// ── Degradation ───────────────────────────────────────────────────

export interface DegradationYearPoint {
  year: number;
  soh_percent: number;
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
  total_cycles_to_eol: number;
  replacement_cost_m_eur: number;
  lcoe_contribution_eur_mwh: number;
  assessment: string;
}

// ── Mode Request ──────────────────────────────────────────────────

export interface BESSModeRequest {
  mode: string;
  power_setpoint_mw?: number;
}

// ── Dispatch ──────────────────────────────────────────────────────

export interface BESSDispatchRequest {
  power_mw: number;
  duration_s: number;
}

export interface BESSDispatchResponse {
  dispatched_mw: number;
  duration_s: number;
  energy_delivered_mwh: number;
  soc_start_pct: number;
  soc_end_pct: number;
  assessment: string;
}
