/**
 * Grid Advanced API — wrappers for the 18 P2 endpoints that previously
 * had no UI caller (audit 2026-04-20).
 *
 * Each endpoint takes a typed request body (matching the FastAPI Pydantic
 * model in backend/app/routers/p2.py) and returns the raw response object.
 * The frontend renders responses through a generic JSON viewer + targeted
 * Plotly hooks, so we don't model each response shape exhaustively here.
 */

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid";

// ── Request bodies ──────────────────────────────────────────────────

export interface DynamicComplianceRequest {
  export_length_km: number;
  grid_ssc_mva: number;
  generation_fraction: number;
}

export type FrequencyMode = "lfsm_o" | "lfsm_u" | "fsm";
export interface FrequencyResponseRequest {
  mode: FrequencyMode;
  freq_step_hz: number;
  droop_pct: number;
  generation_fraction: number;
}

export interface SSOScreeningRequest {
  export_length_km: number;
  grid_ssc_mva: number;
  generation_fraction: number;
}

export interface OPFRequest {
  method: "ac" | "dc";
  generation_fraction: number;
  export_length_km: number;
  grid_ssc_mva: number;
}

export interface SCOPFRequest {
  generation_fraction: number;
  export_length_km: number;
  grid_ssc_mva: number;
}

export interface DCPowerFlowRequest {
  generation_fraction: number;
  export_length_km: number;
  grid_ssc_mva: number;
}

export interface EconomicDispatchRequest {
  mean_wind_speed_ms: number;
  curtailment_order_mw: number;
  electricity_price_eur_mwh: number;
}

export interface BESSDispatchRequest {
  mean_wind_speed_ms: number;
  grid_export_limit_mw: number;
  bess_power_mw: number;
  bess_energy_mwh: number;
}

export interface ACDCComparisonRequest {
  cable_length_km: number;
  capacity_factor: number;
}

export interface CapacityExpansionRequest {
  electricity_price_eur_mwh: number;
  base_year: number;
  include_bess: boolean;
}

export interface PathwayPlanningRequest {
  scenario: "reference" | "accelerated" | "conservative";
  demand_growth_rate: number;
}

export interface SectorCouplingRequest {
  grid_capacity_mw: number;
  electrolyzer_capacity_mw: number;
  heat_pump_capacity_mw: number;
}

export interface ElectrolyzerRequest {
  electrolyzer_capacity_mw: number;
  technology: "pem" | "alkaline" | "soec";
  price_threshold_eur_mwh: number;
}

export interface SeasonalStorageRequest {
  technology: "hydrogen_cavern" | "compressed_air" | "pumped_hydro";
  storage_capacity_mwh: number;
  charge_capacity_mw: number;
  discharge_capacity_mw: number;
}

export interface FlexibleDemandRequest {
  grid_capacity_mw: number;
  price_elasticity: number;
}

export interface MultiEnergyRequest {
  wind_generation_mwh: number;
  electricity_demand_mwh: number;
  heat_demand_mwh: number;
  hydrogen_demand_mwh: number;
}

// ── Default bodies (sensible defaults matching backend Field() defaults) ──

