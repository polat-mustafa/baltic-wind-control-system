import type { EducationContent } from "../../../types/education";

export const weibullEducation: EducationContent = {
  id: "p1.weibull",
  title: "Weibull Wind Speed Distribution",
  subtitle: "How often each wind speed occurs at hub height",
  discipline: "Civil",

  overview:
    "Hub-height wind speed at most offshore sites is well described by a two-parameter Weibull distribution: shape k " +
    "and scale A. The fitted distribution, multiplied by the turbine power curve and integrated, gives gross energy. " +
    "Fits are made to long-term data (reanalysis such as ERA5, met masts, floating LiDAR), corrected to the long term " +
    "and extrapolated to hub height.",

  simpleExplanation:
    "Sort every hour of the year by wind speed into 1 m/s boxes and count them — that is the histogram. The Weibull " +
    "curve is a smooth line through it with two knobs: A (how windy — it moves the curve right) and k (how steady — it " +
    "makes the curve narrower and taller).",

  technicalExplanation:
    "Offshore k is typically about 2–2.4 (k = 2 is the Rayleigh distribution). The mean is v̄ = A·Γ(1 + 1/k) — for " +
    "k = 2.2 that is 0.886·A. How strongly AEP reacts to A depends on the turbine: below rated P ∝ v³, but above " +
    "rated P is flat. For the low-specific-power V236 at this windy site, much of the energy comes at rated power, so a " +
    "1 % change in A moves gross AEP by only ≈ 1.2 % — far less than the 'cubic' rule of thumb suggests.",

  standards: [
    {
      label: "IEC 61400-1 — Wind turbines: design requirements (wind classes)",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-12-1 — Power performance measurements (method of bins)",
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
      expression: "f(v) = (k/A) · (v/A)^(k−1) · exp(−(v/A)^k)",
      variables: [
        { symbol: "v", name: "Hub-height wind speed", unit: "m/s" },
        { symbol: "k", name: "Shape parameter", unit: "—" },
        { symbol: "A", name: "Scale parameter", unit: "m/s" },
      ],
      explanation: "Probability density; × 1 m/s × 8,760 h gives hours per year in a 1 m/s bin (the chart's y-axis).",
    },
    {
      expression: "v̄ = A · Γ(1 + 1/k)",
      variables: [{ symbol: "Γ", name: "Gamma function", unit: "—" }],
      explanation: "For k = 2 (Rayleigh): v̄ = A·√π/2 ≈ 0.886·A. For k = 2.2: Γ(1.4545) = 0.8857.",
    },
    {
      expression: "AEP_gross = 8760 h · ∫ P(v) · f(v) dv",
      variables: [
        { symbol: "P(v)", name: "Turbine power curve", unit: "MW" },
        { symbol: "f(v)", name: "Weibull density", unit: "1/(m/s)" },
      ],
      explanation:
        "Integrate the power curve against the distribution — never P(v̄)·8760: P is non-linear, so the power at the " +
        "mean speed is not the mean power (Jensen's inequality).",
    },
  ],

  workedExamples: [
    {
      title: "This platform's site (A = 10.5 m/s, k = 2.2)",
      scenario: "Weibull inputs of the AEP tab; V236-15.0 MW power curve.",
      steps: [
        "v̄ = 10.5 × Γ(1 + 1/2.2) = 10.5 × 0.8857 = 9.30 m/s",
        "Gross energy per turbine = 8,760 · ∫P·f dv ≈ 71.7 GWh/yr (CF 54.6 %)",
        "Same integral with A = 10.605 m/s (+1 %): +1.2 % energy",
      ],
      result:
        "A mean of 9.3 m/s at 150 m is a strong Baltic site (IEC wind class I by mean speed, i.e. above class II's " +
        "8.5 m/s). The low AEP sensitivity to A is a property of this turbine–site pair, not a general rule.",
    },
  ],

  realWorldCases: [
    {
      title: "Long-term correction (MCP)",
      description:
        "On-site campaigns usually cover only 1–2 years. Measure-correlate-predict (MCP) against a long reanalysis " +
        "record corrects them to the long-term mean, because single years differ by several percent in energy.",
      takeaway: "The Weibull of one measured year is not the Weibull of the project's life.",
    },
  ],

  furtherReading: [
    {
      label: "ERA5 reanalysis (Copernicus C3S)",
      type: "website",
      url: "https://cds.climate.copernicus.eu/",
    },
    {
      label: "Burton, Jenkins, Sharpe, Bossanyi — Wind Energy Handbook",
      type: "textbook",
      citation: "Wiley, 2nd ed. 2011",
    },
    {
      label: "Manwell, McGowan, Rogers — Wind Energy Explained",
      type: "textbook",
      citation: "Wiley, 2nd ed. 2009",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/wind_analysis.py",
      description: "fit_weibull(), compute_weibull_pdf(), compute_wind_rose() — fitted on the synthetic hourly record.",
    },
    {
      file: "backend/app/routers/p1.py",
      description: "_generate_synthetic_wind() — Weibull speeds with a prevailing-direction speed-up.",
    },
  ],

  relatedLessons: ["lesson-004", "lesson-005"],
};
