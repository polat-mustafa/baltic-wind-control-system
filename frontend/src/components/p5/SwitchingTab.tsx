/**
 * Switching tab — single-line diagram, the current step with its controls,
 * the load-flow readings of the live network, and the full step list.
 */

import { useState } from "react";
import { CheckCircle2, Circle, CircleDot, Lock, OctagonAlert, PauseCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";
import { cn } from "../../lib/utils";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { ProgrammeDetail, Step, StepType } from "../../types/commissioning";
import { p5NetworkInfo, p5SldInfo, p5StepInfo } from "../../constants/panelInfo";
import CircuitSLD from "./CircuitSLD";
import { ACTION_LABEL, GATE_TAB, gateOf, type P5Tab } from "./steps";

export type { P5Tab };


const TYPE_LABEL: Record<StepType, string> = {
  check: "Check",
  gate: "Gate",
  isolation: "Isolation",
  switching: "Switching",
  verification: "Verification",
  hold_point: "Hold point",
  declaration: "Declaration",
};



function TypeTag({ type }: { type: StepType }) {
  return (
    <span className="rounded border border-border-primary bg-bg-tertiary px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-text-secondary">
      {TYPE_LABEL[type]}
    </span>
  );
}

function CurrentStep({ programme, onGoto }: { programme: ProgrammeDetail; onGoto: (t: P5Tab) => void }) {
  const { busy, lastResult, startProgramme, executeCurrentStep, decide, emergencyStop } = useCommissioningStore();
  const [reason, setReason] = useState("");
  const [tripReason, setTripReason] = useState("");
  const [confirmTrip, setConfirmTrip] = useState(false);
  const step: Step | undefined = programme.steps[programme.current_step_index];
  const { status } = programme;

  return (
    <Card>
      <CardHeader action={<InfoButton info={p5StepInfo} />}>
        <CardTitle>
          {step && status !== "completed" ? `Step ${step.step_id}` : "Programme"}
        </CardTitle>
        {step && status !== "completed" && (
          <span className="text-xs text-text-muted font-mono">
            {step.step_number} / {programme.total_steps} · {programme.phases[String(step.phase)]}
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {status === "created" && (
          <>
            <p className="text-sm text-text-secondary">
              The plant is in its construction condition: every earth switch closed, every
              disconnector open, {programme.equipment_states.filter((e) => e.locked).length} isolation
              locks applied. The Person in Control approves the programme and starts it.
            </p>
            <Button onClick={startProgramme} disabled={busy}>Approve &amp; start programme</Button>
          </>
        )}

        {step && ["in_progress", "hold", "suspended", "aborted"].includes(status) && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <TypeTag type={step.step_type} />
              <span className="text-xs text-text-muted">by {step.responsible}</span>
              {step.equipment_id && <span className="font-mono text-xs text-text-secondary">{step.equipment_id}</span>}
            </div>
            <p className="text-sm font-medium leading-snug text-text-primary">{step.action}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-text-muted">Confirmed by</dt>
              <dd className="text-text-secondary">{step.verification || "—"}</dd>
              {step.notes && (
                <>
                  <dt className="text-text-muted">Note</dt>
                  <dd className="text-text-secondary">{step.notes}</dd>
                </>
              )}
            </dl>
          </>
        )}

        {lastResult && (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              lastResult.ok
                ? "border-status-normal/30 bg-status-normal/10 text-text-primary"
                : "border-status-alarm/30 bg-status-alarm/10 text-status-alarm",
            )}
          >
            <span className="font-mono font-semibold">{lastResult.stepId}</span> {lastResult.ok ? "✓" : "refused"} — {lastResult.text}
          </div>
        )}

        {status === "in_progress" && step && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={executeCurrentStep} disabled={busy}>
              {ACTION_LABEL[step.step_type]}
              {step.step_type === "switching" && step.equipment_id ? ` ${step.equipment_id}` : ""}
            </Button>
            {step.step_type === "gate" && (
              <GateHint step={step} onGoto={onGoto} />
            )}
          </div>
        )}

        {status === "hold" && (
          <div className="space-y-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
              <PauseCircle size={14} /> Hold point — Person in Control decides
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => decide("go")} disabled={busy}>GO</Button>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="NO-GO reason"
                className="min-w-40 flex-1 rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <Button variant="secondary" disabled={busy || !reason.trim()} onClick={() => decide("nogo", reason.trim())}>
                NO-GO
              </Button>
            </div>
          </div>
        )}

        {status === "suspended" && (
          <div className="space-y-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3">
            <p className="text-xs text-text-primary">
              Switching suspended by an emergency procedure. The plant is unchanged; resume only
              when the cause is cleared.
            </p>
            <Button onClick={() => decide("go", "Cause cleared")} disabled={busy}>Resume (PiC)</Button>
          </div>
        )}

        {status === "completed" && (
          <p className="flex items-start gap-2 text-sm text-text-secondary">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-status-normal" />
            Circuit 1 is energised and handed over. Section B stays earthed for the circuit 2
            programme. Next: compliance tests and the FON (Grid code tab).
          </p>
        )}
        {status === "aborted" && (
          <p className="flex items-start gap-2 text-sm text-status-alarm">
            <OctagonAlert size={16} className="mt-0.5 shrink-0" />
            Programme aborted — see the audit trail. A new programme is needed to continue.
          </p>
        )}

        {/* Emergency trip — always reachable while the plant may be live */}
        {status !== "created" && (
          <div className="border-t border-border-primary pt-3">
            {!confirmTrip ? (
              <button
                type="button"
                onClick={() => setConfirmTrip(true)}
                className="w-full rounded-md bg-status-alarm py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
              >
                Emergency trip
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <input
                  autoFocus
                  value={tripReason}
                  onChange={(e) => setTripReason(e.target.value)}
                  placeholder="Reason (required)"
                  className="min-w-40 flex-1 rounded-md border border-status-alarm/50 bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary focus:outline-none"
                />
                <button
                  type="button"
                  disabled={!tripReason.trim() || busy}
                  onClick={() => {
                    void emergencyStop(tripReason.trim());
                    setConfirmTrip(false);
                    setTripReason("");
                  }}
                  className="rounded-md bg-status-alarm px-3 text-xs font-bold text-white disabled:opacity-40"
                >
                  Trip all breakers
                </button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmTrip(false)}>Cancel</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function GateHint({ step, onGoto }: { step: Step; onGoto: (t: P5Tab) => void }) {
  const g = GATE_TAB[gateOf(step)];
  return (
    <button type="button" onClick={() => onGoto(g.tab)} className="text-xs text-accent hover:underline">
      {g.what} →
    </button>
  );
}

function Readings({ programme }: { programme: ProgrammeDetail }) {
  const n = programme.network;
  const rows: [string, string][] = [];
  if (n.cable_i_send_a != null) rows.push(["Cable 1 current (sending end)", `${n.cable_i_send_a.toFixed(0)} A · ${n.cable_loading_pct?.toFixed(0)} %`]);
  if (n.reactor_q_mvar != null) rows.push(["Reactor 1", `${n.reactor_q_mvar.toFixed(1)} Mvar`]);
  if (n.statcom_q_mvar != null) rows.push(["STATCOM", `${n.statcom_q_mvar >= 0 ? "+" : "−"}${Math.abs(n.statcom_q_mvar).toFixed(1)} Mvar`]);
  if (n.tx1_i_hv_a != null) rows.push(["TX-OSS-01 HV current", `${n.tx1_i_hv_a < 10 ? n.tx1_i_hv_a.toFixed(2) : n.tx1_i_hv_a.toFixed(0)} A · ${n.tx1_loading_pct?.toFixed(1)} %`]);
  rows.push(["Generation", `${n.generation_mw.toFixed(0)} MW`]);
  rows.push(["Into PSE 400 kV", `P ${n.poc_p_mw.toFixed(1)} MW · Q ${n.poc_q_mvar >= 0 ? "+" : "−"}${Math.abs(n.poc_q_mvar).toFixed(1)} Mvar`]);

  return (
    <Card>
      <CardHeader action={<InfoButton info={p5NetworkInfo} />}>
        <CardTitle>Network readings</CardTitle>
        <span className="text-xs text-text-muted">load flow of the live network</span>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="pb-1 font-medium">Busbar</th>
              <th className="pb-1 text-right font-medium">kV</th>
              <th className="pb-1 text-right font-medium">pu</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {n.buses.map((b) => {
              const out = b.vm_pu < 0.95 || b.vm_pu > 1.05;
              return (
                <tr key={b.name} className="border-t border-border-primary/50">
                  <td className="py-1 font-sans text-text-secondary">{b.name}</td>
                  <td className="py-1 text-right text-text-primary">{b.kv.toFixed(1)}</td>
                  <td className={cn("py-1 text-right", out ? "text-status-alarm" : "text-text-primary")}>{b.vm_pu.toFixed(3)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <dl className="space-y-1 text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-t border-border-primary/50 pt-1">
              <dt className="text-text-secondary">{k}</dt>
              <dd className="font-mono text-text-primary">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-relaxed text-text-muted">
          Steady state only — switching transients and transformer inrush are not load-flow
          quantities. Released turbines are dispatched at rated output, capped by the circuit 1 PPC limit while circuit 2 is out (design check).
          Q: generator convention, + = generating.
        </p>
      </CardContent>
    </Card>
  );
}

const STATUS_ICON = {
  completed: <CheckCircle2 size={14} className="text-status-normal" />,
  in_progress: <CircleDot size={14} className="text-status-warning" />,
  failed: <OctagonAlert size={14} className="text-status-alarm" />,
  pending: <Circle size={14} className="text-text-muted" />,
};

function StepList({ programme }: { programme: ProgrammeDetail }) {
  const phases = Object.entries(programme.phases);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Programme steps</CardTitle>
        <span className="text-xs font-mono text-text-muted">
          {programme.completed_steps} / {programme.total_steps}
        </span>
      </CardHeader>
      <div className="max-h-[560px] overflow-y-auto">
        {phases.map(([phase, name]) => {
          const steps = programme.steps.filter((s) => String(s.phase) === phase);
          const done = steps.filter((s) => s.status === "completed").length;
          return (
            <section key={phase}>
              <h4 className="sticky top-0 z-10 flex justify-between border-y border-border-primary bg-bg-tertiary px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                <span>{phase}. {name}</span>
                <span className="font-mono font-normal">{done}/{steps.length}</span>
              </h4>
              <ol>
                {steps.map((s) => {
                  const current = s.step_number - 1 === programme.current_step_index && !["completed", "created"].includes(programme.status);
                  return (
                    <li
                      key={s.step_id}
                      className={cn(
                        "grid grid-cols-[16px_44px_1fr] gap-x-2 border-b border-border-primary/40 px-4 py-2 text-xs",
                        current && "bg-accent/10",
                      )}
                    >
                      <span className="pt-0.5">{STATUS_ICON[s.status]}</span>
                      <span className="pt-0.5 font-mono text-text-muted">{s.step_id}</span>
                      <div className="min-w-0">
                        <p className={cn("leading-snug", s.status === "completed" ? "text-text-secondary" : "text-text-primary")}>
                          {s.step_type === "isolation" && <Lock size={11} className="mr-1 inline text-text-muted" />}
                          {s.action}
                        </p>
                        {s.reading && (
                          <p className={cn("mt-0.5 font-mono text-xs", s.status === "completed" ? "text-text-muted" : "text-status-alarm")}>
                            {s.reading}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </Card>
  );
}

export default function SwitchingTab({ programme, onGoto }: { programme: ProgrammeDetail; onGoto: (t: P5Tab) => void }) {
  const busy = useCommissioningStore((s) => s.busy);
  const executeCurrentStep = useCommissioningStore((s) => s.executeCurrentStep);
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader action={<InfoButton info={p5SldInfo} />}>
            <CardTitle>Circuit 1 — single-line diagram</CardTitle>
          </CardHeader>
          <CircuitSLD programme={programme} onOperate={() => void executeCurrentStep()} busy={busy} />
        </Card>
        <StepList programme={programme} />
      </div>
      <div className="order-first space-y-4 xl:order-none">
        <CurrentStep programme={programme} onGoto={onGoto} />
        <Readings programme={programme} />
      </div>
    </div>
  );
}
