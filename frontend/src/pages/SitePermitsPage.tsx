/**
 * Site & Permits — build a wind farm from scratch (route /develop).
 *
 * Five stages: screen a site on open marine data, survey it, run the
 * environmental studies, go through consultation and the permit decision,
 * and read the documents that come out. Generic EU process; national
 * procedures differ. Backend: /api/v1/site (services/site_assessment).
 */

import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Gavel, OctagonX, RotateCcw } from "lucide-react";

import { cn } from "../lib/utils";
import { useSiteStore } from "../store/siteStore";
import { Button } from "../components/ui/Button";
import { InfoButton } from "../components/ui/InfoButton";
import { Skeleton } from "../components/ui/Skeleton";
import ExportRoute from "../components/site/ExportRoute";
import SiteReport from "../components/site/SiteReport";
import { EnvironmentStage, InvestigationStage, PermitStage, WatchOut } from "../components/site/Stages";
import DocumentsStage from "../components/site/Documents";
import DataSources, { ScreeningDisclaimer } from "../components/site/DataSources";
import { OUTCOME_LABEL, STAGES, decide, type Decision, type StageId } from "../components/site/journey";
import type { CriterionCard } from "../services/siteApi";
import { PageHeader } from "../components/layout/PageHeader";

// Leaflet map only when the page opens
const ScreeningMap = lazy(() => import("../components/site/ScreeningMap"));

