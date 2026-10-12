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
    expect(screen.getByText(/loss cascade/)).toBeDefined();
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
    expect(screen.getByText(/12.3 %/)).toBeDefined();
  });

  it("labels an unassessed curtailment step with its provenance and lists the horizons", () => {
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
          { name: "curtailment", loss_percent: 0, uncertainty_percent: 0, quality: "illustrative", source: "Not assessed: needs an hourly price series" },
        ],
        exceedance_by_horizon: [
          { years: 1, sigma_percent: 9.8, p75_gwh: 1728, p90_gwh: 1618, p99_gwh: 1428 },
          { years: 10, sigma_percent: 7.1, p75_gwh: 1761, p90_gwh: 1681, p99_gwh: 1544 },
          { years: 30, sigma_percent: 6.9, p75_gwh: 1764, p90_gwh: 1687, p99_gwh: 1553 },
        ],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<AEPCascadePanel />);
    expect(screen.getByText("Curtailment: not assessed (0 %)")).toBeDefined();
    expect(screen.getByTitle("Not assessed: needs an hourly price series")).toBeDefined();
    expect(screen.getByText("1 year")).toBeDefined();
    expect(screen.getByText("10 years")).toBeDefined();
    expect(screen.getByText("Lifetime (30 years)")).toBeDefined();
    expect(screen.getByText("1618")).toBeDefined();
  });
});
