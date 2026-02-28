/**
 * Tests for the VoltageProfilePanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VoltageProfilePanel from "../../../src/components/p2/VoltageProfilePanel";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VoltageProfilePanel", () => {
  it("returns null when loadFlowResults is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: null,
      activeScenario: "full_load",
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<VoltageProfilePanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title with scenario name", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: [
        {
          scenario: "full_load",
          buses: [
            { name: "PSE_400kV", vn_kv: 400, vm_pu: 1.0, va_deg: 0, p_mw: 0, q_mvar: 0 },
          ],
          v_min_pu: 0.97,
          v_max_pu: 1.03,
          total_loss_mw: 12,
          total_generation_mw: 510,
          voltage_compliant: true,
          lines: [],
          transformers: [],
          converged: true,
        },
      ],
      activeScenario: "full_load",
    } as unknown as ReturnType<typeof useGridStore>);

    render(<VoltageProfilePanel />);
    expect(screen.getByText(/Voltage Profile/)).toBeDefined();
    expect(screen.getByText(/Full Load/)).toBeDefined();
  });
});
