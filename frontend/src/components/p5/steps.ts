/** Shared labels of the P5 switching programme UI (Switching tab, NextAction). */

import type { Step, StepType } from "../../types/commissioning";

export type P5Tab = "switching" | "isolation" | "testing" | "gridcode" | "emergency" | "audit";

export const ACTION_LABEL: Record<StepType, string> = {
  check: "Confirm check",
  gate: "Check gate",
  isolation: "Remove lock",
  switching: "Operate",
  verification: "Take reading",
  hold_point: "Reach hold point",
  declaration: "Declare",
};

export const GATE_TAB: Record<string, { tab: P5Tab; what: string }> = {
  sat: { tab: "testing", what: "Approve the SAT campaign (Testing tab)" },
  eon: { tab: "gridcode", what: "Have PSE issue the EON (Grid code tab)" },
  ion: { tab: "gridcode", what: "Have PSE issue the ION (Grid code tab)" },
};

/** Which gate a gate step checks (from its action text: "SAT …", "EON …", "ION …"). */
export const gateOf = (step: Step): "sat" | "eon" | "ion" =>
  step.action.startsWith("SAT") ? "sat" : step.action.startsWith("EON") ? "eon" : "ion";
