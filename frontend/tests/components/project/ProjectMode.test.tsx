/** Project chooser, locked modules and the "See it in SB-510" way out. */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppShell from "../../../src/components/layout/AppShell";
import { useLifecycleStore } from "../../../src/store/lifecycleStore";
import { MODE_KEY, useModeStore } from "../../../src/store/modeStore";
import { useProjectStore } from "../../../src/store/projectStore";
import { useSiteStore } from "../../../src/store/siteStore";
import { useTourStore } from "../../../src/tour/tourStore";

vi.mock("../../../src/services/siteApi");

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>control room</p>} />
          <Route path="develop" element={<p>site page</p>} />
          <Route path="hv-grid" element={<p>grid page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  localStorage.clear();
  useTourStore.setState({ welcomeOpen: false, activeTourId: null });
  useSiteStore.setState({ site: null, report: null, stage: "screening", done: [] });
  useProjectStore.getState().clear();
  useLifecycleStore.getState().restore({});
});

describe("project mode", () => {
  it("asks how to work once the welcome is closed, and opens Site & Permits for an own project", () => {
    useModeStore.setState({ mode: null });
    renderAt("/");
    expect(screen.getByRole("dialog", { name: "How do you want to work?" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Build my own project/ }));
    expect(useModeStore.getState().mode).toBe("own");
    expect(localStorage.getItem(MODE_KEY)).toBe("own");
    expect(screen.getByText("site page")).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks a module the own project has not reached and lets the learner see it in SB-510", () => {
    useModeStore.setState({ mode: "own" });
    renderAt("/hv-grid");
    expect(screen.queryByText("grid page")).toBeNull();
    expect(screen.getByText(/is locked in your project/)).toBeDefined();
    expect(screen.getByText(/Draw a site/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Grid Integration \(locked\)/ })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "See it in SB-510" }));
    expect(screen.getByText("grid page")).toBeDefined();
    expect(screen.queryByRole("link", { name: /\(locked\)/ })).toBeNull();
  });

  it("lifts the locks during a guided tour", () => {
    useModeStore.setState({ mode: "own" });
    renderAt("/hv-grid");
    expect(screen.getByText(/is locked in your project/)).toBeDefined();
    act(() => useTourStore.setState({ activeTourId: "control-room" }));
    expect(screen.queryByText(/is locked in your project/)).toBeNull();
    expect(screen.queryByRole("link", { name: /\(locked\)/ })).toBeNull();
  });
});
