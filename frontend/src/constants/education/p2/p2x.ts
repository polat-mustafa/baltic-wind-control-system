import type { EducationContent } from "../../../types/education";

export const p2xEducation: EducationContent = {
  id: "p2.p2x",
  title: "Power-to-X on Surplus Wind",
  subtitle: "Why an electrolyser fed only by curtailed energy depends on its full-load hours",
  discipline: "Electrical",

  overview:
    "When a farm may export less than it can generate — a smaller grid connection, overplanting or congestion — " +
    "the energy above the limit is curtailed. An electrolyser next to the farm can turn some of it into hydrogen. " +
    "The energy is free, but the electrolyser is not: its cost per kilogram depends on how many hours a year it " +
    "actually runs.",

  simpleExplanation:
    "Sort the 8760 hours of a year from the windiest to the calmest and draw the farm's output: that is the " +
    "duration curve. The grid limit is a horizontal line across it. Everything above the line is lost unless the " +
    "electrolyser takes it. A small electrolyser runs in most of those hours; a big one runs at full power only in " +
    "the windiest few, so each kilogram carries more of its purchase price.",

  technicalExplanation:
    "The duration curve comes from the site's Weibull distribution (v̄ = 9.3 m/s, k = 2.2, as in P1) through a " +
    "multi-turbine power curve: the V236 curve averaged over a Gaussian spread of wind speed across the farm " +
    "(σ = 1 m/s, Nørgaard & Holttinen), times 97 % availability. Wakes are not deducted, so energies are upper " +
    "bounds. A PEM electrolyser at a system specific energy of 53 kWh/kg puts 33.33/53 ≈ 63 % of the electricity " +
    "into the hydrogen's lower heating value; it cannot run below about 10 % load. LCOH = annualised capital " +
    "(capital recovery factor at 7 % over 20 years, plus 3 % O&M) divided by the yearly output, plus the electricity " +
    "price times the specific energy. Turning the hydrogen back into power returns only about a third of the " +
    "electricity, so P2X serves hydrogen users rather than storage. Whether the hydrogen counts as renewable (RFNBO) " +
    "is set by EU rules on additionality and time correlation, which are not modelled. Cost inputs are assumptions.",

  standards: [
    { label: "ISO 22734 — Hydrogen generators using water electrolysis", type: "standard" },
    { label: "Commission Delegated Regulation (EU) 2023/1184 — rules for renewable hydrogen (RFNBO)", type: "regulation" },
  ],

  formulas: [
    {
      expression: "m_H₂ = E_el / SEC",
      variables: [
        { symbol: "E_el", name: "Electricity into the electrolyser", unit: "kWh" },
        { symbol: "SEC", name: "System specific energy (53, assumption)", unit: "kWh/kg" },
      ],
      explanation: "Hydrogen produced; LHV efficiency = 33.33 / SEC.",
    },
    {
      expression: "LCOH = CAPEX·(CRF + o) / (FLH / SEC) + p·SEC",
      variables: [
        { symbol: "CRF", name: "Capital recovery factor r(1+r)ⁿ/((1+r)ⁿ−1) = 0.094", unit: "1/yr" },
        { symbol: "o", name: "O&M share of CAPEX (3 %)", unit: "1/yr" },
        { symbol: "FLH", name: "Full-load hours", unit: "h/yr" },
        { symbol: "p", name: "Electricity price", unit: "€/kWh" },
      ],
      explanation: "Levelised cost of hydrogen; the capital term falls as 1/FLH.",
    },
  ],

  workedExamples: [
    {
      title: "60 MW on a 400 MW connection",
      scenario: "Surplus energy is free; installed cost 2000 €/kW.",
      steps: [
        "Absorbed: ≈ 179 GWh at ≈ 2980 full-load hours",
        "Hydrogen: 179 GWh / 53 kWh/kg ≈ 3380 t/yr",
        "Capital per kW-year: 2000 € · (0.094 + 0.03) ≈ 249 €; per kg: 249 / (2980/53) ≈ 4.4 €/kg",
      ],
      result: "A 150 MW electrolyser on the same connection runs fewer full-load hours, and each kilogram costs more.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "P. Nørgaard, H. Holttinen, A multi-turbine power curve approach",
      type: "paper",
      citation: "Nordic Wind Power Conference, Chalmers, 2004",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/planning.py", description: "farm_duration_mw(), p2x_study(): duration curve, electrolyser, LCOH." },
  ],
};
