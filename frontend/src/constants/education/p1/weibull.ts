import type { EducationContent } from "../../../types/education";

export const weibullEducation: EducationContent = {
  id: "p1.weibull",
  title: "Weibull Wind Speed Distribution",
  subtitle: "How wind speed frequency is parameterised at hub height",
  discipline: "Civil",

  overview:
    "The Weibull distribution is the standard statistical fit for hub-height wind speed at almost every offshore site. " +
    "Two parameters — shape k and scale A — fully describe the curve. They are obtained by least-squares or maximum-likelihood " +
    "fitting on the histogram of long-term measurements (ERA5 reanalysis, met-mast, or nacelle anemometer). The fitted " +
    "Weibull is then convolved with the turbine power curve to produce the gross AEP estimate.",

  simpleExplanation:
    "Imagine binning every wind-speed measurement at the turbine hub by speed (0–1 m/s, 1–2 m/s, ...). The Weibull formula " +
    "draws a smooth bell-like curve through that histogram. Two numbers control the shape: how peaky it is (k) and where it " +
    "sits on the speed axis (A). Once you have those two numbers you can predict how often any wind speed will occur in a year.",

  technicalExplanation:
    "For Class I offshore sites, k is typically 2.0–2.4 (close to a Rayleigh distribution, k=2). A is related to the long-term " +
    "mean wind speed by V_mean = A·Γ(1 + 1/k). Errors in A propagate roughly cubically into AEP because power scales with V³, " +
    "so a 1% error on A becomes ~3% error on energy. Modern energy yield assessments quote uncertainty per IEC 61400-15-2, " +
    "splitting wind resource (~3–5%), wake (~1–2%), and electrical losses (<1%) and combining them by the root-sum-square method.",

  standards: [
    {
      label: "IEC 61400-1 — Wind turbines: Design requirements",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-12-1 — Power performance measurements",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-15-2 — Energy yield assessment uncertainty",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "MEASNET — Evaluation of Site-Specific Wind Conditions",
      type: "standard",
      url: "https://www.measnet.com/procedure/",
    },
    {
      label: "DNV-RP-J103 — Energy yield assessment of offshore wind farms",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "f(v) = (k/A)·(v/A)^(k−1)·exp(−(v/A)^k)",
      variables: [
        { symbol: "v", name: "Wind speed at hub height", unit: "m/s" },
        { symbol: "k", name: "Shape parameter", unit: "—" },
        { symbol: "A", name: "Scale parameter", unit: "m/s" },
      ],
      explanation:
        "The probability density of wind speed v. Integrated over a 1 m/s bin it gives the fraction of hours per year " +
        "with that wind speed. Higher k → narrower / more consistent wind; higher A → faster mean wind.",
      reference: "Burton et al., Wind Energy Handbook 2e, §2.4",
    },
    {
      expression: "V_mean = A·Γ(1 + 1/k)",
      variables: [
        { symbol: "V_mean", name: "Long-term mean wind speed", unit: "m/s" },
        { symbol: "Γ", name: "Gamma function", unit: "—" },
        { symbol: "A", name: "Scale parameter", unit: "m/s" },
        { symbol: "k", name: "Shape parameter", unit: "—" },
      ],
      explanation:
        "Closed-form mean of a Weibull-distributed variable. For k=2 (Rayleigh) this reduces to V_mean = A·√(π)/2 ≈ 0.886·A.",
    },
    {
      expression: "AEP_gross = T · ∫ P(v)·f(v) dv",
      variables: [
        { symbol: "AEP_gross", name: "Gross annual energy production", unit: "MWh/yr" },
        { symbol: "T", name: "Hours per year", unit: "8760 h" },
        { symbol: "P(v)", name: "Turbine power curve", unit: "MW" },
        { symbol: "f(v)", name: "Weibull PDF", unit: "1/(m/s)" },
      ],
      explanation:
        "Convolution of the wind speed PDF with the turbine power curve. Integration is normally done numerically over " +
        "1 m/s bins from cut-in (3 m/s) to cut-out (31 m/s for the V236-15.0 MW).",
      reference: "IEC 61400-12-1 §9.2",
    },
  ],

  workedExamples: [
    {
      title: "Mean wind speed at the Baltic Wind site",
      scenario:
        "ERA5 reanalysis bilinearly interpolated to 54.8°N 17.5°E and extrapolated from 100 m to 150 m hub height with " +
        "shear exponent α=0.10 yields a fit of k = 2.20 and A = 11.30 m/s for the 1991–2020 climatology.",
      steps: [
        "1 + 1/k = 1 + 1/2.20 = 1.4545",
        "Γ(1.4545) ≈ 0.8856  (table lookup or scipy.special.gamma)",
        "V_mean = A · Γ(1 + 1/k) = 11.30 × 0.8856",
        "V_mean ≈ 10.01 m/s",
      ],
      result:
        "Long-term hub-height mean ≈ 10.0 m/s — Class IA site by IEC 61400-1, supports a capacity factor in the 50–55% range.",
    },
    {
      title: "Sensitivity of AEP to A",
      scenario:
        "Same site, but a re-fit on a slightly different reference period gives A = 11.40 m/s (+0.9%). All other parameters held.",
      steps: [
        "ΔA / A = 0.10 / 11.30 ≈ +0.88%",
        "Approximate AEP sensitivity at rated: ∂AEP/∂A ≈ 2.5–3 × ΔA/A (cubic in v below rated, flat above)",
        "ΔAEP ≈ 0.88% × 2.7 ≈ +2.4%",
      ],
      result:
        "A 0.9% scale-parameter shift moves the gross AEP by ~2.4%. This is why long-term reference period selection is the " +
        "single largest contributor to wind resource uncertainty.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea 2 (UK, 1.32 GW)",
      description:
        "The world's largest operating offshore wind farm at the time of commissioning. Site Weibull at 100 m: k ≈ 2.10, " +
        "A ≈ 10.8 m/s. Reported P50 AEP ≈ 5.4 TWh/yr, capacity factor ≈ 47%.",
      takeaway:
        "Real offshore sites cluster around k ≈ 2 (Rayleigh) with A ≈ 10–11 m/s. Capacity factors above 45% are achievable " +
        "in the central North Sea and southern Baltic; the Polish Baltic Sea is comparable.",
      source: "Ørsted Annual Report 2022; UK BEIS Energy Trends 2023",
    },
    {
      title: "Anholt (Denmark, 400 MW) — long-term reference correction",
      description:
        "On-site met-mast measurements covered only 18 months, so they were extended via MCP (Measure-Correlate-Predict) " +
        "against a 30-year ERA-Interim reference. The MCP correction shifted A by +0.6%, moving P90 AEP by ~1.6%.",
      takeaway:
        "Short on-site measurement campaigns must be statistically extended to a long-term climatology before financing — " +
        "the Weibull fit alone is not enough.",
    },
  ],

  furtherReading: [
    {
      label: "ERA5 Climate Reanalysis (Copernicus C3S)",
      type: "website",
      url: "https://cds.climate.copernicus.eu/",
    },
    {
      label: "Burton, Jenkins, Sharpe, Bossanyi — Wind Energy Handbook 2e",
      type: "textbook",
      citation: "Wiley 2011, ISBN 978-0-470-69975-1",
    },
    {
      label: "Manwell, McGowan, Rogers — Wind Energy Explained 2e",
      type: "textbook",
      citation: "Wiley 2009, ISBN 978-0-470-01500-1",
    },
    {
      label: "WAsP — the industry-standard wind atlas software",
      type: "website",
      url: "https://www.wasp.dk/wind-atlas",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/wind_analysis.py",
      description:
        "weibull_fit() — least-squares fit of (k, A) on a hub-height histogram; mean / variance helpers and AEP integration.",
    },
    {
      file: "backend/app/services/p1/data_processing.py",
      description:
        "ERA5 ingestion, bilinear spatial interpolation, vertical extrapolation via the power-law shear profile.",
    },
  ],

  relatedLessons: ["lesson-004", "lesson-005"],
};
