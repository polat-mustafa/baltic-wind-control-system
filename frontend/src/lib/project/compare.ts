/**
 * Side-by-side numbers for "My projects" → Compare: the project report
 * (lib/project/report.ts, same screening engines as the Layout page) plus a
 * simple revenue view at one electricity price.
 *
 * Revenue model (teaching level, stated on the page): flat price, no
 * degradation, no curtailment, no tax; NPV of (revenue − OPEX) over the
 * project's lifetime at its WACC, minus CAPEX at year 0.
 */

import type { AssessResponse } from "../../services/siteApi";
import { CASE_STUDY_SITE } from "../../store/siteStore";
import { DEFAULT_COSTS } from "../layout/cost";
import { defaultExportKm } from "../layout/evaluate";
import type { ProjectDoc } from "./document";
import { buildReport } from "./report";

const HOURS_PER_YEAR = 8766;

export interface ProjectMetrics {
  name: string;
  turbines: number;
  capacityMW: number;
  siteAreaKm2: number | null;
  minSpacingD: number | null;
  meanWindMs: number;
  netGWh: number;
  wakeLossPct: number | null;
  /** Net capacity factor after wake and other losses. */
  capacityFactor: number;
  arrayCableKm: number | null;
  exportKm: number;
  capexMEUR: number;
  capexMEURperMW: number;
  opexMEURyr: number;
  lcoeEURperMWh: number | null;
  revenueMEURyr: number;
  npvMEUR: number;
  /** Simple payback [years], null if the yearly cash flow is not positive. */
  paybackYears: number | null;
  /** Where the wind and depth come from: the site assessment, or the regional fallback. */
  basis: string;
}

/** Present value of 1 per year for n years at rate r (annuity factor). */
export const annuity = (r: number, n: number) => (r > 0 ? (1 - (1 + r) ** -n) / r : n);

export function projectMetrics(doc: ProjectDoc, assessment: AssessResponse | null, priceEURperMWh: number): ProjectMetrics {
  const costs = { ...DEFAULT_COSTS, ...doc.costs };
  const exportKm = defaultExportKm(assessment?.grid_km, doc.site.routeKm);
  const rep = buildReport({
    name: doc.name,
    reference: false,
    generated: "",
    turbineModel: doc.turbineModel,
    site: doc.site.polygon ?? CASE_STUDY_SITE,
    turbines: doc.turbines,
    oss: doc.oss,
    costs,
    exportKm,
    assessment,
    layers: null,
    depthAt: () => null,
    pywake: null,
    history: [],
    moves: null,
    network: null,
    loadFlow: null,
    construction: null,
  });
  const capacityMW = rep.layout.capacity_mw;
  const netGWh = rep.energy.net_gwh;
  const revenue = (netGWh * priceEURperMWh) / 1000; // GWh × €/MWh = k€·1000 → M€
  const cash = revenue - rep.cost.opex_meur_yr;
  const npv = -rep.cost.capex_meur + cash * annuity(costs.waccPct / 100, costs.lifetimeYears);
  return {
    name: doc.name,
    turbines: rep.layout.turbines,
    capacityMW,
    siteAreaKm2: doc.site.polygon ? rep.layout.site_area_km2 : null,
    minSpacingD: rep.layout.min_spacing_d,
    meanWindMs: rep.wind.mean_ms,
    netGWh,
    wakeLossPct: rep.energy.screening?.wake_loss_pct ?? null,
    capacityFactor: capacityMW > 0 ? netGWh / ((capacityMW * HOURS_PER_YEAR) / 1000) : 0,
    arrayCableKm: rep.layout.array_cable_km,
    exportKm,
    capexMEUR: rep.cost.capex_meur,
    capexMEURperMW: rep.cost.capex_meur_per_mw,
    opexMEURyr: rep.cost.opex_meur_yr,
    lcoeEURperMWh: rep.cost.lcoe_eur_mwh,
    revenueMEURyr: Math.round(revenue * 10) / 10,
    npvMEUR: Math.round(npv),
    paybackYears: cash > 0 ? Math.round((rep.cost.capex_meur / cash) * 10) / 10 : null,
    basis: assessment?.wind && !assessment.wind.approximate ? "site assessment (NEWA/ERA5, EMODnet)" : "regional fallback (SB-510 climate)",
  };
}
