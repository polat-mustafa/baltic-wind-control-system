/**
 * Audit trail — reverse-chronological scrollable action log.
 *
 * Every commissioning action (step execution, PiC decision, LOTO apply/remove,
 * emergency stop) is recorded with UTC timestamp, performer, and context.
 * This component renders the log with color-coded action badges.
 *
 * Real HV substations require IEC 61850-compliant audit trails for regulatory
 * compliance. This mirrors that requirement in the educational simulator.
 */

import { useCommissioningStore } from "../../store/commissioningStore";
import { InfoButton } from "../ui/InfoButton";
import { auditTrailInfo } from "../../constants/panelInfo";

const ACTION_COLORS: Record<string, string> = {
  step_executed: "bg-blue-600",
  programme_started: "bg-green-600",
  programme_approved: "bg-green-700",
  pic_go: "bg-green-500",
  pic_nogo: "bg-red-600",
  emergency_stop: "bg-red-700",
  loto_applied: "bg-cyan-600",
  loto_removed: "bg-cyan-700",
  programme_completed: "bg-green-500",
  programme_aborted: "bg-red-500",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (action.toLowerCase().includes(key.replace(/_/g, " ")) || action.toLowerCase().includes(key.replace(/_/g, "_"))) {
      return color;
    }
  }
  return "bg-slate-600";
}

export default function AuditTrail() {
  const { auditRecords } = useCommissioningStore();

  // Reverse chronological
  const sorted = [...auditRecords].reverse();

  return (
    <div className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
      <div className="px-4 py-3 border-b border-border-primary flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">Audit Trail</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {auditRecords.length} records
          </p>
        </div>
        <InfoButton info={auditTrailInfo} />
      </div>

      <div className="overflow-auto max-h-[400px]">
        {sorted.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">
            No audit records yet
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {sorted.map((record) => (
              <div key={record.record_id} className="px-4 py-2.5 hover:bg-slate-700/20">
                <div className="flex items-start gap-2">
                  <span className={`shrink-0 mt-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium text-white ${getActionColor(record.action)}`}>
                    {record.action.length > 20 ? record.action.slice(0, 20) + "..." : record.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-300 truncate">
                      {record.details || record.action}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(record.timestamp).toLocaleString()} · {record.performed_by}
                      {record.step_id && <span> · {record.step_id}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
