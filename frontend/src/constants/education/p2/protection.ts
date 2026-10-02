import type { EducationContent } from "../../../types/education";

export const protectionEducation: EducationContent = {
  id: "p2.protection",
  title: "Protection Zones, Grading and Clearance Time",
  subtitle: "Trip the faulted part — fast — and nothing else",
  discipline: "Electrical",

  overview:
    "Every part of the network belongs to a protection zone with its own main protection. When a fault occurs " +
    "that zone's relay must trip first and quickly; relays further upstream only back it up, after a deliberate " +
    "delay. Getting this right decides whether a cable fault costs one string of turbines or the whole farm.",

  simpleExplanation:
    "Like fuses in a house: the fuse for the kitchen should blow, not the one for the whole building. Protection " +
    "engineers arrange the trip times so the relay nearest the fault always acts first, and the others wait just " +
    "long enough to see whether it succeeded.",

  technicalExplanation:
    "Zones here: 66 kV string feeders (inverse-time overcurrent PTOC-01, backed up by the 66 kV incomer PTOC-02), " +
    "the OSS busbars (busbar differential 87B), the 220 kV export cable (line differential 87L plus distance " +
    "protection: zone 1 covers 80 % of the cable instantaneously, zone 2 120 % after 0.4 s). Differential " +
    "protection compares the currents at both ends of its zone and is inherently selective, so it can trip in " +
    "≈ 20–25 ms. Inverse-time relays are graded: the margin must be checked at the fault currents that can really " +
    "flow (IEC 60909 max and min), because the curves converge at high current. Clearance time = relay time + the " +
    "breaker's rated break time (3 cycles = 60 ms, arcing included). For zones the grid sees, the platform judges " +
    "main protection against 150 ms — the fault duration PSE's FRT profile assumes. For an array feeder, the limit " +
    "is the cable's short-circuit withstand (adiabatic I²t).",

  standards: [
    { label: "IEC 60255-151 — Over/under current protection (IDMT curves)", type: "standard" },
    { label: "IEC 60255-121 — Distance protection", type: "standard" },
    { label: "IEC 60255-187-1 — Differential protection", type: "standard" },
    { label: "IEC 60909-0 — Short-circuit currents", type: "standard" },
    { label: "IEC 62271-100 — AC circuit-breakers (rated break time)", type: "standard" },
    { label: "IEC 60949 — Thermally permissible short-circuit currents (adiabatic method)", type: "standard" },
  ],

  formulas: [
    {
      expression: "t = TMS · 0.14 / ((I / I_p)^0.02 − 1)",
      variables: [
        { symbol: "I_p", name: "Pickup current (CT primary × setting)", unit: "A" },
        { symbol: "TMS", name: "Time multiplier setting", unit: "—" },
      ],
      explanation: "IEC Standard Inverse. Very and Extremely Inverse use 13.5/1.0 and 80/2.0 for k/α.",
      reference: "IEC 60255-151",
    },
    {
      expression: "margin = t_upstream(I) − t_downstream(I) ≥ 300 ms",
      variables: [{ symbol: "I", name: "Fault current seen by both relays", unit: "kA" }],
      explanation: "Covers breaker break time, relay errors and overshoot. Evaluate at I_max and I_min.",
    },
    {
      expression: "I · √t ≤ k · S,   k = 143 A·√s/mm² (Cu, XLPE 90 → 250 °C)",
      variables: [
        { symbol: "S", name: "Conductor cross-section", unit: "mm²" },
        { symbol: "t", name: "Fault duration", unit: "s" },
      ],
      explanation: "Adiabatic short-circuit withstand of the cable.",
      reference: "IEC 60949",
    },
  ],

  workedExamples: [
    {
      title: "Feeder vs incomer at the 66 kV fault level",
      scenario: "PTOC-01: CT 1000 A, 1.2 × In = 1.2 kA, TMS 0.10. PTOC-02: CT 3000 A, 3.6 kA, TMS 0.15. Ik''max = 21.4 kA, Ik''min = 14.4 kA.",
      steps: [
        "At 21.4 kA: feeder I/I_p = 17.9 → t = 0.014 / (17.9^0.02 − 1) = 0.236 s; incomer I/I_p = 5.95 → 0.578 s; margin 342 ms",
        "At 14.4 kA: feeder 0.275 s, incomer 0.746 s; margin 471 ms",
        "Worst case is the maximum current — 342 ms ≥ 300 ms → selective",
        "Cut the incomer TMS to 0.05: it trips in 0.193 s, before the feeder → non-selective (the whole 66 kV section is lost)",
        "Head cable 800 mm²: withstand (143 × 800 / 21 400)² = 28.6 s ≫ 0.64 s backup clearance",
      ],
      result: "Selective with margin; try the TMS sliders to see where grading breaks.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    { label: "Network Protection & Automation Guide (NPAG)", type: "textbook", citation: "Alstom Grid / GE, 2011 edition" },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p5/protection_relay.py",
      description: "Settings, IEC curves, selectivity at IEC 60909 currents, fault study, TCC data.",
    },
  ],
};
