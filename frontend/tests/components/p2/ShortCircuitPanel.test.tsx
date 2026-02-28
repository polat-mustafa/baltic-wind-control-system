/**
 * Tests for the ShortCircuitPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShortCircuitPanel from "../../../src/components/p2/ShortCircuitPanel";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShortCircuitPanel", () => {
  it("returns null when shortCircuit is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      shortCircuit: null,
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<ShortCircuitPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title with voltage factor", () => {
    vi.mocked(useGridStore).mockReturnValue({
      shortCircuit: {
        case: "max",
        voltage_factor_c: 1.1,
        bus_results: [
          { bus_name: "OSS_66kV", vn_kv: 66, ikss_ka: 20, ip_ka: 50, skss_mw: 2280 },
        ],
        max_ikss_ka: 20,
        max_ikss_bus: "OSS_66kV",
        breaker_adequate: true,
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<ShortCircuitPanel />);
    expect(screen.getByText(/IEC 60909/)).toBeDefined();
    expect(screen.getByText(/c=1.1/)).toBeDefined();
  });

  it("shows Breakers Adequate badge when true", () => {
    vi.mocked(useGridStore).mockReturnValue({
      shortCircuit: {
        case: "max",
        voltage_factor_c: 1.1,
        bus_results: [],
        max_ikss_ka: 20,
        max_ikss_bus: "OSS_66kV",
        breaker_adequate: true,
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<ShortCircuitPanel />);
    expect(screen.getByText("Breakers Adequate")).toBeDefined();
  });

  it("shows Breakers Inadequate badge when false", () => {
    vi.mocked(useGridStore).mockReturnValue({
      shortCircuit: {
        case: "max",
        voltage_factor_c: 1.1,
        bus_results: [],
        max_ikss_ka: 45,
        max_ikss_bus: "PSE_400kV",
        breaker_adequate: false,
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<ShortCircuitPanel />);
    expect(screen.getByText("Breakers Inadequate")).toBeDefined();
  });
});
