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

const weibullCdf = (v: number, a: number, k: number) => (v <= 0 ? 0 : 1 - Math.exp(-((v / a) ** k)));

/** One wind case: a sector × speed bin with thrust (Ct > 0), and the summed squared deficits at each hub. */
interface WindCase {
  /** Downwind unit vector (x east, y north). */
  dx: number;
  dy: number;
  v: number;
  /** Hours per year of this case (sector share × bin hours). */
  h: number;
  ct: number;
  /** Σ (Δu/u₀)² over the upstream turbines, per turbine (Katic superposition). */
  sq: Float64Array;
}

/**
 * The yield sum prepared once per layout, so a one-turbine move costs
 * O(N) per case (moveDelta) instead of O(N²) for a full recompute.
 */
export interface YieldModel {
  t: XY[];
  model: TurbineModel;
  cases: WindCase[];
  /** Per-turbine energy [MWh] and Σ h·u [h·m/s] of the bins without thrust (no wake). */
  freeMWh: number;
  freeHv: number;
  /** Hours per year covered by the rose × speed bins. */
  hours: number;
  /** One undisturbed turbine [MWh/yr] and the free-stream mean speed [m/s]. */
  grossOneMWh: number;
  freeMeanMs: number;
  /** Net energy [MWh/yr] and mean hub speed [m/s] per turbine. */
  netMWh: number[];
  meanMs: number[];
}

/** Deficit Δu/u₀ at `to` from a turbine at `from` (0 when `to` is not downwind). */
function contribution(from: XY, to: XY, c: WindCase, d: number): number {
  const ex = to.x - from.x;
  const ey = to.y - from.y;
  const along = ex * c.dx + ey * c.dy;
  if (along <= 0) return 0;
  return velocityDeficit(along, Math.abs(-ex * c.dy + ey * c.dx), c.ct, K_FARM, d);
}

const powerMW = (m: TurbineModel, v: number) => powerKw(m, v) / 1000;
const waked = (c: WindCase, sq: number) => c.v * (1 - Math.min(1, Math.sqrt(Math.max(0, sq))));

export function prepareYield(
  t: XY[],
  a: number,
  k: number,
  rose: WindRose = UNIFORM_ROSE,
  model: TurbineModel = REFERENCE_TURBINE,
): YieldModel {
  const d = model.rotorDiameterM;
  const dv = 0.5;
  const bins: { v: number; h: number }[] = [];
  for (let v = dv / 2; v < 35; v += dv) bins.push({ v, h: HOURS_PER_YEAR * (weibullCdf(v + dv / 2, a, k) - weibullCdf(v - dv / 2, a, k)) });
  const grossOneMWh = bins.reduce((s, b) => s + b.h * powerMW(model, b.v), 0);
  const cases: WindCase[] = [];
  let freeMWh = 0;
  let freeHv = 0;
  let hours = 0;
  let allHv = 0;
  rose.directions.forEach((dir, s) => {
    const f = rose.frequencies[s];
    if (!f) return;
    const th = (dir * Math.PI) / 180;
    for (const b of bins) {
      hours += f * b.h;
      allHv += f * b.h * b.v;
      const ct = thrustCoefficient(model, b.v);
      if (ct <= 0) {
        freeMWh += f * b.h * powerMW(model, b.v);
        freeHv += f * b.h * b.v;
        continue;
      }
      const c: WindCase = { dx: -Math.sin(th), dy: -Math.cos(th), v: b.v, h: f * b.h, ct, sq: new Float64Array(t.length) };
      for (let i = 0; i < t.length; i++)
        for (let j = 0; j < t.length; j++) if (j !== i) c.sq[i] += contribution(t[j], t[i], c, d) ** 2;
      cases.push(c);
    }
  });
  const netMWh = t.map(() => freeMWh);
  const hv = t.map(() => freeHv);
  for (const c of cases)
    for (let i = 0; i < t.length; i++) {
      const u = waked(c, c.sq[i]);
      netMWh[i] += c.h * powerMW(model, u);
      hv[i] += c.h * u;
    }
  return {
    t,
    model,
    cases,
    freeMWh,
    freeHv,
    hours,
    grossOneMWh,
    freeMeanMs: hours > 0 ? allHv / hours : 0,
    netMWh,
    meanMs: hv.map((x) => (hours > 0 ? x / hours : 0)),
  };
}

export interface YieldResult {
  grossGWh: number;
  netGWh: number;
  wakeLossPct: number;
  capacityFactor: number;
  /** Rose-weighted wake loss per turbine [%]. */
  perTurbineLossPct: number[];
  /** Net energy per turbine [GWh/yr] (wake only). */
  perTurbineNetGWh: number[];
}

export function yieldOf(m: YieldModel): YieldResult {
  const n = m.t.length;
  const gross = m.grossOneMWh * n;
  const net = m.netMWh.reduce((s, x) => s + x, 0);
  return {
    grossGWh: gross / 1000,
    netGWh: net / 1000,
    wakeLossPct: gross > 0 ? 100 * (1 - net / gross) : 0,
    capacityFactor: n ? net / ((m.model.ratedKw / 1000) * HOURS_PER_YEAR * n) : 0,
    perTurbineLossPct: m.netMWh.map((e) => (m.grossOneMWh > 0 ? 100 * (1 - e / m.grossOneMWh) : 0)),
    perTurbineNetGWh: m.netMWh.map((e) => e / 1000),
  };
}

export function layoutYield(
  t: XY[],
  a: number,
  k: number,
  rose: WindRose = UNIFORM_ROSE,
  model: TurbineModel = REFERENCE_TURBINE,
): YieldResult {
  return yieldOf(prepareYield(t, a, k, rose, model));
}

export interface MoveEffect {
  /** Change of the farm's net AEP [GWh/yr] (wake only). */
  deltaGWh: number;
  /** The moved turbine at its new position: net AEP [GWh/yr], wake loss [%], mean hub speed [m/s]. */
  turbineGWh: number;
  turbineLossPct: number;
  turbineMeanMs: number;
}

/**
 * Yield change when turbine `i` moves to `p`, exact for this model: the
 * deficits it casts on the others and those it receives are swapped in the
 * prepared sums; nothing else changes.
 */
export function moveDelta(m: YieldModel, i: number, p: XY): MoveEffect {
  const { t, model } = m;
  const d = model.rotorDiameterM;
  let delta = 0;
  let own = m.freeMWh;
  let ownHv = m.freeHv;
  for (const c of m.cases) {
    let sqI = 0;
    for (let j = 0; j < t.length; j++) {
      if (j === i) continue;
      sqI += contribution(t[j], p, c, d) ** 2;
      const before = contribution(t[i], t[j], c, d);
      const after = contribution(p, t[j], c, d);
      if (before === after) continue;
      const sq = c.sq[j] - before * before + after * after;
      delta += c.h * (powerMW(model, waked(c, sq)) - powerMW(model, waked(c, c.sq[j])));
    }
    const u = waked(c, sqI);
    own += c.h * powerMW(model, u);
    ownHv += c.h * u;
  }
  delta += own - m.netMWh[i];
  return {
    deltaGWh: delta / 1000,
    turbineGWh: own / 1000,
    turbineLossPct: m.grossOneMWh > 0 ? 100 * (1 - own / m.grossOneMWh) : 0,
    turbineMeanMs: m.hours > 0 ? ownHv / m.hours : 0,
  };
}
