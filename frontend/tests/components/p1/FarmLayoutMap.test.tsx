/**
 * Tests for the FarmLayoutMap component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FarmLayoutMap from "../../../src/components/p1/FarmLayoutMap";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FarmLayoutMap", () => {
  it("returns null when data is null", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      layoutPositions: null,
      wakeAnalysis: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<FarmLayoutMap />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title with layout name", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      layoutPositions: {
        name: "regular",
        x_positions: [0, 100],
        y_positions: [0, 100],
        num_turbines: 34,
        min_spacing_m: 900,
        area_km2: 45.2,
      },
      wakeAnalysis: {
        per_turbine_aep_gwh: [55, 54],
        per_turbine_wake_loss_percent: [5, 8],
        wake_loss_percent: 6.5,
        gross_aep_gwh: 2100,
        net_aep_gwh: 1960,
        capacity_factor: 0.44,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<FarmLayoutMap />);
    expect(screen.getByText(/regular/)).toBeDefined();
    expect(screen.getByText(/34 turbines/)).toBeDefined();
  });

  it("shows spacing and area in footer", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      layoutPositions: {
        name: "regular",
        x_positions: [0, 100],
        y_positions: [0, 100],
        num_turbines: 34,
        min_spacing_m: 900,
        area_km2: 45.2,
      },
      wakeAnalysis: {
        per_turbine_aep_gwh: [55, 54],
        per_turbine_wake_loss_percent: [5, 8],
        wake_loss_percent: 6.5,
        gross_aep_gwh: 2100,
        net_aep_gwh: 1960,
        capacity_factor: 0.44,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<FarmLayoutMap />);
    expect(screen.getByText(/900m/)).toBeDefined();
    expect(screen.getByText(/45.2 km/)).toBeDefined();
  });
});
