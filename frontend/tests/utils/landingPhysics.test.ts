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

  it("switches reactors: 4 × 180 MVAr against 624 MVAr of charging", () => {
    // no load: all four over-absorb by 96 MVAr (> half the STATCOM), three leave −84 — one goes out.
    // The backend load flow keeps four (+60 MVAr): there the grid and the Ferranti-raised cable
    // voltage take part; this estimate ignores both.
    const idle = reactiveBalance(0);
    expect(idle.reactorsInService).toBe(3);
    expect(idle.statcomMVAr).toBeCloseTo(540 - 624, 0);

    // rated: the transformers' and cables' I²X (≈ 158 MVAr) absorbs too; two would leave −106,
    // worse than three's +74, so three stay (backend: three, +28 MVAr)
    const full = reactiveBalance(510);
    expect(full.reactorsInService).toBe(3);
    expect(full.statcomMVAr).toBeCloseTo(540 + 158 - 624, 0);
  });
});

describe("exportCableState", () => {
  it("matches Q = ωCV²L and stays within the 950 A / 90 °C rating at full output", () => {
    const idle = exportCableState(0);
    expect(idle.chargingMVArPerCircuit).toBeCloseTo(312, 0); // 108 km: 2 × 312 = 624 MVAr
    expect(idle.currentA).toBeGreaterThan(150); // charging current alone

    const full = exportCableState(510);
    expect(full.currentA).toBeGreaterThan(669); // 510 MW / (√3·220 kV·2) = 669 A active
    expect(full.loadingPct).toBeLessThan(100);
    expect(full.conductorC).toBeLessThan(EXPORT_CABLE.maxConductorC);
    expect(full.lossesMW).toBeGreaterThan(4);
    expect(full.lossesMW).toBeLessThan(8); // ≈ 1.3 % of 510 MW over 108 km (backend 6.7 MW)
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

  it("follows the official IEA 15 MW operating table", () => {
    expect(v236RotorRpm(V236.ratedMs)).toBeCloseTo(7.5176, 3); // 95 m/s tip-speed limit
    expect(v236RotorRpm(3)).toBe(5.0); // minimum rotor speed
    expect(v236RotorRpm(8)).toBeCloseTo(5.70, 2); // λ = 9 tracking
    expect(v236PitchDeg(3)).toBeCloseTo(3.918, 3); // minimum-pitch schedule
    expect(v236PitchDeg(10)).toBe(0);
    expect(v236PitchDeg(25)).toBeCloseTo(22.83, 2);
    expect(v236PitchDeg(15)).toBeGreaterThan(5);
    expect(v236PitchDeg(15)).toBeLessThan(v236PitchDeg(20));
    expect(v236PitchDeg(2)).toBe(90);
  });
});

describe("v236PowerChain", () => {
  it("is energy-consistent and physically bounded at rated", () => {
    const c = v236PowerChain(15, V236.ratedMs, 7.56);
    expect(c.rotorMW - c.generator.lossMW - c.converter.lossMW).toBeCloseTo(15, 9); // energy balance
    expect(c.transformer.outMW + c.transformer.lossMW).toBeCloseTo(15, 9);
    expect(c.rotorMW).toBeCloseTo(15.665, 2); // 15 MW ÷ 0.95756 (ROSCO VS_GenEff)
    expect(c.cp).toBeCloseTo(0.461, 2); // table Cp_aero at rated
    expect(c.generatorRpm).toBe(7.56); // direct drive
    expect(c.generatorHz).toBeCloseTo(12.6, 2); // 100 pole pairs
    expect(c.rotorTorqueKNm).toBeCloseTo(19_787, -2); // ROSCO VS_RtTq 19.79 MN·m
  });
});

describe("array cables", () => {
  it("grades like the backend and loads the OSS-end cable ≈ 95 % at full output", () => {
    expect(arrayCableGrade(0, 6).mm2).toBe(1000); // OSS end: 6 turbines, 787 A > 775 A of 800 mm²
    expect(arrayCableGrade(1, 6).mm2).toBe(630); // 5 turbines, 656 A > 655 A of 500 mm²
    expect(arrayCableGrade(5, 6).mm2).toBe(500); // far end
    const full = arrayCableCurrentA(6 * 15); // 90 MW string
    expect(full).toBeCloseTo(787, 0); // backend string_current_ka(6)
    expect(full / arrayCableGrade(0, 6).ratedA).toBeCloseTo(0.954, 3); // 787 / 825 A
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
  it("matches the backend calibration: 825 A at 20 °C → 90 °C in the J-tube", async () => {
    const { dtsTempC, DTS_R_EXT_J_TUBE } = await import("../../src/utils/landingPhysics");
    expect(DTS_R_EXT_J_TUBE).toBeCloseTo(3.67, 2);
    expect(dtsTempC(0.1, 825, 20)).toBeCloseTo(90, 6);
    // HDD landfall is the onshore hotspot, below the J-tube
    expect(dtsTempC(79.1, 825, 20)).toBeGreaterThan(dtsTempC(20, 825, 20));
    expect(dtsTempC(79.1, 825, 20)).toBeLessThan(90);
    // 510 MW → ≈ 818 A at the OSS end (99 %): below the 80 °C DTS alarm only in a cold sea
    expect(dtsTempC(0.1, 818, 10)).toBeLessThan(80);
    // same numbers as backend steady_temps(): 818 A → 82.34 °C (J-tube, 15 °C), 825 A → 84.54 °C (HDD, 20 °C)
    expect(dtsTempC(0.1, 818, 15)).toBeCloseTo(82.34, 1);
    expect(dtsTempC(79.1, 825, 20)).toBeCloseTo(84.54, 1);
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
