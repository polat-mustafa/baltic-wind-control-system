/**
 * Tour content integrity: unique ids, every target exists in the source as
 * a data-tour attribute, every route is a real route.
 */

import { describe, expect, it } from "vitest";

import { TOURS } from "../../src/tour/tours";

// All app sources as text, to find the data-tour attributes the tours point at.
const files = import.meta.glob<string>("../../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });
const code = Object.values(files).join("\n");
const ROUTES = ["/", "/develop", "/wind-resource", "/hv-grid", "/scada", "/forecast", "/commissioning", "/turbine-physics", "/digital-twin"];

describe("tours", () => {
  it("have unique tour and step ids", () => {
    const ids = TOURS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOURS) {
      const steps = t.steps.map((s) => s.id);
      expect(new Set(steps).size, t.id).toBe(steps.length);
      expect(t.steps.length).toBeGreaterThan(0);
    }
  });

  it("point at data-tour targets that exist in the app", () => {
    for (const t of TOURS) {
      for (const s of t.steps) {
        for (const target of ([] as string[]).concat(s.target ?? [])) {
          expect(code.includes(`data-tour="${target}"`), `${t.id}/${s.id} → ${target}`).toBe(true);
        }
      }
    }
  });

  it("only use real routes", () => {
    for (const t of TOURS) for (const s of t.steps) if (s.route) expect(ROUTES).toContain(s.route);
  });

  it("start with the control-room tour and cover every page", () => {
    expect(TOURS[0].id).toBe("control-room");
    const routes = new Set(TOURS.flatMap((t) => t.steps.map((s) => s.route)).filter(Boolean));
    for (const r of ROUTES) expect(routes.has(r), r).toBe(true);
  });
});
