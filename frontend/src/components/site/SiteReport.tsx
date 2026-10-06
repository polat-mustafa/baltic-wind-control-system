/**
 * Candidate-site report: key figures and the screening checklist.
 * Status is word + icon + colour (never colour alone).
 *
 * States: no site · assessing · failed (retry) · up to date · out of date
 * (site or criteria changed since the report) — a failed run keeps the
 * last good report on screen, marked as such.
 */

import { AlertTriangle, CheckCircle2, HelpCircle, Info, Loader2, OctagonX, RefreshCw } from "lucide-react";

import { cn } from "../../lib/utils";
import type { CheckStatus } from "../../services/siteApi";
import { reportSignature, useSiteStore } from "../../store/siteStore";
import { Button } from "../ui/Button";
import { InfoTile } from "../ui/InfoTile";
import { Skeleton } from "../ui/Skeleton";

const STATUS: Record<CheckStatus, { label: string; Icon: typeof CheckCircle2; cls: string }> = {
  pass: { label: "Pass", Icon: CheckCircle2, cls: "text-status-normal" },
  warn: { label: "Check", Icon: AlertTriangle, cls: "text-status-warning" },
  fail: { label: "Fail", Icon: OctagonX, cls: "text-status-alarm" },
  unknown: { label: "Unknown", Icon: HelpCircle, cls: "text-text-muted" },
  info: { label: "Note", Icon: Info, cls: "text-status-info" },
};

export function StatusMark({ status }: { status: CheckStatus }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex w-[4.5rem] shrink-0 items-center gap-1 text-[11px] font-semibold uppercase", s.cls)}>
      <s.Icon size={13} aria-hidden />
      {s.label}
    </span>
  );
}

const fmt = (v: number | null | undefined, digits = 1) => (v == null ? "—" : v.toFixed(digits));

function RetryNote({ tone, text }: { tone: "alarm" | "warning"; text: string }) {
  const assess = useSiteStore((s) => s.assess);
  return (
    <div
      role={tone === "alarm" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-[12px]",
        tone === "alarm" ? "border-status-alarm/40 bg-status-alarm/10" : "border-status-warning/40 bg-status-warning/10",
      )}
    >
      <span className="text-text-secondary">{text}</span>
      <Button variant="ghost" size="sm" onClick={() => void assess()}>
        <RefreshCw size={12} className="mr-1" aria-hidden /> Retry
      </Button>
    </div>
  );
}

export default function SiteReport() {
  const report = useSiteStore((s) => s.report);
  const assessing = useSiteStore((s) => s.assessing);
  const assessError = useSiteStore((s) => s.assessError);
  const site = useSiteStore((s) => s.site);
  const criteria = useSiteStore((s) => s.criteria);
  const reportFor = useSiteStore((s) => s.reportFor);
  const stale = report != null && reportFor !== reportSignature(site, criteria);

  if (!site) {
    return (
      <div className="rounded-lg border border-dashed border-border-primary p-4 text-sm text-text-muted" data-tour="site-report">
        Draw a candidate site on the map, or load the SB-510 boundary, to get its screening report.
      </div>
    );
  }
  if (!report) {
    if (assessError && !assessing) {
      return (
        <div data-tour="site-report">
          <RetryNote tone="alarm" text={`The site could not be assessed: ${assessError}`} />
        </div>
      );
    }
    return (
      <div className="space-y-2" data-tour="site-report" aria-busy={assessing}>
        <p className="flex items-center gap-2 text-sm text-text-muted">
          {assessing && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />}
          {assessing ? "Assessing the site…" : "No report yet."}
        </p>
        {assessing && <Skeleton className="h-40 w-full rounded-lg" />}
      </div>
    );
  }

  const fails = report.checks.filter((c) => c.status === "fail").length;
  return (
    <div className="space-y-3" data-tour="site-report" aria-busy={assessing}>
      {assessing && (
        <p className="flex items-center gap-2 text-[12px] text-text-muted" role="status">
          <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden /> Updating the report…
        </p>
      )}
      {!assessing && assessError && (
        <RetryNote tone="alarm" text={`Update failed (${assessError}). Showing the last good report.`} />
      )}
      {!assessing && !assessError && stale && (
        <RetryNote tone="warning" text="Out of date: the site or the criteria changed since this report." />
      )}
      <div className={cn("space-y-3", (assessing || stale) && "opacity-60")}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <InfoTile label="Area" value={fmt(report.area_km2, 1)} unit="km²" size="sm" />
        <InfoTile
          label="Indicative capacity"
          value={fmt(report.capacity_mw, 0)}
          unit="MW"
          subtitle={report.excluded_fraction > 0 ? `${(100 * report.excluded_fraction).toFixed(0)} % of the area excluded` : "whole area usable"}
          priority={report.excluded_fraction > 0 ? "warning" : "normal"}
          size="sm"
        />
        <InfoTile
          label="Water depth"
          value={report.depth_m ? `${fmt(report.depth_m[0], 0)}–${fmt(report.depth_m[1], 0)}` : "—"}
          unit="m"
          subtitle={report.foundation ?? undefined}
          size="sm"
        />
        <InfoTile
          label="Distance to shore"
          value={report.shore_km ? `${fmt(report.shore_km[0], 0)}–${fmt(report.shore_km[1], 0)}` : "—"}
          unit="km"
          size="sm"
        />
        <InfoTile label="To grid node" value={fmt(report.grid_km, 0)} unit="km" subtitle={report.grid_node ?? undefined} size="sm" />
        {report.wind && (
          <InfoTile
            label={`Wind at ${report.wind.height_m.toFixed(0)} m`}
            value={report.wind.mean_ms.toFixed(1)}
            unit="m/s"
            subtitle={
              report.wind.approximate
                ? "approximation — real data not found"
                : `A ${report.wind.weibull_a.toFixed(1)} · k ${report.wind.weibull_k.toFixed(2)} · NEWA + ERA5`
            }
            priority={report.wind.approximate ? "warning" : "normal"}
            size="sm"
          />
        )}
        <InfoTile
          label="Mean score"
          value={report.mean_score == null ? "—" : report.mean_score.toFixed(2)}
          subtitle="0 = poor · 1 = ideal"
          size="sm"
        />
      </div>

      <div className="rounded-lg border border-border-primary bg-bg-secondary">
        <div className="flex items-center justify-between border-b border-border-primary px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Screening checklist</h3>
          <span className={cn("text-[11px] font-medium", fails ? "text-status-alarm" : "text-text-muted")}>
            {fails ? `${fails} blocking issue${fails > 1 ? "s" : ""}` : "no blocking issue"}
          </span>
        </div>
        <ul className="divide-y divide-border-primary">
          {report.checks.map((c) => (
            <li key={c.id} className="flex gap-2 px-3 py-2 text-[12px]">
              <StatusMark status={c.status} />
              <div className="min-w-0">
                <div className="font-medium text-text-primary">{c.title}</div>
                <div className="text-text-secondary">{c.detail}</div>
                {c.reference && <div className="mt-0.5 text-[10px] text-text-muted">{c.reference}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      {!report.complete && (
        <p className="text-[11px] text-status-warning">
          Some data layers are missing: checks marked "unknown" were not done.
        </p>
      )}
      </div>
    </div>
  );
}
