/**
 * TypeScript interfaces for M04 Multi-Farm Comparison.
 *
 * Field names are snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/farm_config.py.
 */

// ── Farm input configuration (FarmConfigCreate) ──────────────────

export interface FarmConfig {
  name: string;
  turbine_count: number;
  turbine_rated_mw: number;
  /** Hub-height mean wind speed [m/s]; Weibull A = v̄ / Γ(1+1/k). */
  mean_wind_speed_ms: number;
  weibull_k: number;
  /** Grid spacing in rotor diameters [D]. */
  turbine_spacing_d: number;
  array_voltage_kv: number;
  export_voltage_kv: number;
  export_length_km: number;
  availability_pct: number;
  capex_m_eur_per_mw: number;
  opex_k_eur_per_mw_year: number;
  discount_rate_pct: number;
  lifetime_years: number;
}

// ── Per-farm results ─────────────────────────────────────────────

export interface FarmAEPResult {
  farm_name: string;
  installed_mw: number;
  weibull_a_ms: number;
  gross_gwh: number;
  net_gwh: number;
  p50_gwh: number;
  p90_gwh: number;
  capacity_factor_pct: number;
  wake_loss_pct: number;
  blockage_loss_pct: number;
  electrical_loss_pct: number;
  availability_loss_pct: number;
  total_loss_pct: number;
}

export interface FarmLCOEResult {
  farm_name: string;
  lcoe_eur_per_mwh: number;
  capex_meur: number;
  opex_meur_year: number;
  annual_revenue_meur: number;
  lifetime_revenue_meur: number;
  simple_payback_years: number;
  irr_pct: number;
}

export interface FarmGridResult {
  farm_name: string;
  installed_mw: number;
  export_circuits: number;
  export_cable_losses_pct: number;
  array_cable_losses_pct: number;
  transformer_losses_pct: number;
  total_electrical_losses_pct: number;
  annual_electrical_loss_pct: number;
  loss_load_factor: number;
  cable_charging_mvar: number;
  export_utilization_pct: number;
}

export interface FarmComparisonResponse {
  comparison_id: string;
  aep: FarmAEPResult[];
  lcoe: FarmLCOEResult[];
  grid: FarmGridResult[];
  best_aep_farm: string;
  best_lcoe_farm: string;
  best_cf_farm: string;
  electricity_price_eur_mwh: number;
  summary: string;
}
