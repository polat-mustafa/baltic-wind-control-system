/**
 * Audit trail — append-only record of every action, decision and refusal,
 * newest first. Refused steps stay in the log with the interlock or check
 * that stopped them.
 */

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { cn } from "../../lib/utils";
import type { ProgrammeDetail } from "../../types/commissioning";

export default function AuditTrail({ programme }: { programme: ProgrammeDetail }) {
  const records = [...programme.audit_trail].reverse();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit trail</CardTitle>
        <span className="text-xs font-mono text-text-muted">{records.length} records</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[640px] overflow-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="sticky top-0 bg-bg-tertiary text-left text-[10px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Time (local)</th>
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">By</th>
                <th className="px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const refused = r.action.startsWith("Step not executed") || r.action.startsWith("EMERGENCY") || r.action.includes("NO-GO");
                return (
                  <tr key={r.record_id} className="border-t border-border-primary/50 align-top">
                    <td className="whitespace-nowrap px-4 py-1.5 font-mono text-text-muted">{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td className="px-3 py-1.5 font-mono text-text-secondary">{r.step_id || "—"}</td>
                    <td className={cn("px-3 py-1.5", refused ? "text-status-alarm" : "text-text-primary")}>{r.action}</td>
                    <td className="px-3 py-1.5 text-text-secondary">{r.performed_by}</td>
                    <td className="px-4 py-1.5 font-mono text-[11px] text-text-muted">{r.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
