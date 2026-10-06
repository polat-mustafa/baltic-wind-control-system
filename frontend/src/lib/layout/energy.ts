/**
 * Live (screening) energy yield of a user layout, for the layout canvas.
 *
 * Wake deficit: Bastankhah Gaussian from utils/wakeModel (k* = K_FARM),
 * evaluated at each hub with the thrust coefficient Ct(u) of the free-stream
 * speed, Katic sum-of-squares superposition. Yield = Σ sectors Σ speed bins
 * hours · P(u·(1 − δ(u))). Power and Ct from the chosen reference turbine
 * (constants/turbineModels.ts — the same tables as backend turbine_models.py).
 *
 * This is a fast screening number for dragging turbines around. The
 * reference AEP is PyWake on the backend (POST /api/v1/wind/wake-analysis-custom).
 */

import type { TurbineModel } from "../../constants/turbineModels";
import { HOURS_PER_YEAR } from "../../utils/aepMath";
import { powerKw, REFERENCE_TURBINE, thrustCoefficient } from "../../utils/turbineCurves";
import { velocityDeficit } from "../../utils/wakeModel";
import type { XY } from "./geometry";

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
export function deficits(t: XY[], fromDeg: number, ct = 0.8, kStar = K_FARM, d = REFERENCE_TURBINE.rotorDiameterM): number[] {
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
      sq += velocityDeficit(along, cross, ct, kStar, d) ** 2;
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

export function layoutYield(
  t: XY[],
  a: number,
  k: number,
  rose: WindRose = UNIFORM_ROSE,
  model: TurbineModel = REFERENCE_TURBINE,
): YieldResult {
  const powerMW = (v: number) => powerKw(model, v) / 1000;
  const ratedMW = model.ratedKw / 1000;
  const dv = 0.5;
  const bins: { v: number; h: number }[] = [];
  for (let v = dv / 2; v < 35; v += dv) bins.push({ v, h: HOURS_PER_YEAR * (weibullCdf(v + dv / 2, a, k) - weibullCdf(v - dv / 2, a, k)) });
  const grossOne = bins.reduce((s, b) => s + b.h * powerMW(b.v), 0); // MWh
  const net = new Array<number>(t.length).fill(0);
  rose.directions.forEach((dir, s) => {
    const f = rose.frequencies[s];
    if (!f) return;
    for (const b of bins) {
      const ct = thrustCoefficient(model, b.v);
      const d = ct > 0 ? deficits(t, dir, ct, K_FARM, model.rotorDiameterM) : null;
      t.forEach((_, i) => {
        net[i] += f * b.h * powerMW(b.v * (1 - (d ? d[i] : 0)));
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
