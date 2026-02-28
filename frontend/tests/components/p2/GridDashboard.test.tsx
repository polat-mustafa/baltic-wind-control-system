/**
 * Tests for the GridDashboard component.
 */

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GridDashboard from "../../../src/components/p2/GridDashboard";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GridDashboard", () => {
  it("returns null when loadFlowResults is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: null,
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<GridDashboard />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when data is loaded", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: [
        {
          scenario: "full_load",
          v_min_pu: 0.97,
          v_max_pu: 1.03,
          total_loss_mw: 12,
          total_generation_mw: 510,
          voltage_compliant: true,
          buses: [],
          lines: [],
          transformers: [],
          converged: true,
        },
      ],
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<GridDashboard />);
    expect(container.innerHTML).not.toBe("");
  });
});
