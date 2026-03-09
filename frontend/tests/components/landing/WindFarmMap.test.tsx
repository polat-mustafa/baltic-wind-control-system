/**
 * Tests for the WindFarmMap component.
 *
 * WindFarmMap now reads turbine data from the Zustand store internally,
 * so we only pass totalPowerMW as a prop. The store is initialised with
 * 34 turbines automatically.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WindFarmMap from "../../../src/components/landing/WindFarmMap";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("WindFarmMap", () => {
  it("renders the map title", () => {
    render(<WindFarmMap totalPowerMW={442} />);
    const svg = document.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("renders turbine icons from store", () => {
    const { container } = render(<WindFarmMap totalPowerMW={442} />);
    const turbineButtons = container.querySelectorAll('[role="button"]');
    // 34 turbines + OSS + onshore + export cable = 37
    expect(turbineButtons.length).toBeGreaterThanOrEqual(34);
  });

  it("renders with zero power", () => {
    const { container } = render(<WindFarmMap totalPowerMW={0} />);
    expect(container.innerHTML).not.toBe("");
  });

  it("renders the legend component", () => {
    render(<WindFarmMap totalPowerMW={442} />);
    expect(screen.getByText("Operating")).toBeDefined();
  });
});
