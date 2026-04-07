import type { EducationContent } from "../../../types/education";

export const powerCurveTestingEducation: EducationContent = {
  id: "library.power-curve-testing",
  title: "Power Curve Testing & Verification",
  subtitle: "How a turbine vendor proves the machine does what they claimed",
  discipline: "Mechanical",

  overview:
    "A turbine power curve is the contractual heart of every supply agreement. Underperformance against the warranted " +
    "curve triggers penalties of millions of euros per percentage point. IEC 61400-12-1 defines the measurement " +
    "methodology — site calibration, met-mast vs nacelle anemometry, air-density correction, bin averaging, " +
    "uncertainty quantification — to a level of detail that makes a 0.5% bias in any input visible to both parties.",

  simpleExplanation:
    "Every turbine comes with a graph that says 'at this wind speed I will produce this much power'. When the customer " +
    "buys 34 turbines that's a 1.5 billion euro promise. To check the promise actually holds, an independent engineer " +
    "stands a tall met-mast next to one of the turbines, measures the wind for 6 months, compares it with what the " +
    "turbine actually produced, and tells everyone whether the curve is real. The standard for doing this is " +
    "IEC 61400-12-1, and it is one of the most carefully written measurement standards in any industry.",

  technicalExplanation:
    "Procedure: install a met-mast (or LiDAR) within 2–4 D of the test turbine, measure wind speed at hub height for ≥ " +
    "180 h spread across the full power-producing range. Apply air-density correction to standard sea-level conditions " +
    "(ρ = 1.225 kg/m³). Bin the data in 0.5 m/s wind speed intervals. Compute the binned average power per bin. Combine " +
    "with the long-term Weibull distribution at the site to compute the AEP at the warranted reference air density. " +
    "Compare against the warranted AEP curve. Uncertainty must be calculated per IEC 61400-12-1 Annex E and is dominated " +
    "by anemometer calibration (~1.5%) and air-density measurement (~0.5%).",

  standards: [
    {
      label: "IEC 61400-12-1 — Power performance measurements for wind turbines",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-12-2 — Power performance based on nacelle anemometry",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "MEASNET — Power Performance Measurement Procedure",
      type: "standard",
      url: "https://www.measnet.com/procedure/",
    },
    {
      label: "Honrubia-Escribano et al. (2018) — Wind turbine power curve modelling (review, Energies)",
      type: "paper",
      url: "https://doi.org/10.3390/en11071799",
    },
  ],

  formulas: [
    {
      expression: "P_norm(v) = P_meas(v) · (ρ_ref / ρ_meas)",
      variables: [
        { symbol: "P_norm", name: "Air-density-corrected power", unit: "kW" },
        { symbol: "P_meas", name: "Measured power", unit: "kW" },
        { symbol: "ρ_ref", name: "Reference air density (1.225)", unit: "kg/m³" },
        { symbol: "ρ_meas", name: "Site air density at the time of measurement", unit: "kg/m³" },
      ],
      explanation:
        "Active stall and pitch-regulated turbines apply different exponents (1 vs 1/3) — IEC 61400-12-1 §9 specifies " +
        "the correct formula per turbine class. Cold offshore air can be ~5% denser than the reference, raising power.",
    },
    {
      expression: "AEP_warranted = Σ_i P̄_i · 8760 · (F(v_i+) − F(v_i−))",
      variables: [
        { symbol: "P̄_i", name: "Mean power in bin i", unit: "kW" },
        { symbol: "F(v)", name: "Weibull CDF at the site", unit: "—" },
      ],
      explanation:
        "Combine the measured binned power curve with the site Weibull distribution to derive an annual energy " +
        "production. This AEP is what the OEM warranty pays out against — a 1% shortfall typically triggers a 5% capex " +
        "penalty.",
    },
  ],

  workedExamples: [
    {
      title: "Interpreting a power-curve test result",
      scenario:
        "V236-15.0 MW power curve test at the Baltic Wind sister site, 6 months of valid bins, A=11.3 m/s, k=2.2.",
      steps: [
        "Measured AEP at site air density (ρ ≈ 1.245) = 87.4 GWh/turbine/yr",
        "Air-density correction to 1.225 → 87.4 × (1.225/1.245) = 86.0 GWh/turbine/yr",
        "Warranted AEP per OEM = 87.0 GWh/turbine/yr (at the same Weibull)",
        "Underperformance = (87.0 − 86.0)/87.0 = 1.15%",
        "Contractual remedy: 1.15% × 0.05 × CAPEX_per_turbine ≈ 27,000 EUR/turbine penalty",
      ],
      result:
        "1.15% underperformance × 34 turbines × 27,000 EUR ≈ 920,000 EUR penalty. Significant, but small relative to " +
        "total CAPEX. This is why power-curve verification is paid for by the buyer — it's almost always worth the " +
        "~€500,000 measurement campaign.",
    },
  ],

  realWorldCases: [
    {
      title: "Lillgrund (Sweden) — first major wake validation",
      description:
        "Lillgrund's tight 4D × 4D spacing made it a test bed for power-curve testing under heavy wake. Operational data " +
        "showed wake losses of 14% — 3% higher than the consented model — driving an industry-wide recalibration of wake " +
        "engineering models.",
      takeaway:
        "Power-curve testing in a wake-exposed turbine is hard. Always test the freestream turbine to verify the curve, " +
        "then validate the wake model separately.",
    },
  ],

  furtherReading: [
    {
      label: "IEA Wind Task 32 — LiDAR systems for wind energy",
      type: "website",
      url: "https://iea-wind.org/task32/",
    },
    {
      label: "Pedersen et al. — Recommended Practices for Wind Farm Data Collection",
      type: "paper",
      citation: "Wind Energy Science 6 (2021), doi:10.5194/wes-6-989-2021",
    },
  ],

  relatedLessons: ["lesson-005"],
};
