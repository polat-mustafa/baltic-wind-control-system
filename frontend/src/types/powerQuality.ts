/**
 * TypeScript interfaces for Power Quality & Harmonics (IEC 61000) API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/power_quality.py Pydantic schemas.
 */

// ── Harmonic Analysis ─────────────────────────────────────────────

export interface HarmonicSpectrumRequest {
  /** WTG current emission {order: % of rated current} (IEC 61400-21 style). */
  harmonic_magnitudes: Record<number, number>;
  /** Assessed bus: 400 = POC, 220 = OSS 220 kV, 66 = OSS 66 kV. */
  voltage_kv: number;
  rated_mw: number;
  grid_fault_level_mva?: number;
}

/** HarmonicComponent — matches backend HarmonicComponent schema */
export interface HarmonicEntry {
  order: number;
  frequency_hz: number;
  /** WTG emission [% of rated current]. */
  current_pct: number;
  /** Harmonic voltage at the assessed bus [% of U1]. */
  magnitude_pct: number;
  voltage_66kv_pct: number;
  /** |Z(h)| seen from OSS 66 kV [Ω]. */
  impedance_ohm: number;
  /** IEC TR 61000-3-6 planning level at the assessed bus [%]. */
  limit_pct: number;
  utilisation_pct: number;
  exceeds_limit: boolean;
}

export interface HarmonicAnalysisResponse {
  thd_voltage_pct: number;
  thd_current_pct: number;
  dominant_harmonic_order: number;
  dominant_harmonic_pct: number;
  harmonics: HarmonicEntry[];
  compliant: boolean;
  voltage_level: string;
  bus: string;
  thd_limit_pct: number;
  worst_utilisation_pct: number;
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
  /** |Z(f)| / (h · |Z(50 Hz)|). */
  amplification: number;
  risk_level: string;
}

export interface ResonanceScanResponse {
  frequencies_hz: number[];
  impedances_ohm: number[];
  resonance_points: ResonancePoint[];
  cable_resonant_freq_hz: number;
  critical_harmonics: number[];
  viewpoint: string;
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
  pst_continuous: number;
  pst_switching: number;
  flicker_coefficient: number;
  switching_coefficient: number;
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
  network_impedance_ohm: number;
  assessment: string;
}
