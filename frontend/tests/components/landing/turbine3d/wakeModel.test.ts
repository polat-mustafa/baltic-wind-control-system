import { describe, expect, it } from "vitest";

import REF from "../../../../../backend/tests/fixtures/wake_centreline_reference.json";

import { D, deficit, farmDeficit, K_STAR, wakeSources } from "../../../../src/components/landing/turbine3d/model/wakeModel";
import { inductionFromCt } from "../../../../src/utils/landingPhysics";
import { velocityDeficit } from "../../../../src/utils/wakeModel";

const ct = 0.8;
const a = inductionFromCt(ct);

// Shared with the backend: PyWake BastankhahGaussianDeficit, same Ct and k*
// (backend/tests/test_wake_reference.py keeps it reproducible).

describe("wake model vs PyWake reference", () => {
  it("uses the same Ct and wake expansion as the reference", () => {
    expect(REF.ct).toBe(ct);
    expect(REF.k_star).toBe(K_STAR);
  });
  it("3D Bastankhah centre line within 0.012 (≈ 2 %) of PyWake from 3 D to 15 D", () => {
    // Residual: momentum theory C = 1 − √(1 − Ct′) here vs Madsen's a(Ct)
    // polynomial (C = 2a) inside PyWake.
    REF.x_over_d.forEach((x, i) => {
      expect(Math.abs(deficit(x * D, 0, a, ct) - REF.deficit[i])).toBeLessThan(0.012);
    });
  });
  it("map / SCADA simulation uses the same model (utils/wakeModel) — same tolerance", () => {
    REF.x_over_d.forEach((x, i) => {
      expect(Math.abs(velocityDeficit(x * D) - REF.deficit[i])).toBeLessThan(0.012);
    });
  });
});

describe("wake model", () => {
  it("has no deficit upstream (without induction) and ~2a far behind the disc", () => {
    expect(deficit(-100, 0, a, ct)).toBe(0);
    expect(deficit(1.5 * D, 0, a, ct)).toBeGreaterThan(1.6 * a);
  });
  it("recovers downstream and spreads laterally (Bastankhah)", () => {
    const d4 = deficit(4 * D, 0, a, ct);
    const d10 = deficit(10 * D, 0, a, ct);
    expect(d10).toBeLessThan(d4);
    expect(d10).toBeGreaterThan(0.05); // still ~10 % at 10 D offshore
    expect(deficit(8 * D, 1.5 * D, a, ct)).toBeLessThan(deficit(8 * D, 0, a, ct) * 0.2);
  });
  it("puts an upwind turbine at +z in the wind frame and sums wakes quadratically", () => {
    const farm = [
      { id: "UP", stringNumber: 1, x: 0, z: 1416 }, // 1416 m due north
      { id: "ME", stringNumber: 1, x: 0, z: 0 },
    ];
    const map = {
      UP: { status: "operating", rotorSpeedRpm: 8, windSpeedMs: 9 },
      ME: { status: "operating", rotorSpeedRpm: 8, windSpeedMs: 9 },
    };
    const src = wakeSources(farm, map, 0); // wind FROM north
    expect(src[0].z).toBeGreaterThan(src[1].z);
    const single = farmDeficit([src[0]], 0, -2000);
    const both = farmDeficit(src, 0, -2000);
    expect(both).toBeGreaterThan(single);
    expect(both).toBeLessThan(single + farmDeficit([src[1]], 0, -2000)); // quadratic < linear
  });
});
