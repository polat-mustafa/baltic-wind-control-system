/**
 * Jensen/Park wake model for offshore wind turbine wake visualization.
 *
 * Reference: N.O. Jensen (1983), "A Note on Wind Generator Interaction"
 * Wake superposition: Katic et al. (1986), sum-of-squares method
 *
 * Parameters tuned for Vestas V236-15.0 MW:
 *   D  = 236 m  rotor diameter
 *   Ct = 0.8    thrust coefficient at rated
 *   k  = 0.04   offshore wake decay constant (low ambient turbulence)
 *
 * Geographic conversions assume ~54.75°N latitude (Polish Baltic EEZ).
 */

// ── Turbine & wake constants ──────────────────────────────────────

export const ROTOR_DIAMETER = 236; // metres
const ROTOR_RADIUS = ROTOR_DIAMETER / 2;
const CT = 0.8; // thrust coefficient at rated wind speed
const K = 0.04; // offshore wake decay constant

// ── Geographic conversion at 54.75°N ─────────────────────────────

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos((54.75 * Math.PI) / 180);

// ── Core wake math ────────────────────────────────────────────────

/** Wake radius (m) at downstream distance x (m). */
function wakeRadius(x: number): number {
  return ROTOR_RADIUS + K * x;
}

/** Centre-line velocity deficit fraction at downstream distance x. */
export function velocityDeficit(x: number): number {
  const a = 1 - Math.sqrt(1 - CT);
  const r = 1 + (K * x) / ROTOR_RADIUS;
  return a / (r * r);
}

// ── Geo helper ────────────────────────────────────────────────────

/** Offset a [lat, lon] point by distance (m) along geographic bearing (deg). */
function offsetGeo(
  lat: number,
  lon: number,
  distM: number,
  bearingDeg: number,
): [number, number] {
  const rad = (bearingDeg * Math.PI) / 180;
  return [
    lat + (distM * Math.cos(rad)) / M_PER_DEG_LAT,
    lon + (distM * Math.sin(rad)) / M_PER_DEG_LON,
  ];
}

// ── Wake cone polygon ─────────────────────────────────────────────

/**
 * Generate a wake cone polygon ([lat, lon][]) for one turbine.
 *
 * The cone starts at the rotor plane (width = D) and expands linearly
 * in the downwind direction following r(x) = D/2 + k·x.
 *
 * @param lat        Turbine latitude
 * @param lon        Turbine longitude
 * @param windFromDeg  Meteorological wind direction (where wind comes FROM)
 * @param lengthM    Downstream extent of the cone (default 2 000 m ≈ 8.5 D)
 * @param steps      Number of polygon segments (default 6)
 */
export function wakeConePoly(
  lat: number,
  lon: number,
  windFromDeg: number,
  lengthM = 2000,
  steps = 6,
): [number, number][] {
  const downwind = (windFromDeg + 180) % 360;
  const perpL = (downwind - 90 + 360) % 360;
  const perpR = (downwind + 90) % 360;

  const left: [number, number][] = [];
  const right: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * lengthM;
    const r = wakeRadius(x);
    const c = offsetGeo(lat, lon, x, downwind);
    left.push(offsetGeo(c[0], c[1], r, perpL));
    right.push(offsetGeo(c[0], c[1], r, perpR));
  }

  return [...left, ...right.reverse()];
}

// ── Farm-level wake loss computation ──────────────────────────────

export interface WakeLossResult {
  turbineId: string;
  /** Estimated power loss percentage due to upstream wakes. */
  lossPct: number;
  /** IDs of upstream turbines casting wakes onto this turbine. */
  upstreamIds: string[];
}

/**
 * Compute wake-induced power losses for every turbine in the farm.
 *
 * Uses Katic et al. (1986) sum-of-squares superposition for multiple
 * overlapping wakes. Power loss ≈ 1 − (1 − Δu/u₀)³ (cubic law).
 *
 * @returns Only turbines with > 1 % power loss.
 */
export function computeWakeLosses(
  turbines: { id: string; lat: number; lon: number }[],
  windFromDeg: number,
): WakeLossResult[] {
  const downRad = ((windFromDeg + 180) * Math.PI) / 180;
  const results: WakeLossResult[] = [];

  for (const target of turbines) {
    let sqSum = 0;
    const upstreamIds: string[] = [];

    for (const src of turbines) {
      if (src.id === target.id) continue;

      // Vector from source to target in metres
      const dN = (target.lat - src.lat) * M_PER_DEG_LAT;
      const dE = (target.lon - src.lon) * M_PER_DEG_LON;

      // Project onto downwind axis
      const along = dN * Math.cos(downRad) + dE * Math.sin(downRad);
      if (along <= 0) continue; // source is not upstream

      // Perpendicular (cross-wind) distance
      const cross = Math.abs(-dN * Math.sin(downRad) + dE * Math.cos(downRad));
      if (cross > wakeRadius(along)) continue; // target outside wake cone

      sqSum += velocityDeficit(along) ** 2;
      upstreamIds.push(src.id);
    }

    if (sqSum > 0) {
      const totalDeficit = Math.sqrt(sqSum); // Katic superposition
      const powerLoss = 1 - (1 - totalDeficit) ** 3; // cubic power law
      const lossPct = Math.round(powerLoss * 100);
      if (lossPct > 1) {
        results.push({ turbineId: target.id, lossPct, upstreamIds });
      }
    }
  }

  return results;
}
