/**
 * "My projects": the reference case never overwrites an own project, and the
 * comparison numbers are physically sane for SB-510.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectMetrics, annuity } from "../../src/lib/project/compare";
import {
  activeProjectId,
  adoptLegacy,
  createProject,
  deleteProject,
  listProjects,
  openProject,
  referenceDoc,
  switchMode,
} from "../../src/lib/project/library";
import { parseDoc } from "../../src/lib/project/document";
import { useModeStore } from "../../src/store/modeStore";
import { useProjectStore } from "../../src/store/projectStore";
import { useProjectSync } from "../../src/store/projectSync";
import { useSiteStore } from "../../src/store/siteStore";

vi.mock("../../src/services/siteApi");
vi.mock("../../src/services/projectApi");

const SITE: [number, number][] = [
  [16.31, 54.845],
  [16.485, 54.845],
  [16.485, 54.755],
];

beforeEach(() => {
  localStorage.clear();
  useModeStore.setState({ mode: "own" });
  useProjectSync.getState().attach("Untitled project", null);
  useProjectStore.getState().clear();
  useSiteStore.setState({ site: null, stage: "screening", done: [] });
});

const draw = () => {
  useSiteStore.setState({ site: SITE });
  useProjectStore.getState().addTurbine([16.4, 54.8]);
  useProjectStore.getState().addTurbine([16.44, 54.8]);
  useProjectSync.getState().setName("Baltic Bravo");
};

describe("reference isolation", () => {
  it("files the own project before showing SB-510 and brings it back", () => {
    draw();
    switchMode("reference");
    expect(useProjectStore.getState().turbines).toHaveLength(34);
    expect(listProjects().map((p) => p.name)).toEqual(["Baltic Bravo"]);

    useProjectStore.getState().removeTurbine("WTG-01"); // an edit on the reference is not kept
    switchMode("own");
    expect(useProjectStore.getState().turbines.map((t) => t.id)).toEqual(["WTG-01", "WTG-02"]);
    expect(useSiteStore.getState().site).toEqual(SITE);
    expect(useProjectSync.getState().name).toBe("Baltic Bravo");
  });

  it("files a drawing made before the library existed", () => {
    useModeStore.setState({ mode: "reference" });
    draw();
    adoptLegacy();
    expect(listProjects()).toHaveLength(1);
    expect(listProjects()[0].doc.turbines).toHaveLength(2);
  });

  it("keeps several projects and switches between them", () => {
    draw();
    const second = createProject(parseDoc({ schema: 2, app: "OffshoreForge", name: "Second", turbines: [] }));
    expect(useProjectStore.getState().turbines).toHaveLength(0);
    const first = listProjects().find((p) => p.name === "Baltic Bravo")!;
    openProject(first.id);
    expect(useProjectStore.getState().turbines).toHaveLength(2);
    expect(activeProjectId()).toBe(first.id);
    expect(deleteProject(first.id)).toBe(false); // the open one stays
    expect(deleteProject(second.id)).toBe(true);
    expect(listProjects()).toHaveLength(1);
  });
});

describe("project comparison", () => {
  it("gives SB-510 sane numbers (510 MW, CF 35–60 %, LCOE 50–150 €/MWh)", () => {
    const m = projectMetrics(referenceDoc(), null, 100);
    expect(m.capacityMW).toBe(510);
    expect(m.capacityFactor).toBeGreaterThan(0.35);
    expect(m.capacityFactor).toBeLessThan(0.6);
    expect(m.lcoeEURperMWh!).toBeGreaterThan(50);
    expect(m.lcoeEURperMWh!).toBeLessThan(150);
    // revenue = net GWh × price: 1 GWh × 100 €/MWh = 0.1 M€
    expect(m.revenueMEURyr).toBeCloseTo(m.netGWh * 0.1, 0);
  });

  it("discounts with the annuity factor", () => {
    expect(annuity(0, 25)).toBe(25);
    expect(annuity(0.07, 25)).toBeCloseTo(11.65, 2);
  });
});
