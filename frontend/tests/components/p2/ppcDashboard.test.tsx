/**
 * PPC tab — TSO command building per mode, and the dashboard's PSE checks.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PPCDashboard from "../../../src/components/p2/PPCDashboard";
import * as api from "../../../src/services/ppcApi";
import { buildTSOSetpoint, usePPCStore } from "../../../src/store/ppcStore";
import type { PPCSimulationResponse } from "../../../src/types/ppc";

vi.mock("../../../src/services/ppcApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

const point = (time_s: number, p: number, f = 50) => ({
  time_s,
  power_setpoint_mw: p,
  power_actual_mw: p,
  available_power_mw: 510,
  curtailment_mw: 510 - p,
  ramp_rate_mw_per_min: 0,
  q_setpoint_mvar: 5,
  q_actual_mvar: 5,
  voltage_pcc_pu: 0.999,
  frequency_hz: f,
  ppc_state: "derated" as const,
});

const sim: PPCSimulationResponse = {
  active_power_mode: "power_reference",
  reactive_power_mode: "voltage_control",
  ppc_state: "derated",
  tso_power_setpoint_mw: 300,
  tso_q_or_v_setpoint: 1,
  final_power_mw: 355.6,
  final_q_mvar: 5.2,
  final_voltage_pu: 0.999,
  total_available_mw: 510,
  total_curtailment_mw: 154.4,
  ramp_time_s: 248.6,
  setpoint_accuracy_compliant: true,
  ramp_rate_compliant: true,
  voltage_compliant: true,
  frequency_response_compliant: true,
  frequency_response_expected_mw: -61.2,
  frequency_response_actual_mw: -60.8,
  q_response_90_s: 0,
  q_response_compliant: true,
  q_range_mvar: [-288.3, 288.3],
  overall_compliant: true,
  wtg_dispatch: [
    { wtg_id: "WTG_01", available_power_mw: 15, dispatched_power_mw: 10.5, dispatched_q_mvar: 0.2, curtailment_mw: 4.5, is_online: true },
  ],
  time_series: [point(0, 510), point(60, 470, 50.5), point(120, 356, 50.5)],
};

beforeEach(() => {
  vi.clearAllMocks();
  usePPCStore.setState({ simulation: null, activePowerMode: "power_reference", reactivePowerMode: "voltage_control", event: "over_frequency" });
});

describe("buildTSOSetpoint", () => {
  it("sends only the fields the selected modes use", () => {
    const s = usePPCStore.getState();
    expect(buildTSOSetpoint(s)).toEqual({ active_power_mw: 300, voltage_setpoint_pu: 1 });
    expect(buildTSOSetpoint({ ...s, activePowerMode: "delta_control", reactivePowerMode: "power_factor", powerFactor: -0.95 })).toEqual({
      delta_reserve_mw: 50,
      power_factor: -0.95,
    });
    expect(buildTSOSetpoint({ ...s, activePowerMode: "ramp_rate_control", reactivePowerMode: "reactive_power" })).toEqual({
      active_power_mw: 300,
      ramp_rate_mw_per_min: 100,
      reactive_power_mvar: 0,
    });
  });
});

describe("PPCDashboard", () => {
  it("runs the simulation with the selected grid event and shows the PSE checks", async () => {
    vi.useFakeTimers();
    vi.mocked(api.runPPCSimulation).mockResolvedValue(sim);
    render(<PPCDashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    vi.useRealTimers();
    expect(api.runPPCSimulation).toHaveBeenCalledWith(
      expect.objectContaining({ frequency_event_hz: 50.5, voltage_step_pu: null, time_step_s: 0.1 }),
    );
    expect(screen.getByText("How the PPC controls the plant")).toBeTruthy();
    expect(screen.getByText(/reached within 2 % in 249 s/)).toBeTruthy();
    expect(screen.getByText(/droop asks -61.2 MW, plant gives -60.8 MW/)).toBeTruthy();
  });
});
