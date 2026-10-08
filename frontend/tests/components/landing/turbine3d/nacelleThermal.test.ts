import { describe, expect, it } from "vitest";

import {
  generatorWindingC,
  irColour,
  modelTempC,
  nacelleTemperatures,
  thermalHealthIndex,
  thermalState,
} from "../../../../src/components/landing/turbine3d/model/nacelleThermal";

describe("modelTempC", () => {
  it("is air + rated rise at rated load", () => {
    expect(modelTempC("transformer", 1, 15)).toBeCloseTo(95, 6); // 15 + 80 K
    expect(modelTempC("mainBearing", 1, 15)).toBeCloseTo(55, 6); // 15 + 40 K
  });

  it("copper-loss parts scale with p² above the no-load share", () => {
    // transformer: k0 = 0.12 → at half load 80·(0.12 + 0.88·0.25) = 27.2 K
    expect(modelTempC("transformer", 0.5, 0)).toBeCloseTo(80 * (0.12 + 0.88 * 0.25), 6);
    expect(modelTempC("transformer", 0, 10)).toBeGreaterThan(10); // core loss
  });

  it("rated temperatures stay below the alarm limits on a 15 °C day", () => {
    for (const id of ["generator", "converter", "transformer", "mainBearing", "rearBearing", "hydraulicOil"] as const) {
      expect(thermalState(id, modelTempC(id, 1, 15))).toBe("ok");
    }
  });
});

describe("generatorWindingC (mirrors backend compute_cooling_state)", () => {
  it("equals air with no power", () => {
    expect(generatorWindingC(0, 12)).toBe(12);
  });

  it("≈ 92.6 °C at rated on a 15 °C day", () => {
    // P_mech = 15 / (0.9655·0.9918) = 15.665 MW; Q_gen = 3.45 % = 540 kW → 15 + 10 + 0.125·540
    expect(generatorWindingC(15, 15)).toBeCloseTo(92.6, 1);
  });
});

describe("nacelleTemperatures", () => {
  it("prefers live telemetry", () => {
    const t = nacelleTemperatures({ powerMW: 15, airC: 12, bearingC: 52.3, windingC: 101 });
    expect(t.mainBearing.tempC).toBe(52.3);
    expect(t.mainBearing.live).toBe(true);
    expect(t.generator.tempC).toBe(101);
    expect(t.generator.live).toBe(true);
    expect(t.rearBearing.live).toBe(false);
  });

  it("flags alarm and trip from the insulation-class limits (130 / 155 °C)", () => {
    expect(nacelleTemperatures({ powerMW: 15, airC: 12, windingC: 135 }).generator.state).toBe("alarm");
    expect(nacelleTemperatures({ powerMW: 15, airC: 12, windingC: 156 }).generator.state).toBe("trip");
  });
});

describe("thermalHealthIndex", () => {
  it("is 100 at nominal and 0 at the trip limit", () => {
    expect(thermalHealthIndex("generator", modelTempC("generator", 1, 15))).toBe(100);
    expect(thermalHealthIndex("generator", 155)).toBe(0);
    expect(thermalHealthIndex("mainBearing", 80)).toBe(0);
    const mid = thermalHealthIndex("mainBearing", 67.5);
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(60);
  });
});

describe("irColour", () => {
  it("returns a hex colour and saturates outside the range", () => {
    expect(irColour(-20)).toBe(irColour(10));
    expect(irColour(500)).toBe(irColour(140));
    expect(irColour(60)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
