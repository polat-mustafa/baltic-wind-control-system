/**
 * Tests for the GridKPIHeader component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GridKPIHeader from "../../../src/components/p2/GridKPIHeader";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GridKPIHeader", () => {
  it("returns null when loadFlowResults is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: null,
      shortCircuit: null,
      statcomSizing: null,
      frtResult: null,
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<GridKPIHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when shortCircuit is null", () => {
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
      shortCircuit: null,
      statcomSizing: null,
      frtResult: null,
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<GridKPIHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all KPI cards when data is loaded", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: [
        {
          scenario: "full_load",
          v_min_pu: 0.97,
          v_max_pu: 1.03,
          total_loss_mw: 12.5,
          total_generation_mw: 510,
          voltage_compliant: true,
          buses: [],
          lines: [],
          transformers: [],
          converged: true,
        },
      ],
      shortCircuit: {
        max_ikss_ka: 25.3,
        max_ikss_bus: "OSS_66kV",
        breaker_adequate: true,
        bus_results: [],
        case: "max",
        voltage_factor_c: 1.1,
      },
      statcomSizing: {
        statcom_rating_mvar: 120,
        compensation_adequate: true,
        ferranti_rise_pu: 0.03,
        cable_q_mvar: 85,
        reactor_q_mvar: 50,
        without_compensation_v_max_pu: 1.06,
        statcom_q_range_min_mvar: -120,
        statcom_q_range_max_mvar: 120,
      },
      frtResult: {
        stayed_connected: true,
        reactive_current_compliant: true,
        recovery_compliant: true,
        reactive_current_gain: 2.5,
        recovery_time_s: 0.85,
        frt_type: "lvrt",
        fault_bus: "OSS_66kV",
        fault_duration_s: 0.15,
        statcom_peak_q_mvar: 95,
        time_series: [],
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<GridKPIHeader />);
    expect(screen.getByText("Voltage Range")).toBeDefined();
    expect(screen.getByText("Total Losses")).toBeDefined();
    expect(screen.getByText("STATCOM Rating")).toBeDefined();
    expect(screen.getByText("FRT Status")).toBeDefined();
    expect(screen.getByText("PASS")).toBeDefined();
  });

  it("shows compliance subtitle", () => {
    vi.mocked(useGridStore).mockReturnValue({
      loadFlowResults: [
        {
          scenario: "full_load",
          v_min_pu: 0.97,
          v_max_pu: 1.03,
          total_loss_mw: 12.5,
          total_generation_mw: 510,
          voltage_compliant: true,
          buses: [],
          lines: [],
          transformers: [],
          converged: true,
        },
      ],
      shortCircuit: {
        max_ikss_ka: 25.3,
        max_ikss_bus: "OSS_66kV",
        breaker_adequate: true,
        bus_results: [],
        case: "max",
        voltage_factor_c: 1.1,
      },
      statcomSizing: null,
      frtResult: null,
    } as unknown as ReturnType<typeof useGridStore>);

    render(<GridKPIHeader />);
    expect(screen.getByText("All scenarios compliant")).toBeDefined();
    expect(screen.getByText("Breakers adequate")).toBeDefined();
  });
});
