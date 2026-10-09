import type { EducationContent } from "../../../types/education";

export const uncertaintyEducation: EducationContent = {
  id: "p1.uncertainty",
  title: "AEP Uncertainty",
  subtitle: "Putting a confidence interval on a long-term energy forecast",
  discipline: "Civil",

  overview:
    "Every AEP on this dashboard is a central estimate of an uncertain quantity. The width of its distribution — the " +
    "combined uncertainty σ — sets the gap between P50 (median) and P90 (bankable: the yield EXCEEDED with 90 % " +
    "probability, so the low value — forecasting's P90 on the Forecast page is the opposite, high quantile). Lenders size debt on P90, so a " +
    "wider σ means less debt for the same farm. Reducing σ (longer data, LiDAR, validated models) is therefore worth " +
    "real money, even when it does not change P50 at all.",

  simpleExplanation:
    "Forecasting 25 years of wind is hard: the measurements have errors, the past is not exactly the future, the wake " +
    "model is approximate. Each step adds a little doubt. 'Combined uncertainty' adds those doubts together with a " +
    "square-root-of-squares rule, which assumes they are independent. The bigger it is, the more cautious the bank.",

  technicalExplanation:
    "This platform builds σ (in % of AEP) from six sourced components of the farm: the wind resource from the NEWA " +
    "model with no on-site measurement (its mean-speed spread of 0.54 m/s, Dörenkämper et al. 2020), the 30-year " +
    "long-term period and the 25-year future variability (ERA5 interannual variability 4.2 %, divided by √N), the wake " +
    "and blockage model (25 % of the modelled loss, Walker et al. 2016), turbine performance 4.0 % and non-wake plant " +
    "losses 2.7 % (medians in Lee & Fields 2021). Speed uncertainties are converted through the power curve: at SB-510's " +
    "9.6 m/s mean, close to the IEA 15 MW's 10.66 m/s rated speed, 1 % of speed is only ≈ 0.98 % of energy. SB-510: " +
    "σ = √59.3 = 7.7 %. Totals of roughly 6–11 % are common (Lee & Fields 2021).",

  standards: [
    {
      label: "IEC 61400-15 (series) — Energy yield assessment and its uncertainty",
      type: "standard",
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
      scenario: "P50 = 2,161 GWh/yr (AEP tab, SB-510 site A = 10.80 m/s, k = 2.04). The six components listed above.",
      steps: [
        "Σσᵢ² = 5.51² + 0.75² + 0.82² + 2.1² + 4.0² + 2.7² = 59.3",
        "σ = √59.3 = 7.7 %",
        "P75 = 2,161 × (1 − 0.674 × 0.077) = 2,049 GWh",
        "P90 = 2,161 × (1 − 1.282 × 0.077) = 1,948 GWh",
        "P99 = 2,161 × (1 − 2.326 × 0.077) = 1,774 GWh",
      ],
      result:
        "P90/P50 = 0.901. Halving the wind-resource term (5.5 → 2.75 %, e.g. with a year of floating-LiDAR data) gives " +
        "σ = 6.04 % and lifts P90 to 1,994 GWh — 46 GWh/yr more bankable energy without changing P50.",
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
      description: "uncertainty_components(), aep_sensitivity(), compute_rss_uncertainty(), compute_exceedance_values().",
    },
    {
      file: "backend/app/services/p1/uncertainty_quantification.py",
      description: "Polynomial-chaos propagation of input uncertainty with Sobol indices.",
    },
  ],

};
