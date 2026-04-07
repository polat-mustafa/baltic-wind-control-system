import type { EducationContent } from "../../../types/education";

export const capacityFactorEducation: EducationContent = {
  id: "p1.capacity-factor",
  title: "Capacity Factor",
  subtitle: "How much of the nameplate rating actually comes out as energy",
  discipline: "Civil",

  overview:
    "Capacity factor is the single most-quoted metric in wind energy. It is the ratio of energy actually produced over a " +
    "year to the energy a turbine would produce if it ran flat-out at nameplate power for every hour of the year. Modern " +
    "offshore wind farms target 45–55%; the V236-15.0 MW pushes towards 60% in Class IA conditions thanks to its very large " +
    "swept area per MW. Onshore farms are typically 30–40%.",

  simpleExplanation:
    "If a 15 MW turbine could run at full power 24 hours a day for a year, it would produce 15 × 24 × 365 ≈ 131,400 MWh. " +
    "Real turbines never do that — sometimes the wind is too low, sometimes too high, sometimes the turbine is being " +
    "serviced. Capacity factor is the percentage of that theoretical maximum that you actually get. 50% means you got " +
    "half as much energy as if it ran at full power continuously.",

  technicalExplanation:
    "CF = AEP_net / (P_rated × 8760 h). For the V236-15 MW the specific power (rated power per rotor area) is " +
    "15,000 / 43,742 = 0.343 kW/m² — about half the figure for early-2010s onshore turbines, which is why the capacity " +
    "factor is so high. CF is sensitive to which AEP you cite: P50 CF is the mean; P90 CF is what banks see; operating " +
    "CF after the first 2 years is normally 1–3 percentage points higher than P50 forecast because availability beats expectations.",

  standards: [
    {
      label: "IEC 61400-12-1 — Power performance measurements",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-26-2 — Production-based availability",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEA Wind Annual Report",
      type: "website",
      url: "https://iea-wind.org/task26/",
    },
  ],

  formulas: [
    {
      expression: "CF = AEP_net / (P_rated · 8760)",
      variables: [
        { symbol: "CF", name: "Capacity factor", unit: "—" },
        { symbol: "AEP_net", name: "Annual net energy production", unit: "MWh/yr" },
        { symbol: "P_rated", name: "Nameplate (rated) power", unit: "MW" },
      ],
      explanation:
        "Always cite which AEP you used (P50, P75, P90) — the same farm has multiple legitimate CFs depending on the " +
        "exceedance level.",
    },
    {
      expression: "Specific power = P_rated / A_rotor",
      variables: [
        { symbol: "A_rotor", name: "Rotor swept area", unit: "m²" },
      ],
      explanation:
        "Lower specific power → higher CF at any given site. The V236-15.0 MW has 343 W/m², down from ~500 W/m² for earlier " +
        "offshore turbines. This is the primary driver of the modern capacity-factor revolution.",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 510 MW",
      scenario: "510 MW farm, P50 net AEP 2,140 GWh/yr (from the cascade example).",
      steps: [
        "Theoretical maximum = 510 × 8760 = 4,467,600 MWh = 4,468 GWh",
        "CF_P50 = 2,140 / 4,468 = 0.479",
      ],
      result: "Capacity factor at P50 ≈ 47.9%. Comparable to Borssele (NL) and Hornsea 2 (UK).",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea 2 (UK) — 2023 operating year",
      description: "47% measured capacity factor across the full 1.32 GW farm.",
      takeaway: "Mature offshore farms now consistently exceed 45% CF — the threshold once considered a research aspiration.",
    },
    {
      title: "Vestas V236-15 MW prototype (Østerild, Denmark)",
      description:
        "The prototype achieved a 64% capacity factor in a publicly-disclosed 24h test in early 2023 — unrepresentative of " +
        "annual operation but illustrative of the headroom of the larger rotor.",
      takeaway: "Single-day or single-month CFs can exceed 60%; annual CFs remain bounded by long-term wind variability.",
    },
  ],

  furtherReading: [
    {
      label: "IEA Wind Energy 2023 Annual Report",
      type: "website",
      url: "https://iea-wind.org/task26/",
    },
    {
      label: "IRENA — Renewable Capacity Statistics",
      type: "website",
      url: "https://www.irena.org/Publications/2023/Aug/Renewable-Power-Generation-Costs-in-2022",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/aep_calculator.py",
      description: "capacity_factor() helper — divides AEP by P_rated × 8760.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
