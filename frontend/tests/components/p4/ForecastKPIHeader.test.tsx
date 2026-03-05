/**
 * Tests for the ForecastKPIHeader component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForecastKPIHeader from "../../../src/components/p4/ForecastKPIHeader";
import { useForecastStore } from "../../../src/store/forecastStore";

vi.mock("../../../src/store/forecastStore");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForecastKPIHeader", () => {
  it("returns null when modelComparison is null", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      modelComparison: null,
      rampDetection: null,
      ensembleForecast: null,
      spotPriceEurMwh: 72,
    } as unknown as ReturnType<typeof useForecastStore>);

    const { container } = render(<ForecastKPIHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when rampDetection is null", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      modelComparison: { model_metrics: [], best_rmse: "XGBoost", best_skill: "TFT" },
      rampDetection: null,
      ensembleForecast: { power_p50_mw: [5] },
      spotPriceEurMwh: 72,
    } as unknown as ReturnType<typeof useForecastStore>);

    const { container } = render(<ForecastKPIHeader />);
    expect(container.innerHTML).toBe("");
  });

  it("renders all 5 KPI cards when data is loaded", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      modelComparison: {
        model_metrics: [
          { model_name: "XGBoost", rmse_mw: 1.05, mae_mw: 0.62, skill_score: 0.35 },
          { model_name: "TFT", rmse_mw: 1.12, mae_mw: 0.68, skill_score: 0.42 },
        ],
        best_rmse: "XGBoost",
        best_skill: "TFT",
      },
      rampDetection: {
        grid_alerts: [{ alert_level: "warning", message: "Ramp up detected" }],
        num_ramp_up: 2,
        num_ramp_down: 1,
      },
      ensembleForecast: {
        power_p50_mw: [5, 6, 7],
      },
      spotPriceEurMwh: 72,
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<ForecastKPIHeader />);
    expect(screen.getByText("Best RMSE")).toBeDefined();
    expect(screen.getByText("Best MAE")).toBeDefined();
    expect(screen.getByText("Skill Score")).toBeDefined();
    expect(screen.getByText("Grid Alerts")).toBeDefined();
    expect(screen.getByText("Est. Revenue")).toBeDefined();
  });

  it("shows model name in RMSE subtitle", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      modelComparison: {
        model_metrics: [
          { model_name: "XGBoost", rmse_mw: 1.05, mae_mw: 0.62, skill_score: 0.35 },
        ],
        best_rmse: "XGBoost",
        best_skill: "XGBoost",
      },
      rampDetection: {
        grid_alerts: [],
        num_ramp_up: 0,
        num_ramp_down: 0,
      },
      ensembleForecast: {
        power_p50_mw: [5],
      },
      spotPriceEurMwh: 72,
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<ForecastKPIHeader />);
    // RMSE and MAE cards each show the model name in their subtitle
    expect(screen.getByText("XGBoost · Lower is better (<1.2 MW = excellent)")).toBeDefined();
    expect(screen.getByText("XGBoost · Avg forecast deviation")).toBeDefined();
  });
});
