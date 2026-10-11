/** Control-room failures follow Carroll et al. (2016) and every string they show has Turkish. */

import { beforeAll, describe, expect, it } from "vitest";

import { FAULT_CATEGORIES } from "../../../src/constants/faultCategories";
import { loadLanguage, translate } from "../../../src/lib/i18n";
import { FAILURE_MODES, MODELLED_RATE, TIME_COMPRESSION, drawFault, faultProbability, repairTicks } from "../../../src/lib/plant/failures";

describe("failure model", () => {
  it("covers every alarm type and uses the paper's rates", () => {
    expect(Object.keys(FAILURE_MODES).sort()).toEqual(FAULT_CATEGORIES.map((c) => c.type).sort());
    // 5.1 of the paper's 8.3 failures/turbine/year map to a stop alarm here
    expect(MODELLED_RATE).toBeCloseTo(5.087, 2);
    expect(FAILURE_MODES.GENERATOR_WINDING_TEMP.rate).toBe(0.999);
    for (const m of Object.values(FAILURE_MODES)) expect(m.minorShare).toBeGreaterThan(0), expect(m.minorShare).toBeLessThanOrEqual(1);
  });

  it("one tick is one plant hour: P = 1 − exp(−λ/8760)", () => {
    expect(TIME_COMPRESSION).toBe(720);
    expect(faultProbability("GENERATOR_WINDING_TEMP")).toBeCloseTo(0.999 / 8760, 7);
    // 34 turbines: ≈ 0.02 new faults per tick, one every ≈ 50 ticks (≈ 4 min of real time)
    const perTick = 34 * (Object.keys(FAILURE_MODES) as (keyof typeof FAILURE_MODES)[]).reduce((s, t) => s + faultProbability(t), 0);
    expect(perTick).toBeCloseTo((34 * MODELLED_RATE) / 8760, 4);
  });

  it("draws faults and repair times from the random source", () => {
    expect(drawFault(() => 0.5)).toBeNull();
    expect(drawFault(() => 0)).toBe(Object.keys(FAILURE_MODES)[0]);
    expect(repairTicks("PITCH_CONTROL_FAULT", () => 0)).toBe(9); // minor repair, Fig. 13
    expect(repairTicks("PITCH_CONTROL_FAULT", () => 0.999)).toBe(19); // major repair
  });
});

describe("Turkish for the control room's fault and status text", () => {
  beforeAll(async () => {
    await loadLanguage("tr");
  });

  it("has every fault label, cause and action, and the KPI alert subtitles", () => {
    const texts = [
      ...FAULT_CATEGORIES.flatMap((c) => [c.label, c.probableCause, c.recommendedAction]),
      "see SCADA alarms",
      "all clear",
      "Negative-Price Curtailment",
    ];
    const missing = texts.filter((t) => translate("tr", t) === t);
    expect(missing).toEqual([]);
  });
});

describe("Turkish for the negative-price explanation", () => {
  beforeAll(async () => {
    await loadLanguage("tr");
  });
  it("matches the live period and price", () => {
    const en = "The RCE price for 12:00 - 12:15 is -42 PLN/MWh (PSE). The farm runs to a zero schedule until the price is positive again.";
    expect(translate("tr", en)).toBe("12:00 - 12:15 için RCE fiyatı -42 PLN/MWh (PSE). Santral, fiyat yeniden pozitif olana kadar sıfır programla çalışır.");
  });
});
