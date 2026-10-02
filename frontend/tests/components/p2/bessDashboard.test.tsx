/**
 * BESS tab — requests follow the controls (FFR off by default, positive =
 * discharge) and the KPIs and dispatch show the backend's verdicts.
 */

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BESSDashboard from "../../../src/components/p2/BESSDashboard";
import * as api from "../../../src/services/bessApi";
import { FREQUENCY_EVENTS, useBESSStore, WIND_TRACE_MW } from "../../../src/store/bessStore";

vi.mock("../../../src/services/bessApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  useBESSStore.setState({ event: "reference", ffrEnabled: false, fcrCapacityMw: 50, initialSocPct: 50, fcr: null, ramp: null, degradation: null, dispatch: null });
  vi.mocked(api.simFrequencyResponse).mockResolvedValue({
    time_s: [0, 1, 2],
    frequency_hz: [50, 49.9, 49.8],
    bess_power_mw: [0, 25, 50],
    soc_percent: [50, 49.99, 49.98],
    nadir_hz: 49.8,
    nadir_time_s: 2,
    energy_delivered_mwh: 2.31,
    energy_absorbed_mwh: 0,
    fcr_endurance_min: 95.6,
    fcr_activated: true,
    ffr_activated: false,
    assessment: "FCR followed the CE characteristic",
  });
  vi.mocked(api.simRampSmoothing).mockResolvedValue({
    wind_power_mw: [260, 330],
    bess_power_mw: [0, -19],
    smoothed_output_mw: [260, 311],
    soc_percent: [50, 50.1],
    ramp_violations_before: 6,
    ramp_violations_after: 0,
    peak_bess_charge_mw: 49.3,
    peak_bess_discharge_mw: 38.9,
    assessment: "PASS — every ramp kept within the limit",
  });
  vi.mocked(api.calcDegradation).mockResolvedValue({
    projection: [{ year: 0, soh_percent: 100, cycle_loss_pct: 0, calendar_loss_pct: 0, cumulative_cycles: 0, capacity_mwh: 200 }],
    eol_year: 9,
    eol_reached: true,
    total_cycles_to_eol: 3285,
    replacement_cost_m_eur: 70,
    lcoe_contribution_eur_mwh: 152,
    assessment: "End of life (80 % SOH) in year 9",
  });
  vi.mocked(api.dispatchBESS).mockResolvedValue({
    p_target_mw: 300,
    p_wtg_dispatch_mw: 350,
    p_bess_mw: -50,
    p_poc_mw: 300,
    soc_after_pct: 50.38,
    bess_mode: "CHARGE",
    dispatch_feasible: true,
    notes: "Wind surplus 80.0 MW; battery charges 50.0 MW instead of curtailing",
  });
});

describe("BESSDashboard", () => {
  it("runs every study and shows the verdicts", async () => {
    vi.useFakeTimers();
    render(<BESSDashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    vi.useRealTimers();

    const fcrReq = vi.mocked(api.simFrequencyResponse).mock.calls[0][0];
    expect(fcrReq.ffr_threshold_hz).toBeNull();
    expect(fcrReq.fcr_capacity_mw).toBe(50);
    expect(fcrReq.frequency_trace_hz).toEqual([...FREQUENCY_EVENTS.reference.trace]);
    expect(vi.mocked(api.simRampSmoothing).mock.calls[0][0].wind_power_trace_mw).toBe(WIND_TRACE_MW);

    expect(screen.getByText("96")).toBeTruthy();
    expect(screen.getByText("6 → 0")).toBeTruthy();
    expect(screen.getByText("year 9")).toBeTruthy();
    expect(screen.getByText("Battery charge")).toBeTruthy();
    expect(screen.getByText(/battery charges 50.0 MW instead of curtailing/)).toBeTruthy();
  });

  it("reference incident stays within the CE design envelope", () => {
    const tr = FREQUENCY_EVENTS.reference.trace;
    const nadir = Math.min(...tr);
    expect(nadir).toBeGreaterThan(49.19);
    expect(nadir).toBeLessThan(49.25);
    expect(tr[tr.length - 1]).toBeCloseTo(49.8, 2);
  });
});
