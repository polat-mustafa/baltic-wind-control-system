/**
 * Emergency Response Panel — SCADA-themed display of offshore emergency procedures.
 *
 * Shows 6 pre-defined emergency procedure cards (arc flash, SF₆ leak, medical,
 * man overboard, comms failure, unexpected voltage) with severity colour coding
 * following ISA-18.2 alarm priorities:
 *   - Critical (red): immediate life/equipment danger
 *   - High (orange): potential escalation risk
 *   - Medium (yellow): operational impact, no immediate danger
 *
 * Instructor mode allows triggering emergencies on the active programme,
 * recording events in the emergency log timeline.
 */

import { useState } from "react";

import { SCADA_COLORS } from "../../constants/scadaColors";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { EmergencyProcedure, EmergencyType } from "../../types/commissioning";

// ── Severity colour mapping (ISA-18.2) ─────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: SCADA_COLORS.ALARM_CRITICAL,
  high: SCADA_COLORS.ALARM_HIGH,
  medium: SCADA_COLORS.ALARM_MEDIUM,
};

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-900/30 border-red-700",
  high: "bg-orange-900/30 border-orange-700",
  medium: "bg-yellow-900/30 border-yellow-700",
};

const EMERGENCY_LABELS: Record<EmergencyType, string> = {
  arc_flash: "Arc Flash",
  sf6_leak: "SF\u2086 Gas Leak",
  medical: "Medical Emergency",
  man_overboard: "Man Overboard",
  comms_failure: "Comms Failure",
  unexpected_voltage: "Unexpected Voltage",
};

// ── Procedure Card ─────────────────────────────────────────────

function ProcedureCard({
  procedure,
  onTrigger,
}: {
  procedure: EmergencyProcedure;
  onTrigger: (type: EmergencyType) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded p-3 ${SEVERITY_BG[procedure.severity]} cursor-pointer transition-colors`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold">
          {EMERGENCY_LABELS[procedure.emergency_type]}
        </span>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
          style={{
            backgroundColor: SEVERITY_COLORS[procedure.severity],
            color: procedure.severity === "medium" ? "#000" : "#fff",
          }}
        >
          {procedure.severity}
        </span>
      </div>

      {/* Responsible */}
      <p className="text-[11px] text-slate-400 mb-1">
        Responsible: {procedure.responsible}
      </p>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Immediate actions checklist */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Immediate Actions
            </p>
            <ol className="list-decimal list-inside space-y-0.5">
              {procedure.immediate_actions.map((action, i) => (
                <li key={i} className="text-xs text-slate-300">
                  {action}
                </li>
              ))}
            </ol>
          </div>

          {/* SCADA actions */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
              Automated SCADA Actions
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              {procedure.automated_scada_actions.map((action, i) => (
                <li key={i} className="text-xs text-cyan-300">
                  {action}
                </li>
              ))}
            </ul>
          </div>

          {/* Reference */}
          <p className="text-[10px] text-slate-500">
            Ref: {procedure.reference_document}
          </p>

          {/* Trigger button (instructor mode) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTrigger(procedure.emergency_type);
            }}
            className="mt-1 px-3 py-1 bg-red-800 hover:bg-red-700 rounded text-xs font-medium transition-colors"
          >
            Trigger Emergency
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────

export default function EmergencyResponsePanel() {
  const {
    emergencyProcedures,
    emergencyLog,
    triggerEmergency,
    activeProgramme,
  } = useCommissioningStore();

  const handleTrigger = (type: EmergencyType) => {
    if (!activeProgramme) return;
    triggerEmergency(type, activeProgramme.pic_name);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
        Emergency Response
      </h3>

      {/* Procedure cards */}
      {emergencyProcedures.length === 0 ? (
        <p className="text-xs text-slate-500">Loading procedures...</p>
      ) : (
        <div className="space-y-2 mb-4">
          {emergencyProcedures.map((proc) => (
            <ProcedureCard
              key={proc.emergency_type}
              procedure={proc}
              onTrigger={handleTrigger}
            />
          ))}
        </div>
      )}

      {/* Emergency log timeline */}
      {emergencyLog.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Event Log
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {emergencyLog.map((event) => (
              <div
                key={event.event_id}
                className={`border rounded p-2 ${SEVERITY_BG[event.severity]}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {EMERGENCY_LABELS[event.emergency_type]}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(event.triggered_at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Triggered by: {event.triggered_by} · ID: {event.event_id}
                </p>
                <div className="mt-1">
                  <p className="text-[10px] text-cyan-400">
                    SCADA: {event.scada_actions_executed.length} automated actions executed
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
