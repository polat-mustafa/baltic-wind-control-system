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
};

describe("TurbineTooltip", () => {
  it("renders turbine ID", () => {
    render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("WTG-01")).toBeDefined();
  });

  it("displays power output", () => {
    render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("12.5 MW")).toBeDefined();
  });

  it("displays wind speed", () => {
    render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("10.3 m/s")).toBeDefined();
  });

  it("shows status label", () => {
    render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("Operating")).toBeDefined();
  });

  it("shows string number", () => {
    render(
      <TurbineTooltip turbine={MOCK_TURBINE} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("String 1")).toBeDefined();
  });

  it("renders fault status correctly", () => {
    const faultTurbine = { ...MOCK_TURBINE, status: "fault" as const };
    render(
      <TurbineTooltip turbine={faultTurbine} position={{ x: 50, y: 50 }} />,
    );
    expect(screen.getByText("Fault")).toBeDefined();
  });
});
