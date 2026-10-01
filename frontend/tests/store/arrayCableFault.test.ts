/**
 * Array-cable fault scenario (landingStore): a fault on one 66 kV segment
 * trips the whole radial string, isolation restores the turbines between
 * the OSS and the fault, repair restores the rest.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ARRAY_FAULT_ISOLATION_MS, useLandingStore } from "../../src/store/landingStore";

// String 2 = WTG-07 (far end) … WTG-12 (OSS end). Fault on WTG-09 → WTG-10:
// the segment carries WTG-07..09, so those are beyond the fault.
const STRING_2 = ["WTG-07", "WTG-08", "WTG-09", "WTG-10", "WTG-11", "WTG-12"];
const BEYOND = ["WTG-07", "WTG-08", "WTG-09"];
const status = (id: string) => useLandingStore.getState().turbineMap[id].status;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  useLandingStore.getState().restoreArrayFault();
  vi.useRealTimers();
});

describe("array cable fault", () => {
  it("trips the string, isolates the faulted section, then restores on repair", () => {
    const before = useLandingStore.getState().kpis.totalOutputMW;
    useLandingStore.getState().injectArrayFault({
      segmentKey: "cable-WTG-09-WTG-10",
      stringNumber: 2,
      stringIds: STRING_2,
      beyondIds: BEYOND,
    });

    // Feeder CB trip: all six off, output drops at once
    for (const id of STRING_2) {
      expect(status(id)).toBe("offline");
      expect(useLandingStore.getState().turbineMap[id].powerOutputMW).toBe(0);
    }
    expect(useLandingStore.getState().kpis.totalOutputMW).toBeLessThan(before);
    expect(useLandingStore.getState().arrayFault?.stage).toBe("tripped");

    // Isolation: OSS side of the fault back, the far side stays out
    vi.advanceTimersByTime(ARRAY_FAULT_ISOLATION_MS);
    const fault = useLandingStore.getState().arrayFault;
    expect(fault?.stage).toBe("isolated");
    expect(fault?.restorableIds).toEqual(["WTG-10", "WTG-11", "WTG-12"]);
    for (const id of BEYOND) expect(status(id)).toBe("offline");
    for (const id of fault!.restorableIds) expect(status(id)).toBe("operating");

    useLandingStore.getState().restoreArrayFault();
    expect(useLandingStore.getState().arrayFault).toBeNull();
    for (const id of STRING_2) expect(status(id)).toBe("operating");
  });

  it("keeps faulted turbines offline through simulation ticks", () => {
    useLandingStore.getState().injectArrayFault({
      segmentKey: "string-2-oss",
      stringNumber: 2,
      stringIds: STRING_2,
      beyondIds: STRING_2, // feeder cable itself: nothing restorable
    });
    useLandingStore.getState().startSimulation();
    vi.advanceTimersByTime(ARRAY_FAULT_ISOLATION_MS + 30_000);
    for (const id of STRING_2) expect(status(id)).toBe("offline");
    expect(useLandingStore.getState().arrayFault?.restorableIds).toEqual([]);
  });
});
