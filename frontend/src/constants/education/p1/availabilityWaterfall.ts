import type { EducationContent } from "../../../types/education";

export const availabilityWaterfallEducation: EducationContent = {
  id: "p1.availability-waterfall",
  title: "Availability Waterfall (EBA / PBA)",
  subtitle: "Where the available hours are lost — by category",
  discipline: "Operations",

  overview:
    "The waterfall starts at 100% theoretical availability and walks down through every IEC 61400-26 downtime category, " +
    "ending at the operating PBA delivered to the offtaker. Each step is a category in the IEC taxonomy: scheduled " +
    "maintenance, forced outages, grid loss, environmental, force majeure, technical standby. The shape of the waterfall " +
    "tells you immediately whether the fleet is bottlenecked by reliability, by O&M logistics, or by external grid issues.",

  simpleExplanation:
    "Imagine starting with a full bucket of operating hours (100%) and pouring a little out at each step for every reason " +
    "the turbine wasn't producing power. The pile at the end is what you actually delivered. The biggest spill is the " +
    "category to fix first.",

  technicalExplanation:
    "EBA and PBA waterfalls share the same category structure but weight time differently — EBA uses theoretical energy, " +
    "PBA further excludes force-majeure energy. A 'good' offshore waterfall has scheduled maintenance ≈ 2.0%, forced " +
    "outages ≈ 1.5%, grid loss ≈ 0.5%, environmental ≈ 0.5%, force majeure ≈ 0.5% — leaving PBA above 95%. Step-changes " +
    "in any single bar between months are the leading indicator that an O&M strategy needs revision.",

  standards: [
    {
      label: "IEC 61400-26-1 — Availability for wind energy generation systems",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-26-2 — Production-based availability",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-26-3 — Information categories for downtime",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
  ],

  formulas: [
    {
      expression: "PBA = 1 − Σ_i loss_i / E_potential",
      variables: [
        { symbol: "loss_i", name: "Energy lost to category i (excluding force majeure)", unit: "MWh" },
        { symbol: "E_potential", name: "Total potential energy", unit: "MWh" },
      ],
      explanation:
        "The waterfall is the visual decomposition of this sum. PBA targets in OEM service contracts are typically 96–98%.",
      reference: "IEC 61400-26-2 §5",
    },
    {
      expression: "MTBF = T_up / N_failures,    MTTR = T_down / N_failures",
      variables: [
        { symbol: "MTBF", name: "Mean time between failures", unit: "h" },
        { symbol: "MTTR", name: "Mean time to repair", unit: "h" },
        { symbol: "N_failures", name: "Number of failures in the period", unit: "—" },
      ],
      explanation:
        "Reliability inputs that drive the forced-outage bar of the waterfall. Offshore operators want MTBF > 8,000 h " +
        "and MTTR < 48 h on the dominant failure mode.",
    },
  ],

  workedExamples: [
    {
      title: "Waterfall for the Baltic Wind fleet (synthetic)",
      scenario:
        "Total potential energy = 2,250 GWh. Losses: scheduled 45 GWh, forced 35 GWh, grid 10 GWh, environmental 8 GWh, " +
        "force majeure 12 GWh.",
      steps: [
        "Sum of operator-controllable losses: 45 + 35 + 10 + 8 = 98 GWh",
        "PBA = 1 − 98 / 2,250 = 1 − 0.0436 = 0.9564 → 95.64%",
        "Including force majeure → EBA = 1 − (98 + 12)/2,250 = 95.11%",
      ],
      result: "PBA 95.6%, EBA 95.1%. Forced outages dominate — the OEM service strategy should target gearbox reliability.",
    },
  ],

  realWorldCases: [
    {
      title: "Walney Extension (UK) — quarterly waterfall",
      description:
        "Q3 2022 waterfall showed a step-change in 'environmental' (cetacean exclusion zone causing daytime curtailment) " +
        "of ~1.5 percentage points. The visual jump triggered an investigation that recovered 40% of the loss via " +
        "improved coordination with marine surveyors.",
      takeaway: "Watch the small bars — they sometimes hide outsized improvements.",
    },
  ],

  furtherReading: [
    {
      label: "G+ Global Offshore Wind Health & Safety Organisation",
      type: "website",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
    {
      label: "WMEP (Germany) — long-term reliability database",
      type: "website",
      url: "https://www.iee.fraunhofer.de/",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/availability.py",
      description: "fleet_waterfall() — splits time and energy losses by IEC 61400-26 categories.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
