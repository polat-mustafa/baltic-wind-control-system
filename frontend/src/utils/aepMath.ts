/**
 * AEP teaching maths — Weibull × power curve, loss cascade, exceedance.
 *
 * Mirrors the backend (services/p1/aep_calculator.py) so the explainer's
 * numbers match the analysis: multiplicative losses, RSS uncertainty (SB-510: 7.7 %),
 * P_xx = P50 · (1 − z·σ). Power curve from utils/landingPhysics (single source).
 */

import { turbinePowerMW } from "./landingPhysics";

export const HOURS_PER_YEAR = 8760;
export const Z = { P75: 0.674, P90: 1.282, P99: 2.326 } as const;

/**
 * SB-510's uncertainty components [% σ of AEP] — backend aep_calculator.uncertainty_components
 * (A 10.80 m/s, k 2.04, wake 6.47 %, blockage 1.95 %); RSS = √59.3 = 7.7 %. Sources: NEWA spread
 * (Dörenkämper et al. 2020), ERA5 interannual variability, Walker et al. 2016, Lee & Fields 2021.
 */
export const UNCERTAINTY_SOURCES: [string, number][] = [
  ["Wind resource (NEWA model, no measurement)", 5.51],
  ["Long-term period (30-year atlas)", 0.75],
  ["Future variability (25 years)", 0.82],
  ["Wake and blockage model", 2.1],
  ["Turbine performance (reference power curve)", 4.0],
  ["Plant non-wake losses", 2.7],
];

export const rss = (sigmas: number[]) => Math.sqrt(sigmas.reduce((s, x) => s + x * x, 0));

/** Γ(x) via Lanczos (g = 7) — enough for Weibull mean conversions. */
export function gamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  const xx = x - 1;
  let a = c[0];
  const t = xx + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (xx + i);
  return Math.sqrt(2 * Math.PI) * t ** (xx + 0.5) * Math.exp(-t) * a;
}

/** Mean wind speed of Weibull(A, k): v̄ = A · Γ(1 + 1/k). */
export const weibullMean = (a: number, k: number) => a * gamma(1 + 1 / k);

const weibullCdf = (v: number, a: number, k: number) => (v <= 0 ? 0 : 1 - Math.exp(-((v / a) ** k)));

export interface SpeedBin {
  /** Bin centre [m/s] (bins are 1 m/s wide: v−0.5 … v+0.5). */
  v: number;
  hours: number;
  powerMW: number;
  /** Energy from this bin for one turbine [MWh/yr]. */
  energyMWh: number;
}

/** Hours per year in each 1 m/s bin, V236 power, and energy = hours × power. */
export function speedBins(a: number, k: number, maxV = 30): SpeedBin[] {
  const bins: SpeedBin[] = [];
  for (let v = 0; v <= maxV; v++) {
    const hours = HOURS_PER_YEAR * (weibullCdf(v + 0.5, a, k) - weibullCdf(v - 0.5, a, k));
    const powerMW = turbinePowerMW(v);
    bins.push({ v, hours, powerMW, energyMWh: hours * powerMW });
  }
  return bins;
}

/**
 * Gross energy of one V236 [MWh/yr], integrated at 0.05 m/s steps
 * (the 1 m/s bins above are for display; this is the accurate total).
 */
export function grossTurbineMWh(a: number, k: number): number {
  let e = 0;
  const dv = 0.05;
  for (let v = dv / 2; v < 35; v += dv) {
    e += turbinePowerMW(v) * (weibullCdf(v + dv / 2, a, k) - weibullCdf(v - dv / 2, a, k));
  }
  return e * HOURS_PER_YEAR;
}

export interface CascadeStep {
  name: string;
  lossPct: number;
  /** Energy lost in this step [same unit as gross]. */
  lost: number;
  /** Energy left after this step. */
  after: number;
}

/** Multiplicative loss cascade: each loss acts on what is left. */
export function lossCascade(gross: number, losses: [string, number][]): CascadeStep[] {
  let left = gross;
  return losses.map(([name, lossPct]) => {
    const lost = (left * lossPct) / 100;
    left -= lost;
    return { name, lossPct, lost, after: left };
  });
}

/** Standard normal CDF Φ(z) — Abramowitz & Stegun 7.1.26 erf, |error| < 1.5·10⁻⁷. */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** P_xx = P50 · (1 − z·σ). */
export const exceedance = (p50: number, sigmaPct: number, z: number) => p50 * (1 - (z * sigmaPct) / 100);
