/**
 * Tests for the AccuracyHeatmapPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccuracyHeatmapPanel from "../../../src/components/p4/AccuracyHeatmapPanel";
import { useForecastStore } from "../../../src/store/forecastStore";

vi.mock("../../../src/store/forecastStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AccuracyHeatmapPanel", () => {
  it("returns null when ensembleForecast is null", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      ensembleForecast: null,
      horizonSteps: 288,
    } as unknown as ReturnType<typeof useForecastStore>);

    const { container } = render(<AccuracyHeatmapPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title when data is loaded", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      ensembleForecast: {
        power_p10_mw: [3, 4, 5],
        power_p50_mw: [5, 6, 7],
        power_p90_mw: [7, 8, 9],
        num_steps: 3,
      },
      horizonSteps: 288,
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<AccuracyHeatmapPanel />);
    expect(
      screen.getByText("Uncertainty vs Lead Time — P90-P10 Spread"),
    ).toBeDefined();
  });
});
