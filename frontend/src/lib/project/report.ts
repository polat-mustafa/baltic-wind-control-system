/**
 * Project report (route /report): one plain object with every number of the
 * project — site checks, permit outlook, layout, energy, suggested moves,
 * electrical design, cost and construction — with units in the key names and
 * the source of each block. The page renders it; "Download JSON" saves it as is.
 *
 * Pure: the page gathers the inputs (stores, backend answers) and calls
 * buildReport(); the engines are the Layout page's (lib/layout).
 */

import { decide, OUTCOME_LABEL } from "../../components/site/journey";
import type { AepRun } from "../../services/projectApi";
import type { AssessResponse, LayersResponse } from "../../services/siteApi";
import type { checkWakeMoves, WakeMoveResult } from "../../services/windResourceApi";
import type { Turbine } from "../../store/projectStore";
import type { LoadFlowResult, NetworkSpec } from "../../types/grid";
import type { CampaignResult } from "../../types/lifecycle";
import type { WakeAnalysisResult } from "../../types/windResource";
import { weibullMean } from "../../utils/aepMath";
import { turbineById } from "../../utils/turbineCurves";
import { routeCables } from "../layout/cables";
import { COST_DEFAULTS, DEFAULT_COSTS, layoutCost, type CostInputs } from "../layout/cost";
import { prepareYield, UNIFORM_ROSE, yieldOf, type WindRose } from "../layout/energy";
import { foundationFactor, foundationFor, layoutContext, OTHER_LOSSES, statusAt, WEIBULL_A, WEIBULL_K, type SeabedAt } from "../layout/evaluate";
import { minSpacing, polygonArea, type LonLat } from "../layout/geometry";
import { suggestMoves, type MoveSuggestion } from "../layout/suggest";
import { SB510_WIND } from "../../constants/sb510Wind";

export const REPORT_SCHEMA = "offshoreforge-report/1";

export const REVERIFY_NOTE =
  "Training output. Open data, reference-turbine curves, screening models and U.S. reference unit costs (2023) — " +
  "re-verify every number against primary data, surveys and vendor information before any real decision.";

export interface ReportInput {
  name: string;
  /** true: the SB-510 reference farm, false: the learner's own project. */
  reference: boolean;
  generated: string;
  /** Turbine model id (constants/turbineModels.ts). */
  turbineModel: string;
  site: LonLat[];
  turbines: Turbine[];
  oss: LonLat | null;
  costs: CostInputs;
  exportKm: number;
  assessment: AssessResponse | null;
  layers: LayersResponse | null;
  /** Water depth [m, positive down] at a point, null = no data. */
  depthAt: (p: LonLat) => number | null;
  /** Seabed substrate class at a point (EMODnet Geology), null = no data. */
  seabedAt?: SeabedAt;
  /** PyWake run for exactly this layout, else null. */
  pywake: WakeAnalysisResult | null;
  history: AepRun[];
  moves: { list: MoveSuggestion[]; checked: WakeMoveResult[] | null } | null;
  network: NetworkSpec | null;
  /** Full-load load flow of `network`. */
  loadFlow: LoadFlowResult | null;
  construction: CampaignResult | null;
}

const r = (v: number, d = 1) => Number(v.toFixed(d));

type LayoutPart = Pick<ReportInput, "turbineModel" | "site" | "turbines" | "oss" | "assessment" | "layers">;

/** Shared by the report and the move search: projection, site wind, screening yield, cable tree. */
function prepare(i: LayoutPart) {
  const a = i.assessment;
  const model = turbineById(i.turbineModel);
  const ratedMW = model.ratedKw / 1000;
  const ctx = layoutContext(i.site, i.layers, model.rotorDiameterM);
  const xy = i.turbines.map((t) => ctx.proj.toXY([t.lon, t.lat]));
  // Wind: the site climate of the assessment (NEWA + ERA5), else the labelled regional approximation.
  const w = a?.wind && !a.wind.approximate ? a.wind : null;
  const windA = w?.weibull_a ?? WEIBULL_A;
  const windK = w?.weibull_k ?? WEIBULL_K;
  const rose: WindRose = w?.sector_frequencies
    ? { directions: w.sector_frequencies.map((_, k) => k * 30), frequencies: w.sector_frequencies }
    : UNIFORM_ROSE;
  const yieldModel = xy.length ? prepareYield(xy, windA, windK, rose, model) : null;
  const cables = i.oss && xy.length ? routeCables(ctx.proj.toXY(i.oss), xy, ratedMW) : null;
  return { model, ratedMW, ctx, xy, w, windA, windK, yieldModel, cables };
}

