import { describe, expect, it } from "vitest";

import { TURBINE_POSITIONS } from "../../src/constants/windFarmLayout";
import { computeWakeLosses, toLocalM, velocityDeficit, wakeSpeedRatio } from "../../src/utils/wakeModel";

const lat0 = TURBINE_POSITIONS[0].lat;
const lon0 = TURBINE_POSITIONS[0].lon;
const rotors = TURBINE_POSITIONS.map((t) => {
  const [e, n] = toLocalM(t.lat, t.lon, lat0, lon0);
  return { id: t.id, e, n };
});

describe("wake field (maps) agrees with the per-turbine losses (KPIs)", () => {
  it("at every waked hub: 1 − u/u₀ equals computeWakeLosses' deficit", () => {
    for (const dir of [270, 250, 180]) {
      const losses = computeWakeLosses(TURBINE_POSITIONS, dir, 0.8);
      expect(losses.length).toBeGreaterThan(0);
      for (const w of losses) {
        const r = rotors.find((x) => x.id === w.turbineId)!;
        // the field also counts the < 0.5 % contributions the loss list leaves out
        const others = rotors.filter((x) => x.id !== w.turbineId);
        expect(1 - wakeSpeedRatio(r.e, r.n, others, dir, 0.8)).toBeCloseTo(w.deficit, 2);
      }
    }
  });

  it("is the Gaussian centre-line deficit behind a single rotor and 1 upstream of it", () => {
    const one = [{ e: 0, n: 0 }];
    // wind from the west: 1 km east of the rotor is downstream on its axis
    expect(1 - wakeSpeedRatio(1000, 0, one, 270, 0.8)).toBeCloseTo(velocityDeficit(1000, 0, 0.8), 10);
    expect(wakeSpeedRatio(-1000, 0, one, 270, 0.8)).toBe(1);
  });
});
