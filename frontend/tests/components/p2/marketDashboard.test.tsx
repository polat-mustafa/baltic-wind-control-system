/**
 * Market tab — the request follows the controls and the KPIs show the
 * backend's settlement.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MarketDashboard from "../../../src/components/p2/MarketDashboard";
import * as api from "../../../src/services/marketApi";
import { useMarketStore } from "../../../src/store/marketStore";

vi.mock("../../../src/services/marketApi");
vi.mock("react-plotly.js", () => ({ default: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  useMarketStore.setState({ scenario: "windy_spring_sunday", strike_pln_mwh: 489, forecast_sigma_ms: 1, include_cfd: true, include_bess: true, day: null });
  vi.mocked(api.simMarketDay).mockResolvedValue({
    scenario: "windy_spring_sunday",
    scenario_label: "Windy spring Sunday",
    hours: [],
    energy_mwh: 6951.5,
    curtailed_mwh: 1697.2,
    negative_hours: 5,
    rmse_mwh: 67.8,
    day_average_price_pln_mwh: 231.7,
    captured_price_pln_mwh: 294.9,
    capture_rate_pct: 127.3,
    farm_price_pln_mwh: 485.4,
    energy_value_pln: 2367821,
    imbalance_pln: -27544,
    cfd_settlement_pln: 1418291,
    bess_arbitrage_pln: 89325,
    total_pln: 3847894,
    assessment: "The CfD fixes the price.",
  });
  vi.mocked(api.getPseDay).mockResolvedValue({
    date: "2026-10-10",
    quarters: [],
    summary: {
      quarters_filled: 96,
      last_filled: "2026-10-11 00:00:00",
      wind_mwh: 98400,
      pv_mwh: 31000,
      demand_mwh: 401400,
      wind_share_pct: 24.5,
      pv_share_pct: 7.7,
      wind_peak_mw: 5800,
      avg_price_pln_mwh: 428,
      wind_capture_price_pln_mwh: 401,
      wind_capture_rate_pct: 94,
      negative_price_quarters: 0,
    },
    source: "PSE S.A., Raporty PSE",
  });
});

const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
};

describe("MarketDashboard", () => {
  it("runs the day and shows the settlement", async () => {
    vi.useFakeTimers();
    render(<MarketDashboard />);
    await flush();

    expect(api.simMarketDay).toHaveBeenCalledWith({
      scenario: "windy_spring_sunday",
      strike_pln_mwh: 489,
      forecast_sigma_ms: 1,
      include_cfd: true,
      include_bess: true,
    });
    expect(screen.getByText("3848")).toBeTruthy();
    expect(screen.getByText("485")).toBeTruthy();
    expect(screen.getByText("−28")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Winter weekday" }));
    fireEvent.click(screen.getByLabelText("Two-sided CfD"));
    await flush();
    vi.useRealTimers();
    expect(vi.mocked(api.simMarketDay).mock.lastCall?.[0]).toMatchObject({ scenario: "winter_weekday", include_cfd: false });
  });

  it("runs a real day (PSE prices) for the chosen date and shows the Polish system", async () => {
    vi.useFakeTimers();
    render(<MarketDashboard />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Real day (PSE)" }));
    fireEvent.change(screen.getByLabelText("Real day"), { target: { value: "2026-10-10" } });
    await flush();
    vi.useRealTimers();
    expect(vi.mocked(api.simMarketDay).mock.lastCall?.[0]).toMatchObject({ scenario: "real_day", date: "2026-10-10" });
    expect(vi.mocked(api.getPseDay).mock.lastCall?.[0]).toBe("2026-10-10");
    expect(await screen.findByText("24.5")).toBeTruthy(); // wind share of Polish demand
  });
});
