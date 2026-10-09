/**
 * Live layout checklist: the site report (with its loading / out-of-date /
 * failed states and Retry) and the client-side checks that update as turbines
 * move. The five marked "HV Grid" are the ones that open the Grid stage of an
 * own project (lib/project/progress.ts → layoutProblems()).
 */

import { Loader2, RefreshCw } from "lucide-react";

import type { CheckStatus } from "../../services/siteApi";
import { reportSignature, useSiteStore } from "../../store/siteStore";
import { StatusMark } from "../site/SiteReport";
import { Button } from "../ui/Button";
import { InfoButton } from "../ui/InfoButton";
import { layoutChecklistInfo } from "../../constants/panelInfo";
import { MIN_SPACING_D } from "../../lib/layout/evaluate";

export interface ChecklistInput {
  siteDrawn: boolean;
  count: number;
  outside: number;
  excluded: number;
  basin: number;
  close: number;
  oss: boolean;
  overCapacity: number;
  crossings: number;
  /** Turbines with an unknown depth, outside the depth bands, on floating foundations. */
  depthUnknown: number;
  depthOut: number;
  floating: number;
  pywake: "fresh" | "stale" | "none";
}

interface Item {
  status: CheckStatus;
  title: string;
  detail: string;
  grid?: boolean;
}

const n = (k: number, what: string) => `${k} ${what}${k === 1 ? "" : "s"}`;

