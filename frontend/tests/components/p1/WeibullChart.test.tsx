/**
 * Tests for the WeibullChart component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WeibullChart from "../../../src/components/p1/WeibullChart";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WeibullChart", () => {
  it("returns null when data is null", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      weibullFit: null,
      turbineSpec: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<WeibullChart />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title with Weibull parameters", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      weibullFit: {
        fitted_a: 10.5,
        fitted_k: 2.2,
        mean_speed_ms: 9.3,
        bin_centres: [1, 2, 3],
        bin_frequencies: [0.01, 0.02, 0.03],
        pdf_values: [0.01, 0.05, 0.08],
      },
      turbineSpec: {
        cut_in_speed_ms: 3,
        rated_speed_ms: 12.5,
        cut_out_speed_ms: 31,
        rotor_diameter_m: 236,
        hub_height_m: 150,
        rated_power_kw: 15000,
        num_turbines: 34,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<WeibullChart />);
    expect(screen.getByText(/A=10.5/)).toBeDefined();
    expect(screen.getByText(/k=2.2/)).toBeDefined();
  });

  it("shows mean speed in footer", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      weibullFit: {
        fitted_a: 10.5,
        fitted_k: 2.2,
        mean_speed_ms: 9.3,
        bin_centres: [1, 2, 3],
        bin_frequencies: [0.01, 0.02, 0.03],
        pdf_values: [0.01, 0.05, 0.08],
      },
      turbineSpec: {
        cut_in_speed_ms: 3,
        rated_speed_ms: 12.5,
        cut_out_speed_ms: 31,
        rotor_diameter_m: 236,
        hub_height_m: 150,
        rated_power_kw: 15000,
        num_turbines: 34,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<WeibullChart />);
    expect(screen.getByText(/9.3 m\/s/)).toBeDefined();
  });
});