function Stepper() {
  const stage = useSiteStore((s) => s.stage);
  const done = useSiteStore((s) => s.done);
  const setStage = useSiteStore((s) => s.setStage);
  const report = useSiteStore((s) => s.report);
  return (
    <ol className="grid grid-cols-5 gap-1 rounded-lg border border-border-primary bg-bg-secondary p-1" data-tour="site-stages">
      {STAGES.map((s, i) => {
        const isDone = done.includes(s.id);
        const locked = s.id !== "screening" && !report;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setStage(s.id)}
              disabled={locked}
              aria-current={stage === s.id ? "step" : undefined}
              aria-label={`Stage ${i + 1}: ${s.title}${isDone ? " (done)" : ""}`}
              className={cn(
                "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors disabled:opacity-40",
                stage === s.id ? "bg-accent text-accent-ink" : "text-text-secondary hover:bg-bg-hover",
              )}
            >
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider">
                {isDone ? <CheckCircle2 size={11} aria-label="done" /> : `${i + 1}`}
                <span className="hidden sm:inline">· {s.short}</span>
              </span>
              <span className="hidden text-xs font-medium md:block">{s.title}</span>
              <span className="hidden text-xs lg:block">{s.duration}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Provenance of a screening criterion (API model card) behind an info button. */
function CriterionInfo({ card }: { card: CriterionCard | undefined }) {
  if (!card) return null;
  return (
    <InfoButton
      className="h-5 w-5 shrink-0"
      info={{
        title: card.label,
        description: card.provenance,
        parameters: [
          { name: "default", description: `${String(card.default)}${card.unit ? ` ${card.unit}` : ""}` },
          { name: "kind", description: card.kind },
        ],
        interpretation: card.note || undefined,
      }}
    />
  );
}

function CriteriaPanel() {
  const cards = useSiteStore((s) => s.layers?.criteria);
  const cardByKey: Record<string, CriterionCard> = Object.fromEntries((cards ?? []).map((c) => [c.key, c]));
  const criteria = useSiteStore((s) => s.criteria);
  const setCriteria = useSiteStore((s) => s.setCriteria);
  const suitability = useSiteStore((s) => s.suitability);
  const area = (name: string) => suitability?.class_areas.find((c) => c.name === name)?.area_km2 ?? 0;
  const toggles: {
    key: "exclude_territorial_sea" | "require_energy_basin" | "exclude_protected" | "exclude_restricted";
    label: string;
    note: string;
  }[] = [
    { key: "exclude_territorial_sea", label: "Exclude the 12 nm territorial sea", note: "Polish law: no offshore wind in internal waters or the territorial sea" },
    { key: "require_energy_basin", label: "Only the plan's energy basins", note: "Polish law: a location permit needs a basin where the maritime spatial plan allows wind" },
    { key: "exclude_protected", label: "Exclude Natura 2000 sites", note: "Not a legal ban: projects there need an appropriate assessment" },
    { key: "exclude_restricted", label: "Exclude military areas and munition dumpsites", note: "Defence areas may be negotiable; dumpsites need UXO clearance" },
  ];
  return (
    <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Screening criteria</h3>
      {toggles.map((t) => (
        <div key={t.key} className="flex items-start justify-between gap-1">
          <label className="flex cursor-pointer items-start gap-2 text-[12px]">
            <input
              type="checkbox"
              className="mt-0.5 accent-accent"
              checked={criteria[t.key] ?? true}
              onChange={(e) => setCriteria({ [t.key]: e.target.checked })}
            />
            <span>
              <span className="text-text-primary">{t.label}</span>
              <span className="block text-xs text-text-muted">{t.note}</span>
            </span>
          </label>
          <CriterionInfo card={cardByKey[t.key]} />
        </div>
      ))}
      <label className="flex items-center justify-between gap-2 text-[12px] text-text-primary">
        <span className="flex items-center gap-1">
          Cable buffer <CriterionInfo card={cardByKey.cable_buffer_km} />
        </span>
        <select
          value={criteria.cable_buffer_km ?? 0.5}
          onChange={(e) => setCriteria({ cable_buffer_km: Number(e.target.value) })}
          className="rounded border border-border-primary bg-bg-tertiary px-1.5 py-0.5 text-[12px]"
        >
          {[0.25, 0.5, 1, 2].map((v) => (
            <option key={v} value={v}>
              {v} km
            </option>
          ))}
        </select>
      </label>
      {suitability && (
        <p className="border-t border-border-primary pt-2 text-xs text-text-secondary">
          <span className="font-semibold text-status-normal">{area("suitable").toFixed(0)} km² suitable</span> ·{" "}
          {area("marginal").toFixed(0)} km² marginal · {area("excluded").toFixed(0)} km² excluded (≈ {suitability.cell_km} km
          cells). Thresholds marked illustrative in the API model card are teaching defaults.
        </p>
      )}
    </div>
  );
}

const OUTLOOK_STYLE: Record<Decision["outcome"], { cls: string; Icon: typeof Gavel }> = {
  refused: { cls: "border-status-alarm/50 bg-status-alarm/10 text-status-alarm", Icon: OctagonX },
  more_information: { cls: "border-status-warning/50 bg-status-warning/10 text-status-warning", Icon: AlertTriangle },
  approved_with_conditions: { cls: "border-status-normal/50 bg-status-normal/10 text-status-normal", Icon: Gavel },
  approved: { cls: "border-status-normal/50 bg-status-normal/10 text-status-normal", Icon: CheckCircle2 },
};

const OUTLOOK_NOTE: Record<Decision["outcome"], string> = {
  refused:
    "You can still walk through the next stages to learn the procedure, but a real project could not take this site on to layout: redraw it clear of the failed checks.",
  more_information: "Essential data are missing, so the authority would ask for more before deciding.",
  approved_with_conditions:
    "No blocking issue; the points marked “Check” would become permit conditions (seabed and grid findings are design matters, not consent conditions).",
  approved: "No blocking issue in this screening.",
};

/** What the permit authority would make of the screened site (simulation). */
function PermitOutlook({ decision }: { decision: Decision }) {
  const st = OUTLOOK_STYLE[decision.outcome];
  return (
    <div className={cn("rounded-lg border p-3", st.cls)} role="status" data-tour="site-outlook">
      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold">
        <st.Icon size={14} aria-hidden /> Permit outlook: {OUTCOME_LABEL[decision.outcome]}
      </h3>
      {decision.reasons.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] text-text-secondary">
          {decision.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-[12px] text-text-secondary">{OUTLOOK_NOTE[decision.outcome]}</p>
    </div>
  );
}

function ScreeningStage() {
  const report = useSiteStore((s) => s.report);
  const complete = useSiteStore((s) => s.completeStage);
  const setStage = useSiteStore((s) => s.setStage);
  const decision = decide(report);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <Suspense fallback={<Skeleton className="h-[460px] w-full rounded-lg sm:h-[560px]" />}>
          <ScreeningMap />
        </Suspense>
        <WatchOut text="Green means the open data raise no exclusion here, not that a permit is certain: fisheries, radar, aviation and cultural heritage are not in this screening." />
        <ScreeningDisclaimer />
      </div>
      <div className="space-y-3">
        <CriteriaPanel />
        {report && <PermitOutlook decision={decision} />}
        <SiteReport />
        <ExportRoute />
        <DataSources />
        {report && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={() => {
                complete("screening");
                setStage("investigation");
              }}
            >
              Continue to site investigation <ArrowRight size={13} className="ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

const NEXT: Partial<Record<StageId, StageId>> = {
  investigation: "environment",
  environment: "permit",
  permit: "documents",
};
const PREV: Partial<Record<StageId, StageId>> = {
  investigation: "screening",
  environment: "investigation",
  permit: "environment",
  documents: "permit",
};

export default function SitePermitsPage() {
  const stage = useSiteStore((s) => s.stage);
  const done = useSiteStore((s) => s.done);
  const report = useSiteStore((s) => s.report);
  const site = useSiteStore((s) => s.site);
  const error = useSiteStore((s) => s.error);
  const loadLayers = useSiteStore((s) => s.loadLayers);
  const runSuitability = useSiteStore((s) => s.runSuitability);
  const assess = useSiteStore((s) => s.assess);
  const setStage = useSiteStore((s) => s.setStage);
  const reset = useSiteStore((s) => s.reset);
  const clearError = useSiteStore((s) => s.clearError);

  useEffect(() => {
    void loadLayers();
    if (!useSiteStore.getState().suitability) void runSuitability();
    if (useSiteStore.getState().site && !useSiteStore.getState().report) void assess();
  }, [loadLayers, runSuitability, assess]);

  // Later stages need an assessed site.
  const effective: StageId = stage !== "screening" && !site ? "screening" : stage;
  const current = STAGES.find((s) => s.id === effective)!;
  const next = NEXT[effective];
  const prev = PREV[effective];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Site & Permits"
        description={
          <>
            Build a wind farm from scratch: screen a site on open marine data, survey it, study the environment and
            take it through the permit procedure. Generic EU process; national procedures differ.
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw size={13} className="mr-1" /> Start over
            </Button>
          </>
        }
      />

      <Stepper />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-status-alarm/30 bg-status-alarm/10 p-3 text-sm">
          <span className="text-status-alarm">{error}</span>
          <Button variant="ghost" size="sm" onClick={clearError}>
            Dismiss
          </Button>
        </div>
      )}

      <section aria-labelledby="stage-title" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="stage-title" className="text-base font-semibold text-text-primary">
            {current.title}
          </h3>
          {current.duration && <span className="text-xs text-text-muted">{current.duration}</span>}
        </div>
        {effective === "screening" && <ScreeningStage />}
        {effective === "investigation" && <InvestigationStage />}
        {effective === "environment" && <EnvironmentStage />}
        {effective === "permit" && <PermitStage />}
        {effective === "documents" && <DocumentsStage />}
      </section>

      {effective !== "screening" && (
        <div className="flex items-center justify-between gap-2 border-t border-border-primary pt-3">
          {prev ? (
            <Button variant="ghost" size="sm" onClick={() => setStage(prev)}>
              <ArrowLeft size={13} className="mr-1" /> Back
            </Button>
          ) : (
            <span />
          )}
          {next && (
            <Button size="sm" onClick={() => setStage(next)} disabled={!report || !done.includes(effective)}>
              {done.includes(effective) ? "Next stage" : "Finish this stage first"} <ArrowRight size={13} className="ml-1" />
            </Button>
          )}
          {effective === "documents" && (
            <Link
              to="/develop/layout"
              className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-xs font-medium text-accent-ink hover:bg-accent-hover"
            >
              Continue to layout <ArrowRight size={13} className="ml-1" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
