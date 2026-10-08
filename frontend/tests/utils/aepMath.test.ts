import { describe, expect, it } from "vitest";

import {
  exceedance,
  gamma,
  grossTurbineMWh,
  HOURS_PER_YEAR,
  lossCascade,
  normalCdf,
  rss,
  speedBins,
  UNCERTAINTY_SOURCES,
  weibullMean,
} from "../../src/utils/aepMath";

describe("aepMath", () => {
  it("gamma matches known values", () => {
    expect(gamma(5)).toBeCloseTo(24, 8);
    expect(gamma(1.5)).toBeCloseTo(Math.sqrt(Math.PI) / 2, 10);
    // Rayleigh (k = 2): mean = A·√π/2 ≈ 0.886·A
    expect(weibullMean(10, 2)).toBeCloseTo(8.862, 3);
  });

  it("hours per year sum to 8760", () => {
    const total = speedBins(10.5, 2.2, 40).reduce((s, b) => s + b.hours, 0);
    expect(total).toBeCloseTo(HOURS_PER_YEAR, 0);
  });

  it("gross yield of the reference turbine is in the backend's PyWake range", () => {
    // Backend PyWake (no wake), IEA 15 MW, A = 10.5, k = 2.2: 74.70 GWh per turbine
    const gwh = grossTurbineMWh(10.5, 2.2) / 1000;
    expect(gwh).toBeGreaterThan(73.7);
    expect(gwh).toBeLessThan(75.7);
    // Physical bound: never above rated × 8760
    expect(gwh).toBeLessThan((15 * HOURS_PER_YEAR) / 1000);
  });

  it("losses are multiplicative, not additive", () => {
    const steps = lossCascade(100, [
      ["a", 10],
      ["b", 10],
    ]);
    expect(steps[1].after).toBeCloseTo(81, 10); // not 80
  });

  it("SB-510 RSS uncertainty = 7.7 % and P90 = P50·(1 − 1.282σ)", () => {
    const sigma = rss(UNCERTAINTY_SOURCES.map(([, s]) => s));
    expect(sigma).toBeCloseTo(7.7, 2); // backend test pins the components to aep_calculator
    expect(exceedance(1000, 6.2, 1.282)).toBeCloseTo(920.5, 1);
  });

  it("normal CDF matches the exceedance z-scores", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(-1.282)).toBeCloseTo(0.1, 3); // P90 ↔ 10 % below
    expect(normalCdf(2.326)).toBeCloseTo(0.99, 3);
  });
});
