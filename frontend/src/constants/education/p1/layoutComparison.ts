import type { EducationContent } from "../../../types/education";

export const layoutComparisonEducation: EducationContent = {
  id: "p1.layout-comparison",
  title: "Layout Comparison",
  subtitle: "Same turbines, different positions — what is it worth?",
  discipline: "Civil",

  overview:
    "Layout alternatives are compared on the full chain, not on wake loss alone: net AEP, P90, capacity factor and " +
    "revenue — and, in the Farm Comparison tab, cable losses and LCOE. The core trade-off is wake vs. seabed and " +
    "cable: tighter spacing loses more energy to wakes; wider spacing needs more area, longer array cables and often " +
    "more expensive foundations.",

  simpleExplanation:
    "Put 34 turbines on graph paper. Packed tightly, the back rows steal each other's wind. Spread out, you pay for " +
    "more underwater cable and seabed. The comparison shows how much energy each arrangement delivers so the " +
    "difference can be weighed against its cost.",

  technicalExplanation:
    "Both layouts here run through identical models: the same 12-sector wind rose, PyWake BPA wakes, blockage and the " +
    "loss cascade. Staggering rows means a turbine is rarely directly behind its neighbour for the dominant directions, " +
    "so wake loss drops slightly. Gains from layout changes inside a fixed area are usually small (tenths of a percent " +
    "to a few percent); larger gains need more area or a different turbine count.",

  standards: [
    {
      label: "IEC 61400-15 (series) — Energy yield assessment",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-ST-0359 — Subsea power cables for wind power plants",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "ΔNPV ≈ ΔAEP · price · AF − ΔCAPEX,    AF = (1 − (1+r)^−n) / r",
      variables: [
        { symbol: "ΔAEP", name: "Energy difference between layouts", unit: "MWh/yr" },
        { symbol: "AF", name: "Annuity factor (r = 6 %, n = 25 → 12.78)", unit: "yr" },
        { symbol: "ΔCAPEX", name: "Extra capital cost (cables, foundations)", unit: "€" },
      ],
      explanation:
        "A layout is better only if its extra energy, valued over the project life, pays for its extra cost.",
    },
  ],

  workedExamples: [
    {
      title: "Regular vs staggered on this platform",
      scenario: "Results from the AEP tab: staggered gains ≈ 2.3 GWh/yr net (0.11 %); price 72 €/MWh; r = 6 %, n = 25 yr.",
      steps: [
        "Extra revenue = 2,260 MWh × 72 € = 0.163 M€/yr",
        "Present value = 0.163 × 12.78 = 2.1 M€",
        "→ the staggered layout is worth it if it costs less than ≈ 2 M€ more (≈ 2 km of extra 66 kV cable)",
      ],
      result:
        "A 0.1 % AEP gain sounds negligible, but over 25 years it is worth about two million euros — the same order as the " +
        "cable and installation cost of moving a handful of turbines.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "TopFarm — open-source wind farm layout optimisation (DTU)",
      type: "website",
      url: "https://topfarm.pages.windenergy.dtu.dk/TopFarm2/",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/aep_calculator.py",
      description: "compare_layouts() — runs each layout through the same cascade.",
    },
    {
      file: "backend/app/services/p1/layout_optimizer.py",
      description: "Regular / staggered grid generators and the layout optimiser.",
    },
  ],

};
