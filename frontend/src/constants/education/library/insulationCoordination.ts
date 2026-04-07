import type { EducationContent } from "../../../types/education";

export const insulationCoordinationEducation: EducationContent = {
  id: "library.insulation-coordination",
  title: "Insulation Coordination",
  subtitle: "Sizing the air gaps and surge arresters that keep the grid alive",
  discipline: "Electrical",

  overview:
    "Insulation coordination is the science of choosing equipment insulation strength such that switching surges, " +
    "lightning surges and temporary overvoltages do not cause flashovers. The output is a Basic Insulation Level (BIL) " +
    "and a switching impulse withstand (BSL) for each voltage class, and a surge arrester rating that limits the " +
    "incoming overvoltage to a level the equipment can survive. Get this wrong and 220 kV switchgear gets flashed by a " +
    "lightning strike that should have been clamped 50 m upstream.",

  simpleExplanation:
    "Power lines and transformers occasionally see voltage spikes — from lightning, from switching, from faults. The " +
    "engineer's job is to make sure that the spike never exceeds what the equipment can withstand. We do this by " +
    "(a) building enough insulation into the equipment, and (b) installing surge arresters that act like pressure " +
    "relief valves, dumping excess voltage to earth.",

  technicalExplanation:
    "Method follows IEC 60071-1 (general principles) and IEC 60071-2 (application guide). Three classes of overvoltage " +
    "are considered: temporary (TOV) from earth faults and load rejection, slow-front from switching (~1 ms duration), " +
    "and fast-front from lightning (~1 µs). For 220 kV systems the standard BIL is 1,050 kV, BSL 850 kV, supported by " +
    "metal-oxide surge arresters with continuous operating voltage U_c ≈ 154 kV and protective level V_pl ≈ 410 kV at " +
    "10 kA. The protective margin V_pl / BIL ≈ 0.4 must hold under the worst-case discharge wave shape.",

  standards: [
    {
      label: "IEC 60071-1 — Insulation coordination definitions and rules",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Insulation_coordination",
    },
    {
      label: "IEC 60071-2 — Application guide for insulation coordination",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Insulation_coordination",
    },
    {
      label: "IEC 60099-4 — Metal-oxide surge arresters without gaps",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Surge_arrester",
    },
    {
      label: "IEEE 1313.2 — Guide for insulation coordination",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Insulation_coordination",
    },
  ],

  formulas: [
    {
      expression: "U_w = K_a · K_s · U_rp",
      variables: [
        { symbol: "U_w", name: "Required withstand voltage", unit: "kV" },
        { symbol: "U_rp", name: "Representative overvoltage (statistical)", unit: "kV" },
        { symbol: "K_s", name: "Safety factor (1.05–1.15 for SF6, 1.15 for ext. insulation)", unit: "—" },
        { symbol: "K_a", name: "Atmospheric correction (≥1 above 1,000 m altitude)", unit: "—" },
      ],
      explanation:
        "Bridging step from statistical overvoltage (with target failure rate) to manufacturer rated withstand. K_s buys " +
        "back margin for ageing, manufacturing tolerance and EMTP modelling uncertainty.",
      reference: "IEC 60071-2 §4",
    },
    {
      expression: "M_p = (V_pl − BIL) / BIL ≤ −0.40",
      variables: [
        { symbol: "M_p", name: "Protective margin (lightning)", unit: "—" },
        { symbol: "V_pl", name: "Surge arrester protective level @ 10 kA", unit: "kV" },
        { symbol: "BIL", name: "Basic insulation level", unit: "kV" },
      ],
      explanation:
        "IEC 60071-2 recommends a protective margin of at least 40%, meaning V_pl ≤ 0.6 BIL. For Baltic Wind 220 kV " +
        "switchgear: V_pl = 410 kV, BIL = 1,050 kV → M_p = -0.61, well clear.",
    },
  ],

  workedExamples: [
    {
      title: "Surge arrester selection for Baltic Wind 220 kV OSS bus",
      scenario:
        "220 kV system, U_s = 245 kV, expected TOV from earth fault 1.5 pu for 1 s.",
      steps: [
        "U_c (continuous operating voltage) ≥ U_s/√3 = 141 kV → choose 154 kV",
        "U_r (rated voltage) = 1.25 × U_c = 192 kV → choose 198 kV from manufacturer catalogue",
        "TOV capability check: 1.5 × U_s/√3 = 212 kV for 1 s (within 10-s capability of a 198 kV arrester)",
        "Lightning protective level @ 10 kA from datasheet: V_pl = 410 kV",
        "Protective margin vs BIL 1,050 kV: M_p = (410 − 1050)/1050 = -0.61 (well below the −0.40 limit)",
      ],
      result:
        "U_c = 154 kV, U_r = 198 kV class arrester at every termination of the 220 kV OSS bus. Cost ~€60,000 per arrester " +
        "set; cheap insurance against a flash that would otherwise destroy the GIS.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea 1 — switching transient damage to early commissioning equipment",
      description:
        "Energising the 220 kV export cable for the first time produced switching transients that exceeded the rated " +
        "TRV of one of the offshore CBs. The CB was uprated; the lesson now drives pre-energisation EMT studies for every " +
        "offshore HV connection.",
      takeaway:
        "Always run an EMT (electromagnetic transient) study before first energisation. Quasi-steady-state load flow does " +
        "not capture switching transients.",
    },
  ],

  furtherReading: [
    {
      label: "CIGRE TB 689 — System operation procedures for offshore wind",
      type: "standard",
      url: "https://www.e-cigre.org/",
    },
    {
      label: "Hileman — Insulation Coordination for Power Systems",
      type: "textbook",
      citation: "CRC Press 1999, ISBN 978-0824799571",
    },
  ],

  relatedLessons: ["lesson-010"],
};
