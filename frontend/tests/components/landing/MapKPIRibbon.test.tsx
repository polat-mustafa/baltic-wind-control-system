/**
 * Tests for the MapKPIRibbon component (vertical KPI panel).
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
    expect(screen.getByText("Total Output")).toBeDefined();
    expect(screen.getByText("450")).toBeDefined();
  });

  it("renders wind speed", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Wind Speed")).toBeDefined();
    expect(screen.getByText("11.2")).toBeDefined();
  });

  it("renders availability", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Availability")).toBeDefined();
    expect(screen.getByText("96.5")).toBeDefined();
  });

  it("renders active alerts", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Active Alerts")).toBeDefined();
  });

  it("uses singular 'alarm' for 1 alert", () => {
    const kpis = { ...highAvailKPIs, activeAlerts: 1 };
    render(<MapKPIRibbon kpis={kpis} />);
    expect(screen.getByText("alarm")).toBeDefined();
  });

  it("renders capacity factor", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Capacity Factor")).toBeDefined();
    expect(screen.getByText("88.2%")).toBeDefined();
  });

  it("renders grid frequency", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Grid Frequency")).toBeDefined();
    expect(screen.getByText("50.01")).toBeDefined();
  });

  it("renders revenue", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Revenue Today")).toBeDefined();
  });
});
