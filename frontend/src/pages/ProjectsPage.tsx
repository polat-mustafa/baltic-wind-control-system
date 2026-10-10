/**
 * My projects (route /projects): every own project kept in this browser
 * (lib/project/library.ts) — open, rename, duplicate, export, import, delete —
 * and a side-by-side comparison of up to four of them (and SB-510) on
 * capacity, energy, cost, LCOE and revenue (lib/project/compare.ts).
 */

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Copy, Download, FolderOpen, Pencil, Trash2, Upload } from "lucide-react";

import { Button } from "../components/ui/Button";
import { parseDoc, type ProjectDoc } from "../lib/project/document";
import { projectMetrics, type ProjectMetrics } from "../lib/project/compare";
import {
  activeProjectId,
  addProject,
  deleteProject,
  duplicateProject,
  listProjects,
  openProject,
  referenceDoc,
  renameProject,
  type LibraryEntry,
} from "../lib/project/library";
import { cn } from "../lib/utils";
import { postAssess, type AssessResponse } from "../services/siteApi";
import { useModeStore } from "../store/modeStore";
import { PageHeader } from "../components/layout/PageHeader";

const REFERENCE = "sb510";
const MAX_COMPARE = 4;

interface Row {
  key: keyof ProjectMetrics;
  label: string;
  unit: string;
  digits: number;
  /** Which end is better, for the highlight (none: just context). */
  best?: "max" | "min";
}

const ROWS: Row[] = [
  { key: "turbines", label: "Turbines", unit: "", digits: 0 },
  { key: "capacityMW", label: "Installed capacity", unit: "MW", digits: 0, best: "max" },
  { key: "siteAreaKm2", label: "Site area", unit: "km²", digits: 1 },
  { key: "minSpacingD", label: "Closest spacing", unit: "D", digits: 1, best: "max" },
  { key: "meanWindMs", label: "Mean wind at hub height", unit: "m/s", digits: 2, best: "max" },
  { key: "netGWh", label: "Net energy (P50)", unit: "GWh/yr", digits: 0, best: "max" },
  { key: "wakeLossPct", label: "Internal wake loss", unit: "%", digits: 1, best: "min" },
  { key: "capacityFactor", label: "Net capacity factor", unit: "%", digits: 1, best: "max" },
  { key: "arrayCableKm", label: "66 kV array cable", unit: "km", digits: 1, best: "min" },
  { key: "exportKm", label: "Export cable route", unit: "km", digits: 0, best: "min" },
  { key: "capexMEUR", label: "CAPEX", unit: "M€", digits: 0, best: "min" },
  { key: "capexMEURperMW", label: "CAPEX per MW", unit: "M€/MW", digits: 2, best: "min" },
  { key: "opexMEURyr", label: "OPEX", unit: "M€/yr", digits: 1, best: "min" },
  { key: "lcoeEURperMWh", label: "LCOE", unit: "€/MWh", digits: 1, best: "min" },
  { key: "revenueMEURyr", label: "Revenue", unit: "M€/yr", digits: 0, best: "max" },
  { key: "npvMEUR", label: "NPV over lifetime", unit: "M€", digits: 0, best: "max" },
  { key: "paybackYears", label: "Simple payback", unit: "yr", digits: 1, best: "min" },
];

const fmt = (v: unknown, r: Row) =>
  typeof v !== "number" ? "—" : (r.key === "capacityFactor" ? v * 100 : v).toLocaleString("en-US", { maximumFractionDigits: r.digits, minimumFractionDigits: r.digits });

const date = (ms: number) => new Date(ms).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

