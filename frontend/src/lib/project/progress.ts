/**
 * Own-project locks: a module opens when the stage before it is done, as in a
 * real project — Site → Wind Resource / Layout → Grid → design freeze → Construction →
 * Commissioning → Hand-over → operation (SCADA, forecasting, digital twin)
 * and decommissioning. Control Room, Site & Permits, Turbine Physics and the
 * Academy are always open; in reference mode and during a guided tour nothing
 * is locked. The sidebar and the AppShell guard both read useLocks().
 */

import { useMemo } from "react";

import { decide, type Outcome } from "../../components/site/journey";
import { useLifecycleStore, type Milestone } from "../../store/lifecycleStore";
import { useModeStore } from "../../store/modeStore";
import { useProjectStore } from "../../store/projectStore";
import { useSiteStore } from "../../store/siteStore";
import { useTourStore } from "../../tour/tourStore";
import { layoutProblems, MIN_SPACING_D } from "../layout/evaluate";

/** Why a module is locked: what to do first, and where (`go`, `label`). */
export interface Lock {
  need: string;
  go: string;
  label: string;
}

export interface ProgressInput {
  hasSite: boolean;
  permitDone: boolean;
  /** Permit outlook of the assessed site; null until the assessment is back. */
  outcome: Outcome | null;
  turbines: number;
  oss: boolean;
  /** Turbines breaking a layout rule; null until the constraint layers are loaded. */
  problems: number | null;
  done: Milestone[];
}

const SITE = { go: "/develop", label: "Site & Permits" };
const LAYOUT = { go: "/develop/layout", label: "Layout" };

/** [module, module it follows, own condition]. */
const RULES: [string, string | null, (i: ProgressInput) => Lock | null][] = [
  ["/wind-resource", null, (i) => (i.hasSite ? null : { ...SITE, need: "Draw a site in Site & Permits." })],
  [
    "/develop/layout",
    "/wind-resource",
    (i) =>
      !i.permitDone
        ? { ...SITE, need: "Take the site through the permit stage in Site & Permits." }
        : i.outcome === null
          ? { ...SITE, need: "Waiting for the site assessment — open Site & Permits if it does not finish." }
          : i.outcome === "refused"
            ? { ...SITE, need: "The permit was refused: redraw the site clear of the failed checks." }
            : null,
  ],
  [
    "/hv-grid",
    "/develop/layout",
    (i) =>
      i.turbines === 0
        ? { ...LAYOUT, need: "Place the turbines in Layout." }
        : !i.oss
          ? { ...LAYOUT, need: "Place the offshore substation in Layout." }
          : i.problems === null
            ? { ...LAYOUT, need: "Checking the layout against the constraint layers…" }
            : i.problems > 0
              ? {
                  ...LAYOUT,
                  need: `Move the ${i.problems} turbine(s) that are outside the site, in a constraint area or closer than ${MIN_SPACING_D} D.`,
                }
              : null,
  ],
  [
    "/build",
    "/hv-grid",
    (i) =>
      i.done.includes("design")
        ? null
        : {
            go: "/hv-grid",
            label: "Grid Integration",
            need: "Freeze the electrical design: run the grid analysis — full-load voltages within 0.95–1.05 p.u., every branch ≤ 100 % — and mark it.",
          },
  ],
  [
    "/commissioning",
    "/build",
    (i) =>
      i.done.includes("build")
        ? null
        : { go: "/build", label: "Construction", need: "Simulate the construction campaign for your farm and mark it complete." },
  ],
  [
    "/build/handover",
    "/commissioning",
    (i) =>
      i.done.includes("commissioning")
        ? null
        : { go: "/commissioning", label: "Commissioning", need: "Complete a commissioning programme and mark the stage complete." },
  ],
  ...["/scada", "/forecast", "/digital-twin", "/decommission"].map(
    (path): [string, string, (i: ProgressInput) => Lock | null] => [
      path,
      "/build/handover",
      (i) => (i.done.includes("handover") ? null : { go: "/build/handover", label: "Hand-over", need: "Hand the farm over to operation." }),
    ],
  ),
];

/** Lock per route path (null = open); routes not listed are always open. */
export function locks(i: ProgressInput): Record<string, Lock | null> {
  const out: Record<string, Lock | null> = {};
  for (const [path, after, check] of RULES) out[path] = (after && out[after]) || check(i);
  return out;
}

/** Locks of the current project; empty in reference mode and during a tour. */
export function useLocks(): Record<string, Lock | null> {
  const own = useModeStore((s) => s.mode === "own");
  const touring = useTourStore((s) => s.activeTourId !== null);
  const site = useSiteStore((s) => s.site);
  const report = useSiteStore((s) => s.report);
  const permitDone = useSiteStore((s) => s.done.includes("permit"));
  const layers = useSiteStore((s) => s.layers);
  const turbines = useProjectStore((s) => s.turbines);
  const oss = useProjectStore((s) => s.oss);
  const done = useLifecycleStore((s) => s.done);
  const active = own && !touring;

  return useMemo(() => {
    if (!active) return {};
    const p = site && layers ? layoutProblems(site, turbines, layers) : null;
    return locks({
      hasSite: site !== null,
      permitDone,
      outcome: report ? decide(report).outcome : null,
      turbines: turbines.length,
      oss: oss !== null,
      problems: p ? p.outside + p.excluded + p.close : null,
      done,
    });
  }, [active, site, report, permitDone, layers, turbines, oss, done]);
}
