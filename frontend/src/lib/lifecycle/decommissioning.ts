/**
 * Decommissioning scope, material inventory and end-of-life cost.
 *
 * Masses, shares left in situ and unit costs are ILLUSTRATIVE teaching
 * values (order of magnitude for a 15 MW turbine on a monopile in ~35 m of
 * water); every one is listed on the page. Vessel time and its cost come
 * from the campaign simulation (POST /api/v1/lifecycle/campaign, mode
 * "remove"), not from here.
 *
 * Legal frame (primary texts, checked):
 * - UNCLOS Art. 60(3): abandoned or disused installations shall be removed
 *   to ensure safety of navigation, with due regard to fishing and the marine
 *   environment; publicity for anything not entirely removed.
 * - IMO Res. A.672(16) (1989) §3.1–3.2: structures placed after 1 Jan 1998
 *   in < 100 m of water and < 4,000 t in air (excluding deck and
 *   superstructure) should be entirely removed; §3.6: a partially removed
 *   structure keeps ≥ 55 m of clear water column above it.
 */

export type FoundationRemoval = "cut" | "full";

export interface DecomOptions {
  foundations: FoundationRemoval;
  removeArray: boolean;
  removeExport: boolean;
  removeScour: boolean;
}

export const DEFAULT_DECOM: DecomOptions = { foundations: "cut", removeArray: false, removeExport: false, removeScour: false };

/** Illustrative masses [t]. */
export const MASS = {
  bladesPerTurbine: 3 * 65,
  nacellePerTurbine: 820,
  towerPerTurbine: 860,
  monopilePerTurbine: 1400,
  jacketPerTurbine: 1100,
  /** Share of a monopile below the cut (embedded part), left in situ when cut [-]. */
  monopileLeftWhenCut: 0.4,
  jacketPilesLeftWhenCut: 0.25,
  scourPerFoundation: 4000,
  arrayCablePerKm: 30,
  exportCablePerKm: 90,
  ossTopside: 2500,
  ossJacket: 1500,
};

/** Illustrative unit costs and credits. */
export const UNIT = {
  portHandlingEURperT: 60,
  steelScrapCreditEURperT: 250,
  cableRecyclingCreditEURperT: 600,
  bladeProcessingEURperT: 500,
  rockDisposalEURperT: 15,
  monitoringMEURperYear: 0.6,
  monitoringYears: 3,
  /** Project management, engineering, insurance on the offshore work. */
  managementShare: 0.12,
};

export type MaterialClass = "steel" | "composite" | "cable" | "rock";
export type Fate = "recycled" | "processed" | "left in situ";

export interface MaterialLine {
  item: string;
  cls: MaterialClass;
  tonnes: number;
  fate: Fate;
}

export interface FarmSize {
  turbines: number;
  arrayKm: number;
  exportKm: number;
  foundation: "monopile" | "jacket";
}

export function inventory(f: FarmSize, o: DecomOptions): MaterialLine[] {
  const n = f.turbines;
  const jacket = f.foundation === "jacket";
  const fnd = (jacket ? MASS.jacketPerTurbine : MASS.monopilePerTurbine) * n;
  const leftShare = o.foundations === "cut" ? (jacket ? MASS.jacketPilesLeftWhenCut : MASS.monopileLeftWhenCut) : 0;
  const lines: MaterialLine[] = [
    { item: "Blades (glass/carbon fibre composite)", cls: "composite", tonnes: MASS.bladesPerTurbine * n, fate: "processed" },
    { item: "Nacelles and hubs", cls: "steel", tonnes: MASS.nacellePerTurbine * n, fate: "recycled" },
    { item: "Towers", cls: "steel", tonnes: MASS.towerPerTurbine * n, fate: "recycled" },
    { item: jacket ? "Jackets (recovered part)" : "Monopiles and TPs (recovered part)", cls: "steel", tonnes: fnd * (1 - leftShare), fate: "recycled" },
    { item: "Offshore substation (topside and jacket)", cls: "steel", tonnes: MASS.ossTopside + MASS.ossJacket, fate: "recycled" },
  ];
  if (leftShare > 0) lines.push({ item: "Piles below the cut", cls: "steel", tonnes: fnd * leftShare, fate: "left in situ" });
  lines.push({
    item: "Array cables",
    cls: "cable",
    tonnes: MASS.arrayCablePerKm * f.arrayKm,
    fate: o.removeArray ? "recycled" : "left in situ",
  });
  lines.push({
    item: "Export cable (offshore part)",
    cls: "cable",
    tonnes: MASS.exportCablePerKm * f.exportKm,
    fate: o.removeExport ? "recycled" : "left in situ",
  });
  lines.push({ item: "Scour protection (rock)", cls: "rock", tonnes: MASS.scourPerFoundation * n, fate: o.removeScour ? "processed" : "left in situ" });
  return lines;
}

