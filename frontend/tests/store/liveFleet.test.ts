/**
 * The live plant follows the fleet: a new fleet (own project ↔ SB-510)
 * restarts the landing simulation, brings its own switchboard to the SCADA
 * store and drops the grid solution of the old plant.
 */

import { afterEach, describe, expect, it } from "vitest";

import { SB510_FLEET, SB510_NETWORK, useFleetStore, type Fleet } from "../../src/lib/fleet";
import { useLandingStore } from "../../src/store/landingStore";
import { farmPowerVector, useLiveGridStore } from "../../src/store/liveGridStore";
import { useScadaStore } from "../../src/store/scadaStore";

const turbines = Array.from({ length: 8 }, (_, i) => ({
  id: `WTG-0${i + 1}`,
  stringNumber: Math.floor(i / 2) + 1,
  x: i * 50,
  y: 0,
  lat: 54.8 + i * 0.01,
  lon: 16.4,
}));

const FOUR: Fleet = {
  key: "four",
  source: "project",
  name: "Own",
  turbines,
  upstream: Object.fromEntries(turbines.map((t, i) => [t.id, i % 2 ? turbines[i - 1].id : "OSS"])),
  strings: [0, 1, 2, 3].map((s) => [turbines[2 * s].id, turbines[2 * s + 1].id]),
  oss: { lat: 54.79, lon: 16.4 },
  grid: null,
  boundary: [],
  net: { ...SB510_NETWORK, source: "project", total_capacity_mw: 120, num_turbines: 8, string_layout: [2, 2, 2, 2], num_strings: 4, section_a_strings: 2, num_export_cables: 1 },
};

afterEach(() => useFleetStore.getState().setFleet(SB510_FLEET));

describe("live fleet switch", () => {
  it("restarts the plant on the new turbines and switchboard", () => {
    useLandingStore.getState().injectArrayFault({ segmentKey: "string-1-oss", stringNumber: 1, stringIds: ["WTG-01"], beyondIds: [], manual: true });
    useScadaStore.setState({ alarms: [{ id: "x" } as never] });
    useLiveGridStore.setState({ result: { converged: true } as never, at: 1 });

    useFleetStore.getState().setFleet(FOUR);

    const land = useLandingStore.getState();
    expect(land.turbineIds).toEqual(turbines.map((t) => t.id));
    expect(Object.keys(land.turbineMap)).toHaveLength(8);
    expect(land.arrayFault).toBeNull();
    expect(land.cable.lengthKm).toBe(76.5);
    const scada = useScadaStore.getState();
    expect(Object.keys(scada.breakerStates)).toContain("cb-str4");
    expect(Object.keys(scada.breakerStates)).not.toContain("cb-str5");
    expect(Object.keys(scada.breakerStates)).not.toContain("cb-ons-e2");
    expect(scada.alarms).toEqual([]);
    expect(useLiveGridStore.getState().result).toBeNull();
    expect(farmPowerVector()).toHaveLength(8);
  });

  it("is a no-op for the same fleet and returns to SB-510's 34 turbines", () => {
    useFleetStore.getState().setFleet(FOUR);
    const map = useLandingStore.getState().turbineMap;
    useFleetStore.getState().setFleet({ ...FOUR });
    expect(useLandingStore.getState().turbineMap).toBe(map);
    useFleetStore.getState().setFleet(SB510_FLEET);
    expect(useLandingStore.getState().turbineIds).toHaveLength(34);
    expect(farmPowerVector()).toHaveLength(34);
  });
});
