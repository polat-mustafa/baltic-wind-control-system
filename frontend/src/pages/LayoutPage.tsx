/**
 * Layout canvas (route /develop/layout): place turbines inside the site from
 * Site & Permits, see wake losses and the array cable tree update as they
 * move (live while dragging), check the layout, get move suggestions, run
 * PyWake for the reference AEP and estimate the cost.
 *
 * Engines: lib/layout (geometry, cables, energy, evaluate, suggest, cost).
 * Backend: POST /api/v1/wind/wake-analysis-custom and /wake-moves,
 * GET /api/v1/site/raster (bathymetry → depth per turbine).
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Grid3x3, MapPinned, MousePointerClick, Play, RotateCcw, Trash2, Wind } from "lucide-react";

import { cn } from "../lib/utils";
import { routeCables, maxPerString } from "../lib/layout/cables";
import { COST_DEFAULTS, layoutCost, type CostInputs } from "../lib/layout/cost";
import { prepareYield, UNIFORM_ROSE, yieldOf, type WindRose } from "../lib/layout/energy";
import { weibullMean } from "../utils/aepMath";
import {
  D,
  defaultExportKm,
  blockedBy,
  foundationFor,
  layoutContext,
  MIN_SPACING_D,
  OTHER_LOSSES,
  RATED_MW,
  foundationFactor,
  statusAt,
  turbineStats,
  WEIBULL_A,
  WEIBULL_K,
} from "../lib/layout/evaluate";
import { centroid, gridFill, minSpacing, polygonArea, type LonLat, type XY } from "../lib/layout/geometry";
import { suggestMoves } from "../lib/layout/suggest";
import { useSiteRasters } from "../hooks/useSiteRasters";
import { checkWakeMoves, computeWindRose } from "../services/windResourceApi";
import { MAX_TURBINES, signature, useProjectStore } from "../store/projectStore";
import { CASE_STUDY_SITE, useSiteStore } from "../store/siteStore";
import { useProjectSync } from "../store/projectSync";
import { Button } from "../components/ui/Button";
import { InfoTile } from "../components/ui/InfoTile";
import { Skeleton } from "../components/ui/Skeleton";
import { InfoButton } from "../components/ui/InfoButton";
import { SourceBadge } from "../components/ui/SourceBadge";
import { WatchOut } from "../components/site/Stages";
import type { TurbineView } from "../components/layout-canvas/shared";
import TurbineCard from "../components/layout-canvas/TurbineCard";
import LayoutChecklist from "../components/layout-canvas/LayoutChecklist";
import MoveSuggestions from "../components/layout-canvas/MoveSuggestions";
import { layoutCostInfo, layoutGridToolInfo, layoutPyWakeInfo, layoutResultsInfo } from "../constants/panelInfo";

const LayoutMap = lazy(() => import("../components/layout-canvas/LayoutMap"));

function GridTool({ onFill }: { onFill: (o: { along: number; across: number; angle: number; staggered: boolean; avoid: boolean }) => void }) {
  const [along, setAlong] = useState(6);
  const [across, setAcross] = useState(8);
  const [angle, setAngle] = useState(0);
  const [staggered, setStaggered] = useState(false);
  const [avoid, setAvoid] = useState(true);
  const num = (v: number, set: (n: number) => void, min: number, max: number, step = 0.5) => (
    <input
      type="number"
      value={v}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) set(Math.min(max, Math.max(min, n)));
      }}
      className="w-16 rounded border border-border-primary bg-bg-tertiary px-1.5 py-0.5 text-right text-[12px]"
    />
  );
  return (
    <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="layout-grid">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Fill the site with a grid</h3>
        <InfoButton info={layoutGridToolInfo} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-text-primary">
        <label className="flex items-center justify-between gap-2">Along rows {num(along, setAlong, 3, 15)} D</label>
        <label className="flex items-center justify-between gap-2">Between rows {num(across, setAcross, 3, 15)} D</label>
        <label className="flex items-center justify-between gap-2">Row bearing {num(angle, setAngle, 0, 179, 5)}°</label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="accent-accent" checked={staggered} onChange={(e) => setStaggered(e.target.checked)} /> Staggered
        </label>
        <label className="col-span-2 flex items-center gap-2">
          <input type="checkbox" className="accent-accent" checked={avoid} onChange={(e) => setAvoid(e.target.checked)} /> Skip
          Natura 2000, shipping, military and other wind farm areas
        </label>
      </div>
      <Button size="sm" onClick={() => onFill({ along, across, angle, staggered, avoid })}>
        <Grid3x3 size={13} className="mr-1" /> Fill site
      </Button>
      <p className="text-[10px] text-text-muted">
        Put the wider spacing along the prevailing wind (here from the west–southwest): wakes are longest downwind.
      </p>
    </div>
  );
}

function CostPanel({ costs, setCost, reset }: { costs: CostInputs; setCost: (k: keyof CostInputs, v: number) => void; reset: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border-primary bg-bg-secondary">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary"
      >
        Cost inputs (sourced, € 2023) <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border-primary p-3">
          {(Object.keys(COST_DEFAULTS) as (keyof CostInputs)[]).map((k) => (
            <div key={k} className="flex items-start justify-between gap-2 text-[12px] text-text-primary">
              <span>
                <label htmlFor={`cost-${k}`}>
                  {COST_DEFAULTS[k].label} <span className="text-text-muted">[{COST_DEFAULTS[k].unit}]</span>
                </label>{" "}
                <SourceBadge p={COST_DEFAULTS[k]} />
              </span>
              <input
                id={`cost-${k}`}
                type="number"
                min={0}
                step="any"
                value={costs[k]}
                onChange={(e) => setCost(k, Number(e.target.value))}
                className="w-20 shrink-0 rounded border border-border-primary bg-bg-tertiary px-1.5 py-0.5 text-right text-[12px]"
              />
            </div>
          ))}
          <p className="text-[10px] text-text-muted">
            Defaults: NREL Cost of Wind Energy Review 2024 (U.S. fixed-bottom reference) and the ORBIT cable library, 2023 USD at
            1.0813 $/€. Tap a badge for the source. Replace them with your own quotes.
          </p>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset to defaults
          </Button>
        </div>
      )}
    </div>
  );
}

export default function LayoutPage() {
  const siteDrawn = useSiteStore((s) => s.site);
  const report = useSiteStore((s) => s.report);
  const loadLayers = useSiteStore((s) => s.loadLayers);
  const assess = useSiteStore((s) => s.assess);
  const layers = useSiteStore((s) => s.layers);
  const syncId = useProjectSync((s) => s.id);

  const p = useProjectStore();
  const [rose, setRose] = useState<WindRose>(UNIFORM_ROSE);
  const [roseReal, setRoseReal] = useState(false);
  const [wakeOn, setWakeOn] = useState(false);
  const [wakeFrom, setWakeFrom] = useState(255);
  const [exportKm, setExportKm] = useState<number | null>(null);
  const [fillNote, setFillNote] = useState<string | null>(null);

  const site = siteDrawn ?? CASE_STUDY_SITE;
  useEffect(() => {
    void loadLayers();
    if (useSiteStore.getState().site && !useSiteStore.getState().report) void assess();
  }, [loadLayers, assess]);
  useEffect(() => {
    let live = true;
    computeWindRose(WEIBULL_A, WEIBULL_K, 87_600, 12)
      .then((r) => {
        if (live) {
          setRose({ directions: r.sector_centres_deg, frequencies: r.frequencies });
          setRoseReal(true);
        }
      })
      .catch(() => undefined); // uniform rose stays; the panel says so
    return () => {
      live = false;
    };
  }, []);

  const ctx = useMemo(() => layoutContext(site, layers), [site, layers]);
  const { proj, siteXY } = ctx;
  const areaKm2 = polygonArea(siteXY) / 1e6;
  const excludedBy = (pt: LonLat) => blockedBy(pt, ctx.rings, ctx.energy);

  // Water depth and seabed sediment at each turbine (EMODnet bathymetry and Geology, region pack).
  const { depthAt, seabedAt } = useSiteRasters(site, layers?.seabed_classes);
  const siteKey = site.map((q) => q.join(",")).join(";");

  const sig = signature(p.turbines);
  const xy = useMemo(() => p.turbines.map((t) => proj.toXY([t.lon, t.lat])), [p.turbines, proj]);
  // Site wind climate from the assessment (NEWA + ERA5); the regional approximation otherwise.
  const siteWind = report?.wind && !report.wind.approximate ? report.wind : null;
  const windA = siteWind?.weibull_a ?? WEIBULL_A;
  const windK = siteWind?.weibull_k ?? WEIBULL_K;
  const siteRose = useMemo<WindRose | null>(
    () =>
      siteWind?.sector_frequencies
        ? { directions: siteWind.sector_frequencies.map((_, i) => i * 30), frequencies: siteWind.sector_frequencies }
        : null,
    [siteWind],
  );
  const activeRose = siteRose ?? rose;
  // Live screening yield, prepared once per committed layout; a drag only costs moveDelta() per frame.
  const yieldModel = useMemo(() => (xy.length ? prepareYield(xy, windA, windK, activeRose) : null), [xy, windA, windK, activeRose]);
  const yieldRes = useMemo(() => (yieldModel ? yieldOf(yieldModel) : null), [yieldModel]);
  const oss = p.oss;
  const cables = useMemo(() => (oss && xy.length ? routeCables(proj.toXY(oss), xy, RATED_MW) : null), [xy, oss, proj]);
  const spacing = minSpacing(xy);
  const ids = useMemo(() => p.turbines.map((t) => t.id), [p.turbines]);

  const views: TurbineView[] = p.turbines.map((t, i) => {
    const st = statusAt(ctx, [t.lon, t.lat], xy.filter((_, j) => j !== i));
    const loss = yieldRes?.perTurbineLossPct[i];
    const lossNote = loss != null ? `wake loss ${loss.toFixed(1)} %` : "";
    return { ...t, status: st.status, note: [st.note, st.status === "ok" || st.status === "close" ? lossNote : ""].filter(Boolean).join(" · ") };
  });
  const count = (k: TurbineView["status"]) => views.filter((v) => v.status === k).length;
  const problems = { outside: count("outside"), excluded: count("excluded"), basin: count("basin"), close: count("close") };
  const depths = p.turbines.map((t) => depthAt([t.lon, t.lat]));
  const foundations = depths.map((dm) => foundationFor(dm, layers?.depth_bands));

  const stats = useCallback(
    (id: string, at: LonLat | null) => {
      const i = ids.indexOf(id);
      return yieldModel && i >= 0 ? turbineStats(ctx, yieldModel, ids, i, at, depthAt, layers?.depth_bands, seabedAt) : null;
    },
    [ctx, yieldModel, ids, depthAt, seabedAt, layers],
  );

  const capacity = p.turbines.length * RATED_MW;
  const pywakeFresh = p.pywake && p.pywakeFor === sig ? p.pywake : null;
  const wakeOnlyGWh = pywakeFresh?.net_aep_gwh ?? yieldRes?.netGWh ?? 0;
  const netGWh = wakeOnlyGWh * (1 - OTHER_LOSSES);
  const routeKm = useSiteStore((s) => s.routeKm);
  const defaultExport = defaultExportKm(report?.grid_km, routeKm);
  const expKm = exportKm ?? defaultExport;
  const seabedFactor = foundationFactor(p.turbines.map((t) => [t.lon, t.lat]), seabedAt);
  const cost = layoutCost(p.costs, capacity, cables?.totalKm ?? 0, expKm, report?.depth_m?.[1] ?? null, netGWh, seabedFactor);

  const pyWind = { weibull_a: windA, weibull_k: windK, sector_frequencies: siteWind?.sector_frequencies ?? null };
  const subseaCables = useMemo<XY[][]>(
    () =>
      (layers?.layers ?? [])
        .filter((l) => l.role === "cable")
        .flatMap((l) => l.features.filter((f) => f.geometry.type === "LineString").map((f) => (f.geometry.coordinates as LonLat[]).map(proj.toXY))),
    [layers, proj],
  );
  const cableBufferKm = Number(layers?.criteria.find((c) => c.key === "cable_buffer_km")?.default ?? 0.5);
  const suggest = () =>
    yieldModel
      ? suggestMoves({
          ctx,
          model: yieldModel,
          ids,
          oss: oss ? proj.toXY(oss) : null,
          tree: cables,
          costs: p.costs,
          exportKm: expKm,
          maxDepthM: report?.depth_m?.[1] ?? null,
          cables: subseaCables,
          cableBufferM: cableBufferKm * 1000,
        })
      : [];

  const fill = (o: { along: number; across: number; angle: number; staggered: boolean; avoid: boolean }) => {
    let pts = gridFill(siteXY, { along: o.along * D, across: o.across * D, angleDeg: o.angle, staggered: o.staggered, inset: D / 2 }).map(proj.toLonLat);
    const all = pts.length;
    if (o.avoid) pts = pts.filter((q) => !excludedBy(q));
    setFillNote(
      all > pts.length
        ? `${all - pts.length} of ${all} grid positions fall in constraint areas and were skipped.`
        : null,
    );
    if (pts.length > MAX_TURBINES) {
      useProjectStore.setState({ error: `The grid gives ${pts.length} turbines; only the first ${MAX_TURBINES} were placed. Use a wider spacing.` });
    }
    p.setTurbines(pts);
    if (!p.oss && pts.length) {
      const c = centroid(pts.slice(0, MAX_TURBINES));
      p.setOss(c);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2" data-tour="page-header">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <MapPinned size={20} className="text-accent" aria-hidden />
            Layout
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Place turbines in your site, watch wake losses and the array cables change, then check the energy yield with PyWake
            and estimate the cost. Turbine: V236 class, modelled with the IEA 15 MW reference turbine (D = 241 m).
          </p>
        </div>
      </div>

      {!siteDrawn && (
        <p className="rounded-md border border-border-primary bg-bg-secondary px-3 py-2 text-[12px] text-text-secondary">
          No site from <Link to="/develop" className="text-accent underline">Site &amp; Permits</Link> yet: the SB-510 case-study boundary is
          used.
        </p>
      )}
      {p.error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-alarm/30 bg-status-alarm/10 p-3 text-sm">
          <span className="text-status-alarm">{p.error}</span>
          <Button variant="ghost" size="sm" onClick={p.clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5" data-tour="layout-tools">
            <Button size="sm" variant={p.addMode ? "primary" : "secondary"} onClick={() => p.setAddMode(!p.addMode)} aria-pressed={p.addMode}>
              <MousePointerClick size={13} className="mr-1" /> {p.addMode ? "Click the map to add…" : "Add turbines"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => p.selected && p.removeTurbine(p.selected)} disabled={!p.selected}>
              <Trash2 size={13} className="mr-1" /> Remove {p.selected ?? "selected"}
            </Button>
            <Button size="sm" variant="secondary" onClick={p.loadCaseStudy}>
              Load SB-510 layout
            </Button>
            <Button size="sm" variant="ghost" onClick={p.clear} disabled={!p.turbines.length}>
              <RotateCcw size={13} className="mr-1" /> Clear
            </Button>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] text-text-secondary">
              <label className="flex items-center gap-1">
                <input type="checkbox" className="accent-accent" checked={wakeOn} onChange={(e) => setWakeOn(e.target.checked)} />
                <Wind size={13} aria-hidden /> Wakes from
              </label>
              <input
                type="range"
                min={0}
                max={355}
                step={5}
                value={wakeFrom}
                onChange={(e) => setWakeFrom(Number(e.target.value))}
                disabled={!wakeOn}
                aria-label="Wind direction (from)"
                className="w-24 accent-accent"
              />
              <span className="w-9 tabular-nums">{wakeFrom}°</span>
            </span>
          </div>
          <Suspense fallback={<Skeleton className="h-[460px] w-full rounded-lg sm:h-[560px]" />}>
            <LayoutMap
              site={site}
              turbines={views}
              cables={cables}
              wakeFrom={wakeOn ? wakeFrom : null}
              card={<TurbineCard stats={stats} />}
            />
          </Suspense>
          <p className="text-[11px] text-text-muted">
            Click a turbine for its card; drag it to see the farm AEP change live. Turbine IDs appear from zoom 12.
          </p>
          <WatchOut text="Wake losses grow quickly below about 5 D downwind; a tight layout gains megawatts on paper and loses them in energy. Drag a turbine and watch the farm AEP change in its card." />
          <LayoutChecklist
            siteDrawn={siteDrawn != null}
            count={p.turbines.length}
            outside={problems.outside}
            excluded={problems.excluded}
            basin={problems.basin}
            close={problems.close}
            oss={oss != null}
            overCapacity={cables?.edges.filter((e) => !e.section).length ?? 0}
            crossings={cables?.crossings ?? 0}
            depthUnknown={depths.filter((dm) => dm == null).length}
            depthOut={depths.filter((dm, i) => dm != null && !foundations[i]).length}
            floating={foundations.filter((f) => f != null && /floating/.test(f)).length}
            pywake={pywakeFresh ? "fresh" : p.pywake ? "stale" : "none"}
          />
        </div>

        <div className="space-y-3">
          <GridTool onFill={fill} />
          {fillNote && <p className="text-[12px] text-status-warning">{fillNote}</p>}

          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Live results</h3>
            <InfoButton info={layoutResultsInfo} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-tour="layout-results">
            <InfoTile label="Turbines" value={p.turbines.length} subtitle={`${capacity} MW`} size="sm" />
            <InfoTile label="Power density" value={areaKm2 > 0 ? (capacity / areaKm2).toFixed(1) : "—"} unit="MW/km²" subtitle={`${areaKm2.toFixed(0)} km² site`} size="sm" />
            <InfoTile
              label="Closest pair"
              value={spacing ? (spacing.m / D).toFixed(1) : "—"}
              unit="D"
              priority={spacing && spacing.m < MIN_SPACING_D * D ? "warning" : "normal"}
              subtitle={spacing ? `${(spacing.m / 1000).toFixed(2)} km` : undefined}
              size="sm"
            />
            <InfoTile
              label="Wake loss (live)"
              value={yieldRes ? yieldRes.wakeLossPct.toFixed(1) : "—"}
              unit="%"
              subtitle={siteRose ? "site rose (ERA5, 12 sectors)" : roseReal ? "regional synthetic rose" : "uniform rose (API offline)"}
              size="sm"
            />
            <InfoTile
              label="Net AEP (live)"
              value={yieldRes ? yieldRes.netGWh.toFixed(0) : "—"}
              unit="GWh"
              subtitle={yieldRes ? `CF ${(100 * yieldRes.capacityFactor).toFixed(1)} %, wake only` : undefined}
              size="sm"
            />
            <InfoTile
              label="Wind at 150 m"
              value={(siteWind?.mean_ms ?? weibullMean(windA, windK)).toFixed(1)}
              unit="m/s"
              subtitle={`A ${windA.toFixed(1)} · k ${windK.toFixed(2)} · ${siteWind ? "NEWA + ERA5" : "approximation"}`}
              priority={siteWind ? "normal" : "warning"}
              size="sm"
            />
            <InfoTile
              label="Array cables"
              value={cables ? cables.totalKm.toFixed(1) : "—"}
              unit="km"
              subtitle={cables ? `${cables.strings} strings · ≤ ${maxPerString(RATED_MW)} per string` : "place the OSS"}
              priority={cables && cables.crossings > 0 ? "warning" : "normal"}
              size="sm"
            />
          </div>
          {(problems.outside > 0 || problems.excluded > 0 || problems.basin > 0) && (
            <p className="text-[12px] text-status-alarm">
              {problems.outside > 0 && `${problems.outside} turbine(s) outside the site. `}
              {problems.excluded > 0 && `${problems.excluded} turbine(s) inside a constraint area. `}
              {problems.basin > 0 && `${problems.basin} turbine(s) outside the plan's energy basins.`}
            </p>
          )}
          {cables && cables.crossings > 0 && (
            <p className="text-[12px] text-status-warning">{cables.crossings} cable crossing(s): move the OSS or turbines to remove them.</p>
          )}

          <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="layout-pywake">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Reference AEP (PyWake) <InfoButton info={layoutPyWakeInfo} />
              </h3>
              <Button
                size="sm"
                onClick={() =>
                  void p.runPyWake(
                    proj.toXY,
                    siteWind ? { weibullA: windA, weibullK: windK, sectorFrequencies: siteWind.sector_frequencies } : undefined,
                    syncId ? useProjectSync.getState().runAep : undefined,
                  )
                }
                disabled={!p.turbines.length || p.running}
              >
                <Play size={13} className="mr-1" /> {p.running ? "Running…" : "Run PyWake"}
              </Button>
            </div>
            {p.pywake ? (
              <div className={cn("grid grid-cols-3 gap-2 text-[12px]", !pywakeFresh && "opacity-50")}>
                <div>
                  <div className="text-text-muted">Net AEP</div>
                  <div className="font-semibold text-text-primary">{p.pywake.net_aep_gwh.toFixed(0)} GWh</div>
                </div>
                <div>
                  <div className="text-text-muted">Wake loss</div>
                  <div className="font-semibold text-text-primary">{p.pywake.wake_loss_percent.toFixed(1)} %</div>
                </div>
                <div>
                  <div className="text-text-muted">Capacity factor</div>
                  <div className="font-semibold text-text-primary">{(100 * p.pywake.capacity_factor).toFixed(1)} %</div>
                </div>
                {!pywakeFresh && <p className="col-span-3 text-[11px] text-status-warning">The layout changed since this run.</p>}
              </div>
            ) : (
              <p className="text-[11px] text-text-muted">
                Niayifar Gaussian wakes, STF2017 turbulence, same 12-sector rose. The live numbers above use a faster model that agrees
                within about 0.5 percentage points on regular grids.
              </p>
            )}
          </div>

          <MoveSuggestions
            sig={`${sig}|${oss?.join(",") ?? ""}|${windA}|${windK}|${siteKey}`}
            disabled={p.turbines.length < 2}
            suggest={suggest}
            validate={(moves) =>
              checkWakeMoves(
                xy.map((q) => q.x),
                xy.map((q) => q.y),
                moves.map((m) => ({ index: m.index, x_m: m.to.x, y_m: m.to.y })),
                pyWind,
              ).then((r) => r.moves)
            }
            apply={(m) => p.moveTurbine(m.id, proj.toLonLat(m.to))}
          />

          <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="layout-cost">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Cost estimate</h3>
              <InfoButton info={layoutCostInfo} />
            </div>
            <label className="flex items-center justify-between gap-2 text-[12px] text-text-primary">
              Export cable route
              <span>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={expKm}
                  onChange={(e) => setExportKm(Math.max(1, Number(e.target.value) || 1))}
                  className="w-16 rounded border border-border-primary bg-bg-tertiary px-1.5 py-0.5 text-right text-[12px]"
                />{" "}
                km
              </span>
            </label>
            <table className="w-full text-[12px]">
              <tbody>
                {cost.lines.map((l) => (
                  <tr key={l.label} className="border-b border-border-primary/60">
                    <td className="py-0.5 text-text-secondary">
                      {l.label}
                      {l.source && <SourceBadge p={l.source} className="ml-1" />}
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-text-primary">{l.meur.toFixed(0)} M€</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-1 font-semibold text-text-primary">CAPEX</td>
                  <td className="pt-1 text-right font-semibold tabular-nums text-text-primary">
                    {cost.capexMEUR.toFixed(0)} M€ · {cost.capexMEURperMW.toFixed(2)} M€/MW
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="flex items-baseline justify-between border-t border-border-primary pt-2">
              <span className="text-[12px] text-text-secondary">LCOE</span>
              <span className="text-lg font-semibold text-text-primary">{cost.lcoe != null ? `${cost.lcoe.toFixed(0)} €/MWh` : "—"}</span>
            </div>
            <p className="text-[10px] text-text-muted">
              LCOE = (CAPEX·CRF + OPEX) / AEP. AEP: {pywakeFresh ? "PyWake" : "live estimate"}, minus {(100 * OTHER_LOSSES).toFixed(1)} % electrical,
              availability and environmental losses (P1 cascade defaults). Foundations by the site's deepest water ({report?.depth_m ? `${report.depth_m[1].toFixed(0)} m` : "not assessed"}).
            </p>
          </div>
          <CostPanel costs={p.costs} setCost={p.setCost} reset={p.resetCosts} />
        </div>
      </div>
    </div>
  );
}
