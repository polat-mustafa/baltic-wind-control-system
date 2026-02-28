/**
 * Tests for the ConverterComparisonPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConverterComparisonPanel from "../../../src/components/p2/ConverterComparisonPanel";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ConverterComparisonPanel", () => {
  it("returns null when converterComparison is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      converterComparison: null,
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<ConverterComparisonPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders comparison table", () => {
    vi.mocked(useGridStore).mockReturnValue({
      converterComparison: {
        scenario: "strong_grid",
        gfl_result: {
          converter_type: "gfl",
          grid_ssc_mva: 5000,
          scr: 10,
          stable: true,
          voltage_deviation_pu: 0.02,
          settling_time_s: 0.5,
          frequency_deviation_hz: 0.01,
        },
        gfm_result: {
          converter_type: "gfm",
          grid_ssc_mva: 5000,
          scr: 10,
          stable: true,
          voltage_deviation_pu: 0.005,
          settling_time_s: 0.15,
          frequency_deviation_hz: 0.003,
        },
        gfm_advantage: "GFM provides voltage source behavior.",
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<ConverterComparisonPanel />);
    expect(screen.getByText(/Converter Comparison/)).toBeDefined();
    expect(screen.getByText("GFL (PLL)")).toBeDefined();
    expect(screen.getByText("GFM (VSM)")).toBeDefined();
    expect(screen.getByText("Voltage Deviation")).toBeDefined();
    expect(screen.getByText("Settling Time")).toBeDefined();
  });

  it("shows stability badges", () => {
    vi.mocked(useGridStore).mockReturnValue({
      converterComparison: {
        scenario: "strong_grid",
        gfl_result: {
          converter_type: "gfl",
          grid_ssc_mva: 5000,
          scr: 10,
          stable: true,
          voltage_deviation_pu: 0.02,
          settling_time_s: 0.5,
          frequency_deviation_hz: 0.01,
        },
        gfm_result: {
          converter_type: "gfm",
          grid_ssc_mva: 5000,
          scr: 10,
          stable: true,
          voltage_deviation_pu: 0.005,
          settling_time_s: 0.15,
          frequency_deviation_hz: 0.003,
        },
        gfm_advantage: "GFM provides voltage source behavior.",
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<ConverterComparisonPanel />);
    const yesBadges = screen.getAllByText("YES");
    expect(yesBadges).toHaveLength(2);
  });

  it("shows GFM advantage text", () => {
    vi.mocked(useGridStore).mockReturnValue({
      converterComparison: {
        scenario: "strong_grid",
        gfl_result: {
          converter_type: "gfl",
          grid_ssc_mva: 5000,
          scr: 10,
          stable: true,
          voltage_deviation_pu: 0.02,
          settling_time_s: 0.5,
          frequency_deviation_hz: 0.01,
        },
        gfm_result: {
          converter_type: "gfm",
          grid_ssc_mva: 5000,
          scr: 10,
          stable: true,
          voltage_deviation_pu: 0.005,
          settling_time_s: 0.15,
          frequency_deviation_hz: 0.003,
        },
        gfm_advantage: "GFM provides voltage source behavior.",
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<ConverterComparisonPanel />);
    expect(screen.getByText("GFM provides voltage source behavior.")).toBeDefined();
  });
});
