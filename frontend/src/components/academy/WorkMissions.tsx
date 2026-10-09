/**
 * Missions graded on the learner's own project: the site drawn in
 * Site & Permits (siteStore) and the layout on the canvas (projectStore).
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { scoreLayout, scoreSite, type Scored } from "../../academy/scoring";
import { DEFAULT_COSTS } from "../../lib/layout/cost";
import { UNIFORM_ROSE, type WindRose } from "../../lib/layout/energy";
import { defaultExportKm, evaluateLayout, WEIBULL_A, WEIBULL_K } from "../../lib/layout/evaluate";
import { DEFAULT_TURBINE_ID } from "../../constants/turbineModels";
import { computeWindRose } from "../../services/windResourceApi";
import { turbineById } from "../../utils/turbineCurves";
import { useAcademyStore } from "../../store/academyStore";
import { useProjectStore } from "../../store/projectStore";
import { CASE_STUDY_SITE, useSiteStore } from "../../store/siteStore";
import { Button } from "../ui/Button";
import { WatchOut } from "../site/Stages";
import { decide, OUTCOME_LABEL } from "../site/journey";
import { ScoreCard } from "./MissionFrame";

function GoTo({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-8 items-center rounded-md border border-border-secondary px-3 text-xs font-medium text-text-primary hover:bg-bg-hover"
    >
      {children} <ArrowRight size={13} className="ml-1" />
    </Link>
  );
}

export function SiteMission() {
  const site = useSiteStore((s) => s.site);
  const report = useSiteStore((s) => s.report);
  const assessing = useSiteStore((s) => s.assessing);
  const error = useSiteStore((s) => s.error);
  const assess = useSiteStore((s) => s.assess);
  const routeKm = useSiteStore((s) => s.routeKm);
  const record = useAcademyStore((s) => s.record);
  const [result, setResult] = useState<Scored | null>(null);

  useEffect(() => {
    if (useSiteStore.getState().site && !useSiteStore.getState().report) void assess();
  }, [assess]);

  if (!site) {
    return (
      <div className="space-y-2 text-[13px] text-text-secondary">
        <p>
          You have not drawn a site yet. Open Site &amp; Permits, screen the map and draw your site; then come back and grade it.
        </p>
        <GoTo to="/develop">Open Site &amp; Permits</GoTo>
      </div>
    );
  }

  const grade = () => {
    if (!report) return;
    const r = scoreSite(report, routeKm);
    setResult(r);
    record({
      mission: "site-selection",
      score: r.score,
      detail: `${report.area_km2.toFixed(0)} km², ${report.capacity_mw.toFixed(0)} MW, ${OUTCOME_LABEL[decide(report).outcome].toLowerCase()}`,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
        {report ? (
          <span>
            Your site: {report.area_km2.toFixed(0)} km², indicative {report.capacity_mw.toFixed(0)} MW, grid{" "}
            {report.grid_km?.toFixed(0) ?? "?"} km — {OUTCOME_LABEL[decide(report).outcome].toLowerCase()}.
          </span>
        ) : (
          <span>{assessing ? "Assessing your site…" : (error ?? "No report yet.")}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={grade} disabled={!report}>
          <ClipboardCheck size={13} /> Grade my site
        </Button>
        <GoTo to="/develop">Improve it in Site &amp; Permits</GoTo>
      </div>
      {result && <ScoreCard result={result} />}
      <WatchOut text="A refused permit costs 40 points at once: the developer's first job is a site that can be consented, then size and cost." />
    </div>
  );
}

export function LayoutMission() {
  const turbines = useProjectStore((s) => s.turbines);
  const oss = useProjectStore((s) => s.oss);
  const siteDrawn = useSiteStore((s) => s.site);
  const report = useSiteStore((s) => s.report);
  const layers = useSiteStore((s) => s.layers);
  const loadLayers = useSiteStore((s) => s.loadLayers);
  const assess = useSiteStore((s) => s.assess);
  const routeKm = useSiteStore((s) => s.routeKm);
  const record = useAcademyStore((s) => s.record);
  const [rose, setRose] = useState<WindRose | null>(null);
  const model = turbineById(DEFAULT_TURBINE_ID);
  const ratedMW = model.ratedKw / 1000;
  // Same wind as the Layout page: the site's measured climate when assessed, else SB-510's
  const siteWind = report?.wind && !report.wind.approximate ? report.wind : null;
  const [result, setResult] = useState<Scored | null>(null);

  useEffect(() => {
    void loadLayers();
    if (useSiteStore.getState().site && !useSiteStore.getState().report) void assess();
    let live = true;
    computeWindRose(WEIBULL_A, WEIBULL_K, 87_600, 12)
      .then((r) => live && setRose({ directions: r.sector_centres_deg, frequencies: r.frequencies }))
      .catch(() => live && setRose(UNIFORM_ROSE));
    return () => {
      live = false;
    };
  }, [loadLayers, assess]);

  if (turbines.length === 0) {
    return (
      <div className="space-y-2 text-[13px] text-text-secondary">
        <p>Your layout is empty. Open the layout canvas, fill your site with turbines and place the offshore substation.</p>
        <GoTo to="/develop/layout">Open the layout canvas</GoTo>
      </div>
    );
  }

  const grade = () => {
    const e = evaluateLayout({
      site: siteDrawn ?? CASE_STUDY_SITE,
      turbines,
      oss,
      costs: DEFAULT_COSTS,
      layers,
      maxDepthM: report?.depth_m?.[1] ?? null,
      exportKm: defaultExportKm(report?.grid_km, routeKm),
      rose: siteWind?.sector_frequencies
        ? { directions: siteWind.sector_frequencies.map((_, i) => i * 30), frequencies: siteWind.sector_frequencies }
        : (rose ?? UNIFORM_ROSE),
      weibull: siteWind ? { a: siteWind.weibull_a, k: siteWind.weibull_k } : undefined,
      turbineId: model.id,
    });
    const r = scoreLayout(e);
    setResult(r);
    record({
      mission: "layout-challenge",
      score: r.score,
      detail: `${e.capacityMW} MW, wake ${e.yield?.wakeLossPct.toFixed(1) ?? "?"} %, LCOE ${e.cost.lcoe?.toFixed(1) ?? "?"} €/MWh`,
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-text-secondary">
        Your layout: {turbines.length} × {ratedMW} MW {model.name} ({turbines.length * ratedMW} MW){oss ? "" : ", no offshore substation yet"}, in{" "}
        {siteDrawn ? "your site from Site & Permits" : "the SB-510 case-study site"}.
        {!layers && " Constraint layers are not loaded (backend offline?): turbines are only checked against the site boundary."}
        {rose === UNIFORM_ROSE && " Wind rose: uniform (the backend wind rose is not available)."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={grade} disabled={!rose}>
          <ClipboardCheck size={13} /> {rose ? "Grade my layout" : "Loading the wind rose…"}
        </Button>
        <GoTo to="/develop/layout">Change it on the canvas</GoTo>
      </div>
      {result && <ScoreCard result={result} />}
      <WatchOut text="Graded with the default cost inputs, whatever you set on the canvas: editing the unit costs changes the LCOE, not the engineering." />
    </div>
  );
}
