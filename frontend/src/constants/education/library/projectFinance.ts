import type { EducationContent } from "../../../types/education";

export const projectFinanceEducation: EducationContent = {
  id: "library.project-finance",
  title: "Project Finance (DSCR / IRR / PPA)",
  subtitle: "How a 1.8 G EUR cheque actually gets written",
  discipline: "Finance",

  overview:
    "Offshore wind is a project-finance industry: ~70% of CAPEX is debt, raised against the future cash flows of the " +
    "project itself, not the developer's balance sheet. Banks lend against the P90 case, sized so that the debt service " +
    "coverage ratio (DSCR) stays comfortably above 1.30 even in the worst year. The PPA or CfD strike price is the " +
    "single most consequential commercial term — change it by 5 EUR/MWh and the equity IRR moves by ~1.5 percentage " +
    "points on a typical project.",

  simpleExplanation:
    "Imagine you want to buy a 1.8 billion euro asset with 600 million of your own money and 1.2 billion of borrowed " +
    "money. The bank that lends you the 1.2 billion wants to be sure the wind farm will earn enough every year to pay " +
    "the loan back, even in a bad year. They look at three numbers: how much the project will earn (revenue), how much " +
    "the loan costs each year (debt service), and the ratio between them (DSCR). If DSCR stays above 1.3 in the worst " +
    "year, they lend the money. If not, the deal doesn't happen.",

  technicalExplanation:
    "Capital stack: senior debt (~70%), mezzanine (~5%), equity (~25%). Senior tenor 18–22 years; mezzanine 7–10 years. " +
    "Lenders run a financial model with three scenarios (Base, P90, Sensitivity) and require minimum DSCR ≥ 1.30 in the " +
    "P90 case for every year of the loan. Equity targets a project IRR of 8–10% real for a vanilla offshore project; " +
    "below that the developer typically structures a CfD with floor + ceiling. PPA structures range from baseload (24/7 " +
    "fixed price) to as-generated (the actual hourly profile, with the offtaker bearing volume risk). Tax equity (US) " +
    "and CfD (EU) shift different risks between developer, taxpayer and offtaker.",

  standards: [
    {
      label: "Basel III — Banking capital requirements",
      type: "regulation",
      url: "https://www.bis.org/bcbs/basel3.htm",
    },
    {
      label: "IFRS 9 — Financial instruments (impairment of project loans)",
      type: "standard",
      url: "https://www.ifrs.org/issued-standards/list-of-standards/ifrs-9-financial-instruments/",
    },
    {
      label: "EU Taxonomy for Sustainable Activities",
      type: "regulation",
      url: "https://finance.ec.europa.eu/sustainable-finance/tools-and-standards/eu-taxonomy-sustainable-activities_en",
    },
  ],

  formulas: [
    {
      expression: "DSCR_t = CFADS_t / DS_t",
      variables: [
        { symbol: "CFADS", name: "Cash flow available for debt service in year t", unit: "EUR/yr" },
        { symbol: "DS", name: "Principal + interest payment in year t", unit: "EUR/yr" },
      ],
      explanation:
        "Lenders require min(DSCR_t) ≥ 1.30 across the loan tenor in the P90 case. Average DSCR is typically 1.45–1.55. " +
        "If a single year drops below 1.30 the model is re-tuned (longer tenor, lower coupon, larger DSRA reserve).",
    },
    {
      expression: "NPV = Σ_t CF_t / (1+r)^t,    IRR = r such that NPV = 0",
      variables: [
        { symbol: "CF_t", name: "Net cash flow in year t (after tax, after debt service)", unit: "EUR" },
        { symbol: "r", name: "Discount rate (WACC for NPV; solved-for for IRR)", unit: "—" },
      ],
      explanation:
        "Equity investors look at the post-tax post-debt IRR. Project finance models show two IRRs side-by-side: " +
        "unlevered (whole-project) and levered (equity-only).",
    },
    {
      expression: "LLCR = NPV(CFADS_remaining, r) / Debt_outstanding",
      variables: [
        { symbol: "LLCR", name: "Loan life coverage ratio", unit: "—" },
      ],
      explanation:
        "Forward-looking sister metric of DSCR. Lenders typically require LLCR ≥ 1.40 at financial close.",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 510 MW debt sizing",
      scenario:
        "P90 AEP 1,995 GWh, OZMB CfD strike 80 EUR/MWh, OPEX 60 M EUR/yr, 70% gearing, debt tenor 18 yr, coupon 6%.",
      steps: [
        "P90 revenue = 1,995,000 × 80 = 159.6 M EUR/yr",
        "EBITDA P90 = 159.6 − 60 = 99.6 M EUR/yr (no tax simplification)",
        "Required DSCR 1.30 → max annual debt service = 99.6 / 1.30 = 76.6 M EUR/yr",
        "At 6% coupon, 18-year amortising loan, max principal = 76.6 / 0.0964 ≈ 794 M EUR",
        "Debt sizing 794 M EUR vs 70% × 1,800 M = 1,260 M EUR target → DSCR-constrained, not gearing-constrained",
      ],
      result:
        "Even at the OZMB strike of 80 EUR/MWh the project is DSCR-constrained — only ~44% gearing achievable on a P90 " +
        "basis, far below the 70% target. The developer must either negotiate a higher CfD strike, drive CAPEX down, or " +
        "accept more equity in the deal.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea 2 — bond issuance 2020",
      description:
        "Ørsted financed Hornsea 2 partly through €750 M green bond at coupon ~1.625%. Project structuring deliberately " +
        "front-loaded the CfD revenue period to fit the bond amortisation profile.",
      takeaway:
        "Structuring debt around the contracted-revenue profile is one of the highest-leverage activities in project " +
        "finance. Hold a CfD as long as your debt is outstanding.",
    },
    {
      title: "Vineyard Wind (US) — first US offshore PF",
      description:
        "$2.3 G project finance, sponsors Avangrid + CIP, closed 2021. PPA price ~$74/MWh inflation-indexed. Construction " +
        "delays and supply-chain inflation prompted a renegotiation in 2024.",
      takeaway:
        "Long-tenor fixed-price PPAs are vulnerable to capex inflation. Inflation-indexed strike prices have become the " +
        "norm in 2023+.",
    },
  ],

  furtherReading: [
    {
      label: "Yescombe — Principles of Project Finance (3e)",
      type: "textbook",
      citation: "Academic Press 2014, ISBN 978-0-12-391058-5",
    },
    {
      label: "IRENA — Renewable Power Generation Costs 2022 (open access report)",
      type: "website",
      url: "https://www.irena.org/Publications/2023/Aug/Renewable-Power-Generation-Costs-in-2022",
    },
  ],

  relatedLessons: ["lesson-006"],
};
