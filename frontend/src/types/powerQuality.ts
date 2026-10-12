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
  /** Max switching operations of one turbine in 10 min / 2 h (IEC 61400-21). */
  n10: number;
  n120: number;
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

// ── Converter–array stability (POST /converter-stability) ─────────────

/** Grid-side converter of one WTG (pu on its own rating) and the study case; every field optional (backend defaults = SB-510). */
export interface ConverterStabilityRequest {
  l_filter_pu?: number;
  c_filter_pu?: number;
  /** Series R of the C_f branch [pu]; null = 1/(3 ω_r C_f), 0 = no damping resistor. */
  damping_r_pu?: number | null;
  f_sw_hz?: number;
  bandwidth_hz?: number;
  feedforward?: number;
  grid_ssc_factor?: number;
  coupler_closed?: boolean;
  turbines_in_service?: number | null;
}

export interface StabilityHarmonicRow {
  bus: string;
  order: number;
  voltage_pct: number;
  limit_pct: number;
  utilisation_pct: number;
}

export interface ConverterStabilityResponse {
  lcl_resonance_hz: number;
  /** Converter admittance is non-passive (negative real part) from this frequency up. */
  non_passive_from_hz: number;
  damping_r_pu: number;
  standalone_stable: boolean;
  standalone_vector_margin: number;
  stable: boolean;
  unstable_poles: number;
  /** Generalized-Nyquist vector margin: closest approach of the loci to −1 [–]. */
  vector_margin: number;
  vector_margin_hz: number;
  phase_margin_deg: number;
  phase_margin_hz: number;
  loci_hz: number[];
  /** min_i |1 + Y·λ_i| per frequency: distance of the characteristic loci from −1 (0 = on the stability boundary). */
  loci_min_distance: number[];
  /** THD per bus with Norton converter models / with ideal current sources / planning limit [%]. */
  thd_norton_pct: Record<string, number>;
  thd_ideal_sources_pct: Record<string, number>;
  thd_limit_pct: Record<string, number>;
  harmonics: StabilityHarmonicRow[];
  assumptions: string[];
}
