/**
 * Project report (route /report): the whole project on printable pages —
 * site checks and their sources, permit outlook, a mini map, energy
 * (screening + PyWake, per turbine, AEP history), PyWake-checked move
 * suggestions, the electrical design and its full-load load flow, cost and
 * LCOE, the construction campaign (P50 / P90) and the data sources.
 *
 * Own-project mode reports the learner's project (site, layout and lifecycle
 * stores); reference mode reports SB-510. All numbers come from
 * lib/project/report.ts buildReport(), which is also the JSON download.
 * Saved projects can also be downloaded as a windIO 2.x YAML plant file
 * (backend GET /api/v1/projects/{id}/windio.yaml) with the project document
 * as its `.offshoreforge.json` sidecar.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Download, FileCode2, Play, Printer } from "lucide-react";

import { OSS_GEO, TURBINE_POSITIONS } from "../constants/windFarmLayout";
import { DEFAULT_TURBINE_ID } from "../constants/turbineModels";
import { useFarmPlan } from "../hooks/useFarmPlan";
import { campaignRequest } from "../lib/lifecycle/farm";
import { DEFAULT_COSTS } from "../lib/layout/cost";
import { layoutContext, RATED_MW } from "../lib/layout/evaluate";
import { useSiteRasters } from "../hooks/useSiteRasters";
import type { LonLat } from "../lib/layout/geometry";
import { routeCables } from "../lib/layout/cables";
import { buildDoc } from "../lib/project/document";
import { farmKey } from "../lib/project/farmHeader";
import { buildReport, findMoves, type ProjectReport, type ReportInput } from "../lib/project/report";
import { cn } from "../lib/utils";
import { runLoadFlow } from "../services/gridApi";
import { aepHistory, windioUrl, type AepRun } from "../services/projectApi";
import { postAssess, type AssessResponse } from "../services/siteApi";
import { checkWakeMoves, getUncertainty, runCustomWakeAnalysis } from "../services/windResourceApi";
import type { UncertaintyResult } from "../types/windResource";
import { useGridStore } from "../store/gridStore";
import { limitList, requestSignature, useLifecycleStore } from "../store/lifecycleStore";
import { useModeStore } from "../store/modeStore";
import { signature, useProjectStore } from "../store/projectStore";
import { useProjectSync } from "../store/projectSync";
import { CASE_STUDY_GRID_NODE, CASE_STUDY_SITE, useSiteStore } from "../store/siteStore";
import type { LoadFlowResult } from "../types/grid";
import type { WakeAnalysisResult } from "../types/windResource";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/layout/PageHeader";

const SB510_TURBINES = TURBINE_POSITIONS.map((t) => ({ id: t.id, lon: t.lon, lat: t.lat }));
const SB510_OSS: LonLat = [OSS_GEO.lon, OSS_GEO.lat];

function save(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "project";
const fmt = (v: number | null | undefined, d = 0, unit = "") => (v == null ? "—" : `${v.toLocaleString("en-GB", { minimumFractionDigits: d, maximumFractionDigits: d })}${unit ? ` ${unit}` : ""}`);

const STATUS_STYLE: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-800",
  ok: "bg-emerald-100 text-emerald-800",
  info: "bg-sky-100 text-sky-800",
  warn: "bg-amber-100 text-amber-800",
  close: "bg-amber-100 text-amber-800",
  unknown: "bg-slate-200 text-slate-700",
  fail: "bg-red-100 text-red-800",
  outside: "bg-red-100 text-red-800",
  excluded: "bg-red-100 text-red-800",
  basin: "bg-red-100 text-red-800",
};
const Chip = ({ s }: { s: string }) => (
  <span className={cn("inline-block rounded px-1.5 py-px font-sans text-xs font-semibold uppercase", STATUS_STYLE[s] ?? STATUS_STYLE.unknown)}>{s}</span>
);

function Section({ n, title, children, action }: { n: number; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-300 pb-1">
        <h2 className="font-sans text-[14px] font-bold text-slate-900">
          {n}. {title}
        </h2>
        {action && <div className="font-sans print:hidden">{action}</div>}
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

/** Two-column facts list. */
const Facts = ({ rows }: { rows: [string, ReactNode][] }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
    {rows.map(([k, v]) => (
      <div key={k} className="flex justify-between gap-3 border-b border-dotted border-slate-200 py-0.5">
        <dt className="text-slate-600">{k}</dt>
        <dd className="text-right tabular-nums text-slate-900">{v}</dd>
      </div>
    ))}
  </dl>
);

