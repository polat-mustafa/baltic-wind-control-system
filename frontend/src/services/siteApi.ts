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

/** One raster layer clipped to a bbox: bands[name][j][i] at (lon0 + i·dlon, lat0 + j·dlat), null = no data. */
export interface RasterResponse {
  role: string;
  lon0: number;
  lat0: number;
  dlon: number;
  dlat: number;
  bands: Record<string, (number | null)[][]>;
  /** Class rasters (seabed): code → name. */
  classes?: Record<string, string> | null;
  source: string;
  license: string;
  retrieved: string;
}

export interface LayersResponse {
  region: RegionInfo;
  layers: LayerInfo[];
  missing: MissingLayer[];
  complete: boolean;
  criteria: CriterionCard[];
  depth_bands: { min_m: number; max_m: number; score: number; foundation: string }[];
  /** Seabed substrate classes (EMODnet Folk 5) and what they mean for piles and cables. */
  seabed_classes?: SeabedClass[];
}

export interface SeabedClass {
  code: number;
  name: string;
  piling: string;
  burial: string;
  /** Foundation cost multiplier, sand = 1.00 (illustrative). */
  foundation_factor: number;
  /** Piling or burial needs extra work. */
  hard: boolean;
  quality: "illustrative";
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

/** Hub-height wind climate of a site (NEWA + ERA5, or the labelled approximation). */
export interface SiteWind {
  mean_ms: number;
  weibull_a: number;
  weibull_k: number;
  height_m: number;
  /** 12 sectors, wind FROM, centres 0°, 30° … 330°; null without a site rose. */
  sector_frequencies: number[] | null;
  source: string;
  license: string;
  /** True: real data not found, closest approximation used. */
  approximate: boolean;
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
  wind?: SiteWind | null;
  /** Seabed substrate class → share of the mapped site area. */
  seabed?: Record<string, number> | null;
  checks: SiteCheck[];
  complete: boolean;
}

/** `?region=…` when one is given; without it the backend uses its default region pack. */
const regionQuery = (region?: string) => (region ? `region=${encodeURIComponent(region)}` : "");

/** Layers of a region (default: the backend's region pack; `layers.region.region` names it). */
export const getLayers = (region?: string): Promise<LayersResponse> =>
  request(`${BASE}/layers${region ? `?${regionQuery(region)}` : ""}`);

/** A raster layer (bathymetry: depth [m, positive down]) clipped to [lon_min, lat_min, lon_max, lat_max]. */
export const getRaster = (role: string, bbox: [number, number, number, number], region?: string): Promise<RasterResponse> =>
  request(`${BASE}/raster?role=${encodeURIComponent(role)}&bbox=${bbox.map((v) => v.toFixed(4)).join(",")}${region ? `&${regionQuery(region)}` : ""}`);

export const postSuitability = (criteria: CriteriaOverrides, cell_km = 2, region?: string): Promise<SuitabilityResponse> =>
  post(`${BASE}/suitability`, { criteria, cell_km, ...(region ? { region } : {}) });

export const postAssess = (polygon: LonLat[], criteria: CriteriaOverrides, region?: string): Promise<AssessResponse> =>
  post(`${BASE}/assess`, { polygon, criteria, ...(region ? { region } : {}) });
