/**
 * Tests for the WindResourceDashboard component.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WindResourceDashboard from "../../../src/components/p1/WindResourceDashboard";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WindResourceDashboard", () => {
  it("returns null when aepCascade is null", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<WindResourceDashboard />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when data is loaded", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: {
        net_aep_gwh: 1850,
        p90_gwh: 1720,
        capacity_factor: 0.42,
        revenue_meur: 133,
        price_eur_mwh: 72,
        combined_uncertainty_percent: 8.5,
        total_loss_percent: 12,
        gross_aep_gwh: 2100,
        p50_gwh: 1850,
        p75_gwh: 1780,
        p99_gwh: 1600,
        loss_factors: [],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<WindResourceDashboard />);
    expect(container.innerHTML).not.toBe("");
  });
});
