/**
 * Permit-to-Work — register, lifecycle stepper and audit trail.
 *
 * The 9 states and their order mirror the backend state machine
 * (services/p3/permit_to_work.py): request → risk assessment → approval →
 * isolation → LOTO → active → work complete → LOTO removed → closed, with
 * cancellation from any open state. Each transition needs an RBAC permission;
 * buttons the current role cannot use are shown disabled with the reason.
 */

import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { useScadaStore } from "../../store/scadaStore";
import { InfoButton } from "../ui/InfoButton";
import { permitWorkflowInfo } from "../../constants/panelInfo";
import { useFleet } from "../../lib/fleet";
import { breakers } from "../../utils/scadaTopology";
import { cn } from "../../lib/utils";

const STEPS = [
  { id: "requested", label: "Requested" },
  { id: "risk_assessed", label: "Risk assessed" },
  { id: "approved", label: "Approved" },
  { id: "isolation_confirmed", label: "Isolated" },
  { id: "loto_applied", label: "LOTO applied" },
  { id: "active", label: "Active" },
  { id: "work_complete", label: "Work complete" },
  { id: "loto_removed", label: "LOTO removed" },
  { id: "closed", label: "Closed" },
] as const;

/** Isolation points of the live fleet's switchgear plus the main plant. */
const equipmentOf = (f: ReturnType<typeof useFleet>) => [
  ...Object.values(breakers(f)).map((b) => b.bay.split(" · ")[0]),
  "TX-OSS-01",
  "TX-OSS-02",
  "TX-ONS-01",
  "TX-ONS-02",
  "STATCOM",
  "OSS_PROT_IED01",
];

const statusLabel = (s: string) => STEPS.find((x) => x.id === s)?.label ?? s.replace(/_/g, " ");

const inputCls =
  "w-full h-8 bg-bg-primary border border-border-primary rounded px-2 text-xs text-text-primary focus:border-accent focus:outline-none";

