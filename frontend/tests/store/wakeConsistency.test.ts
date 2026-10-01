/**
 * A waked turbine's wind must stay ≈ freestream × (1 − δ) while the wind
 * direction sweeps across 5° wake bins, so the wake-loss badges and the
 * turbines' actual output tell the same story.
 */

import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useLandingStore } from "../../src/store/landingStore";
import { farmWakeDeficits } from "../../src/utils/landingPhysics";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("keeps waked wind consistent with the freestream across direction bins", () => {
  let worst = 0;
  useLandingStore.getState().startSimulation();
  for (let tick = 0; tick < 40; tick++) {
    vi.advanceTimersByTime(5000);
    if (tick < 4) continue; // let the EWMA settle
    const { turbineMap, kpis } = useLandingStore.getState();
    const deficits = farmWakeDeficits(kpis.windDirectionDeg);
    for (const [id, d] of deficits) {
      const implied = turbineMap[id].windSpeedMs / (1 - d);
      // per-turbine spread (position offset ±0.5, noise ±0.15, smoothing lag) ≲ 1 m/s
      worst = Math.max(worst, Math.abs(implied - kpis.freestreamWindMs));
    }
  }
  expect(worst).toBeLessThan(1.5); // measured ≈ 1.05–1.1
});
