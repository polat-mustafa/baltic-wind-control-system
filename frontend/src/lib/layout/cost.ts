/**
 * Indicative CAPEX and levelised cost of energy (LCOE) of a layout.
 *
 *   LCOE = (CAPEX · CRF + OPEX) / AEP_net,   CRF = r(1+r)ⁿ / ((1+r)ⁿ − 1)
 *
 * Unit-cost defaults come from NREL's Cost of Wind Energy Review 2024 (fixed-bottom
 * reference: 600 MW, 12 MW monopiles in 34 m, U.S. North Atlantic, ORBIT CapEx, WOMBAT
 * OpEx) and the ORBIT v1.3 cable library, all in 2023 USD, converted at the ECB 2023
 * average of 1.0813 $/€. Every value carries its source (`COST_DEFAULTS`) and stays
 * editable on the Layout page.
 */

import type { Sourced } from "../../components/ui/SourceBadge";

export interface CostInputs {
  turbineMEURperMW: number;
  /** Monopile up to 40 m water depth, jacket beyond. */
  monopileMEURperMW: number;
  jacketMEURperMW: number;
  /** Supply per km of 66 kV array cable (laying is in "installation"). */
  arrayCableMEURperKm: number;
  ossMEURperMW: number;
  /** Supply per km of one 220 kV circuit; the export line multiplies by the circuits. */
  exportCircuitMEURperKm: number;
  installOtherMEURperMW: number;
  opexKEURperMWyr: number;
  waccPct: number;
  lifetimeYears: number;
}

/** ECB euro reference rate, 2023 annual average [$ per €]. */
export const USD_PER_EUR_2023 = 1.0813;
const eur = (usd: number) => Math.round((usd / USD_PER_EUR_2023) * 100) / 100;

const NREL = {
  source: "NREL, Cost of Wind Energy Review: 2024 Edition (Stehly, Duffy, Mulas Hernando), NREL/PR-5000-91775, fixed-bottom reference",
  license: "U.S. Government work",
  retrieved: "2026-10-08",
} as const;
const ORBIT = {
  source: "NREL ORBIT v1.3 cable library (github.com/WISDEM/ORBIT, library/cables)",
  license: "Apache-2.0",
  retrieved: "2026-10-08",
} as const;

export const COST_DEFAULTS: Record<keyof CostInputs, Sourced & { label: string }> = {
  turbineMEURperMW: {
    label: "Turbines (supply)", value: eur(1.77), unit: "M€/MW", quality: "literature", ...NREL,
    note: "Turbine 1 770 $/kW (2023 USD)",
  },
  monopileMEURperMW: {
    label: "Foundations, monopile (≤ 40 m)", value: eur(0.789), unit: "M€/MW", quality: "literature", ...NREL,
    note: "Substructure 764 + scour protection 25 $/kW (2023 USD), monopile in 34 m",
  },
  jacketMEURperMW: {
    label: "Foundations, jacket (> 40 m)", value: Math.round(eur(0.789) * 1.25 * 100) / 100, unit: "M€/MW", quality: "illustrative",
    source: "Teaching assumption: monopile cost + 25 %",
    note: "The NREL reference has monopiles only; replace with a jacket quote",
  },
  arrayCableMEURperKm: {
    label: "Array cable (supply)", value: eur(0.65), unit: "M€/km", quality: "literature", ...ORBIT,
    note: "XLPE_630mm_66kV cost_per_km 650 000 $ (supply)",
  },
  ossMEURperMW: {
    label: "Offshore substation", value: eur(0.243), unit: "M€/MW", quality: "literature", ...NREL,
    note: "Offshore substation 243 $/kW (2023 USD)",
  },
  exportCircuitMEURperKm: {
    label: "Export cable per circuit (supply)", value: eur(1.500902), unit: "M€/km", quality: "literature", ...ORBIT,
    note: "XLPE_1000mm_220kV cost_per_km 1 500 902 $ (supply, one circuit)",
  },
  installOtherMEURperMW: {
    label: "Installation, development, soft costs", value: eur(2.132), unit: "M€/MW", quality: "literature", ...NREL,
    note: "Installation 830 + development 123 + lease 167 + soft costs 1 012 $/kW (2023 USD; lease is the U.S. auction price)",
  },
  opexKEURperMWyr: {
    label: "Operation and maintenance", value: Math.round(135 / USD_PER_EUR_2023), unit: "k€/MW/yr", quality: "literature", ...NREL,
    note: "OpEx 135 $/kW-yr (2023 USD, WOMBAT)",
  },
  waccPct: {
    label: "Discount rate (real WACC)", value: 6, unit: "%", quality: "illustrative",
    source: "Teaching assumption",
    note: "NREL uses 4.01 % real / 6.61 % nominal for a U.S. project; set your own",
  },
  lifetimeYears: {
    label: "Lifetime", value: 25, unit: "years", quality: "literature", ...NREL,
    note: "Project design life 25 years",
  },
};

const keys = Object.keys(COST_DEFAULTS) as (keyof CostInputs)[];
export const DEFAULT_COSTS = Object.fromEntries(keys.map((k) => [k, COST_DEFAULTS[k].value])) as unknown as CostInputs;
export const COST_LABELS = Object.fromEntries(
  keys.map((k) => [k, { label: COST_DEFAULTS[k].label, unit: COST_DEFAULTS[k].unit }]),
) as Record<keyof CostInputs, { label: string; unit: string }>;

/**
 * 220 kV export circuits a farm needs: n = ⌈P / P_circuit(L)⌉,
 * P_circuit = √3·U·√(Imax² − (Ic/2)²), Ic = ωC·L·U/√3 — the backend `design()` rule
 * (services/p2/network_model.py, 1000 mm²: 0.95 kA, 190 nF/km).
 */
export function exportCircuits(capacityMW: number, km: number): number {
  if (capacityMW <= 0) return 0;
  const u = 220e3;
  const ic = 2 * Math.PI * 50 * 190e-9 * km * (u / Math.sqrt(3));
  const pCircuit = (Math.sqrt(3) * u * Math.sqrt(Math.max(950 ** 2 - (ic / 2) ** 2, 0))) / 1e6;
  return pCircuit > 0 ? Math.max(1, Math.ceil(capacityMW / pCircuit - 1e-9)) : 1;
}

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
  const circuits = exportCircuits(capacityMW, exportKm);
  const foundation = maxDepthM != null && maxDepthM > 40 ? c.jacketMEURperMW : c.monopileMEURperMW;
  const lines = [
    { label: "Turbines", meur: c.turbineMEURperMW * capacityMW },
    { label: maxDepthM != null && maxDepthM > 40 ? "Foundations (jacket)" : "Foundations (monopile)", meur: foundation * capacityMW },
    { label: "Array cables", meur: c.arrayCableMEURperKm * arrayKm },
    { label: "Offshore substation", meur: c.ossMEURperMW * capacityMW },
    { label: `Export cable (${circuits} × ${exportKm.toFixed(0)} km)`, meur: c.exportCircuitMEURperKm * exportKm * circuits },
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
