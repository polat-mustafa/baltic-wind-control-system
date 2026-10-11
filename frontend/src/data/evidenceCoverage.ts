/**
 * Evidence page data types, check kinds and the modules without an external check
 * (pages/EvidencePage.tsx; rows in data/evidence.json).
 */

export type EvidenceKind = "measured" | "analytic" | "reference" | "standard";

export interface EvidenceItem {
  id: string;
  area: string;
  kind: EvidenceKind;
  claim: string;
  against: string;
  metric: string;
  value: number;
  unit: string;
  limit: string;
  test: string;
}

export const KINDS: { id: EvidenceKind; label: string; hint: string }[] = [
  { id: "measured", label: "Measured data", hint: "field measurements: SCADA, metered output, wake rows" },
  { id: "analytic", label: "Hand calculation", hint: "an independent closed-form or hand calculation" },
  { id: "reference", label: "Reference implementation", hint: "another published implementation of the same model" },
  { id: "standard", label: "Standard requirement", hint: "a limit set by a grid code or standard" },
];

/** Modules with no external check yet, and why — shown in the matrix as gaps. */
export const GAPS: { module: string; note: string }[] = [
  {
    module: "P1 — other real farms",
    note: "Kriegers Flak (SG 8.4-167 DD) and Rødsand 1 (SWT-2.3-82): no open power curve, so their metered output is not used. Next: Baltica 2 (107 × SG 14-222 DD, 1 498 MW, Polish EEZ) once it is commissioned (2027) and on ENTSO-E",
  },
  {
    module: "P1 — wind input at SB-510",
    note: "no offshore mast at the site; FINO2 (the nearest Baltic mast) needs a BSH data account — the owner's to-do",
  },
  {
    module: "P2 — reactor sizing vs a built farm",
    note: "no published MVAr ratings for Kriegers Flak, Anholt, Baltic Power, Baltica 2 or Hornsea 1/2, so the topology is checked instead. Baltica 2's grid-connection EIA: shunt reactors, harmonic filters and a STATCOM onshore. Hornsea 1/2 (Hjerrild et al., CIGRE 2019): reactors at both cable ends plus a mid-point station, STATCOMs onshore, line reactor below 50 % of the cable at energisation — the zero-miss limit the P5 programme now checks (pre-insertion resistor above it). Baltic Power (operator films, 2026): 4 export circuits (the design rule gives 4, see P2 — HV grid), and its OSS equipment list (transformers, 230/66 kV GIS, diesel, auxiliaries) names no reactor: at ≈ 40 km per circuit the charging current can be compensated onshore, where our rule still puts one at each end",
  },
  {
    module: "P4 — Baltic Power forecast site",
    note: "still energising (peak 295 of 1140 MW in the last 30 days); added once it reaches 90 % — a test enforces it",
  },
  { module: "P5 — commissioning", note: "switching programme checked by load flow and interlocks only, no field record" },
  { module: "Site assessment", note: "screening layers are sourced data; the scoring itself is not validated" },
  { module: "Lifecycle (construction, O&M, decommissioning)", note: "weather windows use measured ERA5 sea states; costs and durations are illustrative" },
  { module: "Control room live plant", note: "live Open-Meteo wind on the IEA 15 MW curve, faults at published offshore failure rates (Carroll et al. 2016), curtailment on the live RCE price; time compressed, not compared with a real plant's event log" },
];
