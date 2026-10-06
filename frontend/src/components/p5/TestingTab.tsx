/**
 * Testing tab — factory (FAT) and site (SAT) acceptance tests.
 *
 * FAT: one campaign per equipment item, from the routine-test template of its
 * class. SAT: one campaign for circuit 1, opened once every class has an
 * approved FAT. A pass/fail test is recorded as Pass or Fail; a measured test
 * as a number checked against its acceptance band.
 */

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";
import { cn } from "../../lib/utils";
import { useCommissioningStore } from "../../store/commissioningStore";
import type { EquipmentClass, FATCampaign, SATCampaign, TestSpecification } from "../../types/commissioning";
import { p5FatInfo, p5SatInfo } from "../../constants/panelInfo";

const CLASS_LABEL: Record<EquipmentClass, string> = {
  power_transformer: "Power transformer",
  gis_220kv: "220 kV GIS",
  protection_panel: "Protection panel",
};
const DEFAULT_TAG: Record<EquipmentClass, string> = {
  power_transformer: "TX-OSS-01",
  gis_220kv: "GIS-OSS-220",
  protection_panel: "PROT-CIRCUIT-1",
};

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(2));

function band(s: TestSpecification): string {
  if (s.unit === "pass/fail") return "pass";
  if (s.min_value === s.max_value && s.min_value != null) return `= ${fmt(s.min_value)} ${s.unit}`;
  if (s.min_value != null && s.min_value !== 0 && s.max_value != null) return `${fmt(s.min_value)} … ${fmt(s.max_value)} ${s.unit}`;
  return `≤ ${fmt(s.max_value ?? 0)} ${s.unit}`;
}

