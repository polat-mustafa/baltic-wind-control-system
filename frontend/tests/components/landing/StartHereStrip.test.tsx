import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import StartHereStrip from "../../../src/components/landing/StartHereStrip";
import { useAcademyStore } from "../../../src/store/academyStore";
import { useTourStore } from "../../../src/tour/tourStore";

const strip = () =>
  render(
    <MemoryRouter>
      <StartHereStrip />
    </MemoryRouter>,
  );

afterEach(() => {
  useTourStore.setState({ progress: { completed: [], welcomeDismissed: true }, activeTourId: null });
  useAcademyStore.setState({ lessons: [], attempts: [] });
});

describe("StartHereStrip", () => {
  it("points a first visit at the tour, the Academy and the Develop stage", () => {
    useTourStore.setState({ progress: { completed: [], welcomeDismissed: true } });
    strip();
    expect(screen.getByRole("link", { name: /Academy/ }).getAttribute("href")).toBe("/academy");
    expect(screen.getByRole("link", { name: /own farm/ }).getAttribute("href")).toBe("/develop");
    fireEvent.click(screen.getByRole("button", { name: /control-room tour/ }));
    expect(useTourStore.getState().activeTourId).toBe("control-room");
  });

  it("is gone once a tour is done or a lesson opened", () => {
    useTourStore.setState({ progress: { completed: ["control-room"], welcomeDismissed: true } });
    const { container } = strip();
    expect(container.textContent).toBe("");
  });
});
