import { describe, expect, it } from "vitest";

import {
  inductionFromCt,
  v236ThrustMN,
  v236TowerTopDeflectionM,
  v236TipDeflectionM,
  EXPORT_CABLE,
  arrayCableCurrentA,
  arrayCableGrade,
  plantNet,
  V236,
  exportCableState,
  farmWakeDeficits,
  wakePowerLossPct,
  gustMs,
  reactiveBalance,
  turbulenceIntensity,
  v236PitchDeg,
  v236PowerChain,
  turbinePowerMW,
  v236RotorRpm,
  windAtHeight,
} from "../../src/utils/landingPhysics";

describe("reactiveBalance", () => {
  it("closes Q ≈ 0 at the grid connection across the output range", () => {
    for (const mw of [0, 100, 255, 400, 510]) {
      const b = reactiveBalance(mw);
      const net = b.cableMVAr + b.statcomMVAr + b.reactorsMVAr + b.seriesLossMVAr;
      expect(Math.abs(net)).toBeLessThan(1e-9);
      expect(Math.abs(b.statcomMVAr)).toBeLessThanOrEqual(plantNet().statcomMVAr);
    }
  });

  it("switches the N+1 spare: 3 × 170 MVAr against 442 MVAr of charging", () => {
    // no load: all three over-absorb by 68 MVAr, still less than the −102 two would leave
    const idle = reactiveBalance(0);
    expect(idle.reactorsInService).toBe(3);
    expect(idle.statcomMVAr).toBeCloseTo(510 - 442, 0);

    // rated: the transformers' and cables' I²X (≈ 146 MVAr) absorbs too — the spare goes out
    const full = reactiveBalance(510);
    expect(full.reactorsInService).toBe(2);
    expect(full.statcomMVAr).toBeCloseTo(340 + 146 - 442, 0);
  });
});

describe("exportCableState", () => {
  it("matches Q = ωCV²L and stays within the 950 A / 90 °C rating at full output", () => {
    const idle = exportCableState(0);
    expect(idle.chargingMVArPerCircuit).toBeCloseTo(221, 0); // 76.5 km: 2 × 221 = 442 MVAr
    expect(idle.currentA).toBeGreaterThan(150); // charging current alone

    const full = exportCableState(510);
    expect(full.currentA).toBeGreaterThan(669); // 510 MW / (√3·220 kV·2) = 669 A active
    expect(full.loadingPct).toBeLessThan(100);
    expect(full.conductorC).toBeLessThan(EXPORT_CABLE.maxConductorC);
    expect(full.lossesMW).toBeGreaterThan(4);
    expect(full.lossesMW).toBeLessThan(7); // ≈ 1.1 % of 510 MW over 76.5 km
  });
});

describe("SB-510 turbine operating model (IEA 15 MW curves)", () => {
  it("follows the backend power curve and domain limits", () => {
    expect([V236.cutInMs, V236.cutOutMs]).toEqual([3, 25]);
    expect(V236.ratedMs).toBeCloseTo(10.66, 2);
    expect(turbinePowerMW(2.9)).toBe(0); // below cut-in
    expect(turbinePowerMW(8)).toBeCloseTo(6.34, 1); // IEA-15 table (Cp ≈ 0.48)
    expect(turbinePowerMW(V236.ratedMs)).toBeCloseTo(15);
    expect(turbinePowerMW(20)).toBe(15);
    expect(turbinePowerMW(25.5)).toBe(0); // above cut-out
    for (let v = 0; v <= 35; v += 0.5) {
      expect(turbinePowerMW(v)).toBeGreaterThanOrEqual(0);
      expect(turbinePowerMW(v)).toBeLessThanOrEqual(V236.ratedMW);
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

describe("array cables", () => {
  it("grades like the backend and loads the OSS-end cable ≈ 87 % at full output", () => {
    expect(arrayCableGrade(0, 6).mm2).toBe(800); // OSS end
    expect(arrayCableGrade(5, 6).mm2).toBe(500); // far end
    const full = arrayCableCurrentA(6 * 15); // 90 MW string
    expect(full).toBeCloseTo(787, 0); // backend comment: ≈ 790 A
    expect(full / arrayCableGrade(0, 6).ratedA).toBeGreaterThan(0.85);
    expect(full / arrayCableGrade(0, 6).ratedA).toBeLessThan(0.9);
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
    const below = wakePowerLossPct(8, deficit); // below rated: close to the cubic rule
    expect(below).toBeGreaterThan(36);
    expect(below).toBeLessThan(44);
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

describe("export cable DTS profile", () => {
  it("matches the backend calibration: 950 A at 15 °C → 90 °C in the J-tube", async () => {
    const { dtsTempC, DTS_R_EXT_J_TUBE } = await import("../../src/utils/landingPhysics");
    expect(DTS_R_EXT_J_TUBE).toBeCloseTo(2.92, 2);
    expect(dtsTempC(0.1, 950, 15)).toBeCloseTo(90, 6);
    // HDD landfall is the onshore hotspot, below the J-tube
    expect(dtsTempC(63.1, 950, 15)).toBeGreaterThan(dtsTempC(20, 950, 15));
    expect(dtsTempC(63.1, 950, 15)).toBeLessThan(90);
    // 510 MW → ≈ 730 A per circuit: well below the 70 °C DTS alarm at 10 °C
    expect(dtsTempC(0.1, 730, 10)).toBeLessThan(70);
    // same numbers as backend steady_temps(): 730 A → 56.10 °C (J-tube), 950 A → 84.20 °C (HDD)
    expect(dtsTempC(0.1, 730, 15)).toBeCloseTo(56.1, 1);
    expect(dtsTempC(63.1, 950, 15)).toBeCloseTo(84.2, 1);
  });
});

describe("V236 rotor loads", () => {
  it("thrust peaks at rated (≈ 2.45 MN, IEA 15 MW) and falls above rated", () => {
    const rated = v236ThrustMN(V236.ratedMs);
    expect(rated).toBeGreaterThan(2.35);
    expect(rated).toBeLessThan(2.6);
    expect(v236ThrustMN(8)).toBeLessThan(rated);
    expect(v236ThrustMN(20)).toBeLessThan(rated * 0.6);
    expect(v236ThrustMN(2)).toBe(0);
    expect(v236ThrustMN(26)).toBe(0);
  });
  it("gives deflections of the right order at rated", () => {
    const t = v236ThrustMN(V236.ratedMs);
    expect(v236TipDeflectionM(t)).toBeCloseTo(10, 5);
    const top = v236TowerTopDeflectionM(t);
    expect(top).toBeGreaterThan(0.6);
    expect(top).toBeLessThan(1.2);
  });
  it("inverts Ct = 4a(1−a)", () => {
    const a = inductionFromCt(0.8);
    expect(4 * a * (1 - a)).toBeCloseTo(0.8, 6);
    expect(a).toBeCloseTo(0.276, 2);
  });
});
