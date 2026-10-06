import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SwitchingTab from "../../../src/components/p5/SwitchingTab";
import { useCommissioningStore } from "../../../src/store/commissioningStore";
import { programme, step } from "./fixture";

const executeCurrentStep = vi.fn();
const decide = vi.fn();

beforeEach(() => {
  executeCurrentStep.mockReset();
  decide.mockReset();
  useCommissioningStore.setState({ executeCurrentStep, decide, busy: false, lastResult: null });
});

describe("SwitchingTab", () => {
  it("offers the device operation for a switching step", () => {
    render(<SwitchingTab programme={programme()} onGoto={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Operate CB-ON-220-01" }));
    expect(executeCurrentStep).toHaveBeenCalledOnce();
  });

  it("asks for a reason before NO-GO at a hold point", () => {
    const p = programme({
      status: "hold",
      steps: [step({ step_type: "hold_point", equipment_id: "", action: "Pre-energisation review" })],
      current_step_index: 0,
    });
    render(<SwitchingTab programme={p} onGoto={() => {}} />);
    const nogo = screen.getByRole("button", { name: "NO-GO" });
    expect((nogo as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("NO-GO reason"), { target: { value: "Sea state" } });
    fireEvent.click(nogo);
    expect(decide).toHaveBeenCalledWith("nogo", "Sea state");
    fireEvent.click(screen.getByRole("button", { name: "GO" }));
    expect(decide).toHaveBeenCalledWith("go");
  });

  it("shows a refused step and the recorded readings", () => {
    useCommissioningStore.setState({ lastResult: { stepId: "2.08", ok: false, text: "ILK-001 earth on cable" } });
    render(<SwitchingTab programme={programme()} onGoto={() => {}} />);
    expect(screen.getByText(/ILK-001 earth on cable/)).toBeTruthy();
    expect(screen.getByText("Cable 1 dead; CB-OSS-220-01 open")).toBeTruthy();
  });

  it("points a blocked gate to the tab that clears it", () => {
    const onGoto = vi.fn();
    const p = programme({
      steps: [step({ step_type: "gate", equipment_id: "", action: "EON issued by PSE" })],
      current_step_index: 0,
    });
    render(<SwitchingTab programme={p} onGoto={onGoto} />);
    fireEvent.click(screen.getByText(/Have PSE issue the EON/));
    expect(onGoto).toHaveBeenCalledWith("gridcode");
  });
});
