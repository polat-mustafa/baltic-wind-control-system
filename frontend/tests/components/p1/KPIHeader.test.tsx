/**
 * Tests for the P1 KPIHeader component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import KPIHeader from "../../../src/components/p1/KPIHeader";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KPIHeader", () => {
  it("returns null when data is not loaded", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: null,
      wakeAnalysis: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<KPIHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("renders KPI cards when data is loaded", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: {
        net_aep_gwh: 1850.5,
        p90_gwh: 1720.0,
        capacity_factor: 0.42,
        revenue_meur: 133.2,
        price_eur_mwh: 72,
        combined_uncertainty_percent: 8.5,
        total_loss_percent: 12.3,
        gross_aep_gwh: 2100,
        p50_gwh: 1850,
        p75_gwh: 1780,
        p99_gwh: 1600,
        loss_factors: [],
      },
      wakeAnalysis: {
        wake_loss_percent: 8.5,
        gross_aep_gwh: 2100,
        net_aep_gwh: 1850,
        capacity_factor: 0.42,
        per_turbine_aep_gwh: [],
        per_turbine_wake_loss_percent: [],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<KPIHeader />);
    expect(screen.getByText("Net AEP (P50)")).toBeDefined();
    expect(screen.getByText("Wake Loss")).toBeDefined();
    expect(screen.getByText("Capacity Factor")).toBeDefined();
    expect(screen.getByText("Uncertainty")).toBeDefined();
  });

  it("shows P90 in subtitle", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      aepCascade: {
        net_aep_gwh: 1850.5,
        p90_gwh: 1720.0,
        capacity_factor: 0.42,
        revenue_meur: 133.2,
        price_eur_mwh: 72,
        combined_uncertainty_percent: 8.5,
        total_loss_percent: 12.3,
        gross_aep_gwh: 2100,
        p50_gwh: 1850,
        p75_gwh: 1780,
        p99_gwh: 1600,
        loss_factors: [],
      },
      wakeAnalysis: {
        wake_loss_percent: 8.5,
        gross_aep_gwh: 2100,
        net_aep_gwh: 1850,
        capacity_factor: 0.42,
        per_turbine_aep_gwh: [],
        per_turbine_wake_loss_percent: [],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<KPIHeader />);
    expect(screen.getByText(/P90: 1720.0 GWh/)).toBeDefined();
  });
});
