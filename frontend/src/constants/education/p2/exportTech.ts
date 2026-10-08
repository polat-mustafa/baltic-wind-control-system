import type { EducationContent } from "../../../types/education";

export const exportTechEducation: EducationContent = {
  id: "p2.export-tech",
  title: "HVAC or HVDC Export",
  subtitle: "Why the charging current of a long AC cable decides the technology",
  discipline: "Electrical",

  overview:
    "An offshore wind farm sends its power to shore through submarine cables, either as three-phase AC or as DC " +
    "between two converter stations. Close to shore AC is simpler and cheaper; far from shore DC takes over. This " +
    "study shows the two physical reasons — cable charging and losses — for this farm's 510 MW over 10–200 km.",

  simpleExplanation:
    "A long AC cable is also a long capacitor. Every 50 Hz cycle it has to be charged and discharged, and that " +
    "charging current flows through the conductor even when no power is sent. The longer the cable, the more of the " +
    "conductor's current rating it uses up, until there is no room left for the power itself. A DC cable is charged " +
    "once and then carries only the useful current — but the two converter stations each lose about 1 % of the power.",

  technicalExplanation:
    "Per circuit the charging current is Ic = ωC·L·U/√3 and the reactive power ωC·U²·L. With the compensation " +
    "split between both ends, the largest current at a cable end is √(Ip² + (Ic/2)²); keeping it below the 825 A " +
    "rating (ABB/NKT datasheet, IEC 60287) leaves P_max = √3·U·√(Imax² − (Ic/2)²) per circuit. At 108 km this " +
    "farm's two circuits could carry about 546 MW; beyond roughly 127 km they could no longer carry 510 MW. Losses: the AC conductor loss includes the " +
    "charging current (mean Ic² along the cable = Ic²/12 with compensation at both ends) plus a dielectric loss " +
    "Q·tan δ. HVDC has no charging current and lower cable losses, but its converter losses hardly depend on " +
    "distance, so it loses less only on long routes. The real decision is made on cost — converter platforms against " +
    "extra AC circuits, mid-route compensation and reactors — which this study does not model; the commonly quoted " +
    "break-even of roughly 80–150 km depends on power, cable and converter prices. Limits: reactor, STATCOM and " +
    "transformer losses are left out, the converter loss is a flat 1 % per station (assumption), and the Ferranti " +
    "voltage rise is not computed here (the Grid tab's load flow solves it).",

  standards: [
    { label: "IEC 60287-1-1 — Current rating of cables: conductor and dielectric losses (Table 3: tan δ)", type: "standard" },
    { label: "IEC 60228 — Conductors of insulated cables (DC resistance at 20 °C)", type: "standard" },
  ],

  formulas: [
    {
      expression: "Q = ω·C·U²·L",
      variables: [
        { symbol: "C", name: "Capacitance per phase (190 nF/km)", unit: "F/km" },
        { symbol: "U", name: "Line voltage", unit: "V" },
        { symbol: "L", name: "Route length", unit: "km" },
      ],
      explanation: "Charging reactive power of one three-phase circuit — generated, so positive.",
    },
    {
      expression: "P_max = √3·U·√(Imax² − (Ic/2)²)",
      variables: [
        { symbol: "Imax", name: "Conductor current rating (825 A, ABB/NKT 2GM5007 Table 34)", unit: "A" },
        { symbol: "Ic", name: "Charging current ωC·L·U/√3", unit: "A" },
      ],
      explanation: "Active power one AC circuit can carry when compensated equally at both ends.",
    },
  ],

  workedExamples: [
    {
      title: "This farm at 108 km",
      scenario: "2 circuits, 220 kV, 190 nF/km, 825 A.",
      steps: [
        "ωC = 2π·50·190 nF = 59.7 µS/km",
        "Q = 2 · 59.7 µS/km · (220 kV)² · 108 km ≈ 624 Mvar — what the shunt reactors and STATCOM absorb",
        "Ic = 59.7 µS/km · 108 km · 127 kV ≈ 819 A per circuit; half at each end: 410 A",
        "P_max = 2 · √3 · 220 kV · √(825² − 410²) A ≈ 546 MW",
      ],
      result:
        "At 108 km the charging current costs ≈ 13 % of the capacity and 624 Mvar of compensation, split between a " +
        "reactor at each end of each cable (4 × 180 Mvar) so that both ends carry only half of it; AC is still the " +
        "cheaper choice, with 36 MW to spare (the load flow puts the cables at 99 % at 510 MW).",
    },
  ],

  realWorldCases: [],

  furtherReading: [],

  codeReferences: [
    { file: "backend/app/services/p2/planning.py", description: "export_comparison(): capacity, charging and losses vs length." },
  ],
};
