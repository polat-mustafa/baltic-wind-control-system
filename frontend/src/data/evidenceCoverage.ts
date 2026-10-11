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
    note: "Kriegers Flak (SG 8.0-167 DD) and Rødsand 1 (SWT-2.3-82): no open power curve, so their metered output is not used",
  },
  { module: "P5 — commissioning", note: "switching programme checked by load flow and interlocks only, no field record" },
  { module: "Site assessment", note: "screening layers are sourced data; the scoring itself is not validated" },
  { module: "Lifecycle (construction, O&M, decommissioning)", note: "weather windows use measured ERA5 sea states; costs and durations are illustrative" },
  { module: "Turbine physics (ROSCO)", note: "IEA 15 MW reference data; not compared with OpenFAST runs" },
  { module: "Control room live plant", note: "live Open-Meteo wind on the IEA 15 MW curve; the plant itself is a simulation" },
];
