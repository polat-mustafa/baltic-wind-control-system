/**
 * Tests for the CableLoadingPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CableLoadingPanel from "../../../src/components/p2/CableLoadingPanel";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CableLoadingPanel", () => {
  it("returns null when loadFlowResults is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: null,
      activeScenario: "full_load",
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<CableLoadingPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title with scenario name", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: [
        {
          scenario: "full_load",
          lines: [
            { name: "Cable_S1", from_bus: "A", to_bus: "B", loading_percent: 75, p_from_mw: 85, q_from_mvar: 10, pl_mw: 0.5, ql_mvar: 0.1 },
          ],
          transformers: [
            { name: "TR_OSS", loading_percent: 88, p_hv_mw: 510, q_hv_mvar: 50, pl_mw: 2, ql_mvar: 1 },
          ],
          v_min_pu: 0.97,
          v_max_pu: 1.03,
          total_loss_mw: 12,
          total_generation_mw: 510,
          voltage_compliant: true,
          buses: [],
          converged: true,
        },
      ],
      activeScenario: "full_load",
    } as unknown as ReturnType<typeof useGridStore>);

    render(<CableLoadingPanel />);
    expect(screen.getByText(/Cable.*Transformer Loading/)).toBeDefined();
    expect(screen.getByText(/Full Load/)).toBeDefined();
  });
});
