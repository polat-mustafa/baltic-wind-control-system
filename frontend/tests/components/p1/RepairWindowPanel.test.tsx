/**
 * Repair window panel: asks the backend with the farm's O&M port distance and shows the answer.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RepairWindowPanel from "../../../src/components/p1/RepairWindowPanel";
import * as api from "../../../src/services/weatherWindowApi";
import { useModeStore } from "../../../src/store/modeStore";
import { useWeatherWindowStore } from "../../../src/store/weatherWindowStore";
import type { MaintenanceWindowResponse } from "../../../src/types/weatherWindow";

vi.mock("../../../src/services/weatherWindowApi");

const answer: MaintenanceWindowResponse = {
  turbine_id: "WTG-01",
  failure_date_iso: "2026-01-15",
  vessel_type: "CTV",
  repair_duration_hours: 8,
  estimated_window_start_iso: "2026-01-17",
  wait_days: 1.8,
  total_downtime_days: 2.1,
  access_probability_pct: 36,
  port_km: 52.5,
  transit_hours: 1.42,
  work_hours_per_day: 9.17,
  cost_estimate_eur: 21_000,
  cost_breakdown: { vessel_day_rate_eur: 9_000, mobilisation_eur: 2_000, labour_eur: 5_000, parts_eur: 5_000 },
};

beforeEach(() => {
  vi.clearAllMocks();
  useModeStore.setState({ mode: "reference" });
  useWeatherWindowStore.setState({ repair: null, repairError: null });
  vi.mocked(api.findMaintenanceWindow).mockResolvedValue(answer);
});

describe("RepairWindowPanel", () => {
  it("sends SB-510's O&M port distance and shows the window, the work day and the cost", async () => {
    render(<RepairWindowPanel />);
    expect(screen.getByText(/Ustka, 52.5 km by sea/)).toBeTruthy();
    await waitFor(() => expect(api.findMaintenanceWindow).toHaveBeenCalled());
    expect(vi.mocked(api.findMaintenanceWindow).mock.calls[0][0]).toMatchObject({
      vessel_type: "CTV",
      repair_duration_hours: 8,
      turbine_id: "WTG-01",
      port_km: 52.5,
    });
    expect(await screen.findByText("2026-01-17")).toBeTruthy();
    expect(screen.getByText("9.2 h")).toBeTruthy();
    expect(screen.getByText("1.4 h transit each way")).toBeTruthy();
    expect(screen.getByText("21 k€")).toBeTruthy();
  });

  it("shows the backend's refusal (a transit that leaves no working time)", async () => {
    vi.mocked(api.findMaintenanceWindow).mockRejectedValue(new Error("CTV transit 6.0 h each way leaves no working time: use an SOV"));
    render(<RepairWindowPanel />);
    expect(await screen.findByText(/use an SOV/)).toBeTruthy();
  });
});
