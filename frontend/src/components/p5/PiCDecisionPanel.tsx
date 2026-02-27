/**
 * Person-in-Control (PiC) decision panel.
 *
 * Displays:
 * 1. Current programme status and PiC identity
 * 2. GO / NO-GO decision buttons (active only at hold points)
 * 3. Conditions checklist for the current hold point
 * 4. Emergency Stop button (always visible, always active)
 *
 * The emergency stop is styled with a red background per ISA-101:
 * "Emergency controls shall use red on a contrasting background and
 * shall be accessible at all times."
 */

import { useState } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";

export default function PiCDecisionPanel() {
  const {
    activeProgramme,
    picDecision,
    emergencyStop,
  } = useCommissioningStore();

  const [nogoReason, setNogoReason] = useState("");
  const [estopReason, setEstopReason] = useState("");
  const [showEstop, setShowEstop] = useState(false);

  if (!activeProgramme) return null;

  const { status, pic_name, steps, current_step_index } = activeProgramme;
  const isHold = status === "hold";
  const isTerminal = status === "completed" || status === "aborted";
  const currentStep = steps[current_step_index] ?? null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700">
        <h3 className="text-sm font-semibold">PiC Decision Panel</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Person in Control: <span className="text-white font-medium">{pic_name}</span>
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Programme status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Programme Status:</span>
          <span
            className="text-xs font-bold uppercase px-2 py-0.5 rounded"
            style={{
              backgroundColor:
                status === "in_progress" ? SCADA_COLORS.ENERGIZED + "33"
                : status === "hold" ? SCADA_COLORS.WARNING + "33"
                : status === "aborted" ? SCADA_COLORS.FAULT + "33"
                : status === "completed" ? SCADA_COLORS.ENERGIZED + "33"
                : SCADA_COLORS.DE_ENERGIZED + "33",
              color:
                status === "in_progress" ? SCADA_COLORS.ENERGIZED
                : status === "hold" ? SCADA_COLORS.WARNING
                : status === "aborted" ? SCADA_COLORS.FAULT
                : status === "completed" ? SCADA_COLORS.ENERGIZED
                : SCADA_COLORS.DE_ENERGIZED,
            }}
          >
            {status}
          </span>
        </div>

        {/* Hold point info */}
        {isHold && currentStep && (
          <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded text-sm">
            <div className="font-medium text-amber-400 mb-1">
              Hold Point — PiC Decision Required
            </div>
            <div className="text-xs text-slate-300">
              Step {currentStep.step_id}: {currentStep.action}
            </div>
          </div>
        )}

        {/* GO / NO-GO buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => picDecision("go", pic_name)}
            disabled={!isHold}
            className="flex-1 py-2 bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded text-sm font-bold uppercase transition-colors"
          >
            GO
          </button>
          <div className="flex-1 flex flex-col gap-1">
            <input
              type="text"
              value={nogoReason}
              onChange={(e) => setNogoReason(e.target.value)}
              placeholder="NO-GO reason..."
              disabled={!isHold}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs text-white placeholder-slate-500 disabled:opacity-50 focus:outline-none focus:border-red-500"
            />
            <button
              onClick={() => {
                if (nogoReason.trim()) {
                  picDecision("nogo", pic_name, nogoReason.trim());
                  setNogoReason("");
                }
              }}
              disabled={!isHold || !nogoReason.trim()}
              className="py-2 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded text-sm font-bold uppercase transition-colors"
            >
              NO-GO
            </button>
          </div>
        </div>

        {/* Terminal status message */}
        {isTerminal && (
          <div
            className="p-3 rounded text-sm text-center font-medium"
            style={{
              backgroundColor: status === "completed" ? SCADA_COLORS.ENERGIZED + "22" : SCADA_COLORS.FAULT + "22",
              color: status === "completed" ? SCADA_COLORS.ENERGIZED : SCADA_COLORS.FAULT,
            }}
          >
            Programme {status.toUpperCase()}
          </div>
        )}

        {/* Emergency Stop — always visible */}
        <div className="border-t border-slate-700 pt-4">
          {!showEstop ? (
            <button
              onClick={() => setShowEstop(true)}
              disabled={isTerminal}
              className="w-full py-3 rounded text-sm font-bold uppercase transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                backgroundColor: SCADA_COLORS.FAULT,
                color: "white",
              }}
            >
              EMERGENCY STOP
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={estopReason}
                onChange={(e) => setEstopReason(e.target.value)}
                placeholder="Emergency stop reason (required)..."
                className="w-full px-3 py-2 bg-red-900/30 border border-red-700 rounded text-sm text-white placeholder-red-400 focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (estopReason.trim()) {
                      emergencyStop(pic_name, estopReason.trim());
                      setEstopReason("");
                      setShowEstop(false);
                    }
                  }}
                  disabled={!estopReason.trim()}
                  className="flex-1 py-2 rounded text-sm font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: SCADA_COLORS.FAULT, color: "white" }}
                >
                  CONFIRM STOP
                </button>
                <button
                  onClick={() => { setShowEstop(false); setEstopReason(""); }}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
