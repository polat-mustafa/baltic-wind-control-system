/**
 * Sidebar responsive behaviour: off-canvas drawer below md; from md up an icon
 * rail by default that the user can widen, remembered in this browser.
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
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

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
    fireEvent.click(screen.getByRole("link", { name: /Wind Resource/ }));
    expect(onMobileClose).toHaveBeenCalled();
  });

  it("is an icon rail from tablets up, and every icon keeps its page name", () => {
    setViewport(1440);
    renderSidebar();
    expect(screen.getByRole("navigation").dataset.expanded).toBe("false");
    expect(screen.getByRole("link", { name: "Control Room" })).toBeDefined();
  });

  it("widens on request and remembers the choice", () => {
    setViewport(1440);
    const first = renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByRole("navigation").dataset.expanded).toBe("true");
    expect(localStorage.getItem("of.nav.expanded")).toBe("1");
    first.unmount();

    renderSidebar();
    expect(screen.getByRole("navigation").dataset.expanded).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(localStorage.getItem("of.nav.expanded")).toBe("0");
  });
});
