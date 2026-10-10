import type { EducationContent } from "../../../types/education";

export const windRoseEducation: EducationContent = {
  id: "p1.wind-rose",
  title: "Wind Rose & Vertical Shear",
  subtitle: "Where the wind comes from, how strong, and how it changes with height",
  discipline: "Civil",

  overview:
    "A wind rose is a polar histogram: for each compass sector, how often the wind blows from it, split into speed " +
    "classes. It drives layout — turbines need more room along the prevailing direction — and it is an input to the " +
    "wake model here: the AEP tab's PyWake site uses this same 12-sector rose with a Weibull fit per sector. The " +
    "energy rose (orange outline) weights each sector by v³, because power scales with the cube of speed.",

  simpleExplanation:
    "Stand in the middle of a compass. Each petal points to where the wind comes FROM; its length is how often. The " +
    "darker the colour, the faster the wind. If the orange energy line sticks out beyond a petal, that direction brings " +
    "stronger winds than average — it matters more for energy than its frequency suggests.",

  technicalExplanation:
    "Directions are binned into 12 × 30° sectors centred on N, 30°, 60° … ; each sector gets its own Weibull fit. The " +
    "synthetic record here is centred on 240° (WSW) with a circular spread of 60°, and wind speeds are scaled by " +
    "1 + 0.12·cos(θ − 240°): about 12 % above average from the prevailing sector and 12 % below from the opposite " +
    "one — an educational assumption in line with the westerly-dominated southern Baltic. Hub-height extrapolation commonly uses the power law v(z) = v_ref (z/z_ref)^α with α ≈ 0.1 " +
    "offshore; the IEC design profiles use α = 0.2 (IEC 61400-1, onshore) and 0.14 (IEC 61400-3-1, offshore).",

  standards: [
    {
      label: "IEC 61400-1 — Design requirements (normal wind profile)",
      type: "standard",
    },
    {
      label: "IEC 61400-3-1 — Design requirements for fixed offshore wind turbines",
      type: "standard",
    },
    {
      label: "MEASNET — Evaluation of site-specific wind conditions, Version 3 (2022)",
      type: "standard",
      url: "https://www.measnet.com/documents/",
    },
  ],

  formulas: [
    {
      expression: "v(z) = v_ref · (z / z_ref)^α",
      variables: [
        { symbol: "z", name: "Target height (hub)", unit: "m" },
        { symbol: "z_ref", name: "Reference (measurement) height", unit: "m" },
        { symbol: "α", name: "Shear exponent (≈ 0.1 offshore, stability-dependent)", unit: "—" },
      ],
      explanation:
        "Simple steady-state profile. Under stable stratification (common over cold water in spring) real shear can be " +
        "much stronger, so on-site LiDAR is the safer basis for tall hubs.",
    },
    {
      expression: "v(z) = (u* / κ) · [ln(z / z₀) − Ψ_m(z / L)]",
      variables: [
        { symbol: "u*", name: "Friction velocity", unit: "m/s" },
        { symbol: "κ", name: "von Kármán constant ≈ 0.40", unit: "—" },
        { symbol: "z₀", name: "Roughness length (sea ≈ 0.0002 m)", unit: "m" },
        { symbol: "Ψ_m", name: "Stability correction", unit: "—" },
        { symbol: "L", name: "Obukhov length", unit: "m" },
      ],
      explanation: "Monin–Obukhov surface-layer profile; reduces to the log law in neutral conditions (Ψ_m = 0).",
    },
    {
      expression: "Energy share_s ∝ Σ_{hours in s} v³",
      variables: [{ symbol: "s", name: "Direction sector", unit: "—" }],
      explanation: "The energy rose; compare it with the frequency rose to see which directions matter most for AEP.",
    },
  ],

  workedExamples: [
    {
      title: "Extrapolating 100 m data to the 150 m hub",
      scenario: "A dataset gives v̄ = 8.93 m/s at 100 m; offshore α = 0.10; IEA 15 MW hub at 150 m.",
      steps: [
        "(150 / 100)^0.10 = 1.5^0.10 = 1.0414",
        "v̄(150 m) = 8.93 × 1.0414 = 9.30 m/s",
        "Gross AEP with the speed scaled by 1.0414 (same k): +4.6 % for the IEA 15 MW at this site",
      ],
      result:
        "A 4 % speed correction is worth ≈ 4.6 % energy here. Get the shear wrong by 0.05 in α and the hub speed moves by " +
        "≈ 2 %, a full uncertainty band of its own.",
    },
  ],

  realWorldCases: [
    {
      title: "Low-level jets over the Baltic",
      description:
        "Ship-based lidar over the southern Baltic recorded low-level jets in 9.4 % of hours, mostly at night; stable " +
        "layers, typical in spring, make them more likely, and numerical models underestimate how often they occur. " +
        "A single power-law exponent does not capture such profiles.",
      takeaway: "For 150 m hubs, measure the profile (floating LiDAR) rather than assume it.",
      source: "Rubio, Kühn & Gottschall, Wind Energy Science 7, 2433–2455 (2022)",
    },
  ],

  furtherReading: [
    {
      label: "Stull — An Introduction to Boundary Layer Meteorology",
      type: "textbook",
      citation: "Springer 1988",
    },
    {
      label: "Copernicus ERA5 reanalysis",
      type: "website",
      url: "https://cds.climate.copernicus.eu/",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/wind_analysis.py",
      description: "classify_direction_sector(), compute_wind_rose() — sector frequencies, means, Weibull fits, energy rose.",
    },
    {
      file: "backend/app/routers/p1.py",
      description: "_generate_synthetic_wind() and _site() — the same rose feeds the PyWake site; /wind-rose adds the speed-class table.",
    },
  ],

};
