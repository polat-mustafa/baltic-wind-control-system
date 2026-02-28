/**
 * Tests for the SHAPPanel component.
 */

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SHAPPanel from "../../../src/components/p4/SHAPPanel";
import { useForecastStore } from "../../../src/store/forecastStore";

vi.mock("../../../src/store/forecastStore");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SHAPPanel", () => {
  it("returns null when shapResult is null", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      shapResult: null,
    } as unknown as ReturnType<typeof useForecastStore>);

    const { container } = render(<SHAPPanel />);
    expect(container.innerHTML).toBe("");
  });

  it("renders title when data is loaded", () => {
    vi.mocked(useForecastStore).mockReturnValue({
      shapResult: {
        feature_importance: [
          { name: "wind_speed", importance: 0.45 },
          { name: "temperature", importance: 0.12 },
          { name: "pressure", importance: 0.08 },
        ],
        top_features: ["wind_speed", "temperature", "pressure"],
        shap_values_sample: [[0.1, 0.2, 0.3]],
      },
    } as unknown as ReturnType<typeof useForecastStore>);

    render(<SHAPPanel />);
    expect(
      screen.getByText("SHAP Feature Importance — XGBoost"),
    ).toBeDefined();
  });
});
