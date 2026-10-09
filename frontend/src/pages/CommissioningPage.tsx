/**
 * P5 Commissioning page — route /commissioning.
 *
 * Without an open programme: create one (Person in Control) or open an
 * existing one. With a programme open: status strip (progress and the
 * FAT → SAT → EON → ION → FON gates) and six tabs sharing one store.
 */

import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, FlaskConical, Landmark, Lock, ScrollText, Siren, Trash2, Zap } from "lucide-react";

import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { TrainingGuide } from "../components/ui/TrainingGuide";
import ProjectHandoverNote from "../components/lifecycle/ProjectHandoverNote";
import { StageDone } from "../components/project/StageDone";
import { cn } from "../lib/utils";
import { p5Guide } from "../constants/trainingGuideContent";
import { useCommissioningStore } from "../store/commissioningStore";
import { useGridStore, useNetwork } from "../store/gridStore";
import type { ProgrammeDetail, ProgrammeStatus } from "../types/commissioning";
import SwitchingTab, { type P5Tab } from "../components/p5/SwitchingTab";
import NextAction from "../components/p5/NextAction";
import IsolationTab from "../components/p5/IsolationTab";
import TestingTab from "../components/p5/TestingTab";
import GridCodeTab from "../components/p5/GridCodeTab";
import EmergencyTab from "../components/p5/EmergencyTab";
import AuditTrail from "../components/p5/AuditTrail";

const TABS: { id: P5Tab; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "switching", label: "Switching", Icon: Zap },
  { id: "isolation", label: "Isolation", Icon: Lock },
  { id: "testing", label: "FAT / SAT", Icon: FlaskConical },
  { id: "gridcode", label: "Grid code", Icon: Landmark },
  { id: "emergency", label: "Emergency", Icon: Siren },
  { id: "audit", label: "Audit trail", Icon: ScrollText },
];

const STATUS_STYLE: Record<ProgrammeStatus, string> = {
  created: "bg-bg-tertiary text-text-secondary",
  approved: "bg-bg-tertiary text-text-secondary",
  in_progress: "bg-accent/15 text-accent",
  hold: "bg-status-warning/15 text-status-warning",
  suspended: "bg-status-warning/15 text-status-warning",
  completed: "bg-status-normal/15 text-status-normal",
  aborted: "bg-status-alarm/15 text-status-alarm",
};

function StatusChip({ status }: { status: ProgrammeStatus }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide", STATUS_STYLE[status])}>
      {status.replace("_", " ")}
    </span>
  );
}

function Gate({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <span
      title={detail}
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs",
        ok ? "border-status-normal/40 text-status-normal" : "border-border-primary text-text-muted",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-status-normal" : "bg-text-muted")} />
      {label}
    </span>
  );
}

function StatusStrip({ programme }: { programme: ProgrammeDetail }) {
  const { fat, sat, compliance, closeProgramme } = useCommissioningStore();
  const classes = new Set(fat.filter((f) => f.status === "approved").map((f) => f.equipment_class));
  const issued = (s: "eon" | "ion" | "fon") => compliance?.stages[s].status === "issued";
  const pct = (programme.completed_steps / programme.total_steps) * 100;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={closeProgramme}>
          <ArrowLeft size={12} /> Programmes
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-text-primary">{programme.programme_id}</span>
            <StatusChip status={programme.status} />
          </div>
          <div className="text-xs text-text-muted">Person in Control: {programme.pic_name}</div>
        </div>
        <div className="flex min-w-40 flex-1 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-xs text-text-muted">{programme.completed_steps}/{programme.total_steps}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Gate label={`FAT ${classes.size}/3`} ok={classes.size === 3} detail="Approved FAT per equipment class" />
          <Gate label="SAT" ok={sat?.status === "approved"} detail="Site acceptance tests of circuit 1" />
          <Gate label="EON" ok={issued("eon")} detail="Energisation operational notification (NC RfG Art. 34)" />
          <Gate label="ION" ok={issued("ion")} detail="Interim operational notification (Art. 35)" />
          <Gate label="FON" ok={issued("fon")} detail="Final operational notification (Art. 36)" />
        </div>
      </div>
    </Card>
  );
}

