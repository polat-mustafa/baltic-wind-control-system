/**
 * TypeScript interfaces for Power Quality & Harmonics (IEC 61000) API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/power_quality.py Pydantic schemas.
 */

// ── Harmonic Analysis ─────────────────────────────────────────────

export interface HarmonicSpectrumRequest {
  harmonic_magnitudes: Record<number, number>;
  voltage_kv: number;
  rated_mw: number;
}

/** HarmonicComponent — matches backend HarmonicComponent schema */
export interface HarmonicEntry {
  order: number;
  magnitude_pct: number;
  frequency_hz: number;
  exceeds_limit: boolean;
  limit_pct: number;
}

export interface HarmonicAnalysisResponse {
  thd_voltage_pct: number;
  thd_current_pct: number;
  dominant_harmonic_order: number;
  dominant_harmonic_pct: number;
  harmonics: HarmonicEntry[];
  compliant: boolean;
  voltage_level: string;
  violations: string[];
  assessment: string;
}

// ── Resonance Scan ────────────────────────────────────────────────

export interface ResonanceScanRequest {
  cable_length_km: number;
  voltage_kv: number;
  grid_fault_level_mva: number;
  scan_max_hz: number;
}

export interface ResonancePoint {
  frequency_hz: number;
  impedance_ohm: number;
  harmonic_order: number;
  risk_level: string;
}

export interface ResonanceScanResponse {
  frequencies_hz: number[];
  impedances_ohm: number[];
  resonance_points: ResonancePoint[];
  cable_resonant_freq_hz: number;
  critical_harmonics: number[];
  assessment: string;
}

// ── Harmonic Limits ───────────────────────────────────────────────

export interface HarmonicLimitEntry {
  order: number;
  limit_lv_pct: number;
  limit_mv_pct: number;
  limit_hv_pct: number;
  characteristic: string;
}

export interface HarmonicLimitsResponse {
  standard: string;
  thd_limit_lv_pct: number;
  thd_limit_mv_pct: number;
  thd_limit_hv_pct: number;
  entries: HarmonicLimitEntry[];
  pse_additional_note: string;
}

// ── Flicker ───────────────────────────────────────────────────────

export interface FlickerRequest {
  rated_mw: number;
  grid_fault_level_mva: number;
  grid_impedance_angle_deg: number;
  annual_switching_operations: number;
}

export interface FlickerResponse {
  pst: number;
  plt: number;
  pst_limit: number;
  plt_limit: number;
  pst_compliant: boolean;
  plt_compliant: boolean;
  dominant_source: string;
  assessment: string;
}

// ── Filter Design ─────────────────────────────────────────────────

export interface FilterDesignRequest {
  dominant_harmonic_order: number;
  harmonic_current_a: number;
  system_voltage_kv: number;
  rated_mvar: number;
}

export interface FilterDesignResponse {
  harmonic_order: number;
  tuned_frequency_hz: number;
  capacitor_mvar: number;
  capacitor_uf: number;
  reactor_mh: number;
  reactor_resistance_ohm: number;
  quality_factor: number;
  insertion_loss_db: number;
  reactive_contribution_mvar: number;
  estimated_loss_kw: number;
  assessment: string;
}
