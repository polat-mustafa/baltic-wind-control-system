import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RealDataPanel from "../../../src/components/p4/RealDataPanel";
import type { RealForecastResponse, RealModelScore } from "../../../src/services/forecastApi";
import { useForecastStore } from "../../../src/store/forecastStore";

vi.mock("react-plotly.js", () => ({ default: () => null }));

const score = (name: string, nrmse: number, probabilistic = false): RealModelScore => ({
  name,
  nrmse_pct: nrmse,
  nmae_pct: nrmse * 0.65,
  bias_pct: -0.8,
  skill_vs_persistence: 0.82,
  skill_vs_climatology: 0.77,
  crps_pct: 7.7,
  crpss_vs_climatology: 0.62,
  probabilistic,
  fold_nrmse_pct: [16, 17, 16, 14, 13],
});

const BODY: RealForecastResponse = {
  source: {
    site: "dk2",
    title: "DK2",
    production: "Energinet",
    nwp: "Open-Meteo",
    farms: ["Kriegers Flak 604.8 MW"],
    capacity_mw: 977.4,
    period_start_utc: "2024-06-01T00:00Z",
    period_end_utc: "2026-09-29T21:00Z",
    hours: 20422,
    folds: 5,
    scored_hours: 16731,
  },
  scores: [score("XGBoost (P50)", 15.4, true), score("Energinet day-ahead (TSO)", 16.9), score("Persistence 24 h", 36.7)],
  reliability: [{ name: "XGBoost (P50)", observed_below: [0.08, 0.14, 0.22, 0.32, 0.46, 0.59, 0.71, 0.82, 0.91], p10_p90_coverage_pct: 84.5 }],
  p10_p90_coverage_pct: 84.5,
  feature_importance: [{ feature: "icon_kf_ws", shap_share: 0.28 }],
  series: { time_utc: [], actual_mw: [], p10_mw: [], p50_mw: [], p90_mw: [], persistence_mw: [], nwp_wind_ms: [], tso_mw: [] },
};

vi.mock("../../../src/services/forecastApi", () => ({
  getRealSites: vi.fn(() => Promise.resolve([])),
  getRealDayAhead: vi.fn(() => Promise.resolve(BODY)),
}));

describe("RealDataPanel", () => {
  it("scores every forecast on the same hours, with the TSO benchmark and SHAP shares", async () => {
    render(<RealDataPanel />);
    expect(await screen.findByText("Scores on the same 16,731 test hours")).toBeDefined();
    expect(screen.getByText("Energinet day-ahead (TSO)")).toBeDefined();
    expect(screen.getByText(/TSO day-ahead 16.9 %/)).toBeDefined();
    expect(screen.getByText("icon_kf_ws")).toBeDefined();
    expect(screen.getByText(/Reliability/)).toBeDefined();
    // the academy's ensemble lesson reads the same result from the store
    expect(useForecastStore.getState().real?.source.scored_hours).toBe(16731);
  });
});
