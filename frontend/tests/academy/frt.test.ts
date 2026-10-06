import { describe, expect, it } from "vitest";

import { frtQuestions, iqOptions, iqSetpoint, mustRideThrough, pseProfile, scoreFrt, voltageAt } from "../../src/academy/frt";
import { rng } from "../../src/academy/random";

describe("PSE FRT profile (backend frt_simulation.py)", () => {
  it("is 0 pu to 0.15 s, then a line to 0.85 pu at 2.5 s", () => {
    expect(pseProfile(0)).toBe(0);
    expect(pseProfile(0.15)).toBe(0);
    expect(pseProfile(1.325)).toBeCloseTo(0.425, 6);
    expect(pseProfile(2.5)).toBeCloseTo(0.85, 9);
    expect(pseProfile(3)).toBeCloseTo(0.85, 9);
  });

  it("requires ride-through of a bolted 150 ms fault but not of a 300 ms one", () => {
    const fast = { uRet: 0, faultS: 0.15, uEnd: 1, rampS: 0.1 };
    expect(voltageAt(fast, 0.1)).toBe(0);
    expect(mustRideThrough(fast)).toBe(true);
    expect(mustRideThrough({ ...fast, faultS: 0.3 })).toBe(false);
  });

  it("lets the plant disconnect when the voltage stays below 0.85 pu after 2.5 s", () => {
    expect(mustRideThrough({ uRet: 0.7, faultS: 0.1, uEnd: 0.8, rampS: 0.3 })).toBe(false);
    expect(mustRideThrough({ uRet: 0.7, faultS: 0.1, uEnd: 0.85, rampS: 0.3 })).toBe(true);
  });
});

describe("fast fault current", () => {
  it("is K·ΔU outside the ±0.1 pu dead band, capped at 1 pu", () => {
    expect(iqSetpoint(0.1)).toBe(0);
    expect(iqSetpoint(0.3)).toBeCloseTo(0.6, 9);
    expect(iqSetpoint(0.7)).toBe(1);
    expect(iqSetpoint(1 - 0.9)).toBe(0); // floating point: 0.09999…
  });

  it("offers four distinct options, one of them correct", () => {
    const c = { uRet: 0.6, faultS: 0.2, uEnd: 1, rampS: 0.3 };
    const opts = iqOptions(c, rng(3));
    expect(new Set(opts).size).toBe(opts.length);
    expect(opts.length).toBe(4);
    expect(opts).toContain(0.8);
  });
});

describe("generated questions", () => {
  it("are reproducible from the seed and balanced", () => {
    for (const seed of [1, 2, 3, 42, 2024]) {
      const q = frtQuestions(seed);
      expect(q).toEqual(frtQuestions(seed));
      expect(q).toHaveLength(5);
      expect(q.filter((x) => x.rideThrough).length).toBeGreaterThanOrEqual(2);
      expect(q.filter((x) => !x.rideThrough).length).toBeGreaterThanOrEqual(2);
      for (const x of q) {
        expect(mustRideThrough(x.case)).toBe(x.rideThrough);
        expect(x.iqOptions).toContain(x.iq);
      }
    }
  });

  it("scores 12 + 8 points per case", () => {
    const q = frtQuestions(7);
    const perfect = q.map((x) => ({ rideThrough: x.rideThrough, iq: x.iq }));
    expect(scoreFrt(q, perfect)).toBe(100);
    expect(scoreFrt(q, q.map(() => ({ rideThrough: null, iq: null })))).toBe(0);
    const verdictsOnly = q.map((x) => ({ rideThrough: x.rideThrough, iq: null }));
    expect(scoreFrt(q, verdictsOnly)).toBe(60);
  });
});
