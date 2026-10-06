import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import CircuitSLD from "../../../src/components/p5/CircuitSLD";
import { SCADA_COLORS } from "../../../src/constants/scadaColors";
import { programme } from "./fixture";

describe("CircuitSLD", () => {
  it("labels each device with its position and lock", () => {
    render(<CircuitSLD programme={programme()} />);
    expect(screen.getByRole("button", { name: "CB-ON-220-01 open" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "DS-ON-220-01 closed" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ES-OSS-220-BB closed, locked" })).toBeTruthy();
  });

  it("colours conductors from the backend zone status", () => {
    const { container } = render(<CircuitSLD programme={programme()} />);
    const strokes = [...container.querySelectorAll("line")].map((l) => l.getAttribute("stroke"));
    expect(strokes).toContain(SCADA_COLORS.VOLTAGE_220KV); // onshore busbar live
    expect(strokes).toContain(SCADA_COLORS.EARTHED); // OSS busbar earthed
    expect(strokes).toContain(SCADA_COLORS.DE_ENERGIZED); // cable isolated
  });

  it("shows details of a clicked device", () => {
    render(<CircuitSLD programme={programme()} />);
    fireEvent.click(screen.getByRole("button", { name: "CB-ON-220-01 open" }));
    expect(screen.getByText(/CB-ON-220-01 · Onshore bay E1 circuit breaker · open/)).toBeTruthy();
  });
});
