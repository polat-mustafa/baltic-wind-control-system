import type { EducationContent } from "../../../types/education";

export const windRoseEducation: EducationContent = {
  id: "p1.wind-rose",
  title: "Wind Rose & Vertical Shear",
  subtitle: "Directional distribution of wind frequency, speed and energy",
  discipline: "Civil",

  overview:
    "A wind rose is a polar histogram showing how often the wind blows from each compass sector and at what speed. " +
    "It is a primary input to layout optimisation: turbines should be spaced wider along the dominant directions to " +
    "minimise wake losses. The rose is normally complemented by a vertical shear profile that translates measurement " +
    "height to hub height (150 m for the V236-15.0 MW).",

  simpleExplanation:
    "Imagine standing in the middle of a clock face. The wind rose tells you, for each clock sector, how often the wind " +
    "comes from that direction and how strong it is when it does. A long petal pointing southwest means most wind comes " +
    "from the southwest. The shear profile tells you that wind is faster the higher you measure it, so a number measured " +
    "at 100 m has to be scaled up to the turbine hub at 150 m before any energy calculation.",

  technicalExplanation:
    "Direction is binned in 12 × 30° sectors (or 16 × 22.5° for finer studies). Each bin gets its own Weibull fit, then " +
    "the bins are combined for the omnidirectional fit. The power-law shear V(z)=V_ref·(z/z_ref)^α is the simplest " +
    "extrapolation; α≈0.10 is typical for offshore (low surface roughness), versus 0.14–0.20 onshore. Monin-Obukhov " +
    "stability corrections are used when measurements span large height differences or when stability classes vary " +
    "diurnally (common in coastal Baltic conditions).",

  standards: [
    {
      label: "IEC 61400-1 §11 — Wind conditions for design",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-12-1 Annex H — Site calibration",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "MEASNET — Site Assessment guideline",
      type: "standard",
      url: "https://www.measnet.com/procedure/",
    },
    {
      label: "IEA Wind Task 11 Recommended Practices",
      type: "standard",
      url: "https://iea-wind.org/task11/",
    },
  ],

  formulas: [
    {
      expression: "V(z) = V_ref · (z / z_ref)^α",
      variables: [
        { symbol: "V(z)", name: "Wind speed at height z", unit: "m/s" },
        { symbol: "V_ref", name: "Wind speed at reference height", unit: "m/s" },
        { symbol: "z", name: "Target height (hub)", unit: "m" },
        { symbol: "z_ref", name: "Reference height", unit: "m" },
        { symbol: "α", name: "Power-law shear exponent", unit: "—" },
      ],
      explanation:
        "Power-law extrapolation. α=0.10 typical offshore, 0.14 in IEC standard wind class definitions, 0.20 onshore. " +
        "This is a steady-state simplification — the true profile depends on atmospheric stability.",
      reference: "IEC 61400-1 §6.3.1.2",
    },
    {
      expression: "V(z) = (u*/κ) · ln(z / z₀)  −  Ψ_m(z/L)",
      variables: [
        { symbol: "u*", name: "Friction velocity", unit: "m/s" },
        { symbol: "κ", name: "von Kármán constant ≈ 0.40", unit: "—" },
        { symbol: "z₀", name: "Roughness length", unit: "m" },
        { symbol: "Ψ_m", name: "Stability correction", unit: "—" },
        { symbol: "L", name: "Monin-Obukhov length", unit: "m" },
      ],
      explanation:
        "Monin-Obukhov surface-layer profile. Reduces to logarithmic form under neutral stability. Required when " +
        "extrapolating across large height differences in stable (winter) conditions.",
    },
  ],

  workedExamples: [
    {
      title: "Extrapolate ERA5 100 m wind to V236 hub height",
      scenario:
        "ERA5 reports V_100m = 9.50 m/s for a Baltic grid cell. Use offshore shear α=0.10 to obtain hub-height speed at 150 m.",
      steps: [
        "Ratio: (150 / 100)^0.10 = 1.5^0.10",
        "ln(1.5) = 0.4055; × 0.10 = 0.04055",
        "exp(0.04055) ≈ 1.0414",
        "V_150m = 9.50 × 1.0414 ≈ 9.89 m/s",
      ],
      result:
        "Hub-height wind ≈ 9.89 m/s — about 4% higher than at 100 m. This single 4% step changes raw P50 energy by ~10%, " +
        "which is why hub-height extrapolation accuracy is more important than people realise.",
    },
  ],

  realWorldCases: [
    {
      title: "Baltic 1 (Germany) — directional asymmetry",
      description:
        "Wind rose dominated by SW (35% frequency) and W (22%) sectors. Layout was rotated 12° clockwise from a square grid " +
        "to align row gaps with the prevailing direction, reducing modelled wake losses by ~1.4%.",
      takeaway:
        "Wind rose orientation directly drives layout rotation. Even small rotations matter at GW scale.",
    },
    {
      title: "Stable nocturnal jet over the southern Baltic",
      description:
        "Field campaigns (e.g. FINO offshore platforms) regularly measure low-level jets at 100–250 m during stable nights. " +
        "Power-law extrapolation can underestimate hub-height wind by 5–10% when these jets are present.",
      takeaway:
        "When the planned hub is much taller than the reference height, validate with on-site lidar — the cheap power-law " +
        "model breaks down under stable stratification.",
    },
  ],

  furtherReading: [
    {
      label: "Stull — An Introduction to Boundary Layer Meteorology",
      type: "textbook",
      citation: "Springer 1988, ISBN 978-90-277-2769-5",
    },
    {
      label: "FINO offshore research platforms (Germany)",
      type: "website",
      url: "https://www.fino-offshore.de/",
    },
    {
      label: "Copernicus ERA5 reanalysis dataset",
      type: "website",
      url: "https://cds.climate.copernicus.eu/",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/wind_analysis.py",
      description: "directional_binning() and shear_extrapolate() helpers used by the rose chart and Weibull fitter.",
    },
  ],

  relatedLessons: ["lesson-004", "lesson-005"],
};
