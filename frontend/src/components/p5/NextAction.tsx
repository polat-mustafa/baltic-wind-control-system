/**
 * "What do I do now?" — one line above the commissioning tabs that names the
 * next action of the programme and takes the learner there: start it, operate
 * the current device (step button or the highlighted device on the SLD), pass
 * a gate (with a typical-values shortcut), decide a hold point, or mark the
 * stage complete when the programme has finished.
 */

import { ArrowRight, Compass, Wand2 } from "lucide-react";

import { useCommissioningStore } from "../../store/commissioningStore";
import type { ProgrammeDetail } from "../../types/commissioning";
import { Button } from "../ui/Button";
import { ACTION_LABEL, GATE_TAB, gateOf, type P5Tab } from "./steps";

export default function NextAction({ programme, onGoto }: { programme: ProgrammeDetail; onGoto: (t: P5Tab) => void }) {
  const busy = useCommissioningStore((s) => s.busy);
  const prepareGate = useCommissioningStore((s) => s.prepareGate);
  const step = programme.steps[programme.current_step_index];
  const { status } = programme;

  let text: React.ReactNode;
  let actions: React.ReactNode = null;
  if (status === "created") {
    text = "Approve and start the programme (Switching tab). The plant is in its construction condition: earthed and locked.";
    actions = <Go onClick={() => onGoto("switching")}>Switching</Go>;
  } else if (status === "completed") {
    text = "Programme complete: circuit 1 is energised and exporting. Mark the commissioning stage complete above to energise the farm in the control room.";
  } else if (status === "hold") {
    text = "Hold point: the Person in Control checks the readings and decides GO or NO-GO (Switching tab).";
    actions = <Go onClick={() => onGoto("switching")}>Switching</Go>;
  } else if (status === "in_progress" && step?.step_type === "gate") {
    const gate = gateOf(step);
    text = (
      <>
        <b>Gate {step.step_id}:</b> {GATE_TAB[gate].what}. Then press “Check gate”.
      </>
    );
    actions = (
      <>
        <Go onClick={() => onGoto(GATE_TAB[gate].tab)}>{GATE_TAB[gate].tab === "testing" ? "FAT / SAT" : "Grid code"}</Go>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void prepareGate(gate)} title="Records typical passing values and approvals; every record shows in the tab">
          <Wand2 size={13} className="mr-1" /> {busy ? "Preparing…" : "Prepare with typical values"}
        </Button>
      </>
    );
  } else if (step) {
    text = (
      <>
        <b>Step {step.step_id}:</b> {ACTION_LABEL[step.step_type]}
        {step.equipment_id ? ` ${step.equipment_id}` : ""} — {step.action}
        {step.equipment_id && (step.step_type === "switching" || step.step_type === "isolation")
          ? " Use the step button, or click the framed device on the single-line diagram."
          : ""}
      </>
    );
    actions = <Go onClick={() => onGoto("switching")}>Switching</Go>;
  } else {
    text = `Programme ${status}.`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-[12px]" role="status">
      <Compass size={15} className="shrink-0 text-accent" aria-hidden />
      <span className="min-w-0 flex-1 text-text-primary">
        <span className="mr-1 font-semibold uppercase tracking-wide text-accent">Next</span>
        {text}
      </span>
      {actions}
    </div>
  );
}

function Go({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline">
      {children} <ArrowRight size={12} aria-hidden />
    </button>
  );
}
