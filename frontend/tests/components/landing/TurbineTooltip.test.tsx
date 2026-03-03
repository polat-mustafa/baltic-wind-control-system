/**
 * Tests for the TurbineTooltip component.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TurbineTooltip from "../../../src/components/landing/TurbineTooltip";
import type { TurbineData } from "../../../src/types/landing";

const MOCK_TURBINE: TurbineData = {
  id: "WTG-01",
  stringNumber: 1,
  position: { x: 100, y: 200 },
  status: "operating",
  powerOutputMW: 12.5,
  windSpeedMs: 10.3,
  rotorSpeedRpm: 8.2,
  nacellePositionDeg: 225,
  pitchAngleDeg: 0,
  availabilityPct: 99.5,
  energyTodayMWh: 245,
  vibrationMmS: 1.2,
  bearingTempC: 42,
  operatingHours: 18500,
};

describe("TurbineTooltip", () => {
  it("renders turbine ID", () => {
    render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("WTG-01")).toBeDefined();
  });

  it("displays power output", () => {
    const { container } = render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(container.textContent).toContain("12.5");
    expect(container.textContent).toContain("MW");
  });

  it("displays wind speed", () => {
    const { container } = render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(container.textContent).toContain("10.3");
    expect(container.textContent).toContain("m/s");
  });

  it("shows status label", () => {
    render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("Operating")).toBeDefined();
  });

  it("shows string number", () => {
    const { container } = render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(container.textContent).toContain("String 1");
  });

  it("renders fault status correctly", () => {
    const faultTurbine = { ...MOCK_TURBINE, status: "fault" as const };
    render(
      <TurbineTooltip turbine={faultTurbine} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("Fault")).toBeDefined();
  });
});
