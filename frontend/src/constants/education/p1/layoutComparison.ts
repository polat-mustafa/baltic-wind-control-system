import type { EducationContent } from "../../../types/education";

export const layoutComparisonEducation: EducationContent = {
  id: "p1.layout-comparison",
  title: "Layout Comparison (M04)",
  subtitle: "Wake loss vs cable cost — the offshore design trade-off",
  discipline: "Civil",

  overview:
    "M04 compares alternative farm layouts side-by-side on the metrics that matter for the investment decision: gross AEP, " +
    "wake loss, intra-array cable length, foundation count, total LCOE. The fundamental trade-off is wake-vs-cable: " +
    "tighter spacing means more energy lost to wakes, looser spacing means more cable cost. The optimum depends on the " +
    "site-specific cable cost and the wind rose.",

  simpleExplanation:
    "Imagine you have to lay 34 turbines on a sheet of graph paper. Pack them tight and the back rows steal each other's " +
    "wind. Spread them out and you need much more (very expensive) underwater cable to connect them. The comparison view " +
    "tries several arrangements and ranks them so you can pick the cheapest electricity per MWh.",

  technicalExplanation:
    "Each candidate layout is scored on gross AEP (PyWake Bastankhah), wake loss %, cable length (Steiner-tree heuristic " +
    "with capacity constraints), and LCOE delta. The optimisation surface is non-convex — gradient methods get stuck — so " +
    "TopFarm uses a mix of pseudo-gradient and CMA-ES to explore. Even with global search, the gain over a hand-designed " +
    "asymmetric grid is only 1–3% in AEP for typical mature sites. The biggest wins come from foundation cost surfaces " +
    "(avoid expensive seabed) rather than from wake optimisation alone.",

  standards: [
    {
      label: "IEC 61400-1 — Site classification & wake effects",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-RP-J103 — Energy yield assessment of offshore wind farms",
      type: "standard",
    },
    {
      label: "DNV-ST-0359 — Subsea power cables for wind power plants",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "ΔLCOE = (ΔCAPEX_cable·CRF − ΔRevenue_AEP) / AEP_net",
      variables: [
        { symbol: "ΔCAPEX_cable", name: "Change in cable capex between layouts", unit: "EUR" },
        { symbol: "ΔRevenue_AEP", name: "Change in revenue from AEP gain", unit: "EUR/yr" },
        { symbol: "CRF", name: "Capital recovery factor", unit: "1/yr" },
      ],
      explanation:
        "Compares two layouts in LCOE terms — the only fair currency for this trade-off. A layout with 1% more AEP and 5% more " +
        "cable cost is *not* automatically better; the CRF and the strike price decide.",
    },
    {
      expression: "L_min = Σ_(edges in MST) length(edge),  subject to: ΣP_string ≤ S_string_max",
      variables: [
        { symbol: "L_min", name: "Minimum cable length", unit: "m" },
        { symbol: "MST", name: "Minimum spanning tree of the turbine graph", unit: "—" },
      ],
      explanation:
        "Cable routing is a capacity-constrained Steiner-tree problem. Pure MST gives a lower bound; real routing typically " +
        "adds 10–20% for corridor avoidance (existing cables, archaeology, fishing zones).",
    },
  ],

  workedExamples: [
    {
      title: "Square grid vs asymmetric grid for Baltic Wind",
      scenario:
        "Two candidate 34-turbine layouts: (A) regular 7D × 7D, (B) asymmetric 7D × 10D aligned with prevailing W wind.",
      steps: [
        "Layout A: gross AEP 2,210 GWh, wake loss 9.5% → net 2,000 GWh; cable 88 km",
        "Layout B: gross AEP 2,225 GWh, wake loss 6.5% → net 2,080 GWh; cable 112 km",
        "ΔAEP = +80 GWh/yr; ΔRevenue at 80 EUR/MWh = +6.4 M EUR/yr",
        "ΔCable cost = 24 km × 1,000 EUR/m = +24 M EUR (one-off)",
        "ΔAnnualised cable = 24 × 0.0782 = +1.88 M EUR/yr",
        "Net annual benefit B over A = 6.4 − 1.88 = 4.52 M EUR/yr",
      ],
      result:
        "Layout B wins by ~4.5 M EUR/yr despite the extra cable. The wider cross-wind spacing pays for itself in two seasons. " +
        "This is why offshore developers rarely use square grids any more.",
    },
  ],

  realWorldCases: [
    {
      title: "Borssele I+II — TopFarm-optimised layout",
      description:
        "Ørsted/Eneco used TopFarm to optimise 94 SG 8.0 MW turbines against the bathymetry-corrected foundation cost surface. " +
        "Final layout had ~2% more AEP than the consented grid layout while using the same number of turbines.",
      takeaway:
        "Layout optimisation only pays back if foundation cost data is included. Pure AEP optimisation produces clusters in " +
        "expensive seabed zones.",
    },
    {
      title: "Anholt — wind-rose-aligned spacing",
      description:
        "111 × Siemens 3.6 MW arranged in a wind-rose-aligned grid. Operational wake losses 8.5% — about 1.5 pp better than a " +
        "comparable regular grid would have delivered.",
      takeaway:
        "Operational data validates that asymmetric grids work. Always check the wind rose before deciding spacing.",
    },
  ],

  furtherReading: [
    {
      label: "TopFarm — open-source farm layout optimisation",
      type: "website",
      url: "https://topfarm.pages.windenergy.dtu.dk/TopFarm2/",
    },
    {
      label: "Pillai et al. — Cable layout optimisation in offshore wind farms",
      type: "paper",
      citation: "Renewable Energy 85 (2016), doi:10.1016/j.renene.2015.06.062",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/layout_comparison.py",
      description: "Side-by-side scoring of multiple layouts with PyWake AEP + Steiner cable estimate.",
    },
  ],

  relatedLessons: ["lesson-005", "lesson-006"],
};
