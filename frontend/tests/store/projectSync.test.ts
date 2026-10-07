/**
 * Project document (export / import / online copy) and the auto-save store.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { applyDoc, buildDoc, parseDoc, type ProjectDoc } from "../../src/lib/project/document";
import { ApiError } from "../../src/services/apiClient";
import * as projectApi from "../../src/services/projectApi";
import * as siteApi from "../../src/services/siteApi";
import { useLifecycleStore } from "../../src/store/lifecycleStore";
import { useProjectStore } from "../../src/store/projectStore";
import { CLOUD_KEY, initProjectSync, SAVE_DELAY_MS, useProjectSync } from "../../src/store/projectSync";
import { useSiteStore } from "../../src/store/siteStore";
import { report } from "../components/site/fixtures";

vi.mock("../../src/services/projectApi");
vi.mock("../../src/services/siteApi");
const api = vi.mocked(projectApi);

const SITE: [number, number][] = [
  [16.31, 54.845],
  [16.485, 54.845],
  [16.485, 54.755],
];
const ID = "6f1c2e0a-8f3b-4c55-9a77-1d2e3f4a5b6c";
const saved = (revision: number, data: ProjectDoc | null = null): projectApi.SavedProject => ({
  id: ID,
  revision,
  is_reference: false,
  updated_at: "2026-10-07T00:00:00Z",
  data,
});
const sync = () => useProjectSync.getState();

beforeAll(() => initProjectSync());

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(siteApi).postAssess.mockResolvedValue(report());
  localStorage.clear();
  sync().detach();
  useProjectStore.getState().clear();
  useSiteStore.setState({ site: null, stage: "screening", done: [] });
});

afterEach(() => vi.useRealTimers());

describe("project document", () => {
  it("round-trips site progress, layout, costs and lifecycle inputs", () => {
    useSiteStore.setState({ site: SITE, stage: "permit", done: ["screening", "investigation"] });
    useProjectStore.getState().addTurbine([16.4, 54.8]);
    useProjectStore.getState().setCost("waccPct", 7);
    useLifecycleStore.getState().setBuild({ start: "2029-05-01" });
    const text = JSON.stringify(buildDoc("Baltic test"));

    useProjectStore.getState().clear();
    useSiteStore.setState({ site: null, stage: "screening", done: [] });
    useLifecycleStore.getState().setBuild({ start: "2028-04-01" });

    const doc = parseDoc(text);
    expect(doc.name).toBe("Baltic test");
    applyDoc(doc);
    expect(useSiteStore.getState()).toMatchObject({ site: SITE, stage: "permit", done: ["screening", "investigation"] });
    expect(useProjectStore.getState().turbines).toHaveLength(1);
    expect(useProjectStore.getState().costs.waccPct).toBe(7);
    expect(useLifecycleStore.getState().build.start).toBe("2029-05-01");
  });

  it("upgrades a schema-1 layout file", () => {
    const v1 = { schema: 1, app: "OffshoreForge", turbineModel: "IEA-15-240-RWT", site: SITE, turbines: [], oss: null, costs: {} };
    const doc = parseDoc(JSON.stringify(v1));
    expect(doc.schema).toBe(2);
    expect(doc.site).toEqual({ polygon: SITE, stage: "screening", done: [] });
    expect(doc.lifecycle).toBeNull();
  });

  it("rejects foreign or broken files", () => {
    expect(() => parseDoc("{nope")).toThrow(/JSON/);
    expect(() => parseDoc(JSON.stringify({ app: "Other", schema: 2 }))).toThrow(/OffshoreForge/);
    const many = Array.from({ length: 151 }, (_, i) => ({ id: `T${i}`, lon: 16, lat: 54 }));
    expect(() => parseDoc(JSON.stringify({ app: "OffshoreForge", schema: 2, turbines: many }))).toThrow(/at most 150/);
  });
});

describe("online copy", () => {
  it("creates the project, then auto-saves edits with the revision they are based on", async () => {
    vi.useFakeTimers();
    api.createProject.mockResolvedValue(saved(1));
    await sync().saveOnline("My farm");
    expect(api.createProject).toHaveBeenCalledWith(expect.objectContaining({ schema: 2, name: "My farm" }));
    expect(JSON.parse(localStorage.getItem(CLOUD_KEY)!)).toEqual({ id: ID, revision: 1, name: "My farm" });

    api.saveProject.mockResolvedValue(saved(2));
    useProjectStore.getState().addTurbine([16.4, 54.8]);
    useProjectStore.getState().addTurbine([16.45, 54.8]); // one save after the pause
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(api.saveProject).toHaveBeenCalledTimes(1);
    expect(api.saveProject.mock.calls[0][1]).toBe(1);
    expect(api.saveProject.mock.calls[0][2].turbines).toHaveLength(2);
    expect(sync()).toMatchObject({ revision: 2, sync: "saved" });

    useProjectStore.getState().select("T01"); // transient state: nothing to save
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(api.saveProject).toHaveBeenCalledTimes(1);
  });

  it("stops on a conflict and can keep this copy", async () => {
    vi.useFakeTimers();
    api.createProject.mockResolvedValue(saved(1));
    await sync().saveOnline();
    api.saveProject.mockRejectedValueOnce(new ApiError("changed elsewhere", 409));
    useProjectStore.getState().addTurbine([16.4, 54.8]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(sync().sync).toBe("conflict");

    useProjectStore.getState().addTurbine([16.45, 54.8]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(api.saveProject).toHaveBeenCalledTimes(1); // no saves while in conflict

    api.getProject.mockResolvedValue(saved(5));
    api.saveProject.mockResolvedValue(saved(6));
    await sync().resolve("mine");
    expect(api.saveProject.mock.calls[1][1]).toBe(5);
    expect(sync()).toMatchObject({ revision: 6, sync: "saved" });
  });

  it("waits offline and retries when the browser is back online", async () => {
    vi.useFakeTimers();
    api.createProject.mockResolvedValue(saved(1));
    await sync().saveOnline();
    api.saveProject.mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValue(saved(2));
    useProjectStore.getState().addTurbine([16.4, 54.8]);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(sync().sync).toBe("offline");
    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);
    expect(sync()).toMatchObject({ revision: 2, sync: "saved" });
  });

  it("opens a project by id and does not save it straight back", async () => {
    vi.useFakeTimers();
    const doc = parseDoc(
      JSON.stringify({
        schema: 2,
        app: "OffshoreForge",
        name: "Shared",
        site: { polygon: SITE, stage: "documents", done: ["screening"] },
        turbines: [{ id: "T01", lon: 16.4, lat: 54.8 }],
      }),
    );
    api.getProject.mockResolvedValue(saved(3, doc));
    await sync().open(ID);
    expect(sync()).toMatchObject({ id: ID, revision: 3, name: "Shared", sync: "saved" });
    expect(useSiteStore.getState().stage).toBe("documents");
    expect(useProjectStore.getState().turbines).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    expect(api.saveProject).not.toHaveBeenCalled();

    api.getProject.mockRejectedValue(new ApiError("Project not found", 404));
    await sync().open("00000000-0000-4000-8000-000000000000");
    expect(sync().error).toMatch(/12 months/);
  });

  it("runs PyWake on the saved layout after saving pending edits", async () => {
    api.createProject.mockResolvedValue(saved(1));
    await sync().saveOnline();
    api.saveProject.mockResolvedValue(saved(2));
    api.runProjectAep.mockResolvedValue({} as projectApi.AepRun);
    useProjectStore.getState().addTurbine([16.4, 54.8]);
    await sync().runAep({ weibullA: 10.6, weibullK: 2.0, sectorFrequencies: null });
    expect(api.saveProject).toHaveBeenCalledTimes(1);
    expect(api.runProjectAep).toHaveBeenCalledWith(ID, { weibull_a: 10.6, weibull_k: 2.0, sector_frequencies: null });
  });
});
