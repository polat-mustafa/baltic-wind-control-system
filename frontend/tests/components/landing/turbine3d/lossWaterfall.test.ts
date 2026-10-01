import { describe, expect, it } from "vitest";

import { discPowerMW, lossWaterfall } from "../../../../src/components/landing/turbine3d/model/lossWaterfall";
import { v236PowerMW, v236RotorRpm } from "../../../../src/utils/landingPhysics";

const base = { freeWindMs: 10, windMs: 9, yawErrDeg: 0, yawPaused: false, rotorRpm: v236RotorRpm(9) };

describe("loss waterfall", () => {
  it("closes exactly on the reported electrical power", () => {
    const p = v236PowerMW(9);
    const steps = lossWaterfall({ ...base, powerMW: p });
    const first = steps[0].levelMW;
    const lost = steps.reduce((a, s) => a + s.lossMW, 0);
    expect(steps[steps.length - 1].levelMW).toBeCloseTo(p, 9);
    expect(first - lost).toBeCloseTo(p, 9);
    expect(first).toBeCloseTo(discPowerMW(10), 9);
  });

  it("puts the wake step at ½ρA(U∞³ − u³)", () => {
    const steps = lossWaterfall({ ...base, powerMW: v236PowerMW(9) });
    expect(steps.find((s) => s.key === "wake")?.lossMW).toBeCloseTo(discPowerMW(10) - discPowerMW(9), 9);
  });

  it("books everything on the yaw step during a yaw-error stop", () => {
    const steps = lossWaterfall({ ...base, yawErrDeg: 120, yawPaused: true, powerMW: 0 });
    expect(steps.find((s) => s.key === "yaw")?.lossMW).toBeCloseTo(discPowerMW(9), 9);
    expect(steps[steps.length - 1].levelMW).toBe(0);
  });

  it("keeps the rotor under Betz (aero loss ≥ 40.7 % of the local wind)", () => {
    const steps = lossWaterfall({ ...base, powerMW: v236PowerMW(9) });
    const aero = steps.find((s) => s.key === "aero")?.lossMW ?? 0;
    expect(aero / discPowerMW(9)).toBeGreaterThan(1 - 16 / 27);
  });
});
