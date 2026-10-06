/**
 * Reference turbines on the frontend: Rule 1 on the interpolated curves.
 * That constants/turbineModels.ts equals backend/app/data/turbines/ is checked
 * by backend/tests/test_turbine_models.py (both files come from
 * backend/scripts/fetch_turbine_curves.py).
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_TURBINE_ID, TURBINE_MODELS } from "../../src/constants/turbineModels";
import { powerKw, thrustCoefficient } from "../../src/utils/turbineCurves";

describe("turbine models", () => {
  it("packages the IEA 15 MW (default) and 22 MW reference turbines", () => {
    expect(Object.keys(TURBINE_MODELS).sort()).toEqual(["IEA-15-240-RWT", "IEA-22-280-RWT"]);
    expect(DEFAULT_TURBINE_ID).toBe("IEA-15-240-RWT");
    const t = TURBINE_MODELS[DEFAULT_TURBINE_ID];
    expect([t.cutInMs, t.cutOutMs, t.ratedKw]).toEqual([3, 25, 15000]);
    expect(t.ratedMs).toBeCloseTo(10.66, 2);
  });

  it("enforces Rule 1 on the interpolated curves", () => {
    for (const t of Object.values(TURBINE_MODELS)) {
      for (let v = -2; v <= 40; v += 0.25) {
        const p = powerKw(t, v);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(t.ratedKw);
        if (v < t.cutInMs || v > t.cutOutMs) {
          expect(p).toBe(0);
          expect(thrustCoefficient(t, v)).toBe(0);
        }
      }
      expect(powerKw(t, t.ratedMs)).toBeCloseTo(t.ratedKw, 6);
    }
  });
});
