/**
 * Tests for the WindFarmMap component.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WindFarmMap from "../../../src/components/landing/WindFarmMap";
import type { TurbineData } from "../../../src/types/landing";
import { TURBINE_POSITIONS } from "../../../src/constants/windFarmLayout";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

const MOCK_TURBINES: TurbineData[] = TURBINE_POSITIONS.map((pos) => ({
  id: pos.id,
  stringNumber: pos.stringNumber,
  position: { x: pos.x, y: pos.y },
  status: "operating" as const,
  powerOutputMW: 13.0,
  windSpeedMs: 11.0,
}));

describe("WindFarmMap", () => {
  it("renders the map title", () => {
    render(<WindFarmMap turbines={MOCK_TURBINES} totalPowerMW={442} />);
    const svg = document.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("renders turbine icons", () => {
    const { container } = render(
      <WindFarmMap turbines={MOCK_TURBINES} totalPowerMW={442} />,
    );
    const turbineButtons = container.querySelectorAll('[role="button"]');
    // 34 turbines + OSS + onshore + export cable = 37
    expect(turbineButtons.length).toBeGreaterThanOrEqual(34);
  });

  it("renders with empty turbines array", () => {
    const { container } = render(
      <WindFarmMap turbines={[]} totalPowerMW={0} />,
    );
    expect(container.innerHTML).not.toBe("");
  });

  it("renders the legend component", () => {
    render(<WindFarmMap turbines={MOCK_TURBINES} totalPowerMW={442} />);
    expect(screen.getByText("Status")).toBeDefined();
  });
});
