/**
 * Sidebar responsive behaviour: off-canvas drawer below md, icon rail between
 * md and lg, full width from lg up (the user toggle overrides the default).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import Sidebar from "../../../src/components/layout/Sidebar";

/** Pretend the viewport is `width` px wide (min-width queries only). */
function setViewport(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

const renderSidebar = (props: Partial<Parameters<typeof Sidebar>[0]> = {}) =>
  render(
    <MemoryRouter>
      <Sidebar mobileOpen={false} onMobileClose={() => {}} {...props} />
    </MemoryRouter>,
  );

describe("Sidebar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("is an inert off-canvas drawer on phones until opened", () => {
    setViewport(375);
    const { rerender } = renderSidebar();
    expect(screen.getByRole("navigation", { hidden: true }).hasAttribute("inert")).toBe(true);
    rerender(
      <MemoryRouter>
        <Sidebar mobileOpen onMobileClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation").hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("button", { name: "Close menu" })).toBeDefined();
  });

  it("closes the drawer when a destination is chosen", () => {
    setViewport(375);
    const onMobileClose = vi.fn();
    renderSidebar({ mobileOpen: true, onMobileClose });
    fireEvent.click(screen.getByRole("link", { name: /P1 · Wind Resource/ }));
    expect(onMobileClose).toHaveBeenCalled();
  });

  it("is an icon rail on tablets and expandable by the user", () => {
    setViewport(800);
    renderSidebar();
    expect(screen.queryByText("Wind farm map & KPIs")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByText("Wind farm map & KPIs")).toBeDefined();
  });

  it("is full width on laptops and up", () => {
    setViewport(1440);
    renderSidebar();
    expect(screen.getByText("Wind farm map & KPIs")).toBeDefined();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeDefined();
  });
});