function Table({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse font-sans text-xs">
        <thead>
          <tr className="border-b border-slate-400 text-left text-slate-600">
            {head.map((h, k) => (
              <th key={h} className={cn("px-1.5 py-1 font-semibold", right.includes(k) && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j} className="border-b border-slate-200 align-top">
              {r.map((c, k) => (
                <td key={k} className={cn("px-1.5 py-0.5 text-slate-900", right.includes(k) && "text-right tabular-nums")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-[12px] italic text-slate-500">{children}</p>;

/** Mini map: site, array cables, turbines by status, OSS; north up, scale bar. */
function MiniMap({ input }: { input: ReportInput }) {
  const { ctx, xy, oss, edges } = useMemo(() => {
    const c = layoutContext(input.site, input.layers);
    const t = input.turbines.map((p) => c.proj.toXY([p.lon, p.lat]));
    const o = input.oss ? c.proj.toXY(input.oss) : null;
    const tree = o && t.length ? routeCables(o, t, RATED_MW) : null;
    return { ctx: c, xy: t, oss: o, edges: tree?.edges ?? [] };
  }, [input.site, input.layers, input.turbines, input.oss]);
  const pts = [...ctx.siteXY, ...xy, ...(oss ? [oss] : [])];
  const x0 = Math.min(...pts.map((p) => p.x));
  const x1 = Math.max(...pts.map((p) => p.x));
  const y0 = Math.min(...pts.map((p) => p.y));
  const y1 = Math.max(...pts.map((p) => p.y));
  const pad = 0.1 * Math.max(x1 - x0, y1 - y0, 1000);
  const W = x1 - x0 + 2 * pad;
  const H = y1 - y0 + 2 * pad;
  const X = (x: number) => x - x0 + pad;
  const Y = (y: number) => y1 - y + pad; // north up
  const u = Math.max(W, H) / 400; // ≈ 1 px at 400 px width
  const barKm = W > 20_000 ? 5 : W > 8_000 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block max-h-[340px] w-full" role="img" aria-label="Mini map of the site, turbines, array cables and offshore substation">
      <polygon points={ctx.siteXY.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} fill="rgba(14,116,144,0.08)" stroke="#0e7490" strokeWidth={1.5 * u} strokeDasharray={`${6 * u} ${3 * u}`} />
      {oss &&
        edges.map((e, k) => {
          const a = xy[e.from];
          const b = e.to < 0 ? oss : xy[e.to];
          return <line key={k} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke={e.section ? "#64748b" : "#dc2626"} strokeWidth={1.2 * u} />;
        })}
      {xy.map((p, k) => (
        <circle key={input.turbines[k].id} cx={X(p.x)} cy={Y(p.y)} r={3.2 * u} fill="#0f172a" />
      ))}
      {oss && <rect x={X(oss.x) - 5 * u} y={Y(oss.y) - 5 * u} width={10 * u} height={10 * u} fill="#f59e0b" stroke="#0f172a" strokeWidth={u} />}
      <g transform={`translate(${12 * u} ${H - 12 * u})`} fontFamily="Arial, sans-serif" fontSize={10 * u} fill="#334155">
        <line x1={0} y1={0} x2={barKm * 1000} y2={0} stroke="#334155" strokeWidth={2 * u} />
        <text x={0} y={-4 * u}>{barKm} km</text>
      </g>
      <g transform={`translate(${W - 16 * u} ${20 * u})`} fontFamily="Arial, sans-serif" fontSize={10 * u} fill="#334155" textAnchor="middle">
        <path d={`M0 ${-12 * u} L${4 * u} 0 L${-4 * u} 0 Z`} fill="#334155" />
        <text y={11 * u}>N</text>
      </g>
    </svg>
  );
}

export default function ReportPage() {
  const reference = useModeStore((s) => s.mode !== "own");
  const ownSite = useSiteStore((s) => s.site);
  const ownReport = useSiteStore((s) => s.report);
  const layers = useSiteStore((s) => s.layers);
  const loadLayers = useSiteStore((s) => s.loadLayers);
  const assess = useSiteStore((s) => s.assess);
  const p = useProjectStore();
  const { id: syncId, name: syncName, flush } = useProjectSync();
  const farm = useFarmPlan();
  const lifecycle = useLifecycleStore();
  const networkSpec = useGridStore((s) => s.networkSpec);
  const fetchNetworkSpec = useGridStore((s) => s.fetchNetworkSpec);
  const storeLf = useGridStore((s) => (s.farmFor === farmKey() ? (s.loadFlowResults?.find((r) => r.scenario === "full_load") ?? null) : null));

  const site = reference ? CASE_STUDY_SITE : (ownSite ?? CASE_STUDY_SITE);
  const turbines = reference ? SB510_TURBINES : p.turbines;
  const oss = reference ? SB510_OSS : p.oss;
  const costs = reference ? DEFAULT_COSTS : p.costs;
  const sig = signature(turbines);

  // SB-510's assessment is fetched here; an own site's comes from Site & Permits (siteStore).
  const [refReport, setRefReport] = useState<AssessResponse | null>(null);
  const [refPyWake, setRefPyWake] = useState<WakeAnalysisResult | null>(null);
  const assessment = reference ? refReport : ownReport;
  useEffect(() => {
    void loadLayers();
    void fetchNetworkSpec();
    if (reference) postAssess(CASE_STUDY_SITE, {}, undefined, CASE_STUDY_GRID_NODE).then(setRefReport, () => setRefReport(null));
    else if (useSiteStore.getState().site && !useSiteStore.getState().report) void assess();
  }, [reference, loadLayers, fetchNetworkSpec, assess]);

  const { depthAt, seabedAt } = useSiteRasters(site, layers?.seabed_classes);

  const [history, setHistory] = useState<AepRun[]>([]);
  const loadHistory = () => {
    if (!reference && syncId) aepHistory(syncId).then(setHistory, () => setHistory([]));
    else setHistory([]);
  };
  useEffect(loadHistory, [reference, syncId]); // once per project

  const [moves, setMoves] = useState<ReportInput["moves"]>(null);
  const [lf, setLf] = useState<LoadFlowResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setMoves(null);
    setLf(null);
  }, [sig, reference]);

  const pywake = reference ? refPyWake : p.pywake && p.pywakeFor === sig ? p.pywake : null;
  const loadFlow = lf ?? storeLf;
  const build = lifecycle.build;
  const req = campaignRequest(farm, { mode: "install", start_date: build.start, alpha: build.alpha, runs: build.runs, limits: limitList(build.limits) });
  const construction = lifecycle.results.build && lifecycle.resultFor.build === requestSignature(req) ? lifecycle.results.build : null;
  const name = reference ? "SB-510 (reference case study)" : syncName;

  const [unc, setUnc] = useState<UncertaintyResult | null>(null);
  const input: ReportInput = {
    name,
    reference,
    generated: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC",
    turbineModel: DEFAULT_TURBINE_ID,
    site,
    turbines,
    oss,
    costs,
    exportKm: farm.exportKm,
    assessment,
    layers,
    depthAt,
    seabedAt,
    pywake,
    uncertainty: unc,
    external: !reference && p.external && p.externalFor === sig ? { lossPct: p.external.lossPct, farms: p.external.farms.length, turbines: p.external.turbines } : null,
    history,
    moves,
    network: networkSpec,
    loadFlow,
    construction,
  };
  const rep: ProjectReport = buildReport(input);
  const wind = assessment?.wind && !assessment.wind.approximate ? assessment.wind : null;

  // AEP uncertainty of this farm: its wind, wake loss and turbine (P75 / P90 of the net energy).
  const wakePct = (rep.energy.pywake ?? rep.energy.screening)?.wake_loss_pct ?? null;
  const uncKey = `${rep.wind.weibull_a_ms}|${rep.wind.weibull_k}|${wakePct}`;
  useEffect(() => {
    if (wakePct == null) return setUnc(null);
    let live = true;
    getUncertainty({ weibull_a: rep.wind.weibull_a_ms, weibull_k: rep.wind.weibull_k, wake_loss_percent: wakePct, turbine_model: DEFAULT_TURBINE_ID }).then(
      (u) => live && setUnc(u),
      () => live && setUnc(null),
    );
    return () => {
      live = false;
    };
  }, [uncKey]); // the key holds the inputs

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const runPyWake = () =>
    act("pywake", async () => {
      const ctx = layoutContext(site, layers);
      const w = wind ? { weibullA: wind.weibull_a, weibullK: wind.weibull_k, sectorFrequencies: wind.sector_frequencies } : undefined;
      if (reference) {
        const xy = turbines.map((t) => ctx.proj.toXY([t.lon, t.lat]));
        setRefPyWake(
          await runCustomWakeAnalysis(
            xy.map((q) => q.x),
            xy.map((q) => q.y),
            w?.weibullA,
            w?.weibullK,
            0.06,
            DEFAULT_TURBINE_ID,
            w?.sectorFrequencies ?? null,
          ),
        );
      } else {
        await p.runPyWake(ctx.proj.toXY, w, syncId ? useProjectSync.getState().runAep : undefined);
        loadHistory();
      }
    });
  const runMoves = () => act("moves", async () => setMoves(await findMoves(input, checkWakeMoves)));
  const runLf = () => act("lf", async () => setLf(await runLoadFlow("full_load")));
  const runBuild = () => act("build", () => lifecycle.run("build", req));

  const [printing, setPrinting] = useState(false);
  const print = () => {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  };
  const downloadWindio = () =>
    act("windio", async () => {
      if (!syncId) return;
      await flush(); // the YAML is written from the saved copy
      const r = await fetch(windioUrl(syncId));
      if (!r.ok) throw new Error(`windIO export failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
      save(`${slug(name)}.windio.yaml`, await r.text(), "application/yaml");
      save(`${slug(name)}.offshoreforge.json`, JSON.stringify(buildDoc(name), null, 2), "application/json");
    });

  const runButton = (key: string, label: string, onClick: () => void, disabled = false) => (
    <Button size="sm" variant="secondary" onClick={onClick} disabled={disabled || busy !== null}>
      <Play size={12} className="mr-1" /> {busy === key ? "Running…" : label}
    </Button>
  );

  const e = rep.energy;
  const el = rep.electrical;
  const fl = el?.full_load;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Project report"
        description={
          <>
            {reference ? "The SB-510 reference farm" : "Your project"} on printable pages: site, permit outlook, energy, electrical design, cost and
            construction, each with its source. Print it to PDF, download the numbers as JSON
            {reference ? "" : ", or the layout as a windIO file for other wind-farm tools"}.
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => save(`${slug(name)}.report.json`, JSON.stringify(rep, null, 2), "application/json")}>
              <Download size={13} className="mr-1" /> JSON
            </Button>
            {!reference && (
              <Button
                size="sm"
                variant="secondary"
                onClick={downloadWindio}
                disabled={!syncId || !turbines.length || busy !== null}
                title={syncId ? "windIO 2.x YAML + the project document (.offshoreforge.json)" : "Save the project online first (project menu)"}
              >
                <FileCode2 size={13} className="mr-1" /> {busy === "windio" ? "Exporting…" : "windIO"}
              </Button>
            )}
            <Button size="sm" onClick={print}>
              <Printer size={13} className="mr-1" /> Print / PDF
            </Button>
          </>
        }
      />
      {!reference && !syncId && (
        <p className="text-[12px] text-text-muted">windIO export works on saved projects: use “Save online” in the project menu first.</p>
      )}
      {err && (
        <p role="alert" className="text-[12px] text-status-alarm">
          {err}
        </p>
      )}

      <div className="print-doc mx-auto max-w-4xl" data-printing={printing ? "" : undefined}>
        <article className="rounded-md border border-slate-300 bg-white p-4 font-serif text-[13px] leading-relaxed text-slate-900 shadow-md sm:p-8">
          <header className="border-b-2 border-slate-800 pb-2">
            <p className="font-sans text-xs uppercase tracking-widest text-slate-500">OffshoreForge · project report · training</p>
            <h1 className="font-sans text-[20px] font-bold leading-tight">{name}</h1>
            <p className="text-[12px] text-slate-600">
              {rep.layout.turbines} × {rep.layout.turbine_model} = {fmt(rep.layout.capacity_mw)} MW · generated {rep.generated}
              {!reference && syncId ? ` · project ${syncId.slice(0, 8)}` : ""}
            </p>
          </header>
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 font-sans text-xs text-amber-900">{rep.note}</p>

          <Section n={1} title="Site and screening checks">
            {rep.site ? (
              <>
                <Facts
                  rows={[
                    ["Area", fmt(rep.site.area_km2, 1, "km²")],
                    ["Water depth", rep.site.depth_m ? `${rep.site.depth_m[0].toFixed(0)}–${rep.site.depth_m[1].toFixed(0)} m` : "—"],
                    ["Foundation (by depth)", rep.site.foundation ?? "—"],
                    ["Distance to shore", rep.site.shore_km ? `${rep.site.shore_km[0].toFixed(1)}–${rep.site.shore_km[1].toFixed(1)} km` : "—"],
                    ["Grid node", rep.site.grid_node ? `${rep.site.grid_node} (${fmt(rep.site.grid_km, 1, "km")} straight)` : "—"],
                    ["Energy basins (MSP)", rep.site.energy_basins.join(", ") || "none"],
                  ]}
                />
                <Table
                  head={["Check", "Result", "Finding", "Reference"]}
                  rows={rep.site.checks.map((c) => [c.title, <Chip key="s" s={c.status} />, c.detail, <span key="r" className="text-slate-500">{c.reference}</span>])}
                />
              </>
            ) : (
              <Muted>{reference ? "Assessing the SB-510 site…" : <>No site assessment yet — draw a site in <Link to="/develop" className="underline">Site &amp; Permits</Link>.</>}</Muted>
            )}
          </Section>

          <Section n={2} title="Permit outlook (simulation)">
            <p>
              <strong>{rep.permit.label}.</strong>{" "}
              {rep.permit.outcome === "refused" || rep.permit.outcome === "more_information" ? rep.permit.reasons.join(" ") : ""}
            </p>
            {rep.permit.conditions.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-[12px]">
                {rep.permit.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section n={3} title="Layout">
            {turbines.length ? <MiniMap input={input} /> : <Muted>No turbines placed yet.</Muted>}
            <p className="text-center font-sans text-xs text-slate-500">Dashed: site · dots: turbines · square: offshore substation · lines: array cables (red = over the largest section)</p>
            <Facts
              rows={[
                ["Turbines", `${rep.layout.turbines} × 15 MW = ${fmt(rep.layout.capacity_mw)} MW`],
                ["Power density", fmt(rep.layout.power_density_mw_km2, 2, "MW/km²")],
                ["Closest pair", fmt(rep.layout.min_spacing_d, 1, "D")],
                ["Layout problems", Object.entries(rep.layout.problems).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ") || "none"],
                ["Array cables (66 kV, layout routing)", rep.layout.array_cable_km != null ? `${fmt(rep.layout.array_cable_km, 1, "km")}, ${rep.layout.strings} strings` : "place the OSS"],
                ["Export route (model)", fmt(rep.layout.export_km, 1, "km")],
              ]}
            />
          </Section>

          <Section n={4} title="Energy yield" action={runButton("pywake", pywake ? "Re-run PyWake" : "Run PyWake", runPyWake, !turbines.length)}>
            <Facts
              rows={[
                ["Wind at hub height", `${fmt(rep.wind.mean_ms, 2, "m/s")} (A ${rep.wind.weibull_a_ms} m/s, k ${rep.wind.weibull_k}, ${rep.wind.height_m} m)`],
                ["Screening model", e.screening ? `${fmt(e.screening.net_wake_gwh, 0, "GWh/yr")}, wake ${fmt(e.screening.wake_loss_pct, 1, "%")}` : "—"],
                ["PyWake (Niayifar Gaussian, STF2017)", e.pywake ? `${fmt(e.pywake.net_wake_gwh, 0, "GWh/yr")}, wake ${fmt(e.pywake.wake_loss_pct, 1, "%")}` : "not run for this layout"],
                ["Gross (no wakes)", fmt((e.pywake ?? e.screening)?.gross_gwh, 0, "GWh/yr")],
                ["Capacity factor (wake only)", fmt(100 * ((e.pywake ?? e.screening)?.capacity_factor ?? 0), 1, "%")],
                [
                  "External wake loss (neighbouring farms)",
                  e.external_wake
                    ? `${fmt(e.external_wake.loss_pct, 1, "%")} from ${e.external_wake.farms} farms (TurbOPark, approximate layouts)`
                    : "not estimated — Layout, “Estimate external loss”",
                ],
                [`Net after ${e.other_losses_pct} % other losses (${e.basis})`, fmt(e.net_gwh, 0, "GWh/yr")],
                [
                  "P50 / P75 / P90",
                  e.uncertainty
                    ? `${fmt(e.uncertainty.p50_gwh, 0)} / ${fmt(e.uncertainty.p75_gwh, 0)} / ${fmt(e.uncertainty.p90_gwh, 0)} GWh/yr (σ ${fmt(e.uncertainty.combined_pct, 1, "%")})`
                    : "—",
                ],
              ]}
            />
            <p className="text-xs text-slate-500">Wind: {rep.wind.source}.</p>
            {e.uncertainty && (
              <p className="text-xs text-slate-500">
                Uncertainty (1σ of AEP, root-sum-square):{" "}
                {e.uncertainty.components.map((c) => `${c.name} ${c.sigma_pct.toFixed(1)} % (${c.source})`).join("; ")}. P_xx = P50 · (1 − z·σ), z = 0.674 / 1.282.
              </p>
            )}
            {e.turbines.length > 0 && (
              <Table
                head={["Turbine", "Lon", "Lat", "Depth m", "Foundation", "Seabed", "Status", "Wake loss %", `Net GWh/yr (${e.pywake ? "PyWake" : "screening"})`]}
                right={[1, 2, 3, 7, 8]}
                rows={e.turbines.map((t) => [t.id, t.lon.toFixed(4), t.lat.toFixed(4), fmt(t.depth_m), t.foundation ?? "—", t.seabed ?? "—", <Chip key="s" s={t.status} />, fmt(t.wake_loss_pct, 1), fmt(t.net_gwh, 1)])}
              />
            )}
            <h3 className="pt-2 font-sans text-[12px] font-semibold">AEP revision history (stored PyWake runs)</h3>
            {e.history.length ? (
              <Table
                head={["Revision", "Date", "Net GWh/yr", "Wake loss %", "P50 GWh/yr", "P90 GWh/yr"]}
                right={[2, 3, 4, 5]}
                rows={e.history.map((h) => [h.revision ?? "—", h.date.slice(0, 16).replace("T", " "), fmt(h.net_wake_gwh), fmt(h.wake_loss_pct, 2), fmt(h.p50_gwh), fmt(h.p90_gwh)])}
              />
            ) : (
              <Muted>{reference ? "Kept for saved own projects." : syncId ? "No stored runs yet — run PyWake." : "Save the project online to keep a history of PyWake runs."}</Muted>
            )}
            <p className="text-xs text-slate-500">P50 / P90 after the P1 loss cascade (electrical 2 %, availability 5 %, environmental 1 %; no blockage in a stored run) and the uncertainty components of the farm (as above).</p>
          </Section>

          <Section n={5} title="Suggested turbine moves (PyWake-checked)" action={runButton("moves", "Find moves", runMoves, turbines.length < 2)}>
            {rep.moves == null ? (
              <Muted>Not searched. The screening model ranks single moves of the most waked turbines; PyWake checks the best five.</Muted>
            ) : rep.moves.length ? (
              <>
                <Table
                  head={["Turbine", "Move", "Screening %", "PyWake %", "PyWake", "Screening ΔLCOE €/MWh"]}
                  right={[2, 3, 5]}
                  rows={rep.moves.map((m) => [
                    m.turbine,
                    `${m.distance_m} m at ${m.bearing_deg}°`,
                    fmt(m.screening_gain_pct, 3),
                    fmt(m.pywake_gain_pct, 3),
                    m.confirmed == null ? "—" : m.confirmed ? "confirmed" : "not confirmed",
                    fmt(m.lcoe_change_eur_mwh, 2),
                  ])}
                />
                {rep.moves.every((m) => !m.confirmed) && (
                  <p className="text-xs text-slate-500">PyWake confirms none: single moves are worth tenths of a percent, below the screening model's accuracy.</p>
                )}
              </>
            ) : (
              <Muted>No allowed move improves the screening yield.</Muted>
            )}
          </Section>

          <Section n={6} title="Electrical design and load flow" action={runButton("lf", "Run load flow", runLf)}>
            {el ? (
              <>
                <Facts
                  rows={[
                    ["Strings (turbines each)", el.strings.join("-")],
                    ["Voltages", `${el.array_kv} / ${el.export_kv} / ${el.grid_kv} kV`],
                    ["Export", `${el.export_circuits} circuit(s) × ${fmt(el.export_km, 1, "km")}`],
                    ["Cable charging Q = ωCV²L", fmt(el.cable_charging_mvar, 0, "MVAr")],
                    ["Offshore transformers", el.oss_transformers],
                    ["Onshore transformers", el.onshore_transformers],
                    ["Shunt reactors", el.reactors],
                    ["STATCOM", `±${el.statcom_mvar} MVAr`],
                  ]}
                />
                {fl ? (
                  <Facts
                    rows={[
                      ["Full load: voltages", <span key="v">{`${fl.v_min_pu.toFixed(3)}–${fl.v_max_pu.toFixed(3)} p.u.`} <Chip s={fl.voltage_ok ? "pass" : "fail"} /></span>],
                      ["Highest loading (line / transformer)", `${fmt(fl.max_line_loading_pct, 0)} % / ${fmt(fl.max_transformer_loading_pct, 0)} %`],
                      ["Delivered at the POC", `${fmt(fl.poc_p_mw, 1, "MW")}, ${fmt(fl.poc_q_mvar, 1, "MVAr")}`],
                      ["Losses", fmt(fl.losses_mw, 2, "MW")],
                      ["STATCOM output", fmt(fl.statcom_q_mvar, 1, "MVAr")],
                    ]}
                  />
                ) : (
                  <Muted>Full-load load flow not run yet (pandapower, 0.95–1.05 p.u. band).</Muted>
                )}
                <p className="text-xs text-slate-500">
                  Design rules: backend network_model.design(); load flow with pandapower, reactors switched as an operator would. The
                  string plan here is the electrical design&apos;s; the layout section shows the Layout page&apos;s cable routing.
                </p>
              </>
            ) : (
              <Muted>Loading the electrical design…</Muted>
            )}
          </Section>

          <Section n={7} title="Cost and LCOE">
            <Table
              head={["Item", "M€"]}
              right={[1]}
              rows={[...rep.cost.lines_meur.map((l) => [l.item, fmt(l.meur)]), [<strong key="c">CAPEX</strong>, <strong key="v">{`${fmt(rep.cost.capex_meur)} (${rep.cost.capex_meur_per_mw.toFixed(2)} M€/MW)`}</strong>]]}
            />
            <Facts
              rows={[
                ["OPEX", fmt(rep.cost.opex_meur_yr, 1, "M€/yr")],
                ["WACC, lifetime", `${rep.cost.wacc_pct} %, ${rep.cost.lifetime_years} years`],
                ["LCOE = (CAPEX·CRF + OPEX) / AEP", fmt(rep.cost.lcoe_eur_mwh, 0, "€/MWh")],
              ]}
            />
            <p className="text-xs text-slate-500">Source: {rep.cost.source}. Energy basis: {e.basis}.</p>
          </Section>

          <Section n={8} title="Construction campaign" action={runButton("build", "Simulate", runBuild)}>
            {rep.construction ? (
              <>
                <Facts
                  rows={[
                    ["Start", rep.construction.start],
                    ["Duration P50 / P90", `${fmt(rep.construction.total_days.p50)} / ${fmt(rep.construction.total_days.p90)} days`],
                    ["Vessel cost P50 / P90", `${fmt(rep.construction.cost_meur.p50)} / ${fmt(rep.construction.cost_meur.p90)} M€`],
                    ["Weather years simulated", rep.construction.weather_years],
                  ]}
                />
                <Table head={["Milestone", "P50", "P90"]} rows={rep.construction.milestones.map((m) => [m.label, m.date_p50, m.date_p90])} />
              </>
            ) : (
              <Muted>
                Not simulated for these inputs — run it here or on the <Link to="/build" className="underline">Construction</Link> page.
              </Muted>
            )}
          </Section>

          <Section n={9} title="Data sources and provenance">
            <Table head={["Data", "Source", "Licence", "Retrieved"]} rows={rep.sources.map((s) => [s.data, s.source, s.license, s.retrieved || "—"])} />
            <p className="text-[12px]">
              Models: wake screening and cable routing in the browser (lib/layout), PyWake for the reference AEP, pandapower for the load flow,
              Monte Carlo weather years for the campaign. Unit costs are illustrative. <strong>{rep.note}</strong>
            </p>
          </Section>
        </article>
      </div>
    </div>
  );
}