function SiteItem({ siteDrawn }: { siteDrawn: boolean }) {
  const report = useSiteStore((s) => s.report);
  const assessing = useSiteStore((s) => s.assessing);
  const assessError = useSiteStore((s) => s.assessError);
  const site = useSiteStore((s) => s.site);
  const criteria = useSiteStore((s) => s.criteria);
  const reportFor = useSiteStore((s) => s.reportFor);
  const assess = useSiteStore((s) => s.assess);
  const stale = report != null && reportFor !== reportSignature(site, criteria);

  let item: Item;
  let retry = false;
  if (!siteDrawn) item = { status: "info", title: "Site screening", detail: "No site of your own: the SB-510 boundary (energy basin PZP_44) is used." };
  else if (assessing) item = { status: "unknown", title: "Site screening", detail: "Assessing the site…" };
  else if (!report) {
    item = { status: assessError ? "fail" : "unknown", title: "Site screening", detail: assessError ? `Could not assess the site: ${assessError}` : "Not assessed yet." };
    retry = true;
  } else {
    const fails = report.checks.filter((c) => c.status === "fail");
    const warns = report.checks.filter((c) => c.status === "warn");
    item = {
      status: fails.length ? "fail" : warns.length ? "warn" : "pass",
      title: "Site screening",
      detail: fails.length
        ? `Fails: ${fails.map((c) => c.title).join(", ")}.`
        : warns.length
          ? `To check: ${warns.map((c) => c.title).join(", ")}.`
          : "Every screening check passes.",
    };
    if (stale || assessError) {
      item = { ...item, status: item.status === "fail" ? "fail" : "warn", detail: `${stale ? "Out of date (the site changed)." : `Last run failed: ${assessError}.`} ${item.detail}` };
      retry = true;
    }
  }
  return (
    <li className="flex items-start gap-2">
      {assessing ? (
        <span className="inline-flex w-[4.5rem] shrink-0 items-center gap-1 text-xs font-semibold uppercase text-text-muted">
          <Loader2 size={13} className="animate-spin" aria-hidden /> Wait
        </span>
      ) : (
        <StatusMark status={item.status} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-text-primary">{item.title}</span>
        <span className="block text-text-muted">{item.detail}</span>
      </span>
      {retry && siteDrawn && !assessing && (
        <Button variant="ghost" size="sm" onClick={() => void assess()}>
          <RefreshCw size={12} className="mr-1" aria-hidden /> Retry
        </Button>
      )}
    </li>
  );
}

function checklistItems(c: ChecklistInput): Item[] {
  const any = c.count > 0;
  return [
    { status: any ? "pass" : "fail", title: "Turbines placed", detail: any ? n(c.count, "turbine") : "Fill the site or add turbines.", grid: true },
    {
      status: !any ? "unknown" : c.outside ? "fail" : "pass",
      title: "Inside the site",
      detail: c.outside ? `${n(c.outside, "turbine")} outside the boundary.` : "All turbines inside the site boundary.",
      grid: true,
    },
    {
      status: !any ? "unknown" : c.excluded + c.basin ? "fail" : "pass",
      title: "Constraints and energy basin",
      detail:
        c.excluded + c.basin
          ? [c.excluded && `${n(c.excluded, "turbine")} in a constraint area`, c.basin && `${n(c.basin, "turbine")} outside the energy basins`].filter(Boolean).join(", ") + "."
          : "No turbine in Natura 2000, shipping, military or other wind farm areas; all in an energy basin.",
      grid: true,
    },
    {
      status: !any ? "unknown" : c.close ? "fail" : "pass",
      title: `Spacing ≥ ${MIN_SPACING_D} D`,
      detail: c.close ? `${n(c.close, "turbine")} closer than ${MIN_SPACING_D} D to a neighbour.` : `Every turbine at least ${MIN_SPACING_D} D from the next.`,
      grid: true,
    },
    { status: c.oss ? "pass" : "fail", title: "Offshore substation", detail: c.oss ? "Placed." : "Fill the site (places it) or load SB-510.", grid: true },
    {
      status: !c.oss || !any ? "unknown" : c.overCapacity || c.crossings ? "warn" : "pass",
      title: "Array cables",
      detail:
        c.overCapacity || c.crossings
          ? [c.overCapacity && `${n(c.overCapacity, "segment")} over capacity`, c.crossings && `${n(c.crossings, "crossing")}`].filter(Boolean).join(", ") + "."
          : "Every segment within its rating, no crossings.",
    },
    {
      status: !any ? "unknown" : c.depthOut || c.depthUnknown ? "warn" : c.floating ? "info" : "pass",
      title: "Water depth",
      detail:
        [
          c.depthUnknown && `${n(c.depthUnknown, "turbine")} without depth data`,
          c.depthOut && `${n(c.depthOut, "turbine")} outside the screening depth bands`,
          c.floating && `${n(c.floating, "turbine")} on floating foundations`,
        ]
          .filter(Boolean)
          .join(", ") || "Every turbine in fixed-bottom depth (EMODnet bathymetry).",
    },
    {
      status: c.pywake === "fresh" ? "pass" : c.pywake === "stale" ? "warn" : "unknown",
      title: "Reference AEP (PyWake)",
      detail: c.pywake === "fresh" ? "Run for this layout." : c.pywake === "stale" ? "The layout changed since the last run." : "Not run yet.",
    },
  ];
}

export default function LayoutChecklist(props: ChecklistInput) {
  const items = checklistItems(props);
  const gridOpen = items.filter((i) => i.grid).every((i) => i.status === "pass");
  return (
    <div className="space-y-2 rounded-lg border border-border-primary bg-bg-secondary p-3" data-tour="layout-checklist">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Layout checklist</h3>
        <InfoButton info={layoutChecklistInfo} />
      </div>
      <ul className="space-y-1.5 text-[12px]">
        <SiteItem siteDrawn={props.siteDrawn} />
        {items.map((i) => (
          <li key={i.title} className="flex items-start gap-2">
            <StatusMark status={i.status} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-text-primary">
                {i.title}
                {i.grid && <span className="ml-1.5 rounded bg-bg-tertiary px-1 py-px text-xs font-semibold uppercase text-text-muted">HV Grid</span>}
              </span>
              <span className="block text-text-muted">{i.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-secondary">
        {gridOpen ? "The layout meets the checks that open HV Grid in your own project." : "HV Grid opens in your own project once the checks marked HV Grid pass."}
      </p>
    </div>
  );
}
