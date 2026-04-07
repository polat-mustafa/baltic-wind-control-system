import type { EducationContent } from "../../../types/education";

export const uncertaintyEducation: EducationContent = {
  id: "p1.uncertainty",
  title: "AEP Uncertainty (IEC 61400-15-2)",
  subtitle: "How to put a confidence interval on a 25-year energy forecast",
  discipline: "Civil",

  overview:
    "Every AEP figure on this dashboard is a point estimate drawn from a probability distribution. The width of that " +
    "distribution — the combined uncertainty — controls the gap between P50 (median) and P90 (bankable) energy. Banks " +
    "lend against P90, so a wider uncertainty literally means less debt and a more expensive project. IEC 61400-15-2 " +
    "(2022) is the rulebook for how every offshore developer must categorise and combine uncertainties for an investment-grade " +
    "energy yield assessment.",

  simpleExplanation:
    "Predicting how much energy a wind farm will make over 25 years is hard — the wind varies year-to-year, the wake " +
    "model is approximate, the cables warm up by different amounts in summer and winter. Every step has a small error. " +
    "The 'combined uncertainty' adds those errors up using a special rule (root-sum-square) that assumes the errors are " +
    "independent. The bigger the combined uncertainty, the more cautious banks are about lending.",

  technicalExplanation:
    "Uncertainty is split into eight categories: wind data, climatology, vertical extrapolation, wake model, blockage, " +
    "availability, electrical, and curtailment. Each contributor has a typical relative magnitude (1–5%). They combine via " +
    "σ_combined² = Σ σ_i², assuming independence. Total combined uncertainty for a mature offshore project is typically " +
    "5.5–8%. The P-value bands then come from the inverse normal distribution: P90 = P50 · (1 − 1.282·σ).",

  standards: [
    {
      label: "IEC 61400-15-2 — Energy yield assessment uncertainty",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-RP-J103 — Energy yield assessment of offshore wind farms",
      type: "standard",
    },
    {
      label: "MEASNET — Site Assessment guideline",
      type: "standard",
      url: "https://www.measnet.com/procedure/",
    },
    {
      label: "JCGM 100 — Guide to the Expression of Uncertainty in Measurement (GUM)",
      type: "standard",
      url: "https://www.bipm.org/en/committees/jc/jcgm",
    },
  ],

  formulas: [
    {
      expression:
        "σ_combined² = σ_wind² + σ_wake² + σ_blockage² + σ_avail² + σ_elec² + σ_curt²",
      variables: [
        { symbol: "σ_wind", name: "Wind resource uncertainty (3–5%)", unit: "—" },
        { symbol: "σ_wake", name: "Wake model uncertainty (1–2%)", unit: "—" },
        { symbol: "σ_blockage", name: "Blockage uncertainty (0.5–1%)", unit: "—" },
        { symbol: "σ_avail", name: "Availability uncertainty (1–2%)", unit: "—" },
        { symbol: "σ_elec", name: "Electrical loss uncertainty (0.5–1%)", unit: "—" },
        { symbol: "σ_curt", name: "Curtailment uncertainty (0.5–1%)", unit: "—" },
      ],
      explanation:
        "Root-sum-square combination under the independence assumption. IEC 61400-15-2 lists 30+ sub-contributors that " +
        "roll up into these six categories. The wind resource term is always dominant — improving it pays back more than " +
        "improving any of the others.",
      reference: "IEC 61400-15-2 §6.4",
    },
    {
      expression: "P_x = P50 · (1 − z_x · σ_combined)",
      variables: [
        { symbol: "P_x", name: "x% exceedance AEP", unit: "MWh/yr" },
        { symbol: "z_x", name: "Standard normal quantile", unit: "—" },
        { symbol: "σ_combined", name: "Combined relative uncertainty", unit: "—" },
      ],
      explanation:
        "Linear approximation valid when σ ≪ 1. z_75 = 0.674; z_90 = 1.282; z_95 = 1.645; z_99 = 2.326. For lognormal " +
        "treatment (more correct in the tails) replace P_x = P50 · exp(−z_x·σ).",
    },
    {
      expression: "σ_inter-annual = σ_long-term / √N_years",
      variables: [
        { symbol: "σ_long-term", name: "Inter-annual variability of mean wind speed (~6%)", unit: "—" },
        { symbol: "N_years", name: "Years of reference data used", unit: "—" },
      ],
      explanation:
        "Why long reference periods matter: 30 years of ERA5 reduces inter-annual uncertainty to ~1.1% versus ~6% for a " +
        "single year of measurements. This is the single highest-leverage step in resource assessment.",
    },
  ],

  workedExamples: [
    {
      title: "Combined uncertainty for the Baltic Wind site",
      scenario:
        "Mature offshore project with 30-year ERA5 reference, validated wake model (PyWake calibrated against operational " +
        "SCADA from a sister site), and well-known availability/electrical losses.",
      steps: [
        "σ_wind = 4.5% (3.5% climatology + 2.0% vertical extrapolation in quadrature)",
        "σ_wake = 1.8% (Bastankhah validated)",
        "σ_blockage = 0.8%",
        "σ_avail = 1.5%",
        "σ_elec = 0.7%",
        "σ_curt = 1.0%",
        "σ²_combined = 4.5² + 1.8² + 0.8² + 1.5² + 0.7² + 1.0² = 20.25+3.24+0.64+2.25+0.49+1.00 = 27.87",
        "σ_combined = √27.87 ≈ 5.28%",
      ],
      result:
        "Combined uncertainty ≈ 5.3%. P50 = 2,140 GWh → P90 = 2,140 × (1 − 1.282·0.0528) = 1,995 GWh. " +
        "P90/P50 ratio = 0.932 — this is the multiplier banks apply when sizing senior debt against energy revenue.",
    },
  ],

  realWorldCases: [
    {
      title: "Project under-performance — UK Round 2 farms",
      description:
        "A 2018 review of operational data showed several UK farms producing 5–8% below P50 forecast. Root cause: " +
        "wake models had systematically under-predicted long-distance wakes between adjacent farms (cluster-wake effect).",
      takeaway:
        "Inter-array wake uncertainty can be larger than intra-array. New developments cluster around existing farms and " +
        "must include the upstream wake explicitly.",
      source: "Renewable Energy Foundation 2018 review",
    },
    {
      title: "Hornsea 2 (UK) — over-performance",
      description:
        "Reported 7% above P50 in its first operational year, well outside the P90–P50 band. Driver: better-than-modelled " +
        "availability (turbine OEM service contract over-delivered).",
      takeaway:
        "P90 is a lower bound, not a forecast. The asymmetry between bankable forecasts and operating reality is a feature, " +
        "not a bug.",
    },
  ],

  furtherReading: [
    {
      label: "Clifton et al. — IEA Wind Task 43 RP on Uncertainty",
      type: "paper",
      citation: "Wind Energy Science 2022, doi:10.5194/wes-7-2363-2022",
    },
    {
      label: "Lee et al. — Bias in wind energy assessments",
      type: "paper",
      citation: "Renewable Energy 161 (2020), doi:10.1016/j.renene.2020.07.088",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/uncertainty_quantification.py",
      description: "Monte Carlo + polynomial chaos UQ for the cascade. Produces full P-value distributions.",
    },
    {
      file: "backend/app/services/p1/robust_optimization.py",
      description: "Robust layout design under wind direction and wake parameter uncertainty.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
