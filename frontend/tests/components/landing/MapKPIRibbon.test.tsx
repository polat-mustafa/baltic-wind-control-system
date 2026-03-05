/**
 * Tests for the MapKPIRibbon component (horizontal glassmorphic bar — default layout).
 *
 * Labels were shortened in the Leaflet refactor for compact display:
 *   "Total Output" → "Output", "Wind Speed" → "Wind",
 *   "Availability" → "Avail", "Active Alerts" → "Alerts",
 *   "Capacity Factor" → "CF", "Grid Frequency" → "Freq".
 * Revenue chip is not rendered in horizontal mode.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapKPIRibbon from "../../../src/components/landing/MapKPIRibbon";
import type { FarmKPI } from "../../../src/types/landing";

describe("MapKPIRibbon", () => {
  const highAvailKPIs: FarmKPI = {
    totalOutputMW: 450,
    averageWindSpeedMs: 11.2,
    availabilityPercent: 96.5,
    activeAlerts: 0,
    windDirectionDeg: 225,
    capacityFactorPct: 88.2,
    gridFrequencyHz: 50.01,
    revenueTodayEUR: 142350,
  };

  it("renders total output", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Output")).toBeDefined();
    expect(screen.getByText("450")).toBeDefined();
  });

  it("renders wind speed", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Wind")).toBeDefined();
    expect(screen.getByText("11.2")).toBeDefined();
  });

  it("renders availability", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Avail")).toBeDefined();
    expect(screen.getByText("96.5")).toBeDefined();
  });

  it("renders active alerts", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Alerts")).toBeDefined();
  });

  it("uses singular 'alarm' for 1 alert", () => {
    const kpis = { ...highAvailKPIs, activeAlerts: 1 };
    render(<MapKPIRibbon kpis={kpis} />);
    expect(screen.getByText("alarm")).toBeDefined();
  });

  it("renders capacity factor", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("CF")).toBeDefined();
    expect(screen.getByText("88.2%")).toBeDefined();
  });

  it("renders grid frequency", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Freq")).toBeDefined();
    expect(screen.getByText("50.01")).toBeDefined();
  });
});
