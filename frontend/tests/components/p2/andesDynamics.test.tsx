/** ANDES dynamics section — runs on demand and shows the PSE checks. */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AndesDynamicsSection from "../../../src/components/p2/AndesDynamicsSection";
import * as apiClient from "../../../src/services/apiClient";
import { useDynamicsStore } from "../../../src/store/n1SecurityStore";

vi.mock("react-plotly.js", () => ({ default: () => null }));

const point = { t: 0, f_hz: 50, v_poc: 1, p_mw: 510, q_mvar: 35, iq_pu: 0.07, p_expected_mw: null };

beforeEach(() => {
  vi.restoreAllMocks();
  useDynamicsStore.setState({ event: "frequency", load_trip_mw: 3000, retained_voltage_pu: 0.05, result: null, error: null });
});

describe("ANDES dynamics", () => {
  it("runs the frequency event and compares with the droop formula", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      event: "frequency", p0_mw: 510, series: [point], load_trip_mw: 3000, f_max_hz: 50.895, f_final_hz: 50.332,
      p_min_mw: 404.7, dp_final_mw: -27.2, dp_expected_final_mw: -27.0, response_delay_s: 0.4,
      retained_voltage_pu: null, iq_max_pu: null, p_recovery_s: null, recovery_limit_s: null, stayed_connected: null,
    });
    render(<AndesDynamicsSection />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run simulation" }));
    });
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/grid/dynamics/andes", { event: "frequency", load_trip_mw: 3000, retained_voltage_pu: 0.05 });
    expect(screen.getByText("-27.2")).toBeTruthy();
    expect(screen.getByText("5 % droop formula: -27.0 MW")).toBeTruthy();
  });

  it("switches to the fault event", async () => {
    vi.spyOn(apiClient, "post").mockResolvedValue({
      event: "fault", p0_mw: 510, series: [point], load_trip_mw: null, f_max_hz: null, f_final_hz: null, p_min_mw: null,
      dp_final_mw: null, dp_expected_final_mw: null, response_delay_s: null,
      retained_voltage_pu: 0.05, iq_max_pu: 1.099, p_recovery_s: 0.12, recovery_limit_s: 5, stayed_connected: true,
    });
    render(<AndesDynamicsSection />);
    fireEvent.click(screen.getByRole("button", { name: "Fault at the POC (FRT)" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run simulation" }));
    });
    expect(vi.mocked(apiClient.post).mock.lastCall?.[1]).toMatchObject({ event: "fault" });
    expect(screen.getByText("Rode through")).toBeTruthy();
    expect(screen.getByText("1.10")).toBeTruthy();
  });
});