function download(doc: ProjectDoc) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${doc.name.replace(/[^\w.-]+/g, "_") || "project"}.offshoreforge.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const mode = useModeStore((s) => s.mode);
  const [, setVersion] = useState(0); // re-render after every library change
  const projects = listProjects(); // localStorage read: cheap, always current
  const active = activeProjectId();
  const [picked, setPicked] = useState<string[]>([]);
  const [price, setPrice] = useState(100);
  const [results, setResults] = useState<ProjectMetrics[] | null>(null);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => setVersion((v) => v + 1);

  const docOf = (id: string): ProjectDoc | null => (id === REFERENCE ? referenceDoc() : (projects.find((p) => p.id === id)?.doc ?? null));

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_COMPARE ? [...p, id] : p));

  const compare = async () => {
    setRunning(true);
    setNote(null);
    try {
      const docs = picked.map(docOf).filter((d): d is ProjectDoc => d !== null);
      // Site data per project (wind, depth, grid distance): the backend assessment of its polygon
      const reports = await Promise.all(
        docs.map((d) =>
          d.site.polygon ? postAssess(d.site.polygon, {}, undefined, d.site.gridNode).catch((): AssessResponse | null => null) : Promise.resolve(null),
        ),
      );
      if (reports.some((r, i) => r === null && docs[i].site.polygon))
        setNote("Site data unavailable for some projects (backend offline?) — they use the regional fallback climate.");
      setResults(docs.map((d, i) => projectMetrics(d, reports[i], price)));
    } finally {
      setRunning(false);
    }
  };

  const importFile = async (f: File) => {
    try {
      const doc = parseDoc(await f.text());
      addProject(doc);
      refresh();
      setNote(`Imported “${doc.name}”.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  };

  const act = (e: LibraryEntry, what: "open" | "rename" | "copy" | "delete") => {
    if (what === "open") {
      openProject(e.id);
      navigate("/develop/layout");
      return;
    }
    if (what === "rename") {
      const n = window.prompt("Project name", e.name);
      if (n != null) renameProject(e.id, n);
    } else if (what === "copy") duplicateProject(e.id);
    else if (window.confirm(`Delete “${e.name}” from this browser? Export it first to keep a file.${e.cloud ? " Its online copy stays reachable by its link." : ""}`)) {
      if (!deleteProject(e.id)) setNote("That project is open — switch to another one before deleting it.");
      setPicked((p) => p.filter((x) => x !== e.id));
    }
    refresh();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My projects"
        description={
          <>
            Your projects are kept in this browser (switching to the SB-510 reference files the open one here first). Export a project to keep
            it as a file or move it to another computer; a project saved online is also reachable by its link. Tick two to four projects to
            compare them.
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={13} className="mr-1" /> Import file
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Import a project file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importFile(f);
            e.target.value = "";
          }}
        />
        {note && (
          <span role="status" className="text-[12px] text-text-secondary">
            {note}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-primary">
        <table className="w-full min-w-[640px] text-left text-[12px]">
          <thead className="bg-bg-secondary text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="w-8 px-3 py-2" aria-label="Compare" />
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Layout</th>
              <th className="px-3 py-2">Saved</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary">
            <tr className="bg-bg-tertiary/40">
              <td className="px-3 py-2">
                <input type="checkbox" className="accent-accent" checked={picked.includes(REFERENCE)} onChange={() => toggle(REFERENCE)} aria-label="Compare SB-510" />
              </td>
              <td className="px-3 py-2 font-medium text-text-primary">SB-510 reference</td>
              <td className="px-3 py-2 text-text-secondary">34 × 15 MW · PZP_44</td>
              <td className="px-3 py-2 text-text-muted">read-only case study</td>
              <td className="px-3 py-2" />
            </tr>
            {projects.map((e) => (
              <tr key={e.id} className={cn(e.id === active && "bg-accent/5")}>
                <td className="px-3 py-2">
                  <input type="checkbox" className="accent-accent" checked={picked.includes(e.id)} onChange={() => toggle(e.id)} aria-label={`Compare ${e.name}`} />
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium text-text-primary">{e.name}</span>
                  {e.id === active && (
                    <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">{mode === "own" ? "open" : "last open"}</span>
                  )}
                  {e.cloud && <span className="ml-2 rounded bg-bg-tertiary px-1.5 py-0.5 text-xs text-text-muted">online</span>}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {e.doc.turbines.length} × 15 MW = {e.doc.turbines.length * 15} MW{e.doc.site.polygon ? "" : " · no site"}
                </td>
                <td className="px-3 py-2 text-text-muted">{date(e.savedAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => act(e, "open")}>
                      <FolderOpen size={13} className="mr-1" /> Open
                    </Button>
                    <Button size="icon" variant="ghost" title="Rename" aria-label={`Rename ${e.name}`} onClick={() => act(e, "rename")}>
                      <Pencil size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Duplicate" aria-label={`Duplicate ${e.name}`} onClick={() => act(e, "copy")}>
                      <Copy size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Export file" aria-label={`Export ${e.name}`} onClick={() => download(e.doc)}>
                      <Download size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" title="Delete" aria-label={`Delete ${e.name}`} onClick={() => act(e, "delete")}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-text-muted">
                  No own projects yet — choose “My project” in the project menu and draw a site.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border-primary bg-bg-secondary p-3">
        <label className="text-[12px] text-text-secondary">
          Electricity price
          <span className="mt-0.5 flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={500}
              step={5}
              value={price}
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 rounded border border-border-primary bg-bg-tertiary px-2 py-1 font-mono text-text-primary"
            />
            €/MWh
          </span>
        </label>
        <Button onClick={() => void compare()} disabled={picked.length < 2 || running}>
          <BarChart3 size={14} className="mr-1" /> {running ? "Comparing…" : picked.length ? `Compare ${picked.length} selected` : "Compare selected"}
        </Button>
        <p className="min-w-0 flex-1 text-xs text-text-muted">
          Same engines as the Layout page and the project report: screening wake model on each site&apos;s wind, NREL/ORBIT unit costs.
          Revenue at a flat price (no curtailment, degradation or tax); NPV of revenue − OPEX at each project&apos;s WACC and lifetime.
        </p>
      </div>

      {results && <CompareTable results={results} />}
    </div>
  );
}

function CompareTable({ results }: { results: ProjectMetrics[] }) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border-primary">
        <table className="w-full text-[12px]">
          <thead className="bg-bg-secondary">
            <tr>
              <th className="px-3 py-2 text-left text-xs uppercase tracking-wide text-text-muted">Metric</th>
              {results.map((m, i) => (
                <th key={i} className="px-3 py-2 text-right font-semibold text-text-primary">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary">
            {ROWS.map((r) => {
              const vals = results.map((m) => m[r.key]);
              const nums = vals.filter((v): v is number => typeof v === "number");
              const best = r.best && nums.length > 1 ? (r.best === "max" ? Math.max(...nums) : Math.min(...nums)) : null;
              return (
                <tr key={r.key}>
                  <td className="px-3 py-1.5 text-text-secondary">
                    {r.label} {r.unit && <span className="text-text-muted">[{r.unit}]</span>}
                  </td>
                  {vals.map((v, i) => (
                    <td
                      key={i}
                      className={cn("px-3 py-1.5 text-right font-mono tabular-nums", v === best ? "font-semibold text-status-normal" : "text-text-primary")}
                    >
                      {fmt(v, r)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td className="px-3 py-1.5 text-text-muted">Wind and depth from</td>
              {results.map((m, i) => (
                <td key={i} className="px-3 py-1.5 text-right text-xs text-text-muted">
                  {m.basis}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Bars title="Net energy [GWh/yr]" results={results} get={(m) => m.netGWh} />
        <Bars title="LCOE [€/MWh] — lower is better" results={results} get={(m) => m.lcoeEURperMWh ?? 0} />
        <Bars title="NPV [M€]" results={results} get={(m) => m.npvMEUR} />
      </div>
    </div>
  );
}

function Bars({ title, results, get }: { title: string; results: ProjectMetrics[]; get: (m: ProjectMetrics) => number }) {
  const max = Math.max(1, ...results.map((m) => Math.abs(get(m))));
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</div>
      <div className="space-y-1.5">
        {results.map((m, i) => {
          const v = get(m);
          return (
            <div key={i} className="text-xs">
              <div className="flex justify-between text-text-secondary">
                <span className="truncate">{m.name}</span>
                <span className="font-mono tabular-nums">{Math.round(v).toLocaleString("en-US")}</span>
              </div>
              <div className="h-2 rounded bg-bg-tertiary">
                <div className={cn("h-2 rounded", v < 0 ? "bg-status-alarm" : "bg-accent")} style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
