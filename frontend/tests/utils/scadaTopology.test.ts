import { describe, expect, it } from "vitest";

import { SB510_FLEET, SB510_NETWORK, type Fleet } from "../../src/lib/fleet";
import {
  bayOf,
  breakerOfBay,
  breakers,
  deenergisedTurbines,
  energisation,
  initialBreakerStates,
} from "../../src/utils/scadaTopology";

/** Own farm: 4 strings of 2 on one 20 km export circuit (backend design((2,2,2,2), 20 km)). */
const FOUR: Fleet = {
  ...SB510_FLEET,
  key: "four",
  source: "project",
  strings: [0, 1, 2, 3].map((s) => [`WTG-0${2 * s + 1}`, `WTG-0${2 * s + 2}`]),
  net: { ...SB510_NETWORK, num_strings: 4, string_layout: [2, 2, 2, 2], section_a_strings: 2, num_export_cables: 1 },
};

describe("scadaTopology (SB-510)", () => {
  it("normal state: everything live, coupler open", () => {
    const cb = initialBreakerStates(SB510_FLEET);
    expect(cb["cb-66-bc"]).toBe("OPEN");
    const e = energisation(cb, SB510_FLEET);
    expect(e.sectionA && e.sectionB && e.strings.every(Boolean)).toBe(true);
    expect(deenergisedTurbines(cb, SB510_FLEET)).toEqual([]);
  });

  it("TX-OSS-01 trip kills section A (strings 1-3 = 18 WTG); coupler restores it", () => {
    const cb = { ...initialBreakerStates(SB510_FLEET), "cb-oss-t1": "TRIPPED" as const, "cb-66-a": "TRIPPED" as const };
    expect(energisation(cb, SB510_FLEET).strings).toEqual([false, false, false, true, true, true]);
    expect(deenergisedTurbines(cb, SB510_FLEET)).toHaveLength(18);
    expect(deenergisedTurbines({ ...cb, "cb-66-bc": "CLOSED" }, SB510_FLEET)).toEqual([]);
  });

  it("one export cable out keeps the OSS live; both out blacks it out", () => {
    const one = { ...initialBreakerStates(SB510_FLEET), "cb-ons-e1": "OPEN" as const };
    expect(energisation(one, SB510_FLEET).oss220).toBe(true);
    expect(energisation({ ...one, "cb-oss-e2": "OPEN" }, SB510_FLEET).oss220).toBe(false);
  });

  it("every 66 kV breaker maps to its bay controller and back (07/08/09 kept)", () => {
    expect(Object.keys(bayOf(SB510_FLEET))).toHaveLength(9);
    expect(breakerOfBay(SB510_FLEET)["BAY-OSS-66-08"]).toBe("cb-66-bc");
    expect(breakers(SB510_FLEET)["cb-66-a"].label).toBe("CB-66-07");
    expect(breakers(SB510_FLEET)["cb-66-b"].label).toBe("CB-66-09");
  });
});

describe("scadaTopology (own farm, 4 strings, 1 export circuit)", () => {
  it("numbers the bays like the backend bay controller", () => {
    const b = breakers(FOUR);
    expect(b["cb-str4"].label).toBe("CB-66-04");
    expect(b["cb-66-a"].label).toBe("CB-66-05");
    expect(b["cb-66-bc"].label).toBe("CB-66-06");
    expect(b["cb-66-b"].label).toBe("CB-66-07");
    expect(b["cb-str5"]).toBeUndefined();
    expect(b["cb-ons-e2"]).toBeUndefined();
    expect(bayOf(FOUR)["cb-66-b"]).toEqual({ bay: "BAY-OSS-66-07", cb: "CB-TX-OSS-02-LV" });
    expect(breakerOfBay(FOUR)["BAY-OSS-66-06"]).toBe("cb-66-bc");
  });

  it("splits strings 1-2 / 3-4 over the sections; the single export cable is N-0", () => {
    const cb = initialBreakerStates(FOUR);
    expect(energisation({ ...cb, "cb-66-b": "OPEN" }, FOUR).strings).toEqual([true, true, false, false]);
    expect(deenergisedTurbines({ ...cb, "cb-66-b": "OPEN" }, FOUR)).toEqual(["WTG-05", "WTG-06", "WTG-07", "WTG-08"]);
    const cableOut = energisation({ ...cb, "cb-oss-e1": "TRIPPED" }, FOUR);
    expect(cableOut.cable).toEqual([false]);
    expect(cableOut.oss220).toBe(false);
    expect(deenergisedTurbines({ ...cb, "cb-oss-e1": "TRIPPED" }, FOUR)).toHaveLength(8);
  });
});
