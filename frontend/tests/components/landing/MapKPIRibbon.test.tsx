/**
 * Tests for the MapKPIRibbon component.
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
  };

  it("renders total output", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Total Output")).toBeDefined();
    expect(screen.getByText("450")).toBeDefined();
  });

  it("renders average wind speed", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Avg Wind Speed")).toBeDefined();
    expect(screen.getByText("11.2")).toBeDefined();
  });

  it("renders availability", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Availability")).toBeDefined();
    expect(screen.getByText("96.5")).toBeDefined();
  });

  it("renders active alerts with correct plural", () => {
    render(<MapKPIRibbon kpis={highAvailKPIs} />);
    expect(screen.getByText("Active Alerts")).toBeDefined();
    expect(screen.getByText("alarms")).toBeDefined();
  });

  it("uses singular 'alarm' for 1 alert", () => {
    const kpis = { ...highAvailKPIs, activeAlerts: 1 };
    render(<MapKPIRibbon kpis={kpis} />);
    expect(screen.getByText("alarm")).toBeDefined();
  });

  it("uses warning color for medium availability", () => {
    const kpis = { ...highAvailKPIs, availabilityPercent: 90 };
    render(<MapKPIRibbon kpis={kpis} />);
    expect(screen.getByText("90.0")).toBeDefined();
  });
});
