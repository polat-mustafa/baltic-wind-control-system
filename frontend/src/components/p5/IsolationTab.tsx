/**
 * Isolation register — the safety locks of EN 50110-1 §6.2: disconnectors
 * secured OPEN against reconnection, earth switches secured CLOSED.
 * A locked device cannot be operated (interlock ILK-004); only the Person in
 * Control releases a lock, normally through the programme's isolation steps.
 */

import { Lock, LockOpen } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";
import { cn } from "../../lib/utils";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { ProgrammeDetail } from "../../types/commissioning";
import { p5IsolationInfo } from "../../constants/panelInfo";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export default function IsolationTab({ programme }: { programme: ProgrammeDetail }) {
  const { loto, busy, lockAction } = useCommissioningStore();
  const state = Object.fromEntries(programme.equipment_states.map((e) => [e.equipment_id, e]));
  if (!loto) return null;

  return (
    <Card>
      <CardHeader action={<InfoButton info={p5IsolationInfo} />}>
        <CardTitle>Isolation register</CardTitle>
        <span className="text-xs font-mono text-text-muted">
          {loto.applied_count} of {loto.points.length} locks applied
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-bg-tertiary text-left text-[10px] uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Secured</th>
                <th className="px-3 py-2 font-medium">Position now</th>
                <th className="px-3 py-2 font-medium">Danger tag</th>
                <th className="px-3 py-2 font-medium">Lock</th>
                <th className="px-3 py-2 font-medium">Last change</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {loto.points.map((p) => {
                const eq = state[p.equipment_id];
                const applied = p.status === "applied";
                const inSecured = eq?.state === p.secured_state;
                return (
                  <tr key={p.point_id} className="border-t border-border-primary/50">
                    <td className="px-4 py-2">
                      <div className="font-mono text-text-primary">{p.equipment_id}</div>
                      <div className="text-[11px] text-text-muted">{eq?.location}</div>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{p.secured_state === "open" ? "open (DS)" : "closed (earthed)"}</td>
                    <td className={cn("px-3 py-2 font-mono", inSecured ? "text-text-secondary" : "text-status-warning")}>
                      {eq?.state}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-secondary">{p.tag_number}</td>
                    <td className="px-3 py-2">
                      <span className={cn("inline-flex items-center gap-1 font-medium", applied ? "text-status-warning" : "text-text-muted")}>
                        {applied ? <Lock size={12} /> : <LockOpen size={12} />}
                        {applied ? "applied" : "removed"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-text-muted">
                      {applied ? `${p.locked_by} · ${time(p.applied_at)}` : `${p.removed_by} · ${time(p.removed_at)}`}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {applied ? (
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => lockAction(p.point_id, "remove")}>
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy || !inSecured}
                          title={inSecured ? undefined : `Device must be ${p.secured_state} to be locked`}
                          onClick={() => lockAction(p.point_id, "apply")}
                        >
                          Re-apply
                        </Button>
                      )}
                    </td>
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
