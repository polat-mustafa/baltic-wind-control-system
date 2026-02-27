/**
 * TypeScript interfaces for P1 Wind Resource API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/routers/p1.py Pydantic schemas.
 */

// ── Turbine Spec ────────────────────────────────────────────────

export interface TurbineSpec {
  rotor_diameter_m: number;
  hub_height_m: number;
  rated_power_kw: number;
  cut_in_speed_ms: number;
  rated_speed_ms: number;
  cut_out_speed_ms: number;
  num_turbines: number;
}

// ── Weibull Fit ─────────────────────────────────────────────────

export interface WeibullFitResult {
  fitted_a: number;
  fitted_k: number;
  mean_speed_ms: number;
  bin_centres: number[];
  bin_frequencies: number[];
  pdf_values: number[];
}

// ── Wind Rose ───────────────────────────────────────────────────

export interface WindRoseResult {
  sector_centres_deg: number[];
  frequencies: number[];
  mean_speeds_ms: number[];
  energy_fractions: number[];
  dominant_direction_deg: number;
  circular_std_deg: number;
  num_sectors: number;
}

// ── Wake Analysis ───────────────────────────────────────────────

export interface WakeAnalysisResult {
  gross_aep_gwh: number;
  net_aep_gwh: number;
  wake_loss_percent: number;
  capacity_factor: number;
  per_turbine_aep_gwh: number[];
  per_turbine_wake_loss_percent: number[];
}

// ── AEP Cascade ─────────────────────────────────────────────────

export interface LossFactor {
  name: string;
  loss_percent: number;
  uncertainty_percent: number;
}

export interface AEPCascadeResult {
  gross_aep_gwh: number;
  net_aep_gwh: number;
  p50_gwh: number;
  p75_gwh: number;
  p90_gwh: number;
  p99_gwh: number;
  total_loss_percent: number;
  combined_uncertainty_percent: number;
  capacity_factor: number;
  revenue_meur: number;
  loss_factors: LossFactor[];
  price_eur_mwh: number;
}

// ── Blockage ────────────────────────────────────────────────────

export interface BlockageResult {
  blockage_loss_percent: number;
  array_density: number;
  mean_ct: number;
  farm_area_km2: number;
  method: string;
}

// ── Layout Comparison ───────────────────────────────────────────

export interface LayoutCascadeEntry {
  name: string;
  net_aep_gwh: number;
  wake_loss_percent: number;
  capacity_factor: number;
  revenue_meur: number;
  p90_gwh: number;
}

export interface LayoutComparisonResult {
  layouts: LayoutCascadeEntry[];
  best_layout: string;
  improvement_percent: number;
}

// ── Layout Positions ────────────────────────────────────────────

export interface LayoutPositions {
  name: string;
  x_positions: number[];
  y_positions: number[];
  num_turbines: number;
  min_spacing_m: number;
  area_km2: number;
}
