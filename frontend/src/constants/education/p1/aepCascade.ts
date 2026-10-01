import type { EducationContent } from "../../../types/education";

export const aepCascadeEducation: EducationContent = {
  id: "p1.aep-cascade",
  title: "AEP Cascade & P-Values",
  subtitle: "From gross energy to a bankable P50 / P90",
  discipline: "Civil",

  overview:
    "The AEP cascade takes a farm from its gross energy — every turbine in clean wind, always running — to the net " +
    "energy delivered to the grid. Each step is a loss: wake, blockage, electrical, availability, environmental (and, " +
    "where it applies, curtailment). The net result is the P50: the central estimate of long-term annual energy. " +
    "Because every input is uncertain, the AEP is a probability distribution; P90 is the value exceeded with 90 % " +
    "probability and is the figure lenders size debt against.",

  simpleExplanation:
    "Think of pouring water through a row of sieves. Each one keeps a little: turbines downwind get weaker wind (wake), " +
    "the farm slows the incoming wind (blockage), cables warm up (electrical), turbines stop for repairs (availability). " +
    "What comes out at the end is the energy you can sell. Since nobody knows the future exactly, banks ask: what is " +
    "the amount we are 90 % sure to beat? That is P90.",

  technicalExplanation:
    "Losses are multiplicative — each acts on the energy left after the previous one: Net = Gross × Π(1 − Lᵢ). The " +
    "uncertainty of each input (wind data, long-term correction, shear, wake model, power curve, availability…) is " +
    "combined by root-sum-square under an independence assumption, giving σ as a fraction of P50. With a normal " +
    "approximation P_x = P50·(1 − z_x·σ): z = 0.674 (P75), 1.282 (P90), 2.326 (P99). On this platform σ = 6.89 %, " +
    "so P90 sits 8.8 % below P50. These are long-term (multi-year average) values; a 1-year P90 also includes the " +
    "year-to-year variability of the wind and is lower.",

  standards: [
    {
      label: "IEC 61400-15 (series) — Assessment of site-specific wind conditions and energy yield",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "MEASNET — Evaluation of site-specific wind conditions",
      type: "standard",
      url: "https://www.measnet.com/procedure/",
    },
  ],

  formulas: [
    {
      expression: "AEP_net = AEP_gross · (1−L_wake) · (1−L_block) · (1−L_elec) · (1−L_avail) · (1−L_env)",
      variables: [
        { symbol: "AEP_gross", name: "Gross AEP (Weibull × power curve, clean wind)", unit: "GWh/yr" },
        { symbol: "L_wake", name: "Wake loss (PyWake BPA here)", unit: "—" },
        { symbol: "L_block", name: "Global blockage loss", unit: "—" },
        { symbol: "L_elec", name: "Electrical (cables, transformers) loss", unit: "—" },
        { symbol: "L_avail", name: "Availability loss", unit: "—" },
        { symbol: "L_env", name: "Environmental (icing, blade degradation…) loss", unit: "—" },
      ],
      explanation:
        "Multiplicative, so the order does not change the result — but adding the percentages would overstate the loss " +
        "(two 10 % losses leave 81 %, not 80 %).",
    },
    {
      expression: "σ = √(Σ σᵢ²),    P_x = P50 · (1 − z_x · σ)",
      variables: [
        { symbol: "σᵢ", name: "Relative uncertainty of source i", unit: "—" },
        { symbol: "z_x", name: "Standard-normal quantile (P90 → 1.282)", unit: "—" },
      ],
      explanation:
        "Root-sum-square assumes the sources are independent. The linear form is an approximation valid for σ ≪ 1.",
    },
  ],

  workedExamples: [
    {
      title: "This platform's cascade (A = 10.5 m/s, k = 2.2, regular grid)",
      scenario:
        "34 × V236-15.0 MW. Gross AEP from PyWake = 2,425.8 GWh/yr. Losses: wake 5.56 %, blockage 1.63 %, electrical 2.0 %, " +
        "availability 5.0 %, environmental 1.0 %. Price 72 €/MWh.",
      steps: [
        "After wake: 2,425.8 × 0.9444 = 2,290.9 GWh",
        "After blockage: 2,290.9 × 0.9837 = 2,253.6 GWh",
        "After electrical: 2,253.6 × 0.980 = 2,208.5 GWh",
        "After availability: 2,208.5 × 0.950 = 2,098.1 GWh",
        "After environmental: 2,098.1 × 0.990 = 2,077.1 GWh  → P50",
        "σ = √(4² + 3² + 3² + 2² + 2² + 1.5² + 1.5² + 1²) = √47.5 = 6.89 %",
        "P90 = 2,077 × (1 − 1.282 × 0.0689) = 1,894 GWh",
      ],
      result:
        "P50 ≈ 2,077 GWh/yr (capacity factor 46.5 %), P90 ≈ 1,894 GWh/yr. At 72 €/MWh the gap is ≈ 13 M€ of revenue per " +
        "year — the price of uncertainty.",
    },
  ],

  realWorldCases: [
    {
      title: "Industry-wide prediction bias",
      description:
        "A review of published validation studies found that pre-construction energy estimates historically over-" +
        "predicted actual production, with the bias shrinking over the last decade as wake, blockage and availability " +
        "modelling improved.",
      takeaway:
        "P50 is only unbiased if every loss is modelled honestly — omitted losses (e.g. blockage) show up later as " +
        "under-performance.",
      source: "Lee & Fields (2021), Wind Energy Science 6, 311–365",
    },
  ],

  furtherReading: [
    {
      label: "Lee & Fields — An overview of wind-energy-production prediction bias, losses, and uncertainties",
      type: "paper",
      citation: "Wind Energy Science 6 (2021) 311–365, doi:10.5194/wes-6-311-2021",
    },
    {
      label: "Burton, Jenkins, Sharpe, Bossanyi — Wind Energy Handbook",
      type: "textbook",
      citation: "Wiley, 2nd ed. 2011",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/aep_calculator.py",
      description: "compute_aep_cascade() — multiplicative losses, RSS uncertainty, P50/P75/P90/P99, revenue.",
    },
    {
      file: "backend/app/services/p1/uncertainty_quantification.py",
      description: "Polynomial-chaos uncertainty propagation (Research Lab).",
    },
  ],

  relatedLessons: ["lesson-006"],
};
