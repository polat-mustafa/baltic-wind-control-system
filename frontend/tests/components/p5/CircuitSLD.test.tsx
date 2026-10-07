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

  it("draws the programme's farm: strings of section A, ratings, no reactor bay without reactors", () => {
    const base = programme();
    const strings = [1, 2, 3, 4].map((n) => ({
      equipment_id: `CB-STR-0${n}`, equipment_type: "circuit_breaker" as const, voltage_kv: 66,
      location: `String ${n} feeder CB`, state: "open" as const, zones: ["66A", `STR${n}`], locked: false,
    }));
    const { container } = render(
      <CircuitSLD
        programme={{
          ...base,
          equipment_states: [...base.equipment_states, ...strings],
          farm: { ...base.farm, string_layout: [5, 5, 5, 5, 4, 4, 4, 4], section_a_strings: 4, oss_trafo_mva: 400, export_length_km: 75, reactor_unit_mvar: null },
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "CB-STR-04 open" })).toBeTruthy();
    expect(screen.getAllByText("5 × 15 MW")).toHaveLength(4);
    expect(screen.getByText("220/66 kV · 400 MVA")).toBeTruthy();
    expect(screen.getByText(/Export cable 1 · 75 km/)).toBeTruthy();
    expect(screen.getByText("strings 5–8:")).toBeTruthy();
    expect(screen.queryByText(/Reactor 1/)).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 955 720"); // one string more → wider
  });

  it("shows details of a clicked device", () => {
    render(<CircuitSLD programme={programme()} />);
    fireEvent.click(screen.getByRole("button", { name: "CB-ON-220-01 open" }));
    expect(screen.getByText(/CB-ON-220-01 · Onshore bay E1 circuit breaker · open/)).toBeTruthy();
  });
});
