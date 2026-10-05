/**
 * Site & Permits store: drawing a site, assessment, stage progress, persistence.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../src/services/siteApi";
import { CASE_STUDY_SITE, useSiteStore } from "../../src/store/siteStore";
import { report } from "../components/site/fixtures";

vi.mock("../../src/services/siteApi");
const mockApi = vi.mocked(api);
const s = () => useSiteStore.getState();

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mockApi.postAssess.mockResolvedValue(report());
  mockApi.postSuitability.mockResolvedValue({ class_areas: [] } as unknown as api.SuitabilityResponse);
  useSiteStore.setState({ site: null, report: null, drawing: null, stage: "screening", done: [], criteria: {}, error: null });
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
    expect(mockApi.postAssess).toHaveBeenCalledWith(s().site, {});
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
    expect(mockApi.postSuitability).toHaveBeenCalledWith({ exclude_protected: false });
    expect(mockApi.postAssess).toHaveBeenCalledWith(CASE_STUDY_SITE, { exclude_protected: false });
  });

  it("reports API errors", async () => {
    mockApi.postAssess.mockRejectedValue(new Error("backend down"));
    await s().setSite(CASE_STUDY_SITE);
    expect(s().error).toBe("backend down");
    expect(s().report).toBeNull();
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
