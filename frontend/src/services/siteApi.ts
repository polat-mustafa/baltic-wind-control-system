/**
 * Typed client for the site assessment API (backend/app/routers/site_assessment.py).
 *
 * Coordinates are WGS84 [lon, lat] (GeoJSON order). Distances in km, depths
 * in m (positive down), areas in km², capacity in MW, scores 0…1.
 */

import { post, request } from "./apiClient";

const BASE = "/api/v1/site";

export type CheckStatus = "pass" | "warn" | "fail" | "unknown" | "info";
export type ClassName = "excluded" | "poor" | "marginal" | "suitable" | "unscored";
export type LonLat = [number, number];

export interface RegionInfo {
  region: string;
  title: string;
  description: string;
  bbox: [number, number, number, number];
}

export interface LayerFeature {
  name: string;
  geometry:
    | { type: "Polygon"; coordinates: LonLat[][] }
    | { type: "LineString"; coordinates: LonLat[] }
    | { type: "Point"; coordinates: LonLat };
  properties: Record<string, unknown>;
}

export interface LayerInfo {
  id: string;
  title: string;
  role: string;
  geometry: string;
  source: string;
  license: string;
  retrieved: string;
  features: LayerFeature[];
}

export interface MissingLayer {
  role: string;
  effect: string;
  source: string;
  essential: boolean;
}

export interface CriterionCard {
  key: string;
  label: string;
  unit: string;
  kind: string;
  default: number | boolean;
  provenance: string;
  note: string;
}

export interface LayersResponse {
  region: RegionInfo;
  layers: LayerInfo[];
  missing: MissingLayer[];
  complete: boolean;
  criteria: CriterionCard[];
  depth_bands: { min_m: number; max_m: number; score: number; foundation: string }[];
}

export interface CriteriaOverrides {
  exclude_territorial_sea?: boolean;
  require_energy_basin?: boolean;
  exclude_protected?: boolean;
  exclude_restricted?: boolean;
  cable_buffer_km?: number;
  power_density_mw_km2?: number;
}

export interface SuitabilityResponse {
  region: string;
  lon0: number;
  lat0: number;
  dlon: number;
  dlat: number;
  nx: number;
  ny: number;
  cell_km: number;
  classes: number[][];
  scores: (number | null)[][];
  reasons: number[][];
  reason_keys: string[];
  class_areas: { name: ClassName; cells: number; area_km2: number }[];
  reason_areas: { reason: string; label: string; cells: number; area_km2: number }[];
  missing: MissingLayer[];
  complete: boolean;
}

export interface SiteCheck {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
  reference: string;
}

export interface AssessResponse {
  region: string;
  area_km2: number;
  centroid: LonLat;
  capacity_mw: number;
  samples: number;
  excluded_fraction: number;
  exclusion_shares: Record<string, number>;
  class_shares: Record<string, number>;
  mean_score: number | null;
  shore_km: [number, number] | null;
  grid_km: number | null;
  grid_node: string | null;
  cable_km: number | null;
  owf_km: number | null;
  protected_km: number | null;
  depth_m: [number, number] | null;
  foundation: string | null;
  /** Plan basins with an energy function the site lies in (Polish MSP). */
  energy_basins?: string[];
  /** Real wind farm projects inside the site or already holding its energy basins. */
  projects?: string[];
  checks: SiteCheck[];
  complete: boolean;
}

export const getLayers = (region = "southern-baltic"): Promise<LayersResponse> =>
  request(`${BASE}/layers?region=${encodeURIComponent(region)}`);

export const postSuitability = (criteria: CriteriaOverrides, cell_km = 2): Promise<SuitabilityResponse> =>
  post(`${BASE}/suitability`, { criteria, cell_km });

export const postAssess = (polygon: LonLat[], criteria: CriteriaOverrides): Promise<AssessResponse> =>
  post(`${BASE}/assess`, { polygon, criteria });