function TestTable({
  campaign,
  onRecord,
}: {
  campaign: FATCampaign | SATCampaign;
  onRecord: (testId: string, value: number) => void;
}) {
  const busy = useCommissioningStore((s) => s.busy);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const results = Object.fromEntries(campaign.results.map((r) => [r.test_id, r]));
  const frozen = campaign.status === "approved";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead className="bg-bg-tertiary text-left text-[10px] uppercase tracking-wide text-text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Test</th>
            <th className="px-3 py-2 font-medium">Standard</th>
            <th className="px-3 py-2 font-medium">Acceptance</th>
            <th className="px-3 py-2 font-medium">Result</th>
            <th className="px-4 py-2 font-medium">Record</th>
          </tr>
        </thead>
        <tbody>
          {campaign.specs.map((s) => {
            const r = results[s.test_id];
            return (
              <tr key={s.test_id} className="border-t border-border-primary/50 align-top">
                <td className="px-4 py-2">
                  <div className="text-text-primary">
                    <span className="mr-1.5 font-mono text-text-muted">{s.test_id}</span>
                    {s.name}
                  </div>
                  <div className="text-[11px] text-text-muted">{s.description}</div>
                </td>
                <td className="px-3 py-2 text-[11px] text-text-secondary">{s.standard}</td>
                <td className="px-3 py-2 font-mono text-text-secondary">{band(s)}</td>
                <td className="px-3 py-2">
                  {r ? (
                    <span className={cn("font-mono font-semibold", r.verdict === "pass" ? "text-status-normal" : "text-status-alarm")}>
                      {s.unit === "pass/fail" ? (r.measured_value === 1 ? "PASS" : "FAIL") : `${fmt(r.measured_value)} · ${r.verdict.toUpperCase()}`}
                    </span>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {!frozen &&
                    (s.unit === "pass/fail" ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => onRecord(s.test_id, 1)}>Pass</Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRecord(s.test_id, 0)}>Fail</Button>
                      </div>
                    ) : (
                      <form
                        className="flex gap-1"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const v = Number(draft[s.test_id]);
                          if (draft[s.test_id] !== undefined && Number.isFinite(v)) onRecord(s.test_id, v);
                        }}
                      >
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          aria-label={`${s.test_id} measured value in ${s.unit}`}
                          placeholder={String(s.typical_value)}
                          value={draft[s.test_id] ?? ""}
                          onChange={(e) => setDraft({ ...draft, [s.test_id]: e.target.value })}
                          className="w-20 rounded border border-border-secondary bg-bg-tertiary px-1.5 py-1 font-mono text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        <Button size="sm" variant="secondary" type="submit" disabled={busy}>Save</Button>
                      </form>
                    ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ status, allPassed }: { status: string; allPassed: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        status === "approved" ? "bg-status-normal/15 text-status-normal"
          : status === "completed" && !allPassed ? "bg-status-alarm/15 text-status-alarm"
          : "bg-bg-tertiary text-text-secondary",
      )}
    >
      {status === "completed" && !allPassed ? "failures" : status.replace("_", " ")}
    </span>
  );
}

export default function TestingTab() {
  const { fat, sat, busy, createFAT, recordFAT, fillFAT, approveFAT, createSAT, recordSAT, fillSAT, approveSAT } =
    useCommissioningStore();
  const [cls, setCls] = useState<EquipmentClass>("power_transformer");
  const [tag, setTag] = useState(DEFAULT_TAG.power_transformer);
  const [openFat, setOpenFat] = useState<string | null>(null);
  const approvedClasses = new Set(fat.filter((f) => f.status === "approved").map((f) => f.equipment_class));
  const missing = (Object.keys(CLASS_LABEL) as EquipmentClass[]).filter((c) => !approvedClasses.has(c));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader action={<InfoButton info={p5FatInfo} />}>
          <CardTitle>Factory acceptance tests</CardTitle>
          <span className="text-xs text-text-muted">routine tests at the manufacturer's works</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (tag.trim()) void createFAT(tag.trim(), cls);
            }}
          >
            <label className="text-xs text-text-muted">
              Equipment class
              <select
                value={cls}
                onChange={(e) => {
                  const c = e.target.value as EquipmentClass;
                  setCls(c);
                  setTag(DEFAULT_TAG[c]);
                }}
                className="mt-1 block rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary"
              >
                {(Object.keys(CLASS_LABEL) as EquipmentClass[]).map((c) => (
                  <option key={c} value={c}>{CLASS_LABEL[c]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-text-muted">
              Equipment tag
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="mt-1 block w-40 rounded-md border border-border-secondary bg-bg-tertiary px-2 py-1.5 font-mono text-xs text-text-primary"
              />
            </label>
            <Button type="submit" size="sm" disabled={busy}>Open FAT campaign</Button>
          </form>

          {fat.length === 0 && <p className="text-xs text-text-muted">No FAT campaigns yet.</p>}
          <div className="space-y-2">
            {fat.map((f) => {
              const open = openFat === f.campaign_id;
              return (
                <div key={f.campaign_id} className="rounded-md border border-border-primary">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <button type="button" onClick={() => setOpenFat(open ? null : f.campaign_id)} className="flex items-center gap-2 text-left">
                      <span className="font-mono text-xs text-text-primary">{f.equipment_tag}</span>
                      <span className="text-xs text-text-secondary">{CLASS_LABEL[f.equipment_class]}</span>
                      <span className="text-[11px] font-mono text-text-muted">{f.results.length}/{f.specs.length}</span>
                      <StatusChip status={f.status} allPassed={f.all_passed} />
                    </button>
                    <span className="ml-auto flex gap-1">
                      {f.status !== "approved" && f.results.length < f.specs.length && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => fillFAT(f.campaign_id)} title="Record each pending test at a typical passing value (demonstration)">
                          Fill typical values
                        </Button>
                      )}
                      {f.status === "completed" && f.all_passed && (
                        <Button size="sm" disabled={busy} onClick={() => approveFAT(f.campaign_id)}>Approve</Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => setOpenFat(open ? null : f.campaign_id)}>
                        {open ? "Hide" : "Tests"}
                      </Button>
                    </span>
                  </div>
                  {open && <TestTable campaign={f} onRecord={(t, v) => recordFAT(f.campaign_id, t, v)} />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader action={<InfoButton info={p5SatInfo} />}>
          <CardTitle>Site acceptance tests — circuit 1</CardTitle>
          {sat && <StatusChip status={sat.status} allPassed={sat.all_passed} />}
        </CardHeader>
        {!sat ? (
          <CardContent className="space-y-2">
            <p className="text-xs text-text-secondary">
              The SAT can be opened once every equipment class has an approved FAT.
              {missing.length > 0 && ` Missing: ${missing.map((c) => CLASS_LABEL[c]).join(", ")}.`}
            </p>
            <Button size="sm" disabled={busy || missing.length > 0} onClick={createSAT}>Open SAT campaign</Button>
          </CardContent>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 px-5 py-2 text-xs text-text-muted">
              <span className="font-mono">{sat.results.length}/{sat.specs.length} recorded</span>
              <span className="ml-auto flex gap-1">
                {sat.status !== "approved" && sat.results.length < sat.specs.length && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={fillSAT}>Fill typical values</Button>
                )}
                {sat.status === "completed" && sat.all_passed && (
                  <Button size="sm" disabled={busy} onClick={approveSAT}>Approve SAT</Button>
                )}
              </span>
            </div>
            <TestTable campaign={sat} onRecord={recordSAT} />
          </>
        )}
      </Card>
    </div>
  );
}
