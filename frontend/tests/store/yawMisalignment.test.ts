import { describe, expect, it } from "vitest";

import { YAW_PAUSE_DEG, yawPowerFactor } from "../../src/store/landingStore";

describe("yaw misalignment power loss (cos^1.88, Fleming et al. 2017)", () => {
  it("is lossless when aligned and symmetric in sign", () => {
    expect(yawPowerFactor(0)).toBe(1);
    expect(yawPowerFactor(20)).toBeCloseTo(yawPowerFactor(-20), 12);
  });
  it("matches cos^1.88 at 30° and 60°", () => {
    expect(yawPowerFactor(30)).toBeCloseTo(Math.cos(Math.PI / 6) ** 1.88, 6); // ≈ 0.763
    expect(yawPowerFactor(60)).toBeCloseTo(0.5 ** 1.88, 6); // ≈ 0.272
  });
  it("never produces power with the rotor facing away from the wind", () => {
    expect(yawPowerFactor(120)).toBe(0);
    expect(YAW_PAUSE_DEG).toBeLessThan(90);
  });
});
