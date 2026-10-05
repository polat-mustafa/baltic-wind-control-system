import type { EducationContent } from "../../../types/education";

export const lcoeEducation: EducationContent = {
  id: "p1.lcoe-revenue",
  title: "Revenue & LCOE",
  subtitle: "Levelised cost of energy and what it says about a project",
  discipline: "Finance",

  overview:
    "LCOE (levelised cost of energy) turns every cost a project incurs — capital, operations, financing — into a " +
    "single €/MWh: the constant price at which discounted revenues exactly repay discounted costs. Compare it with the " +
    "price the project will actually receive (a contract-for-difference strike, a PPA or the market): if LCOE is " +
    "lower, the project earns more than its cost of capital.",

  simpleExplanation:
    "Think of the farm as a 25-year loan. You pay a big amount up front (building it) and a smaller amount every year " +
    "(running it). LCOE is the price per MWh that pays all of it back, including interest. If you can sell for more, " +
    "you make money; if not, you don't.",

  technicalExplanation:
    "Screening form: LCOE = (CAPEX·CRF + OPEX) / AEP_net, with the capital recovery factor CRF = r(1+r)ⁿ / ((1+r)ⁿ − 1). " +
    "It assumes constant annual energy and costs; full models discount year-by-year cash flows (degradation, major " +
    "repairs, decommissioning). Use real costs with a real discount rate or nominal with nominal — never mix. LCOE is " +
    "inversely proportional to AEP: using P90 instead of P50 raises it by the same 8–10 %. When LCOE > price, the " +
    "project IRR is below the discount rate — the two indicators say the same thing.",

  standards: [
    {
      label: "IEA Wind TCP Task 26 — Cost of wind energy",
      type: "standard",
      url: "https://iea-wind.org/task26/",
    },
    {
      label: "IRENA — Renewable Power Generation Costs (annual)",
      type: "website",
      url: "https://www.irena.org/Publications",
    },
  ],

  formulas: [
    {
      expression: "LCOE = (CAPEX · CRF + OPEX_annual) / AEP_net",
      variables: [
        { symbol: "CAPEX", name: "Total upfront investment", unit: "€" },
        { symbol: "CRF", name: "Capital recovery factor", unit: "1/yr" },
        { symbol: "OPEX_annual", name: "Annual operating cost", unit: "€/yr" },
        { symbol: "AEP_net", name: "Net annual energy (P50)", unit: "MWh/yr" },
      ],
      explanation: "Single-period screening form used in the Farm Comparison tab.",
    },
    {
      expression: "CRF = r · (1+r)ⁿ / ((1+r)ⁿ − 1)",
      variables: [
        { symbol: "r", name: "Discount rate (WACC)", unit: "—" },
        { symbol: "n", name: "Economic lifetime", unit: "yr" },
      ],
      explanation: "r = 6 %, n = 25 yr → CRF = 0.0782: every 100 M€ of CAPEX costs 7.82 M€ per year.",
    },
    {
      expression: "LCOE = Σ_t C_t/(1+r)^t  /  Σ_t E_t/(1+r)^t",
      variables: [
        { symbol: "C_t", name: "Costs in year t", unit: "€" },
        { symbol: "E_t", name: "Energy in year t", unit: "MWh" },
      ],
      explanation: "Discounted-cash-flow form; reduces to the screening form for constant C and E.",
    },
  ],

  workedExamples: [
    {
      title: "This platform's base case (Farm Comparison defaults)",
      scenario:
        "510 MW, CAPEX 3.2 M€/MW = 1,632 M€, OPEX 75 k€/MW·yr = 38.3 M€/yr, net P50 2,111 GWh/yr (Farm Comparison, " +
        "7 D grid, mean 9.3 m/s), WACC 6 %, 25 yr.",
      steps: [
        "CRF = 0.06 × 1.06²⁵ / (1.06²⁵ − 1) = 0.06 × 4.292 / 3.292 = 0.0782",
        "Annualised CAPEX = 1,632 × 0.0782 = 127.6 M€/yr",
        "Annual cost = 127.6 + 38.3 = 165.9 M€/yr",
        "LCOE = 165.9 M€ / 2,111,000 MWh = 78.6 €/MWh",
      ],
      result:
        "≈ 79 €/MWh: above a flat 72 €/MWh market price (IRR ≈ 4.8 % < 6 % WACC), so the project needs a higher price " +
        "— e.g. an indexed CfD — lower CAPEX, or cheaper capital. A 1 pp lower WACC alone brings LCOE to ≈ 73 €/MWh.",
    },
  ],

  realWorldCases: [
    {
      title: "Poland — offshore CfD, phase I (2021)",
      description:
        "About 5.9 GW of Baltic projects received two-sided contracts for difference by administrative decision, with " +
        "a maximum price of 319.60 PLN/MWh, indexed to inflation, for 25 years. Later phases are allocated by auction.",
      takeaway: "The CfD strike, not the spot market, is the price an LCOE should be compared with in Poland.",
      source: "Polish Offshore Wind Act (2020) and URE decisions (2021)",
    },
    {
      title: "UK — AR4 (2022) and AR5 (2023)",
      description:
        "Offshore wind cleared AR4 at £37.35/MWh (2012 prices). After steep cost inflation, AR5 attracted no offshore " +
        "bids at its administrative ceiling, and the ceiling was raised for AR6.",
      takeaway: "When CAPEX and interest rates rise faster than AEP improves, strike prices must follow — LCOE moves.",
    },
  ],

  furtherReading: [
    {
      label: "IRENA — Renewable Power Generation Costs (latest edition)",
      type: "website",
      url: "https://www.irena.org/Publications",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/farm_comparison.py",
      description: "compute_lcoe() and project_irr() — screening LCOE, payback and IRR for each design.",
    },
    {
      file: "backend/app/services/p2/market.py",
      description: "TGE day-ahead market and CfD logic for the M11 module.",
    },
  ],

};
