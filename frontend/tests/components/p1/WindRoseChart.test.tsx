/**
 * Tests for the WindRoseChart component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WindRoseChart from "../../../src/components/p1/WindRoseChart";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WindRoseChart", () => {
  it("returns null when windRose is null", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      windRose: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<WindRoseChart />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title when data is loaded", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      windRose: {
        sector_centres_deg: [0, 30, 60],
        frequencies: [0.1, 0.2, 0.15],
        energy_fractions: [0.12, 0.25, 0.18],
        mean_speeds_ms: [8, 10, 9],
        dominant_direction_deg: 240,
        circular_std_deg: 45,
        num_sectors: 12,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<WindRoseChart />);
    expect(screen.getByText(/Wind Rose/)).toBeDefined();
  });

  it("shows dominant direction in footer", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      windRose: {
        sector_centres_deg: [0, 30, 60],
        frequencies: [0.1, 0.2, 0.15],
        energy_fractions: [0.12, 0.25, 0.18],
        mean_speeds_ms: [8, 10, 9],
        dominant_direction_deg: 240,
        circular_std_deg: 45,
        num_sectors: 12,
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<WindRoseChart />);
    expect(screen.getByText(/240°/)).toBeDefined();
  });
});
