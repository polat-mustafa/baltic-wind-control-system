/**
 * Tour overlay: card content, keyboard navigation, spotlight + node arrow,
 * action steps that wait for the user, and the first-visit welcome.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TourOverlay from "../../src/tour/TourOverlay";
import TourWelcome from "../../src/tour/TourWelcome";
import { useTourStore } from "../../src/tour/tourStore";

// jsdom has no layout: give every tagged element a box so targets are "visible".
const realRect = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useTourStore.getState().reload();
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.hasAttribute("data-tour")) {
      return { x: 40, y: 80, left: 40, top: 80, width: 200, height: 300, right: 240, bottom: 380, toJSON: () => ({}) } as DOMRect;
    }
    return realRect.call(this);
  };
  window.innerWidth = 1440;
  window.innerHeight = 900;
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = realRect;
  act(() => useTourStore.getState().stop());
});

function Page({ viewer = false }: { viewer?: boolean }) {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <nav data-tour="nav">nav</nav>
      <div data-tour="farm-map">map</div>
      {viewer && <div data-tour="turbine-viewer">viewer</div>}
      <TourWelcome />
      <TourOverlay />
    </MemoryRouter>
  );
}

describe("TourOverlay", () => {
  it("shows the step card and moves with the keyboard", async () => {
    render(<Page />);
    act(() => useTourStore.getState().start("control-room"));
    expect(screen.getByRole("dialog", { name: /Welcome to OffshoreForge/ })).toBeDefined();
    expect(screen.getByText(/1 \/ 9/)).toBeDefined();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByRole("dialog", { name: /Organised by lifecycle stage/ })).toBeDefined();
    expect(screen.getByText("Build & Commission")).toBeDefined();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(await screen.findByRole("dialog", { name: /Welcome/ })).toBeDefined();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("tour-overlay")).toBeNull();
    expect(useTourStore.getState().activeTourId).toBeNull();
  });

  it("spotlights the target and draws the node arrow", async () => {
    render(<Page />);
    act(() => useTourStore.getState().start("control-room", 1));
    await waitFor(() => {
      const overlay = screen.getByTestId("tour-overlay");
      expect(overlay.querySelector("path[marker-end]")).not.toBeNull();
      expect(overlay.querySelector("mask rect[fill='black']")).not.toBeNull();
    });
  });

  it("waits for an action step, then moves on by itself", async () => {
    const { rerender } = render(<Page />);
    act(() => useTourStore.getState().start("control-room", 3));
    expect(await screen.findByText(/Your turn: Click any turbine/)).toBeDefined();
    expect((screen.getByRole("button", { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Skip task" })).toBeDefined();

    rerender(<Page viewer />);
    expect(await screen.findByText(/Done\. Moving on/)).toBeDefined();
    expect(await screen.findByRole("dialog", { name: /Meet the turbine/ }, { timeout: 3000 })).toBeDefined();
  });

  it("does not race past a task that was already done when the step opened", async () => {
    render(<Page viewer />);
    act(() => useTourStore.getState().start("control-room", 3));
    expect(await screen.findByText("Done.")).toBeDefined();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1500));
    });
    expect(useTourStore.getState().stepIndex).toBe(3);
    expect((screen.getByRole("button", { name: /Next/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("lets the user skip an action step", async () => {
    render(<Page />);
    act(() => useTourStore.getState().start("control-room", 3));
    fireEvent.click(await screen.findByRole("button", { name: "Skip task" }));
    expect(useTourStore.getState().stepIndex).toBe(4);
  });

  it("says so when a target never appears", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<Page />);
      act(() => useTourStore.getState().start("control-room", 5)); // equipment-panel is absent
      await act(async () => {
        vi.advanceTimersByTime(5600);
      });
      expect(screen.getByText(/not visible right now/)).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("finishing the last step records the tour", async () => {
    render(<Page />);
    act(() => useTourStore.getState().start("commissioning", 1));
    fireEvent.click(await screen.findByRole("button", { name: "Finish" }));
    expect(useTourStore.getState().progress.completed).toContain("commissioning");
  });
});

describe("TourWelcome", () => {
  it("offers the tour on a first visit and starts it", () => {
    render(<Page />);
    expect(screen.getByRole("dialog", { name: "Welcome to OffshoreForge" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Start the tour/ }));
    expect(useTourStore.getState().activeTourId).toBe("control-room");
  });

  it("can be put off for good", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useTourStore.getState().progress.welcomeDismissed).toBe(true);
  });
});
