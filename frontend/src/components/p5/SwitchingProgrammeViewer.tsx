/**
 * 30-step switching programme table.
 *
 * Displays all steps grouped by phase, with the current step highlighted
 * in amber (ISA-101 WARNING color). Each step row shows:
 * - Step ID, phase, type, action description
 * - Responsible party and PiC confirmation requirement
 * - Status badge (pending/completed/hold_point)
 * - Execute button for the current step
 *
 * Clicking a row expands it to show verification criteria and safety notes.
 */

import { useState } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { Step } from "../../types/commissioning";
import { InfoButton } from "../ui/InfoButton";
import { switchingProgrammeInfo } from "../../constants/panelInfo";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-slate-600 text-slate-200",
  in_progress: "bg-amber-600 text-white",
  completed: "bg-green-600 text-white",
  skipped: "bg-slate-500 text-slate-300",
  hold_point: "bg-red-600 text-white",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Pre-Energisation Checks",
  2: "Energisation Sequence",
  3: "Turbine Connection",
};

function StepRow({
  step,
  isCurrent,
  programmeActive,
}: {
  step: Step;
  isCurrent: boolean;
  programmeActive: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { executeStep, activeProgramme } = useCommissioningStore();

  const canExecute =
    isCurrent &&
    programmeActive &&
    step.status === "pending";

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={`cursor-pointer border-b border-slate-700/50 transition-colors ${
          isCurrent
            ? "bg-amber-900/30"
            : step.status === "completed"
              ? "bg-green-900/10"
              : "hover:bg-slate-700/30"
        }`}
        style={isCurrent ? { borderLeft: `3px solid ${SCADA_COLORS.WARNING}` } : undefined}
      >
        <td className="px-3 py-2 text-xs font-mono text-slate-400">{step.step_id}</td>
        <td className="px-3 py-2 text-xs">{step.step_type}</td>
        <td className="px-3 py-2 text-sm">{step.action}</td>
        <td className="px-3 py-2 text-xs text-slate-400">{step.responsible}</td>
        <td className="px-3 py-2 text-xs">
          {step.pic_confirmation && (
            <span className="text-amber-400" title="PiC confirmation required">
              PiC
            </span>
          )}
        </td>
        <td className="px-3 py-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase ${STATUS_STYLES[step.status] ?? STATUS_STYLES.pending}`}>
            {step.status}
          </span>
        </td>
        <td className="px-3 py-2">
          {canExecute && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                executeStep(step.step_id, activeProgramme?.pic_name ?? "PiC");
              }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
            >
              Execute
            </button>
          )}
          {step.executed_at && (
            <span className="text-[10px] text-slate-500">
              {new Date(step.executed_at).toLocaleTimeString()}
            </span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-800/50">
          <td colSpan={7} className="px-6 py-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400">Verification: </span>
                <span className="text-slate-200">{step.verification || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400">Safety Notes: </span>
                <span className="text-slate-200">{step.notes || "—"}</span>
              </div>
              {step.equipment_id && (
                <div>
                  <span className="text-slate-400">Equipment: </span>
                  <span className="font-mono text-slate-200">{step.equipment_id}</span>
                </div>
              )}
              {step.executed_by && (
                <div>
                  <span className="text-slate-400">Executed by: </span>
                  <span className="text-slate-200">{step.executed_by}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SwitchingProgrammeViewer() {
  const { activeProgramme } = useCommissioningStore();

  if (!activeProgramme) return null;

  const { steps, current_step_index, status } = activeProgramme;
  const programmeActive = status === "in_progress" || status === "hold";

  // Group steps by phase
  const phases = [1, 2, 3] as const;

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Switching Programme</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {completedCount}/{steps.length} steps completed
          </p>
        </div>
        <div className="flex items-center gap-3">
          <InfoButton info={switchingProgrammeInfo} />
          <div className="w-32 h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[600px]">
        <table className="w-full text-left">
          <thead className="bg-slate-700/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Step</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Type</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Action</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">By</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">PiC</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Status</th>
              <th className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase">Action</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase) => {
              const phaseSteps = steps.filter((s) => s.phase === phase);
              if (phaseSteps.length === 0) return null;
              return [
                <tr key={`phase-${phase}`} className="bg-slate-700/30">
                  <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-slate-300">
                    Phase {phase}: {PHASE_LABELS[phase]}
                  </td>
                </tr>,
                ...phaseSteps.map((step) => (
                  <StepRow
                    key={step.step_id}
                    step={step}
                    isCurrent={step.step_number - 1 === current_step_index}
                    programmeActive={programmeActive}
                  />
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
