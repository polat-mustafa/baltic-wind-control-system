/**
 * Farm wake model — the single engineering wake formula of the frontend
 * (map wake layer, SCADA/landing simulation, 3D flow and hub-height slice).
 *
 * Bastankhah & Porté-Agel (2014) Gaussian deficit:
 *   σ/D  = k*·x/D + ε,   ε = 0.2·√β,   β = ½(1 + √(1−Ct)) / √(1−Ct)
 *   C(x) = 1 − √(1 − Ct / (8 (σ/D)²))            (centre-line deficit)
 *   Δu/u(x, r) = C(x) · exp(−r² / 2σ²)
 * Superposition: Katic et al. (1986) sum of squares.
 * k* = 0.035 for offshore ambient TI ≈ 6–8 % (k* ≈ 0.38·TI + 0.004).
 *
 * Validated against PyWake's BastankhahGaussianDeficit (same Ct, k*):
 * backend/tests/fixtures/wake_centreline_reference.json, within 2 % from
 * 3 to 15 D — the residual is PyWake's Madsen a(Ct) polynomial vs the
 * momentum-theory root used here. It replaced a Jensen/Park top-hat model
 * (k = 0.04) that overstated far-wake deficits by up to 34 % at 15 D.
 *
 * Geographic conversions assume ~54.75°N latitude (Polish Baltic EEZ).
 */

import { REFERENCE_TURBINE } from "./turbineCurves";

// ── Turbine & wake constants ──────────────────────────────────────

/** Rotor diameter of the SB-510 reference turbine (IEA 15 MW, 241.35 m). */
export const ROTOR_DIAMETER = REFERENCE_TURBINE.rotorDiameterM; // metres
const ROTOR_RADIUS = ROTOR_DIAMETER / 2;
const CT = 0.8; // thrust coefficient below rated
/** Wake expansion rate k* (offshore). */
export const K_STAR = 0.035;

// ── Geographic conversion at 54.75°N ─────────────────────────────

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos((55.06 * Math.PI) / 180);

// ── Core wake math ────────────────────────────────────────────────

/** Gaussian wake width σ [m] at x metres downstream of a rotor of diameter d [m]. */
export function wakeSigma(x: number, ct = CT, kStar = K_STAR, d = ROTOR_DIAMETER): number {
  const s = Math.sqrt(1 - Math.min(ct, 0.95));
  const beta = (0.5 * (1 + s)) / s;
  return d * ((kStar * x) / d + 0.2 * Math.sqrt(beta));
}

/**
 * Velocity deficit Δu/u at x metres downstream, r metres off the wake axis.
 * The Gaussian form is a far-wake model (valid beyond ≈ 2–3 D); closer in it
 * is evaluated at 2 D — the farm's spacing is ≥ 6 D, the 3D near wake uses
 * actuator-disc theory instead (components/landing/turbine3d/model/wakeModel).
 * `kStar` overrides the expansion rate (higher turbulence → faster recovery).
 */
export function velocityDeficit(x: number, r = 0, ct = CT, kStar = K_STAR, d = ROTOR_DIAMETER): number {
  if (x <= 0 || ct <= 0) return 0;
  const sig = wakeSigma(Math.max(x, 2 * d), ct, kStar, d);
  const arg = 1 - ct / (8 * (sig / d) ** 2);
  const c = 1 - Math.sqrt(Math.max(0, arg));
  return c * Math.exp(-(r * r) / (2 * sig * sig));
}

/** Visible wake half-width [m]: 2σ (Niayifar & Porté-Agel 2016). */
function wakeRadius(x: number): number {
  return 2 * wakeSigma(x);
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
 * Generate a wake outline polygon ([lat, lon][]) for one turbine: the 2σ
 * envelope of the Gaussian wake, starting at the rotor disc.
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
    const r = i === 0 ? ROTOR_RADIUS : Math.max(ROTOR_RADIUS, wakeRadius(x));
    const c = offsetGeo(lat, lon, x, downwind);
    left.push(offsetGeo(c[0], c[1], r, perpL));
    right.push(offsetGeo(c[0], c[1], r, perpR));
  }

  return [...left, ...right.reverse()];
}

// ── Farm-level wake loss computation ──────────────────────────────

export interface WakeLossResult {
  turbineId: string;
  /**
   * Power loss [%] from the cubic law — valid BELOW rated wind only. For the
   * live loss at the current wind use `wakePowerLossPct` (utils/landingPhysics).
   */
  lossPct: number;
  /** Combined velocity deficit Δu/u₀ at this turbine (Katic superposition). */
  deficit: number;
  /** IDs of upstream turbines casting wakes onto this turbine. */
  upstreamIds: string[];
}

/** Contributions below this deficit are not counted as "waked by". */
const MIN_DEFICIT = 0.005;

/**
 * Compute wake-induced power losses for every turbine in the farm.
 *
 * Deficit evaluated at the target's hub (centre point, not rotor-averaged),
 * Katic sum of squares over all upstream rotors. Power loss ≈ 1 − (1 − Δu/u₀)³.
 * ponytail: point value at the hub — a rotor average (≈ 4–8 sample points)
 * lowers partial-wake deficits by a few % if that level of detail matters.
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
      const d = velocityDeficit(along, cross);
      if (d < MIN_DEFICIT) continue;

      sqSum += d ** 2;
      upstreamIds.push(src.id);
    }

    if (sqSum > 0) {
      const totalDeficit = Math.sqrt(sqSum); // Katic superposition
      const powerLoss = 1 - (1 - totalDeficit) ** 3; // cubic power law
      const lossPct = Math.round(powerLoss * 100);
      if (lossPct > 1) {
        results.push({ turbineId: target.id, lossPct, deficit: totalDeficit, upstreamIds });
      }
    }
  }

  return results;
}