export interface EndOfLifeCost {
  lines: { label: string; meur: number }[];
  totalMEUR: number;
  perMW: number;
  recoveredT: number;
  leftT: number;
  /** Share of the recovered mass that is recycled [-]. */
  recycledShare: number;
}

/** End-of-life cost [M€]: vessel campaign (from the simulation) + onshore and seabed work − scrap credits. */
export function endOfLifeCost(lines: MaterialLine[], vesselMEUR: number, capacityMW: number): EndOfLifeCost {
  const t = (pred: (l: MaterialLine) => boolean) => lines.filter(pred).reduce((s, l) => s + l.tonnes, 0);
  const recovered = t((l) => l.fate !== "left in situ");
  const steelRec = t((l) => l.cls === "steel" && l.fate === "recycled");
  const cableRec = t((l) => l.cls === "cable" && l.fate === "recycled");
  const blades = t((l) => l.cls === "composite");
  const rock = t((l) => l.cls === "rock" && l.fate !== "left in situ");
  const offshore = vesselMEUR;
  const out = [
    { label: "Vessel campaign (simulated, P50)", meur: offshore },
    { label: "Port handling and dismantling", meur: ((recovered - rock) * UNIT.portHandlingEURperT) / 1e6 },
    { label: "Blade processing", meur: (blades * UNIT.bladeProcessingEURperT) / 1e6 },
    { label: "Rock disposal", meur: (rock * UNIT.rockDisposalEURperT) / 1e6 },
    { label: "Seabed monitoring after removal", meur: UNIT.monitoringMEURperYear * UNIT.monitoringYears },
    { label: "Management, engineering, insurance", meur: offshore * UNIT.managementShare },
    { label: "Steel scrap credit", meur: -(steelRec * UNIT.steelScrapCreditEURperT) / 1e6 },
    { label: "Cable recycling credit", meur: -(cableRec * UNIT.cableRecyclingCreditEURperT) / 1e6 },
  ];
  const total = out.reduce((s, l) => s + l.meur, 0);
  const recycled = t((l) => l.fate === "recycled");
  return {
    lines: out,
    totalMEUR: total,
    perMW: capacityMW > 0 ? total / capacityMW : 0,
    recoveredT: recovered,
    leftT: t((l) => l.fate === "left in situ"),
    recycledShare: recovered > 0 ? recycled / recovered : 0,
  };
}

/** Seabed restoration steps after removal (good practice, not a legal checklist). */
export const RESTORATION_STEPS: { title: string; text: string }[] = [
  {
    title: "Pre-removal survey",
    text: "Multibeam and side-scan survey of every position and cable route: the baseline the end state is compared with.",
  },
  {
    title: "Cut and recover",
    text: "Piles cut below the natural seabed (the depth is set in the approved decommissioning programme) so no stub can be uncovered by scour.",
  },
  {
    title: "Cable ends",
    text: "Cables left in situ are cut, sealed and the ends buried; their position, depth and burial are published for fishers and mariners.",
  },
  {
    title: "Debris clearance",
    text: "Clear dropped objects and cut ends; an over-trawl or ROV trial shows the area is safe for bottom fishing.",
  },
  {
    title: "Post-removal survey and monitoring",
    text: "Repeat the survey, notify the hydrographic office and monitor the seabed and any structures left in situ for a set period.",
  },
];

export const DECOM_SOURCES: { label: string; url: string }[] = [
  { label: "UNCLOS Art. 60(3) — removal of abandoned or disused installations", url: "https://www.un.org/depts/los/convention_agreements/texts/unclos/part5.htm" },
  {
    label: "IMO Res. A.672(16) — Guidelines and standards for the removal of offshore installations (1989)",
    url: "https://wwwcdn.imo.org/localresources/en/KnowledgeCentre/IndexofIMOResolutions/AssemblyDocuments/A.672(16).pdf",
  },
  {
    label: "UK Energy Act 2004 ss. 105–114 and the OREI decommissioning guidance (an example national regime)",
    url: "https://assets.publishing.service.gov.uk/media/5a74b1fded915d7ab83b5cb2/orei_guide.pdf",
  },
  {
    label: "WindEurope (2021) — call for a Europe-wide landfill ban on turbine blades; 85–90 % of turbine mass recyclable",
    url: "https://windeurope.org/news/wind-industry-calls-for-europe-wide-ban-on-landfilling-turbine-blades/",
  },
  {
    label: "Topham & McMillan (2017), Sustainable decommissioning of an offshore wind farm, Renewable Energy 102",
    url: "https://www.sciencedirect.com/science/article/pii/S0960148116309430",
  },
];