/** Screening search for the best single moves (as the Layout page), then PyWake checks the top five. */
export async function findMoves(
  i: LayoutPart & Pick<ReportInput, "costs" | "exportKm">,
  check: typeof checkWakeMoves,
): Promise<NonNullable<ReportInput["moves"]>> {
  const p = prepare(i);
  if (!p.yieldModel) return { list: [], checked: null };
  const subsea = (i.layers?.layers ?? [])
    .filter((l) => l.role === "cable")
    .flatMap((l) => l.features.filter((f) => f.geometry.type === "LineString").map((f) => (f.geometry.coordinates as LonLat[]).map(p.ctx.proj.toXY)));
  const bufferKm = Number(i.layers?.criteria.find((c) => c.key === "cable_buffer_km")?.default ?? 0.5);
  const list = suggestMoves({
    ctx: p.ctx,
    model: p.yieldModel,
    ids: i.turbines.map((t) => t.id),
    oss: i.oss ? p.ctx.proj.toXY(i.oss) : null,
    tree: p.cables,
    costs: i.costs,
    exportKm: i.exportKm,
    maxDepthM: i.assessment?.depth_m?.[1] ?? null,
    cables: subsea,
    cableBufferM: bufferKm * 1000,
  });
  if (!list.length) return { list, checked: null };
  const r = await check(
    p.xy.map((q) => q.x),
    p.xy.map((q) => q.y),
    list.map((m) => ({ index: m.index, x_m: m.to.x, y_m: m.to.y })),
    { weibull_a: p.windA, weibull_k: p.windK, sector_frequencies: p.w?.sector_frequencies ?? null },
    i.turbineModel,
  );
  return { list, checked: r.moves };
}

