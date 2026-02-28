/**
 * Tests for the ModelComparisonPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ModelComparisonPanel from "../../../src/components/p4/ModelComparisonPanel";
import { useForecastStore } from "../../../src/store/forecastStore";

vi.mock("../../../src/store/forecastStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModelComparisonPanel", () => {
  it("returns null when modelComparison is null", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      modelComparison: null,
    } as unknown as ReturnType<typeof useForecastStore>);

    const { container } = render(<ModelComparisonPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title and summary table when data is loaded", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      modelComparison: {
        model_metrics: [
          {
            model_name: "XGBoost",
            rmse_mw: 1.05,
            mae_mw: 0.62,
            skill_score: 0.35,
            r_squared: 0.92,
          },
          {
            model_name: "LSTM",
            rmse_mw: 1.12,
            mae_mw: 0.68,
            skill_score: 0.31,
            r_squared: 0.89,
          },
          {
            model_name: "TFT",
            rmse_mw: 0.98,
            mae_mw: 0.55,
            skill_score: 0.42,
            r_squared: 0.94,
          },
        ],
        best_rmse: "TFT",
        best_skill: "TFT",
      },
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<ModelComparisonPanel />);
    expect(
      screen.getByText("Model Comparison — Error Metrics"),
    ).toBeDefined();
    expect(screen.getByText("XGBoost")).toBeDefined();
    expect(screen.getByText("LSTM")).toBeDefined();
    expect(screen.getByText("Model")).toBeDefined();
    expect(screen.getByText("RMSE")).toBeDefined();
    expect(screen.getByText("MAE")).toBeDefined();
    expect(screen.getByText("Skill")).toBeDefined();
  });

  it("shows star for best RMSE model", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      modelComparison: {
        model_metrics: [
          {
            model_name: "XGBoost",
            rmse_mw: 1.05,
            mae_mw: 0.62,
            skill_score: 0.35,
            r_squared: 0.92,
          },
        ],
        best_rmse: "XGBoost",
        best_skill: "XGBoost",
      },
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<ModelComparisonPanel />);
    expect(screen.getByText(/XGBoost ★/)).toBeDefined();
  });
});
