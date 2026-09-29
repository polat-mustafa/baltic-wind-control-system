import { describe, expect, it } from "vitest";

import {
  EXPORT_CABLE,
  STATCOM_RATING_MVAR,
  V236,
  exportCableState,
  farmWakeDeficits,
  wakePowerLossPct,
  gustMs,
  reactiveBalance,
  turbulenceIntensity,
  v236PitchDeg,
  v236PowerChain,
  v236PowerMW,
  v236RotorRpm,
  windAtHeight,
} from "../../src/utils/landingPhysics";

describe("reactiveBalance", () => {
  it("closes Q ≈ 0 at the grid connection across the output range", () => {
    for (const mw of [0, 100, 255, 400, 510]) {
      const b = reactiveBalance(mw);
      const net = b.cableMVAr + b.statcomMVAr + b.reactorsMVAr + b.seriesLossMVAr;
      expect(Math.abs(net)).toBeLessThan(1e-9);
      expect(Math.abs(b.statcomMVAr)).toBeLessThanOrEqual(STATCOM_RATING_MVAR);
    }
  });

  it("absorbs cable surplus at no load and injects near rated output", () => {
    const idle = reactiveBalance(0);
    expect(idle.statcomMVAr).toBeLessThan(0);
    expect(idle.reactorsInService).toBe(3);

    const full = reactiveBalance(510);
    expect(full.statcomMVAr).toBeGreaterThan(0);
    expect(full.reactorsInService).toBe(2);
  });
});

describe("exportCableState", () => {
  it("matches Q = ωCV²L and stays within the 950 A / 90 °C rating at full output", () => {
    const idle = exportCableState(0);
    expect(idle.chargingMVArPerCircuit).toBeCloseTo(130, 0); // 2 × 130 = 260 MVAr
    expect(idle.currentA).toBeGreaterThan(150); // charging current alone

    const full = exportCableState(510);
    expect(full.currentA).toBeGreaterThan(669); // 510 MW / (√3·220 kV·2) = 669 A active
    expect(full.loadingPct).toBeLessThan(100);
    expect(full.conductorC).toBeLessThan(EXPORT_CABLE.maxConductorC);
    expect(full.lossesMW).toBeGreaterThan(2);
    expect(full.lossesMW).toBeLessThan(4); // ≈ 0.6 % of 510 MW
  });
});

describe("V236 operating model", () => {
  it("follows the backend power curve and domain limits", () => {
    expect(v236PowerMW(2.9)).toBe(0); // below cut-in
    expect(v236PowerMW(8)).toBeCloseTo(15 * (8 / 11.1) ** 3); // ≈ 5.55 MW
    expect(v236PowerMW(11.1)).toBeCloseTo(15);
    expect(v236PowerMW(20)).toBe(15);
    expect(v236PowerMW(31.5)).toBe(0); // above cut-out
    for (let v = 0; v <= 35; v += 0.5) {
      expect(v236PowerMW(v)).toBeGreaterThanOrEqual(0);
      expect(v236PowerMW(v)).toBeLessThanOrEqual(V236.ratedMW);
    }
  });

  it("reaches rated rpm at rated wind and pitches only above it", () => {
    expect(v236RotorRpm(11.1)).toBeCloseTo(8.33);
    expect(v236RotorRpm(3)).toBe(4.0);
    expect(v236PitchDeg(10)).toBe(0);
    expect(v236PitchDeg(15)).toBeGreaterThan(5);
    expect(v236PitchDeg(15)).toBeLessThan(v236PitchDeg(20));
    expect(v236PitchDeg(2)).toBe(90);
  });
});

describe("v236PowerChain", () => {
  it("is energy-consistent and physically bounded at rated", () => {
    const c = v236PowerChain(15, 11.1, 8.33);
    const losses = c.gearbox.lossMW + c.generator.lossMW + c.converter.lossMW + c.transformer.lossMW;
    expect(c.rotorMW - losses).toBeCloseTo(15, 9); // energy balance
    expect(c.rotorMW).toBeCloseTo(16.3, 1); // 15 MW electrical ÷ Πη
    expect(c.cp).toBeGreaterThan(0.4);
    expect(c.cp).toBeLessThan(16 / 27); // Betz
    expect(c.generatorRpm).toBeCloseTo(400, 0); // 8.33 rpm × 48
    expect(c.rotorTorqueKNm).toBeGreaterThan(18_000);
    expect(c.rotorTorqueKNm).toBeLessThan(19_500);
  });
});

describe("wakes", () => {
  it("finds waked turbines and caches per 5° direction", () => {
    const d = farmWakeDeficits(225);
    expect(d.size).toBeGreaterThan(0);
    expect(farmWakeDeficits(226)).toBe(d); // same 5° bin → same cached map
    for (const deficit of d.values()) {
      expect(deficit).toBeGreaterThan(0);
      expect(deficit).toBeLessThan(0.6);
    }
  });

  it("loses less power above rated than the cubic rule suggests", () => {
    const deficit = 0.157; // cubic rule: 1 − (1 − δ)³ ≈ 40 %
    expect(wakePowerLossPct(8, deficit)).toBeCloseTo(40, 0); // below rated: cubic holds
    expect(wakePowerLossPct(12.1, deficit)).toBeLessThan(30); // above rated: much less
    expect(wakePowerLossPct(16, deficit)).toBe(0); // 13.5 m/s waked is still ≥ rated
    expect(wakePowerLossPct(2, deficit)).toBe(0); // below cut-in: nothing to lose
  });
});

describe("offshore wind statistics", () => {
  it("keeps TI in a plausible offshore band and gust factor ≈ 1.2–1.4", () => {
    for (const u of [4, 8, 12, 20]) {
      const ti = turbulenceIntensity(u);
      expect(ti).toBeGreaterThan(0.05);
      expect(ti).toBeLessThan(0.13);
      const g = gustMs(u) / u;
      expect(g).toBeGreaterThan(1.15);
      expect(g).toBeLessThan(1.4);
    }
  });

  it("returns hub wind at hub height and less wind below it", () => {
    expect(windAtHeight(10, 150)).toBeCloseTo(10);
    expect(windAtHeight(10, 40)).toBeLessThan(10);
  });
});
