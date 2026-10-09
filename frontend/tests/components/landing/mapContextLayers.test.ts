/**
 * Tests for the Control Room map's context and marine layers: each toggle
 * adds its deck.gl layers, SB-510-only layers stay off an own project, and the
 * DTS colours the export route from the live current.
 */

import { describe, expect, it } from "vitest";

import { PALETTES, dtsTip, overLayers, underLayers, type ContextInput } from "../../../src/components/landing/mapContextLayers";
import { SB510_FLEET } from "../../../src/lib/fleet";
import { useLayerStore, type LayerVisibility } from "../../../src/store/layerStore";

const none = Object.fromEntries(Object.keys(useLayerStore.getState().layers).map((k) => [k, false])) as unknown as LayerVisibility;

function input(on: Partial<LayerVisibility>, extra: Partial<ContextInput> = {}): ContextInput {
  return {
    layers: { ...none, ...on },
    pal: PALETTES.hmi,
    theme: "hmi",
    fleet: SB510_FLEET,
    sb510: true,
    zoom: 11,
    turbineMap: {},
    fault: null,
    repairs: {},
    ais: [],
    vessels: [],
    dts: { currentA: 800, ambientC: 10 },
    now: Date.now(),
    ...extra,
  };
}
const ids = (c: ContextInput) => [...underLayers(c), ...overLayers(c)].map((l) => l.id);

describe("map context layers", () => {
  it("draws nothing with every layer off", () => {
    expect(ids(input({}))).toEqual([]);
  });

  it("adds the layers of each toggle", () => {
    expect(ids(input({ bathymetry: true }))).toEqual(["bathymetry", "bathymetry-labels"]);
    expect(ids(input({ gridContext: true }))).toEqual(["owf-areas", "owf-outlines", "owf-names", "swepol"]);
    expect(ids(input({ safetyZones: true }))).toEqual(["safety-zones"]);
    expect(ids(input({ fibreComms: true }))).toEqual(["fibre", "microwave"]);
    expect(ids(input({ cableDts: true }))).toEqual(["dts", "dts-labels"]);
    expect(ids(input({ navAids: true }))).toEqual(["nav-lights", "cardinals", "cardinal-labels"]);
  });

  it("keeps SB-510's surveyed-route layers off an own project", () => {
    const own = { sb510: false };
    expect(ids(input({ cableDts: true }, own))).toEqual([]);
    expect(ids(input({ navAids: true }, own))).toEqual([]);
    expect(ids(input({ fibreComms: true }, own))).toEqual(["fibre"]);
  });

  it("shows foundations only when zoomed in", () => {
    expect(ids(input({ foundations: true }))).toEqual([]);
    expect(ids(input({ foundations: true }, { zoom: 13 }))).toEqual(["foundations"]);
  });

  it("flags the fault passage indicators that are lit", () => {
    const fault = { litIds: ["WTG-01", "WTG-02"] } as unknown as ContextInput["fault"];
    const fpi = overLayers(input({}, { fault })).find((l) => l.id === "fpi");
    expect((fpi?.props.data as unknown[]).length).toBe(2);
  });

  it("shows a repair crew with its progress", () => {
    const now = Date.now();
    const repairs = { "WTG-05": { crew: "CTV-01", startedAt: now - 22_500, durationMs: 45_000 } };
    const labels = overLayers(input({ vessels: true }, { repairs, now })).find((l) => l.id === "crew-labels");
    expect((labels?.props.data as { text: string }[])[0].text).toBe("Repair · CTV-01 · 50 %");
  });

  it("reports the conductor temperature along the export cable, hotter with more current", () => {
    const cool = dtsTip(40, { currentA: 400, ambientC: 10 });
    const hot = dtsTip(40, { currentA: 820, ambientC: 10 });
    const t = (s: string) => Number(/([\d.]+) °C/.exec(s)![1]);
    expect(cool).toContain("subsea burial");
    expect(t(hot)).toBeGreaterThan(t(cool));
    // the cable is rated 90 °C at 825 A: near-rated current stays below the limit in burial
    expect(t(hot)).toBeLessThan(90);
  });
});
