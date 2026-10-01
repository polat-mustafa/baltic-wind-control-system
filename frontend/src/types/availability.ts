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
  hours_scheduled_maintenance: number;
  hours_unscheduled_maintenance: number;
  hours_force_majeure: number;
  hours_curtailment: number;
  period_hours: number;
  energy_loss_mwh: number;
  mtbf_hours: number;
  mttr_hours: number;
  fault_count: number;
}

// ── Fleet-level summary ──────────────────────────────────────────

export interface FarmAvailabilityResponse {
  turbines: TurbineAvailabilityKPI[];
  fleet_tba_pct: number;
  fleet_eba_pct: number;
  worst_turbine: string;
  best_turbine: string;
  total_energy_loss_mwh: number;
  total_revenue_loss_eur: number;
  fleet_pba_pct: number;
  fleet_mtbf_hours: number;
  fleet_mttr_hours: number;
  assessment: string;
}

// ── Downtime category breakdown ──────────────────────────────────

export interface DowntimeCategoryBreakdown {
  /** IEC 61400-26 category code, e.g. "SCHEDULED_MAINTENANCE" */
  category: string;
  hours: number;
  energy_loss_mwh: number;
  share_pct: number;
  revenue_loss_eur: number;
  controllable: boolean;
}

export interface DowntimeBreakdownResponse {
  scope: string;
  categories: DowntimeCategoryBreakdown[];
  dominant_category: string;
  /** Controllable downtime as % of all turbine-hours (not of downtime). */
  controllable_loss_pct: number;
  period_hours: number;
  assessment: string;
}