function ProgrammeList() {
  const { programmes, busy, createProgramme, openProgramme, deleteProgramme } = useCommissioningStore();
  const [pic, setPic] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // the farm a new programme is created for (X-Farm header in own-project mode)
  const n = useNetwork();
  useEffect(() => {
    void useGridStore.getState().fetchNetworkSpec();
  }, []);
  const a = n.string_layout.slice(0, n.section_a_strings);
  const wtg = a.reduce((x, y) => x + y, 0);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div data-tour="create-programme">
        <Card>
          <CardHeader>
            <CardTitle>New programme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-text-secondary">
            <p>
              First energisation of export circuit 1 of {n.name}: cable 1 from shore, the OSS
              220 kV busbar with {n.num_reactors ? "reactor 1 and " : ""}the STATCOM, TX-OSS-01, 66 kV
              section A and {a.length === 1 ? "string 1" : `strings 1–${a.length}`} ({wtg} × 15 MW
              = {wtg * 15} MW). Section B (circuit 2) stays isolated and earthed.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (pic.trim()) void createProgramme(pic.trim());
              }}
            >
              <input
                value={pic}
                onChange={(e) => setPic(e.target.value)}
                placeholder="Person in Control (name)"
                aria-label="Person in Control"
                className="min-w-0 flex-1 rounded-md border border-border-secondary bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <Button type="submit" disabled={busy || !pic.trim()}>Create</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Programmes</CardTitle>
          <span className="text-xs text-text-muted">{programmes.length}</span>
        </CardHeader>
        <CardContent className="p-0" data-e2e-mask>
          {programmes.length === 0 ? (
            <p className="px-5 py-4 text-xs text-text-muted">No programmes yet.</p>
          ) : (
            <ul>
              {programmes.map((p) => (
                <li key={p.programme_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-primary/50 px-5 py-2.5 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-text-primary">{p.programme_id}</span>
                      <StatusChip status={p.status} />
                    </div>
                    <div className="text-xs text-text-muted">
                      PiC {p.pic_name} · {p.completed_steps}/{p.total_steps} steps · {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openProgramme(p.programme_id)}>
                    <ClipboardList size={12} /> Open
                  </Button>
                  {confirmDelete === p.programme_id ? (
                    <>
                      <Button size="sm" className="bg-status-alarm hover:bg-status-alarm/90" onClick={() => { void deleteProgramme(p.programme_id); setConfirmDelete(null); }}>
                        Delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>Keep</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" aria-label={`Delete ${p.programme_id}`} onClick={() => setConfirmDelete(p.programme_id)}>
                      <Trash2 size={12} />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CommissioningPage() {
  const { active, programmes, error, fetchProgrammes, clearError } = useCommissioningStore();
  const finished = active?.status === "completed" || programmes.some((p) => p.status === "completed");
  const [tab, setTab] = useState<P5Tab>("switching");

  useEffect(() => {
    void fetchProgrammes();
  }, [fetchProgrammes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2" data-tour="page-header">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">HV Commissioning</h2>
          <p className="mt-1 font-mono text-xs text-text-muted">
            Circuit 1 first energisation · isolation (EN 50110-1) · FAT / SAT · EON → ION → FON (NC RfG)
          </p>
        </div>
        <TrainingGuide guide={p5Guide} />
      </div>

      <ProjectHandoverNote what="A new programme is built for your farm: cable length, transformer, reactor and STATCOM ratings from the grid design, one feeder bay per string of section A. Each programme keeps the farm it was created for." />
      <StageDone
        milestone="commissioning"
        title="Commissioning"
        need={finished ? null : "Run a switching programme to the end (status completed) first."}
        next={{ path: "/build/handover", label: "Hand-over" }}
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-alarm/30 bg-status-alarm/10 p-3 text-sm">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>Dismiss</Button>
        </div>
      )}

      {!active ? (
        <ProgrammeList />
      ) : (
        <>
          <StatusStrip programme={active} />
          <NextAction programme={active} onGoto={setTab} />
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border-primary bg-bg-secondary p-1">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  tab === id ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
          {tab === "switching" && <SwitchingTab programme={active} onGoto={setTab} />}
          {tab === "isolation" && <IsolationTab programme={active} />}
          {tab === "testing" && <TestingTab />}
          {tab === "gridcode" && <GridCodeTab programme={active} />}
          {tab === "emergency" && <EmergencyTab programme={active} />}
          {tab === "audit" && <AuditTrail programme={active} />}
        </>
      )}
    </div>
  );
}
