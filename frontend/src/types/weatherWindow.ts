/**
 * TypeScript interfaces for M14 Weather Window & O&M Logistics API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/weather_window.py.
 */

// ── Vessel access probability ────────────────────────────────────

export type VesselType = "CTV" | "SOV" | "JACK_UP" | "HELICOPTER";

export interface AccessProbabilityResponse {
  location: string;
  vessel: VesselType;
  /** 12 values, Jan–Dec [%] */
  monthly_access_pct: number[];
  annual_average_pct: number;
  limiting_parameter: string;
}

export interface SeaIceClimate {
  source: string;
  ice_days_by_winter: Record<string, number>;
  winters: number;
  winters_with_ice: number;
  mean_ice_days: number;
  note: string;
}

export interface AllVesselAccessResponse {
  location: string;
  year: number;
  vessels: AccessProbabilityResponse[];
  /** Source of the measured sea states behind the access (ERA5 hindcast). */
  hindcast?: string;
  sea_ice?: SeaIceClimate | null;
}

// ── O&M cost breakdown ───────────────────────────────────────────

export interface OAMCostBreakdown {
  total_oam_eur: number;
  per_mw_eur: number;
  planned_maintenance_eur: number;
  unplanned_maintenance_eur: number;
  vessel_charter_eur: number;
  heavy_lift_eur: number;
  insurance_eur: number;
  assessment: string;
}

// ── Repair window (POST /maintenance-scheduling) ─────────────────

export interface MaintenanceWindowRequest {
  failure_date_iso: string;
  vessel_type: VesselType;
  /** Uninterrupted work needed [h]. */
  repair_duration_hours: number;
  turbine_id: string;
  /** O&M port to the farm by sea [km]; omitted = SB-510's (Ustka). */
  port_km?: number;
}

export interface MaintenanceWindowResponse {
  turbine_id: string;
  failure_date_iso: string;
  vessel_type: VesselType;
  repair_duration_hours: number;
  estimated_window_start_iso: string;
  wait_days: number;
  total_downtime_days: number;
  access_probability_pct: number;
  port_km: number;
  /** CTV transit one way [h] (0 for vessels that stay offshore). */
  transit_hours: number;
  /** 12 h working day minus the transits [h]. */
  work_hours_per_day: number;
  cost_estimate_eur: number;
  cost_breakdown: Record<string, number>;
}
