/**
 * Cable DTS API types — mirror backend/app/schemas/cable_dts.py.
 * One circuit of the 220 kV export cable; currents are per circuit.
 */

export interface DTSProfilePoint {
  distance_km: number;
  zone: string;
  fibre_temp_c: number;
  conductor_temp_c: number;
}

export interface DTSZone {
  name: string;
  start_km: number;
  end_km: number;
  r_ext_k_m_per_w: number;
  max_conductor_c: number;
  max_fibre_c: number;
  rating_a: number;
}

export interface RatingCurve {
  ambient_c: number[];
  zones: { name: string; rating_a: number[] }[];
}

/** Export circuits of the modelled farm (GET /cable/dts/farm). */
export interface DTSFarm {
  name: string;
  capacity_mw: number;
  cable_length_km: number;
  num_circuits: number;
  /** Per-circuit current at full output, OSS end (full-load load flow) [A]. */
  normal_current_a: number;
  /** Survivor current after one circuit trips; null with one circuit. */
  n1_current_a: number | null;
}

export interface DTSProfileResponse {
  current_a: number;
  ambient_temp_c: number;
  num_circuits: number;
  cable_length_km: number;
  profile: DTSProfilePoint[];
  zones: DTSZone[];
  max_conductor_c: number;
  max_location_km: number;
  alarm_length_km: number;
  joule_loss_w_per_m: number;
  dielectric_loss_w_per_m: number;
  static_rating_a: number;
  rating_at_ambient_a: number;
  limiting_zone: string;
  export_capability_mva: number;
  rating_curve: RatingCurve;
  assessment: string;
}

export interface DTSTransientRequest {
  prefault_current_a: number;
  emergency_current_a: number;
  ambient_temp_c: number;
  duration_h?: number;
}

export interface TransientZone {
  name: string;
  tau_ext_h: number;
  conductor_temp_c: number[];
  minutes_to_limit: number | null;
  steady_state_c: number | null;
}

export interface DTSTransientResponse {
  prefault_current_a: number;
  emergency_current_a: number;
  ambient_temp_c: number;
  time_h: number[];
  zones: TransientZone[];
  allowed_minutes: number | null;
  limiting_zone: string | null;
  assessment: string;
}

// ── IEC 60287 rating per export route section (GET /grid/cable/route-rating) ──

export interface RouteSection {
  section: string;
  cable: string;
  installation: string;
  ambient_c: number;
  rating_a: number;
  /** External thermal resistance T4 [K·m/W]. */
  t4_k_m_w: number;
  /** Sheath / armour loss factors λ1, λ2 [–]. */
  lambda1: number;
  lambda2: number;
}

export interface HddOption {
  option: string;
  rating_a: number;
}

/** One section through the 30-year wind hindcast (conductor temperature with its thermal time constant). */
export interface SectionLoadProfile {
  section: string;
  steady_rating_a: number;
  full_output_current_a: number;
  peak_conductor_c: number;
  hours_above_90c: number;
  tau_ext_h: number;
}

export interface RouteRatingResponse {
  sections: RouteSection[];
  hdd_options: HddOption[];
  load_profile: SectionLoadProfile[];
  /** IEC 60853-2 cyclic factor of the subsea section: 6 h at full output after the hindcast's mean μ. */
  subsea_cyclic: { loss_load_factor: number; cyclic_factor_m: number };
  datasheet_rating_a: number;
  calibrated_t2_k_m_w: number;
  verification: { case: string; rating_a: number; reference_a: number };
}
