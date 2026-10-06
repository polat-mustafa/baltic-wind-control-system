/**
 * Indicative CAPEX and levelised cost of energy (LCOE) of a layout.
 *
 *   LCOE = (CAPEX · CRF + OPEX) / AEP_net,   CRF = r(1+r)ⁿ / ((1+r)ⁿ − 1)
 *
 * The unit costs below are ILLUSTRATIVE teaching defaults, chosen so a
 * ~500 MW Baltic project lands near 2.8 M€/MW and 60–80 €/MWh; they are not
 * market data. Every input is editable on the page.
 */

export interface CostInputs {
  turbineMEURperMW: number;
  /** Monopile up to 40 m water depth, jacket beyond. */
  monopileMEURperMW: number;
  jacketMEURperMW: number;
  arrayCableMEURperKm: number;
  ossMEURperMW: number;
  exportCableMEURperKm: number;
  installOtherMEURperMW: number;
  opexKEURperMWyr: number;
  waccPct: number;
  lifetimeYears: number;
}

export const DEFAULT_COSTS: CostInputs = {
  turbineMEURperMW: 1.3,
  monopileMEURperMW: 0.6,
  jacketMEURperMW: 0.8,
  arrayCableMEURperKm: 0.5,
  ossMEURperMW: 0.12,
  exportCableMEURperKm: 2.0,
  installOtherMEURperMW: 0.6,
  opexKEURperMWyr: 75,
  waccPct: 6,
  lifetimeYears: 25,
};

export const COST_LABELS: Record<keyof CostInputs, { label: string; unit: string }> = {
  turbineMEURperMW: { label: "Turbines (supply)", unit: "M€/MW" },
  monopileMEURperMW: { label: "Foundations, monopile (≤ 40 m)", unit: "M€/MW" },
  jacketMEURperMW: { label: "Foundations, jacket (> 40 m)", unit: "M€/MW" },
  arrayCableMEURperKm: { label: "Array cable, installed", unit: "M€/km" },
  ossMEURperMW: { label: "Offshore substation", unit: "M€/MW" },
  exportCableMEURperKm: { label: "Export cable, installed", unit: "M€/km" },
  installOtherMEURperMW: { label: "Installation, development, other", unit: "M€/MW" },
  opexKEURperMWyr: { label: "Operation and maintenance", unit: "k€/MW/yr" },
  waccPct: { label: "Discount rate (WACC)", unit: "%" },
  lifetimeYears: { label: "Lifetime", unit: "years" },
};

export const crf = (ratePct: number, years: number) => {
  const r = ratePct / 100;
  if (r === 0) return 1 / years;
  const f = (1 + r) ** years;
  return (r * f) / (f - 1);
};

export interface CostResult {
  lines: { label: string; meur: number }[];
  capexMEUR: number;
  capexMEURperMW: number;
  opexMEURyr: number;
  /** €/MWh, null without energy. */
  lcoe: number | null;
}

export function layoutCost(
  c: CostInputs,
  capacityMW: number,
  arrayKm: number,
  exportKm: number,
  maxDepthM: number | null,
  netGWh: number,
): CostResult {
  const foundation = maxDepthM != null && maxDepthM > 40 ? c.jacketMEURperMW : c.monopileMEURperMW;
  const lines = [
    { label: "Turbines", meur: c.turbineMEURperMW * capacityMW },
    { label: maxDepthM != null && maxDepthM > 40 ? "Foundations (jacket)" : "Foundations (monopile)", meur: foundation * capacityMW },
    { label: "Array cables", meur: c.arrayCableMEURperKm * arrayKm },
    { label: "Offshore substation", meur: c.ossMEURperMW * capacityMW },
    { label: "Export cable", meur: c.exportCableMEURperKm * exportKm },
    { label: "Installation and other", meur: c.installOtherMEURperMW * capacityMW },
  ];
  const capex = lines.reduce((s, l) => s + l.meur, 0);
  const opex = (c.opexKEURperMWyr * capacityMW) / 1000;
  const annual = capex * crf(c.waccPct, c.lifetimeYears) + opex; // M€/yr
  return {
    lines,
    capexMEUR: capex,
    capexMEURperMW: capacityMW > 0 ? capex / capacityMW : 0,
    opexMEURyr: opex,
    lcoe: netGWh > 0 ? (annual * 1e6) / (netGWh * 1000) : null,
  };
}