export const DEFAULTS = {
  dynamicCompliance: { export_length_km: 45, grid_ssc_mva: 10000, generation_fraction: 1.0 } satisfies DynamicComplianceRequest,
  frequencyResponse: { mode: "fsm" as FrequencyMode, freq_step_hz: 0.5, droop_pct: 5.0, generation_fraction: 0.8 } satisfies FrequencyResponseRequest,
  ssoAnalysis: { export_length_km: 45, grid_ssc_mva: 10000, generation_fraction: 1.0 } satisfies SSOScreeningRequest,
  opf: { method: "ac" as const, generation_fraction: 1.0, export_length_km: 45, grid_ssc_mva: 10000 } satisfies OPFRequest,
  scopf: { generation_fraction: 1.0, export_length_km: 45, grid_ssc_mva: 10000 } satisfies SCOPFRequest,
  dcPowerFlow: { generation_fraction: 1.0, export_length_km: 45, grid_ssc_mva: 10000 } satisfies DCPowerFlowRequest,
  dcContingency: { generation_fraction: 1.0, export_length_km: 45, grid_ssc_mva: 10000 } satisfies DCPowerFlowRequest,
  economicDispatch: { mean_wind_speed_ms: 10.5, curtailment_order_mw: 0, electricity_price_eur_mwh: 72 } satisfies EconomicDispatchRequest,
  bessDispatch: { mean_wind_speed_ms: 10.5, grid_export_limit_mw: 510, bess_power_mw: 100, bess_energy_mwh: 400 } satisfies BESSDispatchRequest,
  acDcComparison: { cable_length_km: 45, capacity_factor: 0.45 } satisfies ACDCComparisonRequest,
  capacityExpansion: { electricity_price_eur_mwh: 72, base_year: 2026, include_bess: true } satisfies CapacityExpansionRequest,
  pathwayPlanning: { scenario: "reference" as const, demand_growth_rate: 0.015 } satisfies PathwayPlanningRequest,
  sectorCoupling: { grid_capacity_mw: 400, electrolyzer_capacity_mw: 50, heat_pump_capacity_mw: 30 } satisfies SectorCouplingRequest,
  electrolyzer: { electrolyzer_capacity_mw: 50, technology: "pem" as const, price_threshold_eur_mwh: 40 } satisfies ElectrolyzerRequest,
  seasonalStorage: { technology: "hydrogen_cavern" as const, storage_capacity_mwh: 5000, charge_capacity_mw: 50, discharge_capacity_mw: 50 } satisfies SeasonalStorageRequest,
  flexibleDemand: { grid_capacity_mw: 450, price_elasticity: -0.15 } satisfies FlexibleDemandRequest,
  multiEnergy: { wind_generation_mwh: 2_000_000, electricity_demand_mwh: 1_800_000, heat_demand_mwh: 500_000, hydrogen_demand_mwh: 100_000 } satisfies MultiEnergyRequest,
};

// ── POST wrappers (return unknown — UI uses generic JSON viewer) ──

export const postDynamicCompliance = (body: DynamicComplianceRequest) => post<unknown>(`${BASE}/dynamic-compliance`, body);
export const postFrequencyResponse = (body: FrequencyResponseRequest) => post<unknown>(`${BASE}/frequency-response`, body);
export const postSSOAnalysis = (body: SSOScreeningRequest) => post<unknown>(`${BASE}/sso-analysis`, body);
export const postOPF = (body: OPFRequest) => post<unknown>(`${BASE}/opf`, body);
export const postSCOPF = (body: SCOPFRequest) => post<unknown>(`${BASE}/scopf`, body);
export const postDCPowerFlow = (body: DCPowerFlowRequest) => post<unknown>(`${BASE}/dc-power-flow`, body);
export const postDCContingency = (body: DCPowerFlowRequest) => post<unknown>(`${BASE}/dc-contingency-screening`, body);
export const postEconomicDispatch = (body: EconomicDispatchRequest) => post<unknown>(`${BASE}/economic-dispatch`, body);
export const postBESSDispatch = (body: BESSDispatchRequest) => post<unknown>(`${BASE}/bess-dispatch`, body);
export const postACDCComparison = (body: ACDCComparisonRequest) => post<unknown>(`${BASE}/ac-dc-comparison`, body);
export const postCapacityExpansion = (body: CapacityExpansionRequest) => post<unknown>(`${BASE}/capacity-expansion`, body);
export const postPathwayPlanning = (body: PathwayPlanningRequest) => post<unknown>(`${BASE}/pathway-planning`, body);
export const postSectorCoupling = (body: SectorCouplingRequest) => post<unknown>(`${BASE}/sector-coupling`, body);
export const postElectrolyzer = (body: ElectrolyzerRequest) => post<unknown>(`${BASE}/electrolyzer`, body);
export const postSeasonalStorage = (body: SeasonalStorageRequest) => post<unknown>(`${BASE}/seasonal-storage`, body);
export const postFlexibleDemand = (body: FlexibleDemandRequest) => post<unknown>(`${BASE}/flexible-demand`, body);
export const postMultiEnergy = (body: MultiEnergyRequest) => post<unknown>(`${BASE}/multi-energy-carrier`, body);

// GET — ANDES network spec
export const getAndesNetwork = () => request<unknown>(`${BASE}/andes-network`);
