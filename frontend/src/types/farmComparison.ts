/**
 * TypeScript interfaces for M04 Multi-Farm Comparison API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/farm_config.py.
 */

// ── Farm input configuration ─────────────────────────────────────

export interface FarmConfig {
  name: string;
  n_turbines: number;
  turbine_rated_mw: number;
  weibull_a: number;
  weibull_k: number;
  array_voltage_kv: number;
  export_length_km: number;
}

// ── Comparison result per farm ───────────────────────────────────

export interface FarmComparisonResult {
  name: string;
  n_turbines: number;
  turbine_rated_mw: number;
  installed_mw: number;
  gross_aep_gwh: number;
  net_aep_gwh: number;
  capacity_factor_pct: number;
  wake_loss_pct: number;
  cable_loss_pct: number;
  lcoe_eur_mwh: number;
  array_voltage_kv: number;
  export_length_km: number;
}

// ── Comparison response ──────────────────────────────────────────

export interface FarmComparisonResponse {
  farms: FarmComparisonResult[];
  best_aep_farm: string;
  best_lcoe_farm: string;
  best_capacity_factor_farm: string;
  comparison_timestamp: string;
}
