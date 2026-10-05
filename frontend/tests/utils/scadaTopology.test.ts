import { describe, expect, it } from "vitest";

import {
  deenergisedTurbines,
  energisation,
  initialBreakerStates,
  interlockReason,
} from "../../src/utils/scadaTopology";

describe("scadaTopology", () => {
  it("normal state: everything live, coupler open", () => {
    const cb = initialBreakerStates();
    expect(cb["cb-66-bc"]).toBe("OPEN");
    const e = energisation(cb);
    expect(e.sectionA && e.sectionB && e.strings.every(Boolean)).toBe(true);
    expect(deenergisedTurbines(cb)).toEqual([]);
  });

  it("TX-OSS-01 trip kills section A (strings 1-3 = 18 WTG); coupler restores it", () => {
    const cb = { ...initialBreakerStates(), "cb-oss-t1": "TRIPPED" as const, "cb-66-a": "TRIPPED" as const };
    expect(energisation(cb).strings).toEqual([false, false, false, true, true, true]);
    expect(deenergisedTurbines(cb)).toHaveLength(18);
    expect(interlockReason(cb, "cb-66-bc")).toBeNull();
    expect(deenergisedTurbines({ ...cb, "cb-66-bc": "CLOSED" })).toEqual([]);
  });

  it("one export cable out keeps the OSS live; both out blacks it out", () => {
    const one = { ...initialBreakerStates(), "cb-ons-e1": "OPEN" as const };
    expect(energisation(one).oss220).toBe(true);
    expect(energisation({ ...one, "cb-oss-e2": "OPEN" }).oss220).toBe(false);
  });

  it("interlock: no parallel operation of the OSS transformers", () => {
    const cb = initialBreakerStates();
    expect(interlockReason(cb, "cb-66-bc")).toMatch(/blocked/);
    const coupled = { ...cb, "cb-66-b": "OPEN" as const, "cb-66-bc": "CLOSED" as const };
    expect(interlockReason(coupled, "cb-66-b")).toMatch(/blocked/);
    expect(interlockReason(cb, "cb-str1")).toBeNull(); // opening is always allowed
  });
});
