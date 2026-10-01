import { describe, expect, it } from "vitest";

import {
  CARDINAL_MARKS,
  CTV_ROUTE_GEO,
  NEIGHBOUR_OWF_AREAS,
  PERIPHERY_RING,
  SAFETY_ZONE_M,
  SPS_TURBINES,
  SWEPOL_GEO,
  EXPORT_CABLE_LAND_GEO,
  EXPORT_CABLE_SUBSEA_GEO,
  LANDFALL_GEO,
  ONSHORE_GEO,
  OSS_GEO,
  PSE_SUBSTATION_GEO,
  TURBINE_POSITIONS,
} from "../../src/constants/windFarmLayout";
import { EXPORT_CABLE } from "../../src/utils/landingPhysics";

type P = { lat: number; lon: number };

/** Great-circle distance [km]. */
function km(a: P, b: P): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const length = (path: P[]) => path.slice(1).reduce((sum, p, i) => sum + km(path[i], p), 0);

describe("wind farm geography (verified against OSM / EMODnet, 2026-09-29)", () => {
  it("draws the export route at the 45 km the electrical model uses", () => {
    const total = length(EXPORT_CABLE_SUBSEA_GEO) + length(EXPORT_CABLE_LAND_GEO);
    expect(total).toBeGreaterThan(EXPORT_CABLE.lengthKm - 0.5);
    expect(total).toBeLessThan(EXPORT_CABLE.lengthKm + 0.5);
    expect(EXPORT_CABLE_SUBSEA_GEO.at(-1)).toEqual(LANDFALL_GEO);
    expect(EXPORT_CABLE_LAND_GEO[0]).toEqual(LANDFALL_GEO);
    expect(EXPORT_CABLE_SUBSEA_GEO[0]).toEqual(OSS_GEO);
    expect(EXPORT_CABLE_LAND_GEO.at(-1)).toEqual(ONSHORE_GEO);
  });

  it("puts the onshore substation beside PSE Słupsk Wierzbięcino", () => {
    expect(km(ONSHORE_GEO, PSE_SUBSTATION_GEO)).toBeLessThan(2);
  });

  it("keeps the layout spacing (8D strings, 6D along string) and 34 turbines", () => {
    expect(TURBINE_POSITIONS).toHaveLength(34);
    const [a, b] = TURBINE_POSITIONS; // WTG-01, WTG-02 (same string)
    expect(km(a, b) * 1000).toBeCloseTo(6 * 236, -2); // ≈ 1,416 m
    const s2 = TURBINE_POSITIONS.find((t) => t.id === "WTG-07")!;
    expect(Math.abs(s2.lon - a.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180) * 1000).toBeCloseTo(8 * 236, -2);
  });

  it("marks the periphery per IALA G1162 (SPS ≤ 3 NM apart, corners are SPS)", () => {
    const pos = (id: string) => TURBINE_POSITIONS.find((t) => t.id === id)!;
    const ring = PERIPHERY_RING;
    let gap = 0;
    for (let i = 1; i <= ring.length; i++) {
      gap += km(pos(ring[i - 1]), pos(ring[i % ring.length]));
      if (SPS_TURBINES.includes(ring[i % ring.length])) {
        expect(gap).toBeLessThanOrEqual(3 * 1.852);
        gap = 0;
      }
    }
    for (const corner of ["WTG-01", "WTG-06", "WTG-30", "WTG-34"]) expect(SPS_TURBINES).toContain(corner);
  });

  it("keeps cardinal marks and the CTV track clear of the 500 m safety zones", () => {
    const structures = [...TURBINE_POSITIONS, OSS_GEO];
    for (const m of CARDINAL_MARKS) {
      for (const s of structures) expect(km(m, s) * 1000).toBeGreaterThan(SAFETY_ZONE_M);
    }
    // CTV approach waypoint stays outside the zones until the final leg
    const [lat, lon] = CTV_ROUTE_GEO[CTV_ROUTE_GEO.length - 1];
    for (const s of structures) expect(km({ lat, lon }, s) * 1000).toBeGreaterThan(SAFETY_ZONE_M);
  });

  it("does not overlap any neighbouring planned OWF area and ends SwePol at PSE Słupsk", () => {
    for (const a of NEIGHBOUR_OWF_AREAS) {
      const minLat = Math.min(...a.ring.map(([la]) => la));
      const minLon = Math.min(...a.ring.map(([, lo]) => lo));
      const maxLon = Math.max(...a.ring.map(([, lo]) => lo));
      // every area is north of the array or entirely west of it
      for (const t of TURBINE_POSITIONS) expect(t.lat < minLat || t.lon > maxLon || t.lon < minLon).toBe(true);
    }
    const [lat, lon] = SWEPOL_GEO[SWEPOL_GEO.length - 1];
    expect(km({ lat, lon }, PSE_SUBSTATION_GEO)).toBeLessThan(0.5);
  });

  it("stays north of the 12 nm line checked for the SE corner (EEZ only)", () => {
    // OSM is_in: 54.7247 N at 16.4705 E is territorial sea; 54.7597 N is EEZ.
    const se = TURBINE_POSITIONS.find((t) => t.id === "WTG-34")!;
    expect(se.lat).toBeGreaterThanOrEqual(54.7597);
    // South of the "Ławica Słupska" Natura 2000 site (starts ≈ 54.842 N).
    for (const t of TURBINE_POSITIONS) expect(t.lat).toBeLessThan(54.842);
  });
});
