/**
 * Tests for the KPI strip above the Control Room map: one cell per reading,
 * neutral while normal, warning colour only when a limit is crossed.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MapKPIRibbon from "../../../src/components/landing/MapKPIRibbon";
import type { FarmKPI } from "../../../src/types/landing";

describe("MapKPIRibbon", () => {
  const highAvailKPIs: FarmKPI = {
    totalOutputMW: 450,
    averageWindSpeedMs: 11.2,
    freestreamWindMs: 11.8,
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

  it("renders availability, neutral above 95 % and amber below", () => {
    const { rerender } = render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Availability")).toBeDefined();
    expect(screen.getByText("96.5").getAttribute("style")).toContain("--color-text-primary");
    rerender(<MapKPIRibbon kpis={{ ...highAvailKPIs, availabilityPercent: 91.2 }} />);
    expect(screen.getByText("91.2").getAttribute("style")).toContain("--color-status-warning");
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

  it("renders the capacity factor under the output", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText(/CF 88\.2 %/)).toBeDefined();
  });

  it("renders grid frequency", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Frequency")).toBeDefined();
    expect(screen.getByText("50.010")).toBeDefined();
  });
});
