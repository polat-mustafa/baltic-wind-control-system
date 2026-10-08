/**
 * Site & Permits store: drawing a site, assessment, stage progress, persistence.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../src/services/siteApi";
import { CASE_STUDY_GRID_NODE, CASE_STUDY_SITE, reportSignature, useSiteStore } from "../../src/store/siteStore";
import { report } from "../components/site/fixtures";

vi.mock("../../src/services/siteApi");
const mockApi = vi.mocked(api);
const s = () => useSiteStore.getState();

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mockApi.postAssess.mockResolvedValue(report());
  mockApi.postSuitability.mockResolvedValue({ class_areas: [] } as unknown as api.SuitabilityResponse);
  useSiteStore.setState({
    site: null,
    report: null,
    reportFor: null,
    drawing: null,
    stage: "screening",
    done: [],
    criteria: {},
    error: null,
    assessError: null,
  });
});

describe("drawing", () => {
  it("adds corners, undoes, and assesses the finished polygon", async () => {
    s().startDrawing();
    s().addCorner([16.3, 54.8]);
    s().addCorner([16.4, 54.8]);
    s().addCorner([16.9, 54.9]);
    s().undoCorner();
    await s().finishDrawing(); // only two corners: ignored
    expect(s().drawing).toHaveLength(2);
    s().addCorner([16.4, 54.9]);
    await s().finishDrawing();
    expect(s().drawing).toBeNull();
    expect(s().site).toEqual([
      [16.3, 54.8],
      [16.4, 54.8],
      [16.4, 54.9],
    ]);
    expect(mockApi.postAssess).toHaveBeenCalledWith(s().site, {}, undefined, null); // region: the backend default until layers load; nearest grid node
    expect(s().report?.area_km2).toBe(112.2);
  });

  it("ignores clicks when not drawing", () => {
    s().addCorner([16.3, 54.8]);
    expect(s().drawing).toBeNull();
  });
});

describe("site and stages", () => {
  it("a new site resets the journey and is remembered", async () => {
    useSiteStore.setState({ done: ["screening", "investigation"], stage: "environment" });
    await s().setSite(CASE_STUDY_SITE);
    expect(s().done).toEqual([]);
    expect(s().stage).toBe("screening");
    expect(JSON.parse(localStorage.getItem("of.site.v1")!).site).toEqual(CASE_STUDY_SITE);
  });

  it("completes a stage once", () => {
    s().completeStage("screening");
    s().completeStage("screening");
    expect(s().done).toEqual(["screening"]);
  });

  it("re-screens and re-assesses when criteria change", async () => {
    await s().setSite(CASE_STUDY_SITE);
    mockApi.postAssess.mockClear();
    s().setCriteria({ exclude_protected: false });
    expect(mockApi.postSuitability).toHaveBeenCalledWith({ exclude_protected: false }, 2, undefined);
    expect(mockApi.postAssess).toHaveBeenCalledWith(CASE_STUDY_SITE, { exclude_protected: false }, undefined, null);
  });

  it("re-assesses for a chosen grid node, keeps it, and forgets it for a new site", async () => {
    await s().setSite(CASE_STUDY_SITE);
    mockApi.postAssess.mockClear();
    await s().setGridNode("Żarnowiec 400/110 kV");
    expect(mockApi.postAssess).toHaveBeenCalledWith(CASE_STUDY_SITE, {}, undefined, "Żarnowiec 400/110 kV");
    expect(JSON.parse(localStorage.getItem("of.site.v1")!).gridNode).toBe("Żarnowiec 400/110 kV");
    await s().setSite([[16.3, 54.8], [16.4, 54.8], [16.4, 54.9]]);
    expect(s().gridNode).toBeNull();
  });

  it("keeps the node's short-circuit power within 1 GVA … 63 kA at 400 kV, per node", async () => {
    await s().setSite(CASE_STUDY_SITE, CASE_STUDY_GRID_NODE);
    expect(s().gridNode).toBe("Krzemienica 400 kV");
    s().setGridSscMva(7_500);
    expect(s().gridSscMva).toBe(7_500);
    expect(JSON.parse(localStorage.getItem("of.site.v1")!).gridSscMva).toBe(7_500);
    s().setGridSscMva(60_000); // above √3 · 400 kV · 63 kA = 43 648 MVA
    expect(s().gridSscMva).toBeNull();
    s().setGridSscMva(7_500);
    await s().setGridNode("Żarnowiec 400/110 kV"); // the value belongs to the old node
    expect(s().gridSscMva).toBeNull();
  });

  it("reports assessment errors without a global error", async () => {
    mockApi.postAssess.mockRejectedValue(new Error("backend down"));
    await s().setSite(CASE_STUDY_SITE);
    expect(s().assessError).toBe("backend down");
    expect(s().error).toBeNull();
    expect(s().report).toBeNull();
  });

  it("keeps the last good report when an update fails, and retries", async () => {
    await s().setSite(CASE_STUDY_SITE);
    const good = s().report;
    expect(s().reportFor).toBe(reportSignature(CASE_STUDY_SITE, {}));
    mockApi.postAssess.mockRejectedValueOnce(new Error("timeout"));
    s().setCriteria({ exclude_protected: false });
    await vi.waitFor(() => expect(s().assessing).toBe(false));
    expect(s().report).toBe(good);
    expect(s().assessError).toBe("timeout");
    // the kept report belongs to the old criteria: out of date
    expect(s().reportFor).not.toBe(reportSignature(s().site, s().criteria));
    await s().assess();
    expect(s().assessError).toBeNull();
    expect(s().reportFor).toBe(reportSignature(CASE_STUDY_SITE, { exclude_protected: false }));
  });

  it("drops an assessment overtaken by a newer one", async () => {
    let release: (r: api.AssessResponse) => void = () => undefined;
    mockApi.postAssess
      .mockImplementationOnce(() => new Promise((res) => (release = res)))
      .mockImplementationOnce(async () => report({ shipping: "fail" }));
    const first = s().setSite(CASE_STUDY_SITE);
    await s().assess();
    release(report());
    await first;
    expect(s().report?.checks.find((c) => c.id === "shipping")?.status).toBe("fail");
  });
});

describe("export route", () => {
  const checked = (total_km: number, auto: boolean) =>
    ({ route: [], auto, total_km, offshore_km: total_km - 10, onshore_km: 10, landfall: [16.7, 54.57], grid_node: null, natura: [], restricted: [], shipping: [], shipping_km: [], cables: [], checks: [] }) as api.RouteCheckResponse;

  it("draws waypoints, checks start + waypoints + end, and keeps the length", async () => {
    await s().setSite(CASE_STUDY_SITE);
    mockApi.postRouteCheck.mockResolvedValue(checked(76.5, false));
    s().startRoute();
    s().addRoutePoint([16.4, 54.8]);
    s().addRoutePoint([16.73, 54.57]);
    s().undoRoutePoint();
    s().addRoutePoint([16.735, 54.57]);
    s().finishRoute();
    expect(s().routeDrawing).toBeNull();
    await s().checkRoute([16.44, 55.03], [16.89, 54.5]);
    expect(mockApi.postRouteCheck.mock.calls[0][0]).toMatchObject({
      route: [[16.44, 55.03], [16.4, 54.8], [16.735, 54.57], [16.89, 54.5]],
    });
    expect(s().routeKm).toBe(76.5);
    expect(JSON.parse(localStorage.getItem("of.site.v1")!)).toMatchObject({ routeKm: 76.5, route: [[16.4, 54.8], [16.735, 54.57]] });
  });

  it("asks for the automatic route without waypoints; a new site or grid node forgets the route", async () => {
    await s().setSite(CASE_STUDY_SITE);
    mockApi.postRouteCheck.mockResolvedValue(checked(66, true));
    await s().checkRoute([16.44, 55.03], null);
    expect(mockApi.postRouteCheck.mock.calls[0][0]).toMatchObject({ start: [16.44, 55.03] });
    expect(mockApi.postRouteCheck.mock.calls[0][0]).not.toHaveProperty("route");
    expect(s().routeKm).toBe(66);
    await s().setGridNode("Żarnowiec 400/110 kV");
    expect(s().routeKm).toBeNull();
    s().setRoute([[16.4, 54.8]]);
    await s().setSite([[16.3, 54.8], [16.4, 54.8], [16.4, 54.9]]);
    expect(s().route).toBeNull();
  });
});
