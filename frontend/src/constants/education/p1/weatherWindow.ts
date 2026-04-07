import type { EducationContent } from "../../../types/education";

export const weatherWindowEducation: EducationContent = {
  id: "p1.weather-window",
  title: "Weather Windows & O&M Logistics",
  subtitle: "When can crews actually reach the turbines?",
  discipline: "Marine",

  overview:
    "An offshore turbine is unreachable when waves are too high or wind too strong for the access vessel. The 'weather " +
    "window' is the probability that conditions stay below the vessel limits long enough for a transit + work + return " +
    "cycle. It is the single biggest input into offshore O&M cost models — a southern Baltic site can lose 20–30% of " +
    "available work days to weather, even more for jack-up vessels.",

  simpleExplanation:
    "Crew Transfer Vessels (CTVs) can only sail when waves are smaller than about 1.5 m. For a 6-hour repair the calm " +
    "conditions need to last at least 6 hours. The weather-window calculator asks: 'starting today, what's the probability " +
    "the next 6 hours stay calm enough?' If it's high, dispatch the boat; if it's low, wait.",

  technicalExplanation:
    "Wave heights at most offshore sites follow a Rayleigh distribution (special case of Weibull with k=2). Combined with " +
    "wind speed (also Weibull) and persistence statistics, you can compute the access probability per vessel class. CTV " +
    "limits Hs ≤ 1.5 m and V_wind ≤ 10 m/s; SOV ≤ 2.5 m and ≤ 15 m/s; jack-up vessels are wind-limited at ≈ 8 m/s during " +
    "leg jacking, which is the most binding constraint. The geometric wait-for-window distribution gives expected waiting " +
    "times for each vessel class.",

  standards: [
    {
      label: "DNV-RP-C205 — Environmental conditions and environmental loads",
      type: "standard",
    },
    {
      label: "IMCA M 159 — Guidance on the use of CTVs",
      type: "standard",
      url: "https://www.imca-int.com/product-category/documents/",
    },
    {
      label: "G+ Good Practice Guideline — Vessel transfer operations",
      type: "standard",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
  ],

  formulas: [
    {
      expression: "P(Hs ≤ Hs_lim) = 1 − exp(−2 · (Hs_lim / Hs_mean)²)",
      variables: [
        { symbol: "Hs", name: "Significant wave height", unit: "m" },
        { symbol: "Hs_lim", name: "Vessel access limit", unit: "m" },
        { symbol: "Hs_mean", name: "Long-term mean Hs at the site", unit: "m" },
      ],
      explanation:
        "Rayleigh CDF — the special case of Weibull with k=2 that fits Hs at most extra-tropical offshore sites.",
      reference: "DNV-RP-C205 §3",
    },
    {
      expression: "E[T_wait] = (1 − p_window) / p_window · Δt",
      variables: [
        { symbol: "T_wait", name: "Expected waiting time for next access window", unit: "h" },
        { symbol: "p_window", name: "Probability of an Δt-hour window being accessible", unit: "—" },
        { symbol: "Δt", name: "Required window length", unit: "h" },
      ],
      explanation:
        "Geometric wait-time formula. For a 6 h CTV window with p=0.4, expected wait ≈ 9 h. This is the dominant cost in " +
        "offshore O&M models.",
    },
  ],

  workedExamples: [
    {
      title: "CTV access probability at the Baltic Wind site",
      scenario:
        "Baltic site, long-term Hs_mean = 1.05 m. CTV operating limit Hs ≤ 1.50 m.",
      steps: [
        "Hs_lim / Hs_mean = 1.50 / 1.05 = 1.4286",
        "(1.4286)² = 2.0408",
        "−2 · 2.0408 = −4.0816",
        "exp(−4.0816) ≈ 0.01686",
        "P(Hs ≤ 1.5) = 1 − 0.01686 ≈ 0.983",
      ],
      result:
        "≈ 98% of hours are calm enough for CTV transfer in isolation. But access also requires wind ≤ 10 m/s — combine " +
        "the two and the realised access drops to ~75% over the year (and ~50% in winter).",
    },
  ],

  realWorldCases: [
    {
      title: "Kentish Flats (UK, 90 MW) — first SOV experiment",
      description:
        "Replaced CTV-based service with a Service Operation Vessel hotelling crews offshore. Annual access days went up " +
        "from ~210 to ~320 — a 50% improvement that paid for the SOV charter within two seasons.",
      takeaway:
        "SOVs unlock weather windows that CTVs miss because they stay on station. For sites > 30 km from shore, an SOV is " +
        "almost always cheaper than CTVs over a 25-year life.",
    },
    {
      title: "Hornsea 2 — heli + SOV hybrid",
      description:
        "Helicopter access enabled urgent repairs in marginal weather where SOV crews could not transfer. Helicopter " +
        "minutes are expensive but per-MWh-saved they routinely beat lost-revenue costs in the worst storms.",
      takeaway:
        "Mixed-mode O&M (CTV + SOV + helicopter) is now industry standard for offshore farms over 50 km from shore.",
    },
  ],

  furtherReading: [
    {
      label: "Dinwoodie et al. — Reference cases for verification of O&M models",
      type: "paper",
      citation: "Wind Energy 18 (2015), doi:10.1002/we.1745",
    },
    {
      label: "Carbon Trust Offshore Wind Accelerator — Access Systems",
      type: "website",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/weather_window.py",
      description: "Rayleigh wave model + Weibull wind model + geometric wait-for-window — M14 module.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
