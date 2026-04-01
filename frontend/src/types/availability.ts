/**
 * TypeScript interfaces for M13 Availability Tracking API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/availability.py (IEC 61400-26).
 */

// ── Turbine-level KPI ────────────────────────────────────────────

export interface TurbineAvailabilityKPI {
  turbine_id: string;
  /** Time-Based Availability [%] — IEC 61400-26-1 */
  tba_pct: number;
  /** Energy-Based Availability [%] — IEC 61400-26-1 */
  eba_pct: number;
  /** Production-Based Availability [%] — IEC 61400-26-1 */
  pba_pct: number;
  hours_producing: number;
  hours_downtime: number;
  hours_force_majeure: number;
  period_hours: number;
  energy_loss_mwh: number;
  mtbf_hours: number;
  assessment: string;
}

// ── Fleet-level summary ──────────────────────────────────────────

export interface FarmAvailabilityResponse {
  turbines: TurbineAvailabilityKPI[];
  fleet_tba_pct: number;
  fleet_eba_pct: number;
  worst_turbine: string;
  best_turbine: string;
  total_energy_loss_mwh: number;
  revenue_loss_eur: number;
  assessment: string;
}

// ── Downtime category breakdown ──────────────────────────────────

export interface DowntimeCategoryBreakdown {
  /** IEC 61400-26 category code, e.g. "SCHEDULED_MAINTENANCE" */
  category: string;
  hours: number;
  energy_loss_mwh: number;
  share_pct: number;
  controllable: boolean;
}

export interface DowntimeBreakdownResponse {
  scope: string;
  categories: DowntimeCategoryBreakdown[];
  total_hours: number;
  dominant_category: string;
  controllable_pct: number;
  period_hours: number;
  assessment: string;
}
