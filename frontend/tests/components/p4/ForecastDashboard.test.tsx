/**
 * Tests for the ForecastDashboard component.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForecastDashboard from "../../../src/components/p4/ForecastDashboard";

vi.mock("../../../src/components/p4/ForecastKPIHeader", () => ({
  default: () => <div>ForecastKPIHeader</div>,
}));
vi.mock("../../../src/components/p4/ForecastVsActualPanel", () => ({
  default: () => <div>ForecastVsActualPanel</div>,
}));
vi.mock("../../../src/components/p4/ModelComparisonPanel", () => ({
  default: () => <div>ModelComparisonPanel</div>,
}));
vi.mock("../../../src/components/p4/SHAPPanel", () => ({
  default: () => <div>SHAPPanel</div>,
}));
vi.mock("../../../src/components/p4/AccuracyHeatmapPanel", () => ({
  default: () => <div>AccuracyHeatmapPanel</div>,
}));
vi.mock("../../../src/components/p4/RevenueImpactPanel", () => ({
  default: () => <div>RevenueImpactPanel</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForecastDashboard", () => {
  it("renders all panels (no null guard)", () => {
    const { container } = render(<ForecastDashboard />);
    expect(container.innerHTML).not.toBe("");
  });
});
