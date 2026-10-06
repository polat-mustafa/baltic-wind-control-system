/**
 * SubstationSLD — select-before-operate drives the switchgear and the farm.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SubstationSLD from "../../../src/components/p3/SubstationSLD";
import { useScadaStore } from "../../../src/store/scadaStore";
import { initialBreakerStates } from "../../../src/utils/scadaTopology";
import * as bayApi from "../../../src/services/bayApi";

vi.mock("../../../src/services/bayApi");

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

  it("opening a feeder goes through its bay controller and de-energises the string", async () => {
    vi.mocked(bayApi.executeBayCommand).mockResolvedValue({} as never);
    render(<SubstationSLD />);
    fireEvent.click(screen.getByRole("button", { name: "CB-66-03 CLOSED" }));
    fireEvent.click(screen.getByRole("button", { name: "Execute OPEN" }));
    await waitFor(() => expect(useScadaStore.getState().breakerStates["cb-str3"]).toBe("OPEN"));
    expect(vi.mocked(bayApi.executeBayCommand)).toHaveBeenCalledWith("BAY-OSS-66-03", expect.objectContaining({ equipment_id: "CB-STR-03", action: "open" }));
    expect(screen.getAllByText("de-energised")).toHaveLength(1);
  });

  it("an interlock refusal from the bay controller is shown and nothing moves", async () => {
    vi.mocked(bayApi.executeBayCommand).mockRejectedValue(
      new Error("Interlock violation for CB-TIE-66-01 close: ILK-007: both transformer incomers closed"),
    );
    render(<SubstationSLD />);
    fireEvent.click(screen.getByRole("button", { name: "CB-66-08 OPEN" }));
    fireEvent.click(screen.getByRole("button", { name: "Execute CLOSE" }));
    expect(await screen.findByText(/ILK-007: both transformer incomers closed/)).toBeDefined();
    expect(useScadaStore.getState().breakerStates["cb-66-bc"]).toBe("OPEN");
  });

  it("a viewer cannot operate switchgear", async () => {
    useScadaStore.setState({ selectedRoleLevel: 1 });
    render(<SubstationSLD />);
    fireEvent.click(screen.getByRole("button", { name: "CB-66-01 CLOSED" }));
    fireEvent.click(screen.getByRole("button", { name: "Execute OPEN" }));
    expect(await screen.findByText(/no control rights/)).toBeDefined();
    expect(useScadaStore.getState().breakerStates["cb-str1"]).toBe("CLOSED");
  });
});
