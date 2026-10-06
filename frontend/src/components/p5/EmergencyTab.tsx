/**
 * Emergency tab — procedures and their effect on the programme.
 * TRIP: every closed breaker opens and the programme is aborted.
 * SUSPEND: switching stops until the Person in Control resumes.
 */

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";
import { cn } from "../../lib/utils";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { ProgrammeDetail } from "../../types/commissioning";
import { p5EmergencyInfo } from "../../constants/panelInfo";

const SEVERITY_STYLE = {
  critical: "bg-status-alarm/15 text-status-alarm",
  high: "bg-status-warning/15 text-status-warning",
  medium: "bg-bg-tertiary text-text-secondary",
};

export default function EmergencyTab({ programme }: { programme: ProgrammeDetail }) {
  const { procedures, busy, triggerEmergency } = useCommissioningStore();
  const [armed, setArmed] = useState<string | null>(null);
  const titleOf = Object.fromEntries(procedures.map((p) => [p.emergency_type, p.title]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {procedures.map((p) => (
          <Card key={p.emergency_type} className="flex flex-col">
            <CardHeader action={<InfoButton info={p5EmergencyInfo} />}>
              <CardTitle className="normal-case tracking-normal">{p.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 text-xs">
              <div className="flex flex-wrap gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", SEVERITY_STYLE[p.severity])}>{p.severity}</span>
                <span className="rounded border border-border-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-secondary">
                  {p.effect === "trip" ? "Trips circuit 1" : "Suspends switching"}
                </span>
                <span className="text-[11px] text-text-muted">{p.responsible}</span>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-text-primary">
                {p.immediate_actions.map((a) => <li key={a}>{a}</li>)}
              </ol>
              <div>
                <p className="mb-0.5 text-[10px] uppercase tracking-wide text-text-muted">Communication</p>
                <ul className="space-y-0.5 text-text-secondary">
                  {p.communication_protocol.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </div>
              <p className="text-[11px] text-text-muted">{p.reference_document}</p>
              <div className="mt-auto flex gap-2">
                {armed === p.emergency_type ? (
                  <>
                    <Button
                      size="sm"
                      className="bg-status-alarm hover:bg-status-alarm/90"
                      disabled={busy}
                      onClick={() => {
                        void triggerEmergency(p.emergency_type);
                        setArmed(null);
                      }}
                    >
                      Confirm — {p.effect === "trip" ? "trip" : "suspend"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setArmed(null)}>Cancel</Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => setArmed(p.emergency_type)}>
                    Simulate this emergency
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emergency log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {programme.emergency_log.length === 0 ? (
            <p className="px-5 py-4 text-xs text-text-muted">No emergencies in this programme.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {programme.emergency_log.map((e) => (
                  <tr key={e.event_id} className="border-t border-border-primary/50">
                    <td className="px-4 py-2 font-mono text-text-muted">{new Date(e.triggered_at).toLocaleTimeString()}</td>
                    <td className="px-3 py-2 text-text-primary">{titleOf[e.emergency_type] ?? e.emergency_type}</td>
                    <td className="px-3 py-2 text-text-secondary">{e.triggered_by}</td>
                    <td className="px-4 py-2 text-text-secondary">
                      {e.effect === "trip" ? `Opened: ${e.breakers_opened.join(", ") || "nothing was closed"}` : "Switching suspended"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
