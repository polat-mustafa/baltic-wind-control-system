/** Planning & P2X — backend/app/schemas/planning.py. MW, GWh, Mvar, EUR. */

export interface ExportPoint {
  length_km: number;
  hvac_capacity_mw: number;
  hvac_charging_mvar: number;
  hvac_loss_gwh: number;
  hvdc_loss_gwh: number;
}

export interface ExportResponse {
  design_length_km: number;
  annual_energy_gwh: number;
  capacity_factor: number;
  hvac: { capacity_mw: number; charging_mvar: number; loss_rated_mw: number; loss_gwh: number };
  hvdc: { loss_rated_mw: number; loss_gwh: number };
  hvac_capacity_limit_km: number | null;
  loss_crossover_km: number | null;
  sweep: ExportPoint[];
}

export interface P2XRequest {
  connection_mw: number;
  electrolyser_mw: number;
  capex_eur_per_kw: number;
}

export interface P2XResponse extends P2XRequest {
  farm_energy_gwh: number;
  surplus_gwh: number;
  surplus_hours: number;
  absorbed_gwh: number;
  still_lost_gwh: number;
  h2_tonnes: number;
  full_load_hours: number;
  lcoh_eur_kg: number | null;
  efficiency_lhv: number;
  power_to_power: number;
  duration_step_h: number;
  duration_mw: number[];
  lcoh_flh: number[];
  lcoh_curves: { price_eur_mwh: number; lcoh_eur_kg: number[] }[];
}
