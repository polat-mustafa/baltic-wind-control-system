/**
 * Live (screening) energy yield of a user layout, for the layout canvas.
 *
 * Wake deficit: Bastankhah Gaussian from utils/wakeModel (V236, k* = K_FARM),
 * evaluated at each hub with the thrust coefficient Ct(u) of the free-stream
 * speed (V236 Ct curve, mirror of backend services/p1/wake_model.py), Katic
 * sum-of-squares superposition. Yield = Σ sectors Σ speed bins
 * hours · P(u·(1 − δ(u))).
 *
 * This is a fast screening number for dragging turbines around. The
 * reference AEP is PyWake on the backend (POST /api/v1/wind/wake-analysis-custom).
 */

import { HOURS_PER_YEAR } from "../../utils/aepMath";
import { v236PowerMW } from "../../utils/landingPhysics";
import { velocityDeficit } from "../../utils/wakeModel";
import type { XY } from "./geometry";

// V236 thrust coefficient [m/s, -] — same table as backend services/p1/wake_model.py
const CT_V: number[] = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10.5, 11, 11.1, 11.5, 12, 12.5, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 31, 32];
const CT: number[] = [0, 0, 0.9, 0.88, 0.85, 0.82, 0.78, 0.72, 0.6, 0.45, 0.4, 0.36, 0.35, 0.33, 0.3, 0.28, 0.25, 0.2, 0.17, 0.14, 0.1, 0.08, 0.06, 0.05, 0.04, 0.04, 0.03, 0.03, 0];

/** Thrust coefficient at wind speed v (linear interpolation; 0 outside 3–31 m/s). */
export function v236Ct(v: number): number {
  if (v < 3 || v > 31) return 0;
  for (let i = 1; i < CT_V.length; i++)
    if (v <= CT_V[i]) return CT[i - 1] + ((CT[i] - CT[i - 1]) * (v - CT_V[i - 1])) / (CT_V[i] - CT_V[i - 1]);
  return 0;
}

/**
 * Wake expansion inside the farm. Niayifar & Porté-Agel (2016):
 * k* = 0.3837·TI + 0.003678; with the wake-added turbulence of a farm
 * (TI ≈ 12 % on 6 % ambient) k* ≈ 0.05. With it the screening loss of a
 * 5 × 5 grid at 4 / 6 / 8 D is within 0.5 percentage points of PyWake
 * (Niayifar deficit, STF2017 turbulence, LinearSum) — tests/lib/layout.test.ts.
 */
export const K_FARM = 0.05;

export interface WindRose {
  /** Sector centres, degrees the wind comes FROM. */
  directions: number[];
  /** Share of time per sector; sums to 1. */
  frequencies: number[];
}

export const UNIFORM_ROSE: WindRose = {
  directions: Array.from({ length: 12 }, (_, i) => i * 30),
  frequencies: Array.from({ length: 12 }, () => 1 / 12),
};

/** Combined deficit Δu/u₀ at each turbine for wind from `fromDeg`. */
export function deficits(t: XY[], fromDeg: number, ct = 0.8, kStar = K_FARM): number[] {
  const th = (fromDeg * Math.PI) / 180;
  const dx = -Math.sin(th); // downwind unit vector (x east, y north)
  const dy = -Math.cos(th);
  return t.map((p, i) => {
    let sq = 0;
    for (let j = 0; j < t.length; j++) {
      if (j === i) continue;
      const ex = p.x - t[j].x;
      const ey = p.y - t[j].y;
      const along = ex * dx + ey * dy;
      if (along <= 0) continue;
      const cross = Math.abs(-ex * dy + ey * dx);
      sq += velocityDeficit(along, cross, ct, kStar) ** 2;
    }
    return Math.min(1, Math.sqrt(sq));
  });
}

const weibullCdf = (v: number, a: number, k: number) => (v <= 0 ? 0 : 1 - Math.exp(-((v / a) ** k)));

export interface YieldResult {
  grossGWh: number;
  netGWh: number;
  wakeLossPct: number;
  capacityFactor: number;
  /** Rose-weighted wake loss per turbine [%]. */
  perTurbineLossPct: number[];
}

export function layoutYield(t: XY[], a: number, k: number, rose: WindRose = UNIFORM_ROSE, ratedMW = 15): YieldResult {
  const dv = 0.5;
  const bins: { v: number; h: number }[] = [];
  for (let v = dv / 2; v < 35; v += dv) bins.push({ v, h: HOURS_PER_YEAR * (weibullCdf(v + dv / 2, a, k) - weibullCdf(v - dv / 2, a, k)) });
  const grossOne = bins.reduce((s, b) => s + b.h * v236PowerMW(b.v), 0); // MWh
  const net = new Array<number>(t.length).fill(0);
  rose.directions.forEach((dir, s) => {
    const f = rose.frequencies[s];
    if (!f) return;
    for (const b of bins) {
      const ct = v236Ct(b.v);
      const d = ct > 0 ? deficits(t, dir, ct) : null;
      t.forEach((_, i) => {
        net[i] += f * b.h * v236PowerMW(b.v * (1 - (d ? d[i] : 0)));
      });
    }
  });
  const gross = grossOne * t.length;
  const netSum = net.reduce((s, x) => s + x, 0);
  return {
    grossGWh: gross / 1000,
    netGWh: netSum / 1000,
    wakeLossPct: gross > 0 ? 100 * (1 - netSum / gross) : 0,
    capacityFactor: t.length ? netSum / (ratedMW * HOURS_PER_YEAR * t.length) : 0,
    perTurbineLossPct: net.map((e) => (grossOne > 0 ? 100 * (1 - e / grossOne) : 0)),
  };
}
