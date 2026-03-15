/**
 * Tests for the EnvironmentPanel component.
 *
 * EnvironmentPanel reads from landingStore's environment slice.
 * Default state provides valid environment data (computed from initial wind speed).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EnvironmentPanel from "../../../src/components/landing/EnvironmentPanel";

describe("EnvironmentPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<EnvironmentPanel />);
    expect(container.firstChild).toBeTruthy();
  });

  it("renders the Environment header", () => {
    render(<EnvironmentPanel />);
    expect(screen.getByText("Environment")).toBeDefined();
  });

  it("renders UTC clock", () => {
    render(<EnvironmentPanel />);
    expect(screen.getByText(/UTC/)).toBeDefined();
  });

  it("renders Beaufort scale badge", () => {
    render(<EnvironmentPanel />);
    expect(screen.getByText(/Bft/)).toBeDefined();
  });

  it("renders sea state and weather labels", () => {
    render(<EnvironmentPanel />);
    expect(screen.getByText("Hs")).toBeDefined();
    expect(screen.getByText("Tp")).toBeDefined();
    expect(screen.getByText("Air")).toBeDefined();
    expect(screen.getByText("Sea")).toBeDefined();
    expect(screen.getByText("Vis")).toBeDefined();
    expect(screen.getByText("Cloud")).toBeDefined();
    expect(screen.getByText("Press")).toBeDefined();
  });

  it("renders numeric values with units", () => {
    render(<EnvironmentPanel />);
    // Multiple rows share unit suffixes — use getAllByText
    expect(screen.getAllByText(/m$/).length).toBeGreaterThanOrEqual(1); // Hs + Vis (km)
    expect(screen.getAllByText(/°C$/).length).toBe(2); // Air + Sea temps
    expect(screen.getByText(/hPa$/)).toBeDefined(); // Pressure
  });
});
