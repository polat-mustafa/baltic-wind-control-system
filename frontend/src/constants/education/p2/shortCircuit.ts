import type { EducationContent } from "../../../types/education";

export const shortCircuitEducation: EducationContent = {
  id: "p2.short-circuit",
  title: "Short-Circuit Currents (IEC 60909)",
  subtitle: "How big a fault current every breaker must interrupt and close onto",
  discipline: "Electrical",

  overview:
    "When a fault short-circuits a busbar, the current is limited only by the impedance between the sources and the " +
    "fault. IEC 60909 gives a standard way to compute it: the initial symmetrical current Ik'' sets the breaking duty " +
    "of circuit breakers, the peak current ip (first half-cycle, with DC offset) sets the making duty and the " +
    "mechanical stress on busbars.",

  simpleExplanation:
    "A short circuit is the grid trying to push as much current as it can through a path with almost no resistance. " +
    "Breakers must be able to stop that current, and to survive closing onto it. The stronger the grid and the closer " +
    "the fault to big sources, the larger the current.",

  technicalExplanation:
    "IEC 60909 replaces the pre-fault load flow by an equivalent voltage source c·Un/√3 at the fault, with c = 1.10 " +
    "for maximum currents (breaker sizing) and 1.00 for minimum currents (protection sensitivity) at HV. Full-converter " +
    "WTGs are current sources limited to about their rated current (k·In with k ≈ 1–1.2), so they add little. For " +
    "maximum currents cable resistance is taken at 20 °C (lowest R, highest current). pandapower's calc_sc() implements " +
    "the standard, including the transformer correction factor K_T and κ from R/X (Rule 3: not re-implemented here).",

  standards: [
    { label: "IEC 60909-0:2016 — Short-circuit currents in three-phase AC systems", type: "standard" },
    { label: "IEC 62271-100 — AC circuit-breakers (rated making = 2.5 × breaking at 50 Hz)", type: "standard" },
  ],

  formulas: [
    {
      expression: "Ik'' = c · Un / (√3 · |Zk|),   ip = κ · √2 · Ik'',   κ = 1.02 + 0.98·e^(−3R/X)",
      variables: [
        { symbol: "c", name: "Voltage factor (1.10 max / 1.00 min at HV)", unit: "—" },
        { symbol: "Zk", name: "Short-circuit impedance at the fault", unit: "Ω" },
        { symbol: "κ", name: "Peak factor", unit: "—" },
      ],
      explanation: "Breaking duty from Ik'', making duty from ip.",
      reference: "IEC 60909-0:2016 §4.2–4.3",
    },
    {
      expression: "Sk'' = √3 · Un · Ik''",
      variables: [{ symbol: "Sk''", name: "Short-circuit power", unit: "MVA" }],
      explanation: "Grid strength; divided by the plant rating it gives the short-circuit ratio (SCR).",
    },
  ],

  workedExamples: [
    {
      title: "66 kV offshore switchgear duty",
      scenario: "Maximum case (c = 1.10), all WTGs contributing, OSS 66 kV busbar.",
      steps: [
        "Ik'' = 19.5 kA, ip = 44.8 kA (pandapower calc_sc)",
        "Breaking: 19.5 / 25 kA = 78 % of a 25 kA breaker",
        "Making: 44.8 / (2.5 × 25 = 62.5 kA) = 72 %",
      ],
      result:
        "25 kA switchgear is adequate with margin; a third 66/220 kV transformer in parallel would raise Ik'' to " +
        "≈ 21.2 kA (85 %) — every transformer paralleled eats into that margin.",
    },
  ],

  realWorldCases: [
    {
      title: "West Murray (Australia): when fault level is too low",
      description:
        "In a remote zone with a low-capacity 220 kV network and many inverter-based plants, AEMO declared a system strength gap in December 2019 and limited five solar farms to 50 % because of voltage oscillations, until tuned inverter settings were proven in April 2020.",
      takeaway: "Short-circuit power is not only breaker duty: a weak grid (low S_sc) limits how much converter-based generation can connect stably.",
      source: "AEMO media release, April 2020; AEMO West Murray presentation, Feb 2020",
    },
  ],

  furtherReading: [
    {
      label: "J. Schlabbach — Short-circuit currents",
      type: "textbook",
      citation: "IET Power and Energy Series 51, 2005",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/short_circuit.py", description: "calc_sc() wrapper, breaking + making duty check." },
  ],
};