export default function PermitWorkflowPanel() {
  const activePermit = useScadaStore((s) => s.activePermit);
  const permitList = useScadaStore((s) => s.permitList);
  const roleLevel = useScadaStore((s) => s.selectedRoleLevel);
  const roles = useScadaStore((s) => s.roles);
  const createPermit = useScadaStore((s) => s.createPermit);
  const transitionPermit = useScadaStore((s) => s.transitionPermit);
  const openPermit = useScadaStore((s) => s.openPermit);

  const [form, setForm] = useState({
    work_description: "Replace CT secondary wiring, 66 kV string 3 feeder",
    equipment_id: "BAY-OSS-66-03",
    requested_by: "Protection engineer",
  });
  const [busy, setBusy] = useState(false);
  const fleet = useFleet();

  const role = roles.find((r) => r.level === roleLevel);
  const stepIdx = activePermit ? STEPS.findIndex((s) => s.id === activePermit.status) : -1;
  const cancelled = activePermit?.status === "cancelled";

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-3">
      {/* ── Register + new permit ── */}
      <div className="flex flex-col gap-3">
        <section className="bg-bg-secondary rounded-lg border border-border-primary p-3">
          <h3 className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
            <Plus size={12} /> New permit
          </h3>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => createPermit(form));
            }}
          >
            <label className="block text-xs text-text-muted">
              Work description
              <input className={inputCls} value={form.work_description} onChange={(e) => setForm({ ...form, work_description: e.target.value })} required />
            </label>
            <label className="block text-xs text-text-muted">
              Equipment
              <input className={inputCls} list="ptw-equipment" value={form.equipment_id} onChange={(e) => setForm({ ...form, equipment_id: e.target.value })} required />
              <datalist id="ptw-equipment">
                {equipmentOf(fleet).map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </label>
            <label className="block text-xs text-text-muted">
              Requested by
              <input className={inputCls} value={form.requested_by} onChange={(e) => setForm({ ...form, requested_by: e.target.value })} required />
            </label>
            <button type="submit" disabled={busy} className="w-full h-8 rounded bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 disabled:opacity-50">
              Request permit
            </button>
          </form>
        </section>

        <section className="bg-bg-secondary rounded-lg border border-border-primary overflow-hidden">
          <h3 className="text-xs font-semibold text-text-primary px-3 py-2 border-b border-border-primary">
            Permit register <span className="font-mono font-normal text-text-muted">({permitList?.total ?? 0})</span>
          </h3>
          <div className="max-h-[320px] overflow-auto">
            {!permitList?.permits.length && <p className="p-3 text-xs text-text-muted">No permits issued yet.</p>}
            {permitList?.permits.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void openPermit(p.ptw_number)}
                className={cn(
                  "w-full text-left px-3 py-1.5 border-b border-border-primary/60 hover:bg-bg-hover",
                  activePermit?.ptw_number === p.ptw_number && "bg-bg-hover",
                )}
              >
                <div className="flex justify-between text-xs">
                  <span className="font-mono font-semibold text-text-primary">{p.ptw_number}</span>
                  <span className="text-text-secondary">{statusLabel(p.status)}</span>
                </div>
                <div className="text-xs text-text-muted truncate">
                  {p.equipment_id} · {p.work_description}
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* ── Selected permit ── */}
      <section className="bg-bg-secondary rounded-lg border border-border-primary min-h-[360px]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary">
          <h3 className="text-xs font-semibold text-text-primary">Permit lifecycle</h3>
          <InfoButton info={permitWorkflowInfo} />
          {activePermit && <span className="font-mono text-xs text-text-secondary">{activePermit.ptw_number}</span>}
          <span className="flex-1" />
          <span className="text-xs text-text-muted">
            Acting as <b className="text-text-primary">L{roleLevel} {role?.name ?? ""}</b>
          </span>
        </div>

        {!activePermit ? (
          <p className="p-6 text-center text-xs text-text-muted">Request a permit or pick one from the register.</p>
        ) : (
          <div className="p-3 space-y-4">
            {/* Stepper */}
            <ol className="grid grid-cols-9 gap-1" aria-label="Permit state">
              {STEPS.map((s, i) => {
                const done = !cancelled && i < stepIdx;
                const current = i === stepIdx;
                return (
                  <li key={s.id} className="flex flex-col items-center text-center gap-1 min-w-0">
                    <span
                      className={cn(
                        "flex items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-mono font-bold",
                        current ? "border-accent bg-accent text-accent-ink" : done ? "border-status-normal text-status-normal" : "border-border-secondary text-text-muted",
                      )}
                      aria-current={current ? "step" : undefined}
                    >
                      {done ? <Check size={12} /> : i + 1}
                    </span>
                    <span className={cn("text-xs leading-tight", current ? "text-text-primary font-semibold" : "text-text-muted")}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
            {cancelled && <p className="text-xs font-semibold text-status-warning">Permit cancelled.</p>}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-text-muted">Work</dt>
              <dd className="text-text-primary">{activePermit.work_description}</dd>
              <dt className="text-text-muted">Equipment</dt>
              <dd className="font-mono text-text-primary">{activePermit.equipment_id}</dd>
              <dt className="text-text-muted">Requested by</dt>
              <dd className="text-text-secondary">{activePermit.requested_by}</dd>
              {activePermit.valid_until && (
                <>
                  <dt className="text-text-muted">Valid until</dt>
                  <dd className="font-mono text-text-secondary">{new Date(activePermit.valid_until).toLocaleString("sv-SE", { timeZone: "Europe/Warsaw" })}</dd>
                </>
              )}
            </dl>

            {activePermit.next_allowed_transitions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activePermit.next_allowed_transitions.map((t) => {
                  const allowed = role?.permissions.includes(t.required_permission) ?? false;
                  const isCancel = t.target_status === "cancelled";
                  return (
                    <button
                      key={t.target_status}
                      type="button"
                      disabled={busy || !allowed}
                      title={allowed ? `Needs ${t.required_permission}` : `L${roleLevel} lacks ${t.required_permission}`}
                      onClick={() =>
                        void run(() =>
                          transitionPermit(activePermit.ptw_number, {
                            target_status: t.target_status,
                            performed_by: role?.name ?? `L${roleLevel}`,
                            user_level: roleLevel,
                          }),
                        )
                      }
                      className={cn(
                        "h-8 px-3 rounded text-xs font-semibold border disabled:opacity-40 disabled:cursor-not-allowed",
                        isCancel ? "border-border-primary text-text-secondary hover:bg-bg-hover" : "border-accent bg-accent text-accent-ink hover:opacity-90",
                      )}
                    >
                      {isCancel ? "Cancel permit" : `→ ${statusLabel(t.target_status)}`}
                      <span className="ml-1.5 font-mono font-normal opacity-80">{t.required_permission}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activePermit.transition_log.length > 0 && (
              <div className="overflow-x-auto">
                <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Audit trail</h4>
                <table className="w-full text-xs">
                  <thead className="text-text-muted text-left">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Time</th>
                      <th className="py-1 pr-3 font-medium">Transition</th>
                      <th className="py-1 pr-3 font-medium">By</th>
                      <th className="py-1 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePermit.transition_log.map((t) => (
                      <tr key={t.id} className="border-t border-border-primary/60">
                        <td className="py-1 pr-3 font-mono text-text-secondary whitespace-nowrap">
                          {new Date(t.created_at).toLocaleTimeString("sv-SE", { timeZone: "Europe/Warsaw" })}
                        </td>
                        <td className="py-1 pr-3 text-text-primary whitespace-nowrap">
                          {statusLabel(t.from_status)} → {statusLabel(t.to_status)}
                        </td>
                        <td className="py-1 pr-3 text-text-secondary whitespace-nowrap">
                          {t.performed_by} <span className="font-mono text-text-muted">L{t.user_level}</span>
                        </td>
                        <td className="py-1 text-text-muted">{t.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
