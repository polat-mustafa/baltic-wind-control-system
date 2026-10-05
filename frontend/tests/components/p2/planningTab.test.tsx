/** Planning & P2X tab — export technology vs distance and electrolyser on surplus wind. */

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PlanningCouplingTab from "../../../src/components/p2/PlanningCouplingTab";
import * as apiClient from "../../../src/services/apiClient";
import { usePlanningStore } from "../../../src/store/planningStore";

vi.mock("react-plotly.js", () => ({ default: () => null }));

const exportStudy = {
  design_length_km: 45, annual_energy_gwh: 2365.8, capacity_factor: 0.53,
  hvac: { capacity_mw: 712.2, charging_mvar: 260.0, loss_rated_mw: 3.14, loss_gwh: 13.05 },
  hvdc: { loss_rated_mw: 11.23, loss_gwh: 51.06 },
  hvac_capacity_limit_km: 180, loss_crossover_km: 150,
  sweep: [{ length_km: 45, hvac_capacity_mw: 712.2, hvac_charging_mvar: 260, hvac_loss_gwh: 13.05, hvdc_loss_gwh: 51.06 }],
};

const p2x = {
  connection_mw: 400, electrolyser_mw: 60, capex_eur_per_kw: 2000, farm_energy_gwh: 2365.8,
  surplus_gwh: 260.1, surplus_hours: 3257, absorbed_gwh: 178.9, still_lost_gwh: 81.2, h2_tonnes: 3375.3,
  full_load_hours: 2982, lcoh_eur_kg: 4.42, efficiency_lhv: 0.629, power_to_power: 0.314,
  duration_step_h: 20, duration_mw: [494.7, 300, 0], lcoh_flh: [500, 1000],
  lcoh_curves: [{ price_eur_mwh: 0, lcoh_eur_kg: [26.4, 13.2] }],
};

beforeEach(() => {
  vi.restoreAllMocks();
  usePlanningStore.setState({ exportStudy: null, p2x: null, error: null });
});

describe("Planning & P2X tab", () => {
  it("loads both studies and shows the physics KPIs", async () => {
    vi.spyOn(apiClient, "post").mockImplementation((url: string) =>
      Promise.resolve(url.endsWith("/export") ? exportStudy : p2x),
    );
    render(<PlanningCouplingTab />);
    await waitFor(() => expect(screen.getByText("712")).toBeTruthy());
    expect(screen.getByText("carries 510 MW")).toBeTruthy();
    expect(screen.getByText("to be absorbed by reactors")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("4.42")).toBeTruthy());
    expect(screen.getByText("3375")).toBeTruthy();
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/grid/planning/export", { design_length_km: 45 });
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/grid/planning/p2x", {
      connection_mw: 400,
      electrolyser_mw: 60,
      capex_eur_per_kw: 2000,
    });
  });

  it("shows a backend error", async () => {
    vi.spyOn(apiClient, "post").mockRejectedValue(new Error("boom"));
    render(<PlanningCouplingTab />);
    await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
  });
});
