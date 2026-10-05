/**
 * SubstationSLD — select-before-operate drives the switchgear and the farm.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import SubstationSLD from "../../../src/components/p3/SubstationSLD";
import { useScadaStore } from "../../../src/store/scadaStore";
import { initialBreakerStates } from "../../../src/utils/scadaTopology";

beforeEach(() => {
  useScadaStore.setState({ breakerStates: initialBreakerStates(), selectedRoleLevel: 4, eventLog: [] });
});

describe("SubstationSLD", () => {
  it("draws the split 66 kV switchboard and both export cables", () => {
    render(<SubstationSLD />);
    expect(screen.getByText("66 kV section A")).toBeDefined();
    expect(screen.getByText("Export cable 2")).toBeDefined();
    expect(screen.getByRole("button", { name: "CB-66-08 OPEN" })).toBeDefined();
  });

  it("opening a feeder de-energises its string", () => {
    render(<SubstationSLD />);
    fireEvent.click(screen.getByRole("button", { name: "CB-66-03 CLOSED" }));
    fireEvent.click(screen.getByRole("button", { name: "Execute OPEN" }));
    expect(useScadaStore.getState().breakerStates["cb-str3"]).toBe("OPEN");
    expect(screen.getAllByText("de-energised")).toHaveLength(1);
  });

  it("a viewer cannot operate switchgear", () => {
    useScadaStore.setState({ selectedRoleLevel: 1 });
    render(<SubstationSLD />);
    fireEvent.click(screen.getByRole("button", { name: "CB-66-01 CLOSED" }));
    fireEvent.click(screen.getByRole("button", { name: "Execute OPEN" }));
    expect(useScadaStore.getState().breakerStates["cb-str1"]).toBe("CLOSED");
    expect(screen.getByText(/no control rights/)).toBeDefined();
  });
});
