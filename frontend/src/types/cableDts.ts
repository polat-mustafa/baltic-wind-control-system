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

export interface DTSProfileResponse {
  current_a: number;
  ambient_temp_c: number;
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
