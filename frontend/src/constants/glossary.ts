/**
 * Glossary: one-line definitions of the terms the lessons and module pages use.
 *
 * Shown as "Key terms" chips (components/ui/KeyTerms.tsx) under a primer's overview —
 * not wrapped inside the prose, because the Turkish translator works on whole text
 * nodes and a term element in the middle of a sentence would split it. Every term and
 * definition has its Turkish in src/lib/i18n/tr/glossary.ts (checked by a test).
 * Numbers quote the SB-510 / IEA 15 MW values the rest of the app uses.
 */

export interface GlossaryTerm {
  term: string;
  definition: string;
  /** Where the term counts as present in a text (acronyms case-sensitive). */
  match: RegExp;
}

export const GLOSSARY: GlossaryTerm[] = [
  { term: "AEP", match: /\bAEP\b/, definition: "Annual energy production: the energy the farm delivers in an average year [GWh/yr]." },
  { term: "P50 / P90", match: /\bP(50|90)\b/, definition: "Yearly energy exceeded with 50 % / 90 % probability; lenders size debt on P90." },
  { term: "LCOE", match: /\bLCOE\b/, definition: "Levelised cost of energy: lifetime cost divided by lifetime energy [€/MWh]." },
  { term: "CAPEX", match: /\bCAPEX\b/, definition: "Capital expenditure: the one-off cost of building the farm." },
  { term: "OPEX", match: /\bOPEX\b/, definition: "Operating expenditure: the yearly cost of running and maintaining the farm." },
  { term: "Weibull", match: /\bWeibull\b/, definition: "Two-parameter distribution (scale A, shape k) of how often each wind speed occurs." },
  { term: "Cp", match: /\bCp\b/, definition: "Power coefficient: share of the wind's kinetic power the rotor converts; Betz limit 16/27 ≈ 0.593." },
  { term: "Ct", match: /\bCt\b/, definition: "Thrust coefficient: rotor thrust relative to the wind's dynamic pressure; it sets how deep the wake is." },
  { term: "TI", match: /\b(TI|turbulence intensity)\b/i, definition: "Turbulence intensity: standard deviation of the wind speed over its 10-minute mean." },
  { term: "Wake", match: /\bwakes?\b/i, definition: "The slower, more turbulent air behind a rotor; turbines downstream produce less in it." },
  { term: "Blockage", match: /\bblockage\b/i, definition: "The slow-down of the wind in front of a whole farm; a loss of a few percent." },
  { term: "Shear", match: /\bshear\b/i, definition: "Increase of wind speed with height, power law u ∝ z^α (α = 0.14 offshore in this app)." },
  { term: "Cut-in / cut-out", match: /\bcut-(in|out)\b/i, definition: "Wind speeds where the turbine starts and stops producing: 3 and 25 m/s for the IEA 15 MW." },
  { term: "Rated power", match: /\brated (power|wind|speed)\b/i, definition: "Maximum continuous output: 15 MW for the IEA 15 MW turbine, reached at 10.66 m/s." },
  { term: "STATCOM", match: /\bSTATCOM\b/, definition: "Static synchronous compensator: power electronics that inject or absorb reactive power within milliseconds." },
  { term: "Shunt reactor", match: /\b(shunt )?reactors?\b/i, definition: "Inductor connected to earth that absorbs the reactive power a long cable generates." },
  { term: "Ferranti effect", match: /\bFerranti\b/, definition: "Voltage rise at the far end of a lightly loaded cable or line, caused by its capacitance." },
  { term: "FRT", match: /\b(FRT|LVRT|ride-through)\b/i, definition: "Fault ride-through: the plant stays connected through a grid voltage dip and feeds reactive current." },
  { term: "SCR", match: /\bSCR\b/, definition: "Short-circuit ratio: grid short-circuit power over the plant rating; a low SCR means a weak grid." },
  { term: "IEC 60909", match: /\bIEC 60909\b/, definition: "The standard for calculating short-circuit currents in three-phase AC systems." },
  { term: "POC", match: /\b(POC|point of connection)\b/i, definition: "Point of connection: where the farm meets the TSO's grid and the grid code is checked." },
  { term: "PPC", match: /\b(PPC|power plant controller)\b/i, definition: "Power plant controller: sets every turbine's active and reactive power to meet the targets at the POC." },
  { term: "LFSM", match: /\bLFSM(-[OU])?\b/, definition: "Limited frequency-sensitive mode: power is reduced above 50.2 Hz (O) and raised below 49.8 Hz (U)." },
  { term: "NC RfG", match: /\bRfG\b/, definition: "EU network code Requirements for Generators: the grid-code rules every new plant must meet." },
  { term: "OSS", match: /\b(OSS|offshore substation)\b/i, definition: "Offshore substation: the platform that steps the 66 kV array voltage up to 220 kV for export." },
  { term: "SCADA", match: /\bSCADA\b/, definition: "Supervisory control and data acquisition: the control room's live view of the plant and its commands." },
  { term: "IEC 61850", match: /\bIEC 61850\b/, definition: "The communication standard for substation automation: data models, MMS reports and GOOSE." },
  { term: "GOOSE", match: /\bGOOSE\b/, definition: "IEC 61850 message that carries trips and interlocks on the station Ethernet in under 4 ms." },
  { term: "EIA", match: /\bEIA\b/, definition: "Environmental impact assessment: the study of a project's effects that the permit decision rests on." },
  { term: "nRMSE", match: /\bnRMSE\b/, definition: "Root-mean-square forecast error divided by the installed capacity [%]." },
  { term: "CRPS", match: /\bCRPS\b/, definition: "Continuous ranked probability score: the error of a probabilistic forecast, in the units of the data." },
  { term: "SHAP", match: /\bSHAP\b/, definition: "Method that splits one prediction into the contribution of each input feature." },
  { term: "EWMA", match: /\bEWMA\b/, definition: "Exponentially weighted moving average: a control chart that catches small, lasting shifts." },
];

/** Glossary terms that appear in any of the texts, in glossary order. */
export function termsIn(...texts: (string | undefined)[]): GlossaryTerm[] {
  const all = texts.filter(Boolean).join("\n");
  return GLOSSARY.filter((g) => g.match.test(all));
}
