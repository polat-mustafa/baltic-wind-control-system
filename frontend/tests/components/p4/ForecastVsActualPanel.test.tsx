/**
 * Tests for the ForecastVsActualPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForecastVsActualPanel from "../../../src/components/p4/ForecastVsActualPanel";
import { useForecastStore } from "../../../src/store/forecastStore";

vi.mock("../../../src/store/forecastStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForecastVsActualPanel", () => {
  it("returns null when ensembleForecast is null", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      ensembleForecast: null,
    } as unknown as ReturnType<typeof useForecastStore>);

    const { container } = render(<ForecastVsActualPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title when data is loaded", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      ensembleForecast: {
        power_p10_mw: [3, 4, 5],
        power_p50_mw: [5, 6, 7],
        power_p90_mw: [7, 8, 9],
        wind_speed_ms: [8, 9, 10],
        timestamps_utc: [1000, 2000, 3000],
        num_steps: 3,
      },
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<ForecastVsActualPanel />);
    expect(
      screen.getByText("Ensemble Forecast — P10 / P50 / P90"),
    ).toBeDefined();
  });
});
