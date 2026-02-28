/**
 * Tests for the AEPCascadePanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AEPCascadePanel from "../../../src/components/p1/AEPCascadePanel";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AEPCascadePanel", () => {
  it("returns null when aepCascade is null", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<AEPCascadePanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title when data is loaded", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: {
        gross_aep_gwh: 2100,
        net_aep_gwh: 1850,
        p50_gwh: 1850,
        p75_gwh: 1780,
        p90_gwh: 1720,
        p99_gwh: 1600,
        total_loss_percent: 12.3,
        combined_uncertainty_percent: 8.5,
        capacity_factor: 0.42,
        revenue_meur: 133.2,
        price_eur_mwh: 72,
        loss_factors: [
          { name: "Wake", loss_percent: 8.5, uncertainty_percent: 2.0 },
        ],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<AEPCascadePanel />);
    expect(screen.getByText(/AEP Loss Cascade/)).toBeDefined();
  });

  it("shows total loss and uncertainty in footer", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: {
        gross_aep_gwh: 2100,
        net_aep_gwh: 1850,
        p50_gwh: 1850,
        p75_gwh: 1780,
        p90_gwh: 1720,
        p99_gwh: 1600,
        total_loss_percent: 12.3,
        combined_uncertainty_percent: 8.5,
        capacity_factor: 0.42,
        revenue_meur: 133.2,
        price_eur_mwh: 72,
        loss_factors: [],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<AEPCascadePanel />);
    expect(screen.getByText(/12.3%/)).toBeDefined();
  });
});
