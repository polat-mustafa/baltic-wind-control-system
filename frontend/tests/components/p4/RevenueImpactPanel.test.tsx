/**
 * Tests for the RevenueImpactPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RevenueImpactPanel from "../../../src/components/p4/RevenueImpactPanel";
import { useForecastStore } from "../../../src/store/forecastStore";

vi.mock("../../../src/store/forecastStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RevenueImpactPanel", () => {
  it("returns null when ensembleForecast is null", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      ensembleForecast: null,
      spotPriceEurMwh: 72,
    } as unknown as ReturnType<typeof useForecastStore>);

    const { container } = render(<RevenueImpactPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title and revenue total when data is loaded", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      ensembleForecast: {
        power_p50_mw: [5, 6, 7],
        num_steps: 3,
      },
      spotPriceEurMwh: 72,
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<RevenueImpactPanel />);
    expect(screen.getByText("Revenue Impact — 34 Turbines")).toBeDefined();
    expect(screen.getByText(/synthetic spot price/)).toBeDefined();
  });
});
