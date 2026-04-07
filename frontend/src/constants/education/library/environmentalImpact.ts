import type { EducationContent } from "../../../types/education";

export const environmentalImpactEducation: EducationContent = {
  id: "library.environmental-impact",
  title: "Environmental Impact Assessment",
  subtitle: "Birds, bats, marine mammals and the EIA stop-clock",
  discipline: "Environment",

  overview:
    "An offshore EIA is the multi-year process that turns a leasing area into a consented project. The assessment must " +
    "predict and mitigate impacts on birds (collision, displacement), marine mammals (piling noise), benthic habitat " +
    "(cable scour, sediment plume) and human users (fishing, shipping, archaeology). Bird collision risk is the most " +
    "consequential single output — it has cancelled or delayed multi-billion-euro projects (Dogger Bank D, Vesterhav).",

  simpleExplanation:
    "Before a wind farm is allowed to be built, the developer has to study every way it could harm the local environment " +
    "— birds, sea creatures, the seabed, fishermen, ancient shipwrecks — and prove the harm is acceptable or can be made " +
    "smaller. This study takes 3–5 years, costs millions, and can be the reason a project is approved, modified, or " +
    "rejected. The most sensitive issues are usually birds.",

  technicalExplanation:
    "EIA work in the EU follows Directive 2014/52/EU and is supplemented by site-specific guidance from national " +
    "regulators (UK PINS, Germany BSH, Poland GDOŚ). Bird collision is modelled with the Band collision risk model " +
    "(Marine Scotland 2012), parameterised with site-specific bird flight heights, species avoidance rates and rotor " +
    "geometry. Marine mammal noise during piling is predicted via empirical SEL formulae (e.g. SEL@750m = SEL_source − " +
    "20·log(750)) and mitigated with bubble curtains and soft-start procedures. Cumulative impact assessment (CIA) " +
    "considers the proposed project alongside existing/permitted projects in the same flyway or marine region.",

  standards: [
    {
      label: "EU Directive 2014/52/EU — Environmental Impact Assessment",
      type: "regulation",
      url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=celex%3A32014L0052",
    },
    {
      label: "Band Collision Risk Model — Marine Scotland",
      type: "standard",
      url: "https://marine.gov.scot/data/strategic-assessments-collision-risk-model",
    },
    {
      label: "OSPAR JAMP — Joint Assessment & Monitoring Programme",
      type: "regulation",
      url: "https://www.ospar.org/convention",
    },
    {
      label: "ASCOBANS Resolution 2009/1 — Underwater noise from offshore wind",
      type: "regulation",
      url: "https://www.ascobans.org/en/document/resolution-20091-noise-effects-marine-mammals",
    },
  ],

  formulas: [
    {
      expression: "Collisions = N · F · A · (1 − AR)",
      variables: [
        { symbol: "N", name: "Birds passing through rotor swept area annually", unit: "birds/yr" },
        { symbol: "F", name: "Probability of striking a blade if in rotor", unit: "—" },
        { symbol: "A", name: "Rotor active fraction (≈ 0.83)", unit: "—" },
        { symbol: "AR", name: "Avoidance rate (species-specific, 0.97–0.998)", unit: "—" },
      ],
      explanation:
        "Band model — the regulator-accepted collision risk equation. AR is the most influential parameter; a 0.998 vs " +
        "0.99 assumption changes predicted collisions by 5×.",
      reference: "Band 2012",
    },
    {
      expression: "SEL_cumulative = SEL_per_strike + 10·log(N_strikes)",
      variables: [
        { symbol: "SEL", name: "Sound exposure level", unit: "dB re 1 µPa²·s" },
        { symbol: "N_strikes", name: "Number of pile strikes", unit: "—" },
      ],
      explanation:
        "Cumulative noise exposure for marine mammals during piling. ASCOBANS limit for harbour porpoises: SEL ≤ 160 dB " +
        "re 1 µPa²·s at 750 m, achieved with double bubble curtain mitigation.",
    },
  ],

  workedExamples: [
    {
      title: "Bird collision estimate for Baltic Wind site",
      scenario:
        "34 V236 turbines, baseline gull density 1.2 birds/km², avoidance rate 0.998 (SOSS recommended).",
      steps: [
        "Rotor swept area per turbine = π · 118² = 43,748 m² ≈ 0.044 km²",
        "Volumetric flux N ≈ density · area · flights/yr ≈ 1.2 · 0.044 · 180,000 = 9,500 transits/yr/turbine",
        "F (Band model lookup) ≈ 0.07",
        "Collisions per turbine = 9,500 · 0.07 · 0.83 · (1 − 0.998) = 1.10",
        "Fleet collisions = 34 × 1.10 ≈ 37 birds/yr",
      ],
      result:
        "≈ 37 gull collisions per year for the entire 510 MW farm. Below the threshold for population-level impact for " +
        "any common gull species, but above the threshold for protected species — which is why the AR for protected birds " +
        "(e.g. red kite) is the political battleground.",
    },
  ],

  realWorldCases: [
    {
      title: "Vesterhav Nord (Denmark) — court annulled consent",
      description:
        "Approved in 2017, court-annulled in 2019 after a citizen's challenge that the EIA had under-estimated visual " +
        "impact and bird collision risk. Re-permitted with additional mitigation in 2021 — a four-year delay.",
      takeaway:
        "EIAs can be legally challenged years after approval. Use the most defensible methodology, not the cheapest, " +
        "and document every assumption.",
    },
    {
      title: "Hornsea 4 — withdrawn over kittiwake risk",
      description:
        "Ørsted paused Hornsea 4 in 2024 partly because the cumulative kittiwake collision burden across the Hornsea " +
        "cluster exceeded what the regulator was prepared to consent.",
      takeaway:
        "Cumulative impact across a cluster matters more than the marginal impact of a single project. Late entrants " +
        "to a busy seascape carry the regulatory tail.",
    },
  ],

  furtherReading: [
    {
      label: "JNCC Marine Renewables Guidance",
      type: "website",
      url: "https://jncc.gov.uk/our-work/marine-renewables/",
    },
    {
      label: "Marine Management Organisation (UK)",
      type: "website",
      url: "https://www.gov.uk/government/organisations/marine-management-organisation",
    },
  ],

  relatedLessons: ["lesson-006"],
};
