/**
 * TypeScript interfaces for Cable DTS (Distributed Temperature Sensing) API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/cable_dts.py Pydantic schemas.
 */

// ── Profile ───────────────────────────────────────────────────────

export interface DTSProfilePoint {
  distance_km: number;
  temperature_c: number;
  loading_percent: number;
  is_hotspot: boolean;
}

export interface DTSProfileResponse {
  current_a: number;
  ambient_temp_c: number;
  cable_length_km: number;
  n_points: number;
  profile: DTSProfilePoint[];
  max_temp_c: number;
  max_temp_location_km: number;
  hotspot_count: number;
  static_rating_a: number;
  assessment: string;
}

// ── Dynamic Rating ─────────────────────────────────────────────────

export interface DynamicRatingResponse {
  current_a: number;
  ambient_temp_c: number;
  static_rating_a: number;
  dynamic_rating_a: number;
  headroom_a: number;
  headroom_pct: number;
  thermal_utilisation_pct: number;
  assessment: string;
}

// ── Hotspots ───────────────────────────────────────────────────────

export interface HotspotEntry {
  distance_km: number;
  temperature_c: number;
  loading_percent: number;
  severity: string;
  cause: string;
}

export interface HotspotResponse {
  current_a: number;
  hotspots: HotspotEntry[];
  hotspot_count: number;
  max_severity: string;
  assessment: string;
}
