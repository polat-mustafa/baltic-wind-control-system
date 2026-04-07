import type { EducationContent } from "../../../types/education";

export const decommissioningEducation: EducationContent = {
  id: "library.decommissioning",
  title: "Decommissioning & Recycling",
  subtitle: "What happens when the lease ends",
  discipline: "Environment",

  overview:
    "Every offshore wind project must lodge a decommissioning bond at financial close, sufficient to remove the assets " +
    "and restore the seabed at the end of the lease (typically 25–30 years). The cost is non-trivial: industry estimates " +
    "place it at 1.5–3% of CAPEX. Most components — steel, copper, aluminium — are routinely recycled. The exception is " +
    "blades: composite GFRP/CFRP cannot be re-melted, and Europe is heading toward a landfill ban. Recycling pathways " +
    "(mechanical grinding, pyrolysis, solvolysis) are immature but rapidly maturing.",

  simpleExplanation:
    "When a wind farm reaches the end of its life you can't just leave it there — the seabed has to be returned to a " +
    "useful state. Most parts (steel, copper, aluminium) can be melted down and reused. Blades are the exception: they " +
    "are made of glass and resin and have historically gone to landfill. Europe is now banning that, so the industry is " +
    "racing to develop ways to grind, dissolve or pyrolyse blades back into useful materials.",

  technicalExplanation:
    "Decommissioning sequence: (1) de-energise, electrically isolate and remove turbine top sections by reverse " +
    "installation; (2) cut tower into transportable sections; (3) recover monopiles to ~3 m below mudline (full removal " +
    "is rarely required by regulators because it disturbs the seabed more than it restores); (4) recover or de-energise " +
    "and abandon submarine cables; (5) post-decommissioning seabed survey to verify clearance. Material flows: steel " +
    "100% recycled; copper 100% recycled; rare earths in permanent magnets recovered with developing chemistry; blade " +
    "GFRP currently ~10% mechanically recycled into cement co-processing. The ETIPWind 2030 target is 100% recyclable " +
    "blades — Vestas EpoCH and Siemens RecyclableBlade designs already meet this.",

  standards: [
    {
      label: "EU Circular Economy Action Plan (CEAP)",
      type: "regulation",
      url: "https://environment.ec.europa.eu/strategy/circular-economy-action-plan_en",
    },
    {
      label: "OSPAR Decision 98/3 — Disposal of disused offshore installations",
      type: "regulation",
      url: "https://www.ospar.org/work-areas/bdc/structures/ospar-decision-98-3",
    },
    {
      label: "DNV-RP-J103 — Wind farm layout, energy yield and decommissioning",
      type: "standard",
    },
    {
      label: "UK Energy Act 2004 — Decommissioning of offshore renewable energy installations",
      type: "regulation",
      url: "https://www.legislation.gov.uk/ukpga/2004/20/part/2",
    },
  ],

  formulas: [
    {
      expression: "C_decom ≈ k_decom · CAPEX,    k_decom ∈ [0.015, 0.030]",
      variables: [
        { symbol: "C_decom", name: "Decommissioning cost (real terms)", unit: "EUR" },
        { symbol: "CAPEX", name: "Original construction cost", unit: "EUR" },
      ],
      explanation:
        "First-order industry estimate. Actual costs depend on vessel availability and material recovery prices in the " +
        "year of decommissioning — both highly uncertain at financial close.",
    },
    {
      expression: "DSRA = NPV(C_decom, r, n_lease)",
      variables: [
        { symbol: "DSRA", name: "Decommissioning sinking-fund reserve", unit: "EUR" },
        { symbol: "r", name: "Sinking fund return rate", unit: "—" },
      ],
      explanation:
        "Bond posted at financial close. The lender typically requires DSRA fully funded within 5 years of COD, held in " +
        "escrow at an investment-grade bank.",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind decommissioning provision",
      scenario:
        "510 MW farm, CAPEX 1,800 M EUR, 25-year lease, 3% real sinking-fund return.",
      steps: [
        "C_decom (real, 2050 EUR) ≈ 0.025 × 1,800 = 45 M EUR",
        "Annual sinking-fund deposit ≈ C_decom · r / ((1+r)^n − 1) = 45 · 0.03 / (1.03^25 − 1) = 1.23 M EUR/yr",
        "Cumulative DSRA after 25 years: 45 M EUR (target met)",
      ],
      result:
        "1.23 M EUR/yr deposited into a sinking fund — about 0.06 EUR/MWh of LCOE. Negligible compared with capex but " +
        "must be tracked from day one or the regulator can withhold consent renewal.",
    },
  ],

  realWorldCases: [
    {
      title: "Yttre Stengrund (Sweden) — first commercial decom",
      description:
        "5 × NEG Micon NM72 turbines (10 MW total, installed 2001) were decommissioned in 2016 — the world's first " +
        "commercial offshore wind decommissioning. Total cost ≈ 5 M EUR for 10 MW = 500 EUR/kW, much higher per kW than " +
        "modern projections because of small scale.",
      takeaway:
        "Per-kW decommissioning cost falls strongly with scale. The numbers used for 510 MW projects are not transferable " +
        "to small early-generation farms.",
    },
    {
      title: "Vestas EpoCH — recyclable epoxy blade",
      description:
        "Announced 2023: an epoxy chemistry that can be solvolysed back into base monomers, enabling circular blade " +
        "manufacture. First commercial blades to enter service 2024.",
      takeaway:
        "The 'blade landfill problem' is being engineered away faster than most observers expected.",
    },
  ],

  furtherReading: [
    {
      label: "ETIPWind — Recommendations for recycling and circularity",
      type: "website",
      url: "https://etipwind.eu/publications/",
    },
    {
      label: "WindEurope — Accelerating Wind Turbine Blade Circularity",
      type: "website",
      url: "https://windeurope.org/intelligence-platform/product/accelerating-wind-turbine-blade-circularity/",
    },
  ],

  relatedLessons: ["lesson-006"],
};
