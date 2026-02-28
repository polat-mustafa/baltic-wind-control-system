/**
 * Tests for the WakeLossPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WakeLossPanel from "../../../src/components/p1/WakeLossPanel";
import { useWindResourceStore } from "../../../src/store/windResourceStore";

vi.mock("../../../src/store/windResourceStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WakeLossPanel", () => {
  it("returns null when wakeAnalysis is null", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      wakeAnalysis: null,
    } as unknown as ReturnType<typeof useWindResourceStore>);

    const { container } = render(<WakeLossPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title when data is loaded", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      wakeAnalysis: {
        per_turbine_wake_loss_percent: [5, 8, 12, 16],
        wake_loss_percent: 10,
        gross_aep_gwh: 2100,
        net_aep_gwh: 1890,
        capacity_factor: 0.42,
        per_turbine_aep_gwh: [55, 54, 52, 50],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<WakeLossPanel />);
    expect(screen.getByText("Per-Turbine Wake Loss")).toBeDefined();
  });

  it("renders color legend", () => {
    vi.mocked(useWindResourceStore).mockReturnValue({
      wakeAnalysis: {
        per_turbine_wake_loss_percent: [5, 8, 12, 16],
        wake_loss_percent: 10,
        gross_aep_gwh: 2100,
        net_aep_gwh: 1890,
        capacity_factor: 0.42,
        per_turbine_aep_gwh: [55, 54, 52, 50],
      },
    } as unknown as ReturnType<typeof useWindResourceStore>);

    render(<WakeLossPanel />);
    expect(screen.getByText("10-15%")).toBeDefined();
  });
});
