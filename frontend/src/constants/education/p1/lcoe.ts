import type { EducationContent } from "../../../types/education";

export const lcoeEducation: EducationContent = {
  id: "p1.lcoe-revenue",
  title: "Revenue & LCOE",
  subtitle: "Levelised cost of energy and how it links to project bankability",
  discipline: "Finance",

  overview:
    "LCOE (Levelised Cost of Energy) collapses every cost a project will ever incur — capex, opex, decommissioning, " +
    "financing — into a single €/MWh figure that can be compared against the strike price of a CfD or the captured market " +
    "price. It is the metric that most directly answers whether a project gets built. For Polish Baltic offshore in 2024 " +
    "the OZMB CfD strike price is around 80 EUR/MWh; bankable projects target an LCOE in the 50–70 EUR/MWh band.",

  simpleExplanation:
    "Imagine the wind farm as a 25-year savings account. You deposit a huge amount up front (building it) plus a small " +
    "amount each year (operating it). It pays you back by generating electricity. LCOE asks: what is the price per MWh " +
    "that makes the deposits and the payouts exactly balance, including the cost of borrowing the money? If the market " +
    "or the contract pays more than that, the project makes money.",

  technicalExplanation:
    "LCOE = (CAPEX·CRF + OPEX_annual) / AEP_net, where CRF (capital recovery factor) translates a lump-sum capex into an " +
    "equivalent annuity given a discount rate r and project lifetime n. Real LCOE uses real (inflation-adjusted) cash flows " +
    "and a real discount rate; nominal LCOE uses nominal. Always cite which one. Sensitivity to AEP is direct — using P90 " +
    "instead of P50 raises LCOE by ~10%, which is exactly why bankers run their financing model on P90.",

  standards: [
    {
      label: "IEA Wind Task 26 — Cost of Wind Energy",
      type: "standard",
      url: "https://iea-wind.org/task26/",
    },
    {
      label: "IRENA Renewable Power Generation Costs",
      type: "website",
      url: "https://www.irena.org/Publications/2023/Aug/Renewable-Power-Generation-Costs-in-2022",
    },
    {
      label: "DNV — Bankable Energy Yield Assessment",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "LCOE = (CAPEX · CRF + OPEX_annual) / AEP_net",
      variables: [
        { symbol: "LCOE", name: "Levelised cost of energy", unit: "EUR/MWh" },
        { symbol: "CAPEX", name: "Total upfront cost", unit: "EUR" },
        { symbol: "CRF", name: "Capital recovery factor", unit: "1/yr" },
        { symbol: "OPEX_annual", name: "Annual operating cost", unit: "EUR/yr" },
        { symbol: "AEP_net", name: "Net annual energy production", unit: "MWh/yr" },
      ],
      explanation:
        "Single-period simplification — adequate for screening. Lifetime models use a discounted-cash-flow form that handles " +
        "year-by-year availability and degradation.",
    },
    {
      expression: "CRF = r·(1+r)^n / ((1+r)^n − 1)",
      variables: [
        { symbol: "r", name: "Discount rate (WACC)", unit: "—" },
        { symbol: "n", name: "Project lifetime", unit: "yr" },
      ],
      explanation:
        "Annuitises a lump sum. For r = 6%, n = 25 yr → CRF ≈ 0.0782 — every 100 M EUR of capex becomes 7.82 M EUR/yr of " +
        "equivalent annual payments.",
    },
    {
      expression:
        "LCOE_DCF = Σ_t (Cost_t / (1+r)^t) / Σ_t (E_t / (1+r)^t)",
      variables: [
        { symbol: "Cost_t", name: "Total cost in year t", unit: "EUR" },
        { symbol: "E_t", name: "Energy produced in year t", unit: "MWh" },
        { symbol: "t", name: "Year index", unit: "yr" },
      ],
      explanation:
        "Discounted-cash-flow form used by DNV bankability templates. Handles non-uniform availability and turbine degradation.",
      reference: "IEA Wind Task 26",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 510 MW LCOE estimate",
      scenario:
        "CAPEX 1,800 M EUR (3,529 EUR/kW), OPEX 60 M EUR/yr, AEP P50 2,140 GWh/yr, WACC 6% real, 25-yr lifetime.",
      steps: [
        "CRF = 0.06 · 1.06^25 / (1.06^25 − 1) = 0.06 · 4.292 / 3.292 = 0.0782",
        "Annualised CAPEX = 1,800 × 0.0782 = 140.8 M EUR/yr",
        "Annual revenue requirement = 140.8 + 60 = 200.8 M EUR/yr",
        "LCOE = 200,800,000 / 2,140,000 = 93.8 EUR/MWh",
      ],
      result:
        "LCOE ≈ 94 EUR/MWh — above the OZMB CfD strike of ~80 EUR/MWh. This is why CAPEX has to come down, or AEP has to " +
        "be improved (better wakes, taller hubs), or WACC reduced via debt sculpting before this hypothetical project is " +
        "actually bankable. Real Polish Baltic projects in 2024 quote 65–75 EUR/MWh by leveraging cheaper debt and economies of scale.",
    },
  ],

  realWorldCases: [
    {
      title: "OZMB Polish offshore wind support 2021 round",
      description:
        "5.9 GW awarded across 7 projects at strike prices 200–319 PLN/MWh (~46–73 EUR/MWh). 25-year contract length, " +
        "indexed to inflation. First commissioning by 2026.",
      takeaway:
        "Polish CfD strikes are already below the 80 EUR/MWh ceiling. Subsequent rounds have cleared at materially lower " +
        "prices as the supply chain matures.",
      source: "URE (Polish Energy Regulator) 2021 auction results",
    },
    {
      title: "UK AR4 (2022) — record-low offshore strikes",
      description:
        "Cleared at £37.35/MWh (~43 EUR/MWh, 2012 prices). Several projects subsequently asked to renegotiate as supply-chain " +
        "inflation eroded margins.",
      takeaway:
        "LCOE numbers can be unrealistically optimistic when capex is rising faster than AEP gains. The 2022 round taught " +
        "the market that strike prices need an inflation index.",
    },
  ],

  furtherReading: [
    {
      label: "IRENA Renewable Power Generation Costs (latest edition)",
      type: "website",
      url: "https://www.irena.org/Publications/2023/Aug/Renewable-Power-Generation-Costs-in-2022",
    },
    {
      label: "BloombergNEF — New Energy Outlook",
      type: "website",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/aep_calculator.py",
      description: "compute_lcoe() — single-period and DCF helpers; sensitivity to AEP, WACC, capex.",
    },
    {
      file: "backend/app/services/p2/market.py",
      description: "TGE day-ahead bidding and CfD strike-price comparison logic for the M11 module.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
