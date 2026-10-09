/**
 * Scoring of the Academy missions that grade the learner's own work.
 *
 * Every score is 0–100 and comes with a breakdown so the learner sees what
 * earned and what cost points. Weights and thresholds are ILLUSTRATIVE
 * teaching choices (stated on the mission card); the quantities they grade
 * come from the engines: the site report (backend /api/v1/site/assess), the
 * permit decision (components/site/journey.ts), the layout evaluation
 * (lib/layout/evaluate.ts) and the Digital Twin ground truth.
 */

import { decide, type Outcome } from "../components/site/journey";
import type { LayoutEvaluation } from "../lib/layout/evaluate";
import type { FaultKind } from "../services/digitalTwinApi";
import type { AssessResponse } from "../services/siteApi";

export interface ScoreLine {
  label: string;
  points: number;
  max: number;
  note: string;
}

export interface Scored {
  score: number;
  lines: ScoreLine[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

function total(lines: ScoreLine[], penalty = 0): Scored {
  const sum = lines.reduce((s, l) => s + l.points, 0) - penalty;
  return { score: Math.max(0, Math.min(100, Math.round(sum))), lines };
}

// ── Site selection ───────────────────────────────────────────────

export const SITE_TARGET_MW = 500;

const OUTCOME_POINTS: Record<Outcome, number> = {
  approved: 40,
  approved_with_conditions: 30,
  more_information: 10,
  refused: 0,
};

/** Backend criteria.DEPTH_BANDS: suitability score by water depth (foundation type). */
export function depthScore(depthM: number): number {
  if (depthM >= 10 && depthM < 20) return 0.7;
  if (depthM >= 20 && depthM < 50) return 1;
  if (depthM >= 50 && depthM < 70) return 0.6;
  if (depthM >= 70) return 0.3;
  return 0;
}

/** Export route length for full and zero grid points [km]; straight line × 1.1 when no route was checked. */
export const ROUTE_RANGE: [number, number] = [60, 150];

/** `routeKm`: the checked export route (Site & Permits route check), if any. */
export function scoreSite(report: AssessResponse, routeKm?: number | null): Scored {
  const d = decide(report);
  const deepest = report.depth_m?.[1] ?? null;
  const km = routeKm ?? (report.grid_km == null ? null : report.grid_km * 1.1);
  const gridPts = km == null ? 0 : r1(15 * clamp01((ROUTE_RANGE[1] - km) / (ROUTE_RANGE[1] - ROUTE_RANGE[0])));
  return total([
    {
      label: "Permit decision",
      points: OUTCOME_POINTS[d.outcome],
      max: 40,
      note: d.outcome === "refused" ? `refused: ${d.reasons[0] ?? ""}` : d.outcome.replace(/_/g, " "),
    },
    {
      label: "Indicative capacity",
      points: r1(20 * clamp01(report.capacity_mw / SITE_TARGET_MW)),
      max: 20,
      note: `${report.capacity_mw.toFixed(0)} MW of the ${SITE_TARGET_MW} MW target`,
    },
    {
      label: "Water depth",
      points: deepest == null ? 0 : r1(15 * depthScore(deepest)),
      max: 15,
      note: deepest == null ? "unknown" : `deepest ${deepest.toFixed(0)} m (${report.foundation ?? "foundation band"})`,
    },
    {
      label: "Export cable length",
      points: gridPts,
      max: 15,
      note:
        km == null
          ? "unknown"
          : `${km.toFixed(0)} km ${routeKm != null ? "checked route" : "(straight line + 10 %)"} — full marks ≤ ${ROUTE_RANGE[0]} km, none ≥ ${ROUTE_RANGE[1]} km`,
    },
    {
      label: "Usable share of the area",
      points: r1(10 * clamp01(1 - report.excluded_fraction)),
      max: 10,
      note: `${(100 * (1 - report.excluded_fraction)).toFixed(0)} % not excluded`,
    },
  ]);
}

// ── Layout challenge ─────────────────────────────────────────────

export const LAYOUT_BAND_MW: [number, number] = [450, 550];
/** LCOE for zero and full marks [€/MWh] with the default (NREL 2024) cost inputs; SB-510 ≈ 116 at its site climate (A 10.80, k 2.04). */
export const LCOE_RANGE: [number, number] = [132, 115];
/**
 * Internal wake loss for full and zero marks [%], from the screening model
 * (Bastankhah, internal wakes only): SB-510's 6 × 8 D grid gives ≈ 5 %, a
 * 4 D-packed layout ≈ 12 %.
 */
export const WAKE_RANGE: [number, number] = [5, 12];
/** Closest-pair spacing for zero and full marks [rotor diameters]; below MIN_SPACING_D (4 D) turbines are "close". */
export const SPACING_RANGE: [number, number] = [4, 6];
/** Array cable per MW for full and zero marks [km/MW]. */
export const CABLE_RANGE: [number, number] = [0.1, 0.25];
export const INVALID_PENALTY = 10;

export function scoreLayout(e: LayoutEvaluation): Scored {
  const [lo, hi] = LAYOUT_BAND_MW;
  const off = e.capacityMW < lo ? lo - e.capacityMW : e.capacityMW > hi ? e.capacityMW - hi : 0;
  const lcoe = e.cost.lcoe;
  const wake = e.yield?.wakeLossPct ?? null;
  const kmPerMW = e.cables && e.capacityMW > 0 ? e.cables.totalKm / e.capacityMW : null;
  const invalid = e.outside + e.excluded;
  const lines: ScoreLine[] = [
    {
      label: "Capacity in the 450–550 MW band",
      points: r1(25 * clamp01(1 - off / 150)),
      max: 25,
      note: `${e.capacityMW} MW (${e.count} turbines)`,
    },
    {
      label: "Turbine spacing",
      points: e.minSpacingD == null ? 0 : r1(10 * clamp01((e.minSpacingD - SPACING_RANGE[0]) / (SPACING_RANGE[1] - SPACING_RANGE[0]))),
      max: 10,
      note:
        e.minSpacingD == null
          ? "—"
          : `closest pair ${e.minSpacingD.toFixed(1)} D${e.close ? `, ${e.close} turbine(s) under 4 D` : ""} (full marks ≥ ${SPACING_RANGE[1]} D)`,
    },
    {
      label: "Levelised cost of energy",
      points: lcoe == null ? 0 : r1(45 * clamp01((LCOE_RANGE[0] - lcoe) / (LCOE_RANGE[0] - LCOE_RANGE[1]))),
      max: 45,
      note: lcoe == null ? "no energy yet" : `${lcoe.toFixed(1)} €/MWh (full marks ≤ ${LCOE_RANGE[1]}, none ≥ ${LCOE_RANGE[0]})`,
    },
    {
      label: "Wake loss",
      points: wake == null ? 0 : r1(10 * clamp01((WAKE_RANGE[1] - wake) / (WAKE_RANGE[1] - WAKE_RANGE[0]))),
      max: 10,
      note: wake == null ? "—" : `${wake.toFixed(1)} % (full marks ≤ ${WAKE_RANGE[0]} %, none ≥ ${WAKE_RANGE[1]} %)`,
    },
    {
      label: "Array cable per MW",
      points: kmPerMW == null ? 0 : r1(10 * clamp01((CABLE_RANGE[1] - kmPerMW) / (CABLE_RANGE[1] - CABLE_RANGE[0]))),
      max: 10,
      note: kmPerMW == null ? "place the offshore substation" : `${(kmPerMW * 1000).toFixed(0)} m/MW (${e.cables!.totalKm.toFixed(1)} km)`,
    },
  ];
  if (invalid > 0)
    lines.push({
      label: "Turbines outside the site or in a constraint area",
      points: -INVALID_PENALTY * invalid,
      max: 0,
      note: `${invalid} × −${INVALID_PENALTY}`,
    });
  return total(lines);
}

// ── Digital Twin diagnosis ───────────────────────────────────────

export interface Finding {
  turbine: string;
  kind: FaultKind | null;
}

export const FALSE_ALARM_PENALTY = 15;
export const HEALTHY_FALSE_ALARM_PENALTY = 25;

/**
 * Half the credit of each injected fault for flagging its turbine, half for
 * naming the fault; every flagged healthy turbine costs points (a crew sent
 * to a healthy turbine is a real cost).
 */
export function scoreDiagnosis(truth: Finding[], picks: Finding[]): Scored {
  const truthBy = new Map(truth.map((t) => [t.turbine, t.kind]));
  const falseAlarms = picks.filter((p) => !truthBy.has(p.turbine));
  if (truth.length === 0) {
    return total([
      {
        label: "Healthy fleet left alone",
        points: 100 - HEALTHY_FALSE_ALARM_PENALTY * falseAlarms.length,
        max: 100,
        note: falseAlarms.length ? `flagged ${falseAlarms.map((p) => p.turbine).join(", ")}` : "no turbine flagged",
      },
    ]);
  }
  const per = 100 / truth.length;
  const pickBy = new Map(picks.map((p) => [p.turbine, p.kind]));
  const found = truth.filter((t) => pickBy.has(t.turbine));
  const named = found.filter((t) => pickBy.get(t.turbine) === t.kind);
  const lines: ScoreLine[] = [
    { label: "Faulty turbines found", points: r1((per / 2) * found.length), max: 50, note: `${found.length} of ${truth.length}` },
    { label: "Fault correctly named", points: r1((per / 2) * named.length), max: 50, note: `${named.length} of ${truth.length}` },
  ];
  if (falseAlarms.length)
    lines.push({
      label: "Healthy turbines flagged",
      points: -FALSE_ALARM_PENALTY * falseAlarms.length,
      max: 0,
      note: falseAlarms.map((p) => p.turbine).join(", "),
    });
  return total(lines);
}
