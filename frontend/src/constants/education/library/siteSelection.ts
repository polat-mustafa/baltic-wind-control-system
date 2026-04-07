import type { EducationContent } from "../../../types/education";

export const siteSelectionEducation: EducationContent = {
  id: "library.site-selection",
  title: "Site Selection & Metocean Surveys",
  subtitle: "From a chart of the sea to a buildable wind farm",
  discipline: "Civil",

  overview:
    "Before any concrete is poured, a developer must prove that the seabed, the water column and the air above it are " +
    "compatible with a 25-year offshore project. Site selection is the disciplined process of converting a leasing area " +
    "into a layout, a foundation type and a metocean design basis. Mistakes here can sterilise an entire lease — it is the " +
    "single most consequential phase of the project lifecycle.",

  simpleExplanation:
    "Building a wind farm at sea is a bit like buying a house. Before you commit, you survey the plot: what's the soil " +
    "like? Does the wind blow consistently? Are there hidden problems (shipwrecks, pipelines, fishing grounds, marine " +
    "protected areas)? The answers reshape every later decision — turbine spacing, foundation type, cable corridors, even " +
    "vessel choice.",

  technicalExplanation:
    "Site selection unfolds in three stages: (1) desktop study using public bathymetry (GEBCO), wind reanalysis (ERA5), " +
    "vessel AIS density and protected-area registers; (2) geophysical campaign (multi-beam echo sounder, side-scan sonar, " +
    "sub-bottom profiler) producing a 1:5,000 seabed model; (3) geotechnical campaign (CPTu boreholes at every turbine and " +
    "cable corner), feeding into the foundation design. In parallel, a met-ocean campaign (LiDAR buoy, ADCP for currents, " +
    "wave-rider buoys) produces the design basis for IEC 61400-3 site classification (extreme Hs 50-yr, V_50, currents, " +
    "tidal range).",

  standards: [
    {
      label: "IEC 61400-3-1 — Design requirements for offshore wind turbines",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-RP-C205 — Environmental conditions and environmental loads",
      type: "standard",
    },
    {
      label: "DNV-RP-N101 — Risk management in marine and subsea operations",
      type: "standard",
    },
    {
      label: "ISO 19902 — Fixed steel offshore structures",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/ISO_19902",
    },
  ],

  formulas: [
    {
      expression: "H_s,50 = H_s,mean + k_50 · σ_Hs",
      variables: [
        { symbol: "H_s,50", name: "50-year return period significant wave height", unit: "m" },
        { symbol: "k_50", name: "Gumbel quantile (~ 4.6 for hourly data)", unit: "—" },
        { symbol: "σ_Hs", name: "Standard deviation of annual maxima", unit: "m" },
      ],
      explanation:
        "Extreme value extrapolation, classically by fitting a Gumbel distribution to annual maxima. IEC 61400-3 requires " +
        "≥10 years of measurements or hindcast data validated against ≥1 year of in-situ measurements.",
      reference: "DNV-RP-C205 §3.5",
    },
  ],

  workedExamples: [
    {
      title: "Design Hs for the Polish Baltic site",
      scenario:
        "ERA5 hindcast 1979–2024 at 55.0°N 17.5°E. Annual max Hs mean = 4.8 m, σ = 0.7 m.",
      steps: [
        "k_50 (Gumbel, 1-yr return) = -ln(-ln(1 - 1/50)) = 3.90",
        "Hs_50 = 4.8 + 3.90 × 0.7 = 4.8 + 2.73 = 7.53 m",
      ],
      result:
        "Design 50-year significant wave height ≈ 7.5 m. The associated peak period Tp ≈ 11 s drives both monopile fatigue " +
        "design and CTV operability.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea sandwave migration",
      description:
        "Hornsea 2 redesigned its monopile lengths after side-scan sonar showed a 1–2 m/yr sandwave field across part of " +
        "the lease. Failure to do so would have left foundations exposed within a decade.",
      takeaway:
        "Geophysical survey resolution must match the hydrodynamic timescales of the seabed, not just the turbine footprint.",
    },
  ],

  furtherReading: [
    {
      label: "GEBCO Bathymetric Compilation",
      type: "website",
      url: "https://www.gebco.net/",
    },
    {
      label: "EMODnet Geology Portal",
      type: "website",
      url: "https://emodnet.ec.europa.eu/en/geology",
    },
  ],

  relatedLessons: ["lesson-004"],
};