export function buildReport(i: ReportInput) {
  const a = i.assessment;
  const { model, ratedMW, ctx, xy, w, windA, windK, yieldModel, cables } = prepare(i);
  const areaKm2 = polygonArea(ctx.siteXY) / 1e6;
  const capacityMW = i.turbines.length * ratedMW;
  const screening = yieldModel ? yieldOf(yieldModel) : null;

  const statuses = i.turbines.map((t, k) => statusAt(ctx, [t.lon, t.lat], xy.filter((_, j) => j !== k)));
  const depths = i.turbines.map((t) => i.depthAt([t.lon, t.lat]));
  const seabedAt: SeabedAt = i.seabedAt ?? (() => null);
  const seabeds = i.turbines.map((t) => seabedAt([t.lon, t.lat]));
  const count = (s: string) => statuses.filter((x) => x.status === s).length;
  const spacing = minSpacing(xy);

  const wakeNetGWh = i.pywake?.net_aep_gwh ?? screening?.netGWh ?? 0;
  const netGWh = wakeNetGWh * (1 - OTHER_LOSSES);
  const seabedFactor = foundationFactor(
    i.turbines.map((t) => [t.lon, t.lat]),
    seabedAt,
  );
  const cost = layoutCost(i.costs, capacityMW, cables?.totalKm ?? 0, i.exportKm, a?.depth_m?.[1] ?? null, netGWh, seabedFactor);
  const decision = decide(a);
  const lf = i.loadFlow;

  return {
    schema: REPORT_SCHEMA,
    app: "OffshoreForge",
    name: i.name,
    farm: i.reference ? "SB-510 reference" : "own project",
    generated: i.generated,
    note: REVERIFY_NOTE,
    site: a && {
      area_km2: r(a.area_km2),
      centroid_lonlat: a.centroid.map((v) => r(v, 4)),
      capacity_potential_mw: r(a.capacity_mw, 0),
      depth_m: a.depth_m,
      foundation: a.foundation,
      seabed_shares: a.seabed ?? null,
      shore_km: a.shore_km,
      grid_km: a.grid_km,
      grid_node: a.grid_node,
      energy_basins: a.energy_basins ?? [],
      projects: a.projects ?? [],
      checks: a.checks.map((c) => ({ title: c.title, status: c.status, detail: c.detail, reference: c.reference })),
    },
    permit: { outcome: decision.outcome, label: OUTCOME_LABEL[decision.outcome], reasons: decision.reasons, conditions: decision.conditions },
    wind: {
      height_m: w?.height_m ?? model.hubHeightM,
      mean_ms: r(w?.mean_ms ?? weibullMean(windA, windK), 2),
      weibull_a_ms: r(windA, 2),
      weibull_k: r(windK, 2),
      sector_frequencies: w?.sector_frequencies ?? null,
      source: w ? `${w.source} (${w.license})` : `SB-510 site climate (${SB510_WIND.source}: A ${SB510_WIND.weibullA} m/s, k ${SB510_WIND.weibullK}), uniform rose — no site assessment for this project`,
    },
    layout: {
      turbine_model: model.name,
      turbines: i.turbines.length,
      capacity_mw: capacityMW,
      site_area_km2: r(areaKm2),
      power_density_mw_km2: areaKm2 > 0 ? r(capacityMW / areaKm2, 2) : null,
      min_spacing_d: spacing ? r(spacing.m / model.rotorDiameterM, 2) : null,
      problems: { outside: count("outside"), excluded: count("excluded"), basin: count("basin"), close: count("close") },
      oss_lonlat: i.oss,
      array_cable_km: cables ? r(cables.totalKm) : null,
      array_cable_km_by_section: cables ? Object.fromEntries(Object.entries(cables.kmBySection).map(([k, v]) => [k, r(v)])) : null,
      strings: cables?.strings ?? null,
      cable_crossings: cables?.crossings ?? null,
      export_km: i.exportKm,
    },
    energy: {
      screening: screening && {
        gross_gwh: r(screening.grossGWh, 0),
        net_wake_gwh: r(screening.netGWh, 0),
        wake_loss_pct: r(screening.wakeLossPct, 2),
        capacity_factor: r(screening.capacityFactor, 3),
      },
      pywake: i.pywake && {
        gross_gwh: r(i.pywake.gross_aep_gwh, 0),
        net_wake_gwh: r(i.pywake.net_aep_gwh, 0),
        wake_loss_pct: r(i.pywake.wake_loss_percent, 2),
        capacity_factor: r(i.pywake.capacity_factor, 3),
      },
      other_losses_pct: r(100 * OTHER_LOSSES, 1),
      net_gwh: r(netGWh, 0),
      basis: i.pywake ? "PyWake" : "screening model",
      turbines: i.turbines.map((t, k) => ({
        id: t.id,
        lon: r(t.lon, 5),
        lat: r(t.lat, 5),
        depth_m: depths[k] == null ? null : r(depths[k]!, 0),
        foundation: foundationFor(depths[k], i.layers?.depth_bands),
        seabed: seabeds[k]?.name ?? null,
        status: statuses[k].status,
        wake_loss_pct: screening ? r(screening.perTurbineLossPct[k]) : null,
        net_gwh: i.pywake ? r(i.pywake.per_turbine_aep_gwh[k], 2) : screening ? r(screening.perTurbineNetGWh[k], 2) : null,
      })),
      history: i.history.map((h) => ({
        revision: h.revision,
        date: h.calculated_at,
        net_wake_gwh: r(h.net_aep_gwh, 0),
        wake_loss_pct: r(h.wake_loss_percent, 2),
        p50_gwh: r(h.p50_gwh, 0),
        p90_gwh: r(h.p90_gwh, 0),
      })),
    },
    moves:
      i.moves &&
      i.moves.list.map((m, k) => ({
        turbine: m.id,
        distance_m: r(m.distM, 0),
        bearing_deg: r(m.bearingDeg, 0),
        screening_gain_pct: r(m.deltaPct, 3),
        pywake_gain_pct: i.moves?.checked ? r(i.moves.checked[k].delta_percent, 3) : null,
        confirmed: i.moves?.checked ? i.moves.checked[k].delta_gwh > 0 : null,
        lcoe_change_eur_mwh: r(m.deltaLcoe, 2),
      })),
    electrical: i.network && {
      strings: i.network.string_layout,
      array_kv: i.network.array_voltage_kv,
      export_kv: i.network.export_voltage_kv,
      grid_kv: i.network.grid_voltage_kv,
      export_circuits: i.network.num_export_cables,
      export_km: i.network.export_length_km,
      cable_charging_mvar: r(i.network.cable_q_mvar, 0),
      oss_transformers: `${i.network.num_oss_transformers} × ${i.network.oss_trafo_mva} MVA`,
      onshore_transformers: `${i.network.num_onshore_transformers} × ${i.network.onshore_trafo_mva} MVA`,
      statcom_mvar: i.network.statcom_rating_mvar,
      reactors: `${i.network.num_reactors} × ${i.network.reactor_unit_mvar} MVAr`,
      full_load: lf && {
        converged: lf.converged,
        v_min_pu: r(lf.v_min_pu, 3),
        v_max_pu: r(lf.v_max_pu, 3),
        voltage_ok: lf.voltage_compliant,
        max_line_loading_pct: r(Math.max(0, ...lf.lines.map((l) => l.loading_percent))),
        max_transformer_loading_pct: r(Math.max(0, ...lf.transformers.map((t) => t.loading_percent))),
        losses_mw: r(lf.total_loss_mw, 2),
        poc_p_mw: r(lf.poc_p_mw),
        poc_q_mvar: r(lf.poc_q_mvar),
        statcom_q_mvar: r(lf.statcom_q_mvar),
      },
    },
    cost: {
      lines_meur: cost.lines.map((l) => ({ item: l.label, meur: r(l.meur, 0) })),
      capex_meur: r(cost.capexMEUR, 0),
      capex_meur_per_mw: r(cost.capexMEURperMW, 2),
      seabed_factor: r(seabedFactor, 3),
      opex_meur_yr: r(cost.opexMEURyr, 1),
      wacc_pct: i.costs.waccPct,
      lifetime_years: i.costs.lifetimeYears,
      lcoe_eur_mwh: cost.lcoe == null ? null : r(cost.lcoe, 1),
      source: costSource(i.costs),
    },
    construction: i.construction && {
      start: i.construction.start_date,
      weather_years: i.construction.runs,
      total_days: i.construction.total_days,
      cost_meur: i.construction.cost_meur,
      milestones: i.construction.milestones.map((m) => ({ label: m.label, date_p50: m.date_p50, date_p90: m.date_p90 })),
    },
    sources: [
      ...(i.layers?.layers ?? []).map((l) => ({ data: l.title, source: l.source, license: l.license, retrieved: l.retrieved })),
      { data: "Turbine power and thrust curves", source: model.source, license: model.license, retrieved: "" },
      ...new Map(
        Object.values(COST_DEFAULTS)
          .filter((c) => c.quality !== "illustrative")
          .map((c) => [c.source, { data: "Unit cost defaults (2023 USD → € at 1.0813 $/€)", source: c.source, license: c.license ?? "", retrieved: c.retrieved ?? "" }]),
      ).values(),
    ],
  };
}

/** Which unit costs the report used: the sourced defaults, or the user's own values. */
export function costSource(c: CostInputs): string {
  const own = (Object.keys(DEFAULT_COSTS) as (keyof CostInputs)[]).filter((k) => c[k] !== DEFAULT_COSTS[k]);
  const base = "NREL Cost of Wind Energy Review 2024 + ORBIT cable library (2023 USD → € at 1.0813 $/€; jacket, seabed factors and WACC are teaching assumptions)";
  return own.length ? `${base}; own values for: ${own.map((k) => COST_DEFAULTS[k].label).join(", ")}` : base;
}

export type ProjectReport = ReturnType<typeof buildReport>;
