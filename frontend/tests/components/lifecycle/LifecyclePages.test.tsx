/**
 * Lifecycle pages: construction run and timeline, hand-over register and
 * map hand-off, decommissioning options → request → cost. API responses are
 * real backend outputs (tests/fixtures, 12 turbines, 20 runs).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import install from "../../fixtures/campaign-install.json";
import remove from "../../fixtures/campaign-remove.json";
import * as api from "../../../src/services/lifecycleApi";
import ConstructionPage from "../../../src/pages/ConstructionPage";
import DecommissioningPage from "../../../src/pages/DecommissioningPage";
import HandoverPage from "../../../src/pages/HandoverPage";
import { useLayerStore } from "../../../src/store/layerStore";
import { useLifecycleStore } from "../../../src/store/lifecycleStore";
import { useModeStore } from "../../../src/store/modeStore";
import { useProjectStore } from "../../../src/store/projectStore";
import type { CampaignResult } from "../../../src/types/lifecycle";

vi.mock("../../../src/services/lifecycleApi", () => ({ runCampaign: vi.fn() }));

const renderAt = (path: string, el: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={el} />
        <Route path="/" element={<p>control room</p>} />
      </Routes>
    </MemoryRouter>,
  );

function ownProject() {
  const turbines = Array.from({ length: 8 }, (_, i) => ({ id: `T${String(i + 1).padStart(2, "0")}`, lon: 16.42 + (i % 4) * 0.024, lat: 54.78 + Math.floor(i / 4) * 0.0135 }));
  useProjectStore.setState({ turbines, oss: [16.39, 54.79] });
  useModeStore.setState({ mode: "own" });
}

describe("lifecycle pages", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(api.runCampaign).mockReset();
    useProjectStore.setState({ turbines: [], oss: null });
    useModeStore.setState({ mode: "reference" });
    useLifecycleStore.setState({ results: {}, resultFor: {}, running: {}, error: null });
    useLayerStore.getState().setLayer("myProject", false);
  });

  it("construction: runs the campaign for SB-510 and shows the milestones", async () => {
    vi.mocked(api.runCampaign).mockResolvedValue(install as CampaignResult);
    renderAt("/build", <ConstructionPage />);
    expect(screen.getByText("SB-510 reference farm")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Simulate the campaign/ }));
    await screen.findByText("Full commercial operation");
    const sent = vi.mocked(api.runCampaign).mock.calls[0][0];
    expect(sent).toMatchObject({ mode: "install", n_turbines: 34, export_km: 45, foundation: "monopile", alpha: 0.8 });
    expect(sent.strings?.reduce((a, b) => a + b, 0)).toBe(34);
    expect(screen.getByRole("img", { name: /Campaign timeline/ })).toBeTruthy();
    expect(screen.getByText(/Weather windows by month/)).toBeTruthy();
    expect(screen.queryByText(/Inputs changed since this result/)).toBeNull();
    // a new start date makes the shown result stale
    fireEvent.change(screen.getByLabelText(/First offshore work/), { target: { value: "2028-10-01" } });
    expect(screen.getByText(/Inputs changed since this result/)).toBeTruthy();
  });

  it("construction: reports a backend error", async () => {
    vi.mocked(api.runCampaign).mockRejectedValue(new Error("backend not reachable"));
    renderAt("/build", <ConstructionPage />);
    fireEvent.click(screen.getByRole("button", { name: /Simulate the campaign/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("backend not reachable");
  });

  it("hand-over: register of the learner's project and the map layer", async () => {
    ownProject();
    renderAt("/build/handover", <HandoverPage />);
    expect(screen.getByText("Your layout project")).toBeTruthy();
    expect(screen.getByText(/As-built register — Your layout project/)).toBeTruthy();
    const register = screen.getByText("Turbine register").closest("section") as HTMLElement;
    expect(within(register).getAllByRole("row")).toHaveLength(1 + 8);
    expect(screen.getAllByText(/BAY-OSS-66-01/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Show on the map/ }));
    await waitFor(() => expect(screen.getByText("control room")).toBeTruthy());
    expect(useLayerStore.getState().layers.myProject).toBe(true);
  });

  it("decommissioning: options go into the request and the cost appears", async () => {
    vi.mocked(api.runCampaign).mockImplementation(async (req) => ({ ...(remove as CampaignResult), ...{ mode: req.mode } }));
    renderAt("/decommission", <DecommissioningPage />);
    expect(screen.getByText(/IMO Res. A.672\(16\):/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Recover the array cables/));
    fireEvent.click(screen.getByLabelText(/Full removal/));
    const inv = screen.getByText(/Material inventory/).closest("section") as HTMLElement;
    expect(within(inv).queryByText("Piles below the cut")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Simulate the removal/ }));
    await screen.findByText("Net cost");
    expect(vi.mocked(api.runCampaign).mock.calls[0][0]).toMatchObject({ mode: "remove", remove_foundations: "full", remove_array: true, remove_export: false });
    expect(screen.getByText("Seabed survey and clearance done")).toBeTruthy();
  });
});
