import type { EducationContent } from "../../../types/education";

export const oamCostEducation: EducationContent = {
  id: "p1.oam-cost",
  title: "Operations & Maintenance Cost Model",
  subtitle: "Where the lifetime opex actually goes",
  discipline: "Finance",

  overview:
    "Offshore O&M is 25–35% of LCOE — a far bigger lever than the headline 'turbine price' figure. The cost model splits " +
    "annual opex into a fixed component (vessel charters, base crews, port lease, insurance) and a variable component " +
    "scaled by AEP (consumables, transmission charges, royalties). Operators benchmark themselves against £/MW·yr and " +
    "€/MWh figures to spot inefficiencies before they bleed into LCOE.",

  simpleExplanation:
    "Running an offshore wind farm is mostly about boats, helicopters, and parts. Some costs you pay no matter what " +
    "(vessel charter, port rent, technicians on payroll). Other costs go up the more electricity you make (grid use of " +
    "system charges, percentage royalties). The fixed part is the bigger one offshore — about 70% of the bill — which is " +
    "why getting more energy out of an existing farm is so profitable.",

  technicalExplanation:
    "Industry rule of thumb 2024: offshore opex 60–90 €/kW/yr → for a 510 MW farm, 30–46 M€/yr. Major component " +
    "exchanges (gearbox, blade, generator) are amortised over the warranty period and folded into the variable bucket. " +
    "OEM full-service contracts shift cost from variable to fixed and trade margin for predictability — banks like that. " +
    "Onshore opex is typically 25–40 €/kW/yr, less than half of offshore — most of the gap is vessel and logistics cost.",

  standards: [
    {
      label: "IEC 61400-26-1 — Availability metrics for O&M decisions",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEA Wind Task 26 — Cost of Wind Energy",
      type: "standard",
      url: "https://iea-wind.org/task26/",
    },
    {
      label: "G+ Good Practice Guidelines",
      type: "standard",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
  ],

  formulas: [
    {
      expression: "OPEX_annual = OPEX_fixed + c_var · AEP_net",
      variables: [
        { symbol: "OPEX_fixed", name: "Annual fixed cost (vessels, crews, insurance)", unit: "EUR/yr" },
        { symbol: "c_var", name: "Variable cost coefficient", unit: "EUR/MWh" },
        { symbol: "AEP_net", name: "Net annual energy production", unit: "MWh/yr" },
      ],
      explanation:
        "Two-part model used in IEA Task 26 reference cases. For offshore: OPEX_fixed dominates (~70%); for onshore the split " +
        "is closer to 50/50.",
    },
    {
      expression: "OPEX_specific = OPEX_annual / P_rated",
      variables: [
        { symbol: "OPEX_specific", name: "Specific opex", unit: "EUR/kW/yr" },
        { symbol: "P_rated", name: "Installed capacity", unit: "kW" },
      ],
      explanation:
        "The standard offshore benchmarking figure. 80 €/kW/yr is the typical 2024 number for a Baltic-class farm; below " +
        "60 indicates a very efficient operation, above 100 suggests trouble.",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 510 MW annual O&M budget",
      scenario:
        "OEM full-service contract 50 M EUR/yr (5-year), TUOS+royalties at 5 EUR/MWh, P50 AEP 2,140 GWh.",
      steps: [
        "Variable opex = 5 × 2,140,000 = 10,700,000 EUR/yr",
        "Fixed opex = 50,000,000 EUR/yr (OEM + base costs)",
        "Total opex = 60,700,000 EUR/yr",
        "Specific opex = 60,700,000 / 510,000 = 119 EUR/kW/yr",
        "EUR/MWh = 60,700,000 / 2,140,000 = 28.4 EUR/MWh",
      ],
      result:
        "Specific opex = 119 EUR/kW/yr — high end of the offshore range, reflecting a conservative full-service contract. " +
        "After warranty expiry (year 5+) the operator typically self-services and brings this down to ~85 EUR/kW/yr.",
    },
  ],

  realWorldCases: [
    {
      title: "Anholt (Denmark) post-warranty self-service",
      description:
        "Ørsted moved Anholt to self-service after the 5-year OEM warranty. Reported opex dropped from ~95 EUR/kW/yr to " +
        "~75 EUR/kW/yr — savings of ~8 M EUR/yr — by combining spare-part pooling and crew-sharing with adjacent farms.",
      takeaway:
        "Self-service after warranty is the single biggest opex lever. It requires investment in in-house engineering and " +
        "a critical mass of nearby assets.",
    },
    {
      title: "DONG Walney 1+2 vessel pooling",
      description:
        "Sharing CTV and SOV charters across adjacent UK farms saved an estimated 12% on combined vessel costs via reduced " +
        "deadhead miles and joint-rate negotiation.",
      takeaway:
        "Cluster strategies multiply value. They are why operators try to co-locate consents and why first-of-cluster project " +
        "economics are usually tougher than later neighbours.",
    },
  ],

  furtherReading: [
    {
      label: "Wind Europe — Offshore Wind in Europe (annual statistics)",
      type: "website",
      url: "https://windeurope.org/intelligence-platform/product/offshore-wind-in-europe-key-trends-and-statistics-2023/",
    },
    {
      label: "Carbon Trust — Offshore Wind Accelerator",
      type: "website",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/oam_cost.py",
      description: "Two-part opex model + per-vessel cost breakdown for the OAMCostPanel.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
