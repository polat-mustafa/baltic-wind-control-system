/**
 * Tests for the FRTPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FRTPanel from "../../../src/components/p2/FRTPanel";
import { useGridStore } from "../../../src/store/gridStore";

vi.mock("../../../src/store/gridStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FRTPanel", () => {
  it("returns null when frtResult is null", () => {
    vi.mocked(useGridStore).mockReturnValue({
      frtResult: null,
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<FRTPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when time_series is empty", () => {
    vi.mocked(useGridStore).mockReturnValue({
      frtResult: {
        frt_type: "lvrt",
        fault_bus: "OSS_66kV",
        fault_duration_s: 0.15,
        stayed_connected: true,
        reactive_current_compliant: true,
        recovery_compliant: true,
        reactive_current_gain: 2.5,
        recovery_time_s: 0.85,
        statcom_peak_q_mvar: 95,
        time_series: [],
      },
    } as unknown as ReturnType<typeof useGridStore>);

    const { container } = render(<FRTPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders compliance badges when data is loaded", () => {
    vi.mocked(useGridStore).mockReturnValue({
      frtResult: {
        frt_type: "lvrt",
        fault_bus: "OSS_66kV",
        fault_duration_s: 0.15,
        stayed_connected: true,
        reactive_current_compliant: true,
        recovery_compliant: true,
        reactive_current_gain: 2.5,
        recovery_time_s: 0.85,
        statcom_peak_q_mvar: 95,
        time_series: [
          { time_s: 0, voltage_pu: 1.0, active_power_mw: 510, reactive_power_mvar: 0, reactive_current_pu: 0 },
          { time_s: 0.5, voltage_pu: 0.15, active_power_mw: 50, reactive_power_mvar: 80, reactive_current_pu: 2.5 },
        ],
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<FRTPanel />);
    expect(screen.getByText(/LVRT Simulation/)).toBeDefined();
    expect(screen.getByText(/Connected: PASS/)).toBeDefined();
    expect(screen.getByText(/Recovery: PASS/)).toBeDefined();
  });

  it("shows Kqv value", () => {
    vi.mocked(useGridStore).mockReturnValue({
      frtResult: {
        frt_type: "lvrt",
        fault_bus: "OSS_66kV",
        fault_duration_s: 0.15,
        stayed_connected: true,
        reactive_current_compliant: true,
        recovery_compliant: true,
        reactive_current_gain: 2.5,
        recovery_time_s: 0.85,
        statcom_peak_q_mvar: 95,
        time_series: [
          { time_s: 0, voltage_pu: 1.0, active_power_mw: 510, reactive_power_mvar: 0, reactive_current_pu: 0 },
        ],
      },
    } as unknown as ReturnType<typeof useGridStore>);

    render(<FRTPanel />);
    expect(screen.getByText("Kqv Achieved")).toBeDefined();
    expect(screen.getByText("2.5")).toBeDefined();
  });
});
