import type { EducationContent } from "../../../types/education";

export const uncertaintyEducation: EducationContent = {
  id: "p1.uncertainty",
  title: "AEP Uncertainty",
  subtitle: "Putting a confidence interval on a long-term energy forecast",
  discipline: "Civil",

  overview:
    "Every AEP on this dashboard is a central estimate of an uncertain quantity. The width of its distribution — the " +
    "combined uncertainty σ — sets the gap between P50 (median) and P90 (bankable). Lenders size debt on P90, so a " +
    "wider σ means less debt for the same farm. Reducing σ (longer data, LiDAR, validated models) is therefore worth " +
    "real money, even when it does not change P50 at all.",

  simpleExplanation:
    "Forecasting 25 years of wind is hard: the measurements have errors, the past is not exactly the future, the wake " +
    "model is approximate. Each step adds a little doubt. 'Combined uncertainty' adds those doubts together with a " +
    "square-root-of-squares rule, which assumes they are independent. The bigger it is, the more cautious the bank.",

  technicalExplanation:
    "This platform combines eight sources (σ in % of AEP): wind resource 4.0, wake model 3.0, long-term correction " +
    "3.0, wind shear 2.0, availability 2.0, power curve 1.5, environmental 1.5, electrical 1.0. RSS gives σ = √47.5 = " +
    "6.89 %. Note that the sources are energy uncertainties — a speed uncertainty must first be converted through the " +
    "power curve, and for a low-specific-power turbine like the V236 at a windy site 1 % of speed is only ≈ 1.2 % of " +
    "energy (much of the year is spent at rated power). Totals of roughly 6–10 % are common for offshore projects.",

  standards: [
    {
      label: "IEC 61400-15 (series) — Energy yield assessment and its uncertainty",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "JCGM 100 — Guide to the Expression of Uncertainty in Measurement (GUM)",
      type: "standard",
      url: "https://www.bipm.org/en/committees/jc/jcgm",
    },
  ],

  formulas: [
    {
      expression: "σ = √(σ₁² + σ₂² + … + σₙ²)",
      variables: [
        { symbol: "σᵢ", name: "Uncertainty of source i, as % of AEP", unit: "%" },
        { symbol: "σ", name: "Combined (1σ) uncertainty", unit: "%" },
      ],
      explanation:
        "Root-sum-square: valid for independent sources. Correlated sources (e.g. two parts of the same wind dataset) " +
        "must be added linearly first.",
    },
    {
      expression: "P_x = P50 · (1 − z_x · σ)",
      variables: [
        { symbol: "z_x", name: "Standard-normal quantile: P75 0.674, P90 1.282, P99 2.326", unit: "—" },
      ],
      explanation:
        "Normal approximation. Some assessors use a lognormal form P_x = P50·exp(−z_x·σ), which is slightly less " +
        "pessimistic in the far tail.",
    },
    {
      expression: "σ_IAV,N = σ_IAV,1 / √N",
      variables: [
        { symbol: "σ_IAV,1", name: "Year-to-year variability of annual energy", unit: "%" },
        { symbol: "N", name: "Years averaged", unit: "—" },
      ],
      explanation:
        "Averaging N independent years shrinks the variability by √N: about 6 % for one year falls to about 1.1 % for " +
        "a 30-year mean. This is why a long-term reference dataset matters so much.",
    },
  ],

  workedExamples: [
    {
      title: "This platform's σ and P-values",
      scenario: "P50 = 2,077 GWh/yr (AEP tab, A = 10.5 m/s, k = 2.2). Eight sources as listed above.",
      steps: [
        "Σσᵢ² = 16 + 9 + 9 + 4 + 4 + 2.25 + 2.25 + 1 = 47.5",
        "σ = √47.5 = 6.89 %",
        "P75 = 2,077 × (1 − 0.674 × 0.0689) = 1,981 GWh",
        "P90 = 2,077 × (1 − 1.282 × 0.0689) = 1,894 GWh",
        "P99 = 2,077 × (1 − 2.326 × 0.0689) = 1,744 GWh",
      ],
      result:
        "P90/P50 = 0.912. Halving the wind-resource term (4 → 2 %, e.g. with a year of floating-LiDAR data) gives " +
        "σ = √35.5 = 5.96 % and lifts P90 to 1,919 GWh — 25 GWh/yr more bankable energy without changing P50.",
    },
  ],

  realWorldCases: [
    {
      title: "Why the bias matters as much as the spread",
      description:
        "Validation studies compiled across many projects show that historical pre-construction estimates tended to " +
        "over-predict production; a well-calibrated σ is only meaningful when the P50 itself is unbiased.",
      takeaway: "Uncertainty describes random error; systematic omissions (missing losses) must be fixed, not widened.",
      source: "Lee & Fields (2021), Wind Energy Science 6, 311–365",
    },
  ],

  furtherReading: [
    {
      label: "Lee & Fields — An overview of wind-energy-production prediction bias, losses, and uncertainties",
      type: "paper",
      citation: "Wind Energy Science 6 (2021) 311–365, doi:10.5194/wes-6-311-2021",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/aep_calculator.py",
      description: "DEFAULT_UNCERTAINTY_SOURCES, compute_rss_uncertainty(), compute_exceedance_values().",
    },
    {
      file: "backend/app/services/p1/uncertainty_quantification.py",
      description: "Polynomial-chaos propagation of input uncertainty with Sobol indices.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
