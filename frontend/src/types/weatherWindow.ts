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

export interface AllVesselAccessResponse {
  location: string;
  year: number;
  vessels: AccessProbabilityResponse[];
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
