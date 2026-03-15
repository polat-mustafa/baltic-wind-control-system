/**
 * Tests for the unified fault event bus Zustand store.
 *
 * Verifies publish/clear lifecycle, deduplication, and
 * subscriber notification without touching async APIs.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { useFaultBus } from "../../src/store/faultBus";
import type { FaultAction, FaultEvent } from "../../src/store/faultBus";

afterEach(() => {
  // Clear all faults between tests
  const { activeFaults, clearFault } = useFaultBus.getState();
  for (const id of Object.keys(activeFaults)) {
    clearFault(id, "landing");
  }
});

describe("initial state", () => {
  it("has empty activeFaults", () => {
    const { activeFaults } = useFaultBus.getState();
    expect(Object.keys(activeFaults)).toHaveLength(0);
  });
});

describe("publishFault", () => {
  it("adds a fault to activeFaults", () => {
    useFaultBus.getState().publishFault("WTG-07", "PITCH_CONTROL_FAULT", "landing");
    const { activeFaults } = useFaultBus.getState();
    expect(activeFaults["WTG-07"]).toBeDefined();
    expect(activeFaults["WTG-07"].faultType).toBe("PITCH_CONTROL_FAULT");
    expect(activeFaults["WTG-07"].source).toBe("landing");
  });

  it("deduplicates same turbineId + faultType", () => {
    useFaultBus.getState().publishFault("WTG-01", "GRID_FREQUENCY_FAULT", "landing");
    const ts1 = useFaultBus.getState().activeFaults["WTG-01"].timestamp;
    useFaultBus.getState().publishFault("WTG-01", "GRID_FREQUENCY_FAULT", "scada");
    const ts2 = useFaultBus.getState().activeFaults["WTG-01"].timestamp;
    // Timestamp should not change — second publish was ignored
    expect(ts2).toBe(ts1);
  });
});

describe("clearFault", () => {
  it("removes a fault from activeFaults", () => {
    useFaultBus.getState().publishFault("WTG-03", "PITCH_CONTROL_FAULT", "landing");
    useFaultBus.getState().clearFault("WTG-03", "landing");
    expect(useFaultBus.getState().activeFaults["WTG-03"]).toBeUndefined();
  });

  it("is safe to clear a non-existent fault", () => {
    useFaultBus.getState().clearFault("WTG-99", "landing");
    expect(Object.keys(useFaultBus.getState().activeFaults)).toHaveLength(0);
  });
});

describe("subscribe", () => {
  it("listener receives add events", () => {
    const received: { action: FaultAction; event: FaultEvent }[] = [];
    const unsub = useFaultBus.getState().subscribe((action, event) => {
      received.push({ action, event });
    });

    useFaultBus.getState().publishFault("WTG-10", "GRID_FREQUENCY_FAULT", "scada");
    expect(received).toHaveLength(1);
    expect(received[0].action).toBe("add");
    expect(received[0].event.turbineId).toBe("WTG-10");

    unsub();
  });

  it("unsubscribe stops notifications", () => {
    const spy = vi.fn();
    const unsub = useFaultBus.getState().subscribe(spy);
    unsub();

    useFaultBus.getState().publishFault("WTG-20", "PITCH_CONTROL_FAULT", "landing");
    expect(spy).not.toHaveBeenCalled();
  });
});
