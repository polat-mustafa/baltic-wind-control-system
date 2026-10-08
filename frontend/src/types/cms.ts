/**
 * Condition Monitoring System (CMS) types — M12.
 *
 * Maps to backend schemas/cms.py and routers/p3/cms.py.
 * Covers vibration (FFT), oil analysis, health index, RUL, and fault injection.
 * Fleet of 34 × 15 MW (IEA 15 MW, direct drive) turbines.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

/** Components monitored per turbine (backend CMS_COMPONENTS). */
export type CMSComponent = "MAIN_BEARING" | "REAR_BEARING" | "GENERATOR" | "PITCH" | "YAW";

/** Health-index bands: GREEN ≥ 80 > YELLOW ≥ 60 > AMBER ≥ 40 > RED ≥ 20 > CRITICAL. */
export type CMSAlertLevel = "GREEN" | "YELLOW" | "AMBER" | "RED" | "CRITICAL";

export type FaultSeverity = "MINOR" | "MODERATE" | "SEVERE";

// ── Component Health ───────────────────────────────────────────────────────────

export interface ComponentHealthSchema {
  component: CMSComponent;
  health_index: number;             // 0-100 (100 = perfect)
  alert_level: CMSAlertLevel;
  vib_rms_mm_s: number;             // Vibration RMS velocity (mm/s)
  temp_celsius: number;             // Operating temperature
  oil_iso_code: string;             // ISO 4406 cleanliness code (e.g. "17/15/12")
  rul_days: number;                 // Remaining Useful Life in days
  last_updated: string | null;      // ISO-8601 UTC
}

export interface TurbineHealthResponse {
  turbine_id: string;               // e.g. "WTG-01"
  overall_health_index: number;
  overall_alert_level: CMSAlertLevel;
  components: ComponentHealthSchema[];
  active_alerts: number;
  last_updated: string | null;
}

export interface TurbineHealthSummary {
  turbine_id: string;
  overall_health_index: number;
  overall_alert_level: CMSAlertLevel;
  worst_component: CMSComponent;
  active_alerts: number;
  component_health: Record<CMSComponent, number>;
}

export interface FleetHealthResponse {
  turbines: TurbineHealthSummary[];
  fleet_average_hi: number;
  turbines_in_warning: number;
  turbines_in_alert: number;
  active_alerts_total: number;
  timestamp_utc: string;
}

// ── Vibration Spectrum ─────────────────────────────────────────────────────────

export interface FFTPoint {
  frequency_hz: number;
  amplitude_mm_s: number;
}

export interface VibrationSpectrumResponse {
  turbine_id: string;
  component: CMSComponent;
  timestamp_utc: string;
  points: FFTPoint[];               // 400 lines: 0–10 Hz (main bearing) / 0–200 Hz
  dominant_frequency_hz: number;
  dominant_amplitude_mm_s: number;
  overall_rms_mm_s: number;
  resolution_hz: number;
  fault_frequency_markers: { freq_hz: number; label: string }[];
}

// ── Oil Analysis ───────────────────────────────────────────────────────────────

export interface OilAnalysisPoint {
  timestamp_utc: string;
  iso_code: string;
  particle_count_4um: number;
  particle_count_6um: number;
  particle_count_14um: number;
  viscosity_cst: number;
  water_ppm: number;
}

export interface OilAnalysisResponse {
  turbine_id: string;
  component: CMSComponent;
  history: OilAnalysisPoint[];
  current_iso_code: string;
  target_iso_code: string;
  water_ingress_alert: boolean;
  next_oil_change_recommendation: string;
}

// ── Alerts ─────────────────────────────────────────────────────────────────────

export interface CMSAlertResponse {
  id: string;                       // UUID
  turbine_id: string;
  component: CMSComponent;
  alert_level: CMSAlertLevel;
  health_index: number;
  rul_days: number;
  vib_rms_mm_s: number;
  temp_celsius: number;
  description: string;
  recommended_action: string;
  resolved: boolean;
  created_at: string;
  resolved_at: string | null;
}

// ── Fault Injection (educational simulation) ───────────────────────────────────

export interface FaultInjectionRequest {
  component: CMSComponent;
  severity: FaultSeverity;
  degradation_rate?: number;        // Health index loss per day (optional)
}

export interface FaultInjectionResponse {
  turbine_id: string;
  component: CMSComponent;
  severity: FaultSeverity;
  degradation_rate_per_day: number;
  initial_health_index: number;
  current_health_index: number;
  estimated_days_to_amber: number;
  estimated_days_to_red: number;
  estimated_days_to_critical: number;
  message: string;
}
