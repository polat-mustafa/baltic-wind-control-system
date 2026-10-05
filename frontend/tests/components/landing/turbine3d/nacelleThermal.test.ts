import { describe, expect, it } from "vitest";

import {
  gearboxOilC,
  irColour,
  modelTempC,
  nacelleTemperatures,
  thermalHealthIndex,
  thermalState,
} from "../../../../src/components/landing/turbine3d/model/nacelleThermal";

describe("modelTempC", () => {
  it("is air + rated rise at rated load", () => {
    expect(modelTempC("generator", 1, 15)).toBeCloseTo(90, 6); // 15 + 75 K
    expect(modelTempC("transformer", 1, 15)).toBeCloseTo(95, 6); // 15 + 80 K
  });

  it("copper-loss parts scale with p² above the no-load share", () => {
    // generator: k0 = 0.25 → at half load 75·(0.25 + 0.75·0.25) = 32.8 K
    expect(modelTempC("generator", 0.5, 0)).toBeCloseTo(75 * (0.25 + 0.75 * 0.25), 6);
    // no-load (iron) loss keeps an idling generator above air
    expect(modelTempC("generator", 0, 10)).toBeGreaterThan(10);
  });

  it("rated temperatures stay below the alarm limits on a 15 °C day", () => {
    for (const id of ["generator", "converter", "transformer", "mainBearing"] as const) {
      expect(thermalState(id, modelTempC(id, 1, 15))).toBe("ok");
    }
  });
});

describe("gearboxOilC (mirrors backend compute_cooling_state)", () => {
  it("equals air with no power", () => {
    expect(gearboxOilC(0, 12)).toBe(12);
  });

  it("≈ air + 38 K at rated with the fan at ~60 % (12 °C air)", () => {
    // Q = 15/(0.97·0.975)·0.03 = 476 kW; first pass 43.7 °C → fan 59.8 % →
    // UA = 15 kW/K·0.839 → 37.8 K
    const oil = gearboxOilC(15, 12);
    expect(oil).toBeGreaterThan(49);
    expect(oil).toBeLessThan(51);
  });
});

describe("nacelleTemperatures", () => {
  it("prefers live telemetry and derives the HS bearing from the oil", () => {
    const t = nacelleTemperatures({ powerMW: 15, airC: 12, bearingC: 52.3, oilC: 61 });
    expect(t.mainBearing.tempC).toBe(52.3);
    expect(t.mainBearing.live).toBe(true);
    expect(t.gearboxOil.tempC).toBe(61);
    expect(t.hsBearing.tempC).toBe(69);
    expect(t.generator.live).toBe(false);
  });

  it("flags alarm and trip from the limits", () => {
    expect(nacelleTemperatures({ powerMW: 15, airC: 12, oilC: 78 }).gearboxOil.state).toBe("alarm");
    expect(nacelleTemperatures({ powerMW: 15, airC: 12, oilC: 90 }).gearboxOil.state).toBe("trip");
  });
});

describe("thermalHealthIndex", () => {
  it("is 100 at nominal and 0 at the trip limit", () => {
    expect(thermalHealthIndex("generator", modelTempC("generator", 1, 15))).toBe(100);
    expect(thermalHealthIndex("generator", 145)).toBe(0);
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
