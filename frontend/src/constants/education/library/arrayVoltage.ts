import type { EducationContent } from "../../../types/education";

export const arrayVoltageEducation: EducationContent = {
  id: "library.array-voltage",
  title: "Array Voltage Selection — Why 66 kV?",
  subtitle: "How the offshore wind industry moved from 33 kV to 66 kV — and why 132 kV is not the next step",
  discipline: "Electrical",

  overview:
    "The array voltage (the voltage level inside the wind farm, from turbine transformer to OSS) is one of the most " +
    "consequential design choices in an offshore wind project. Too low, and you need many parallel feeder cables " +
    "eating into the OSS busbar space and cable CAPEX. Too high, and nacelle transformers become impractically large " +
    "and heavy. The industry converged on 33 kV before 2010 and has been transitioning to 66 kV for large farms since " +
    "~2015. For a 510 MW project like Baltic Wind, 66 kV is the clear choice.",

  simpleExplanation:
    "Power = Voltage × Current. If you double the voltage, you halve the current for the same power — and because " +
    "cables are sized by current, you can carry twice the power through the same size wire. Going from 33 kV to 66 kV " +
    "means each feeder cable can carry four times more power (double the voltage squared), so you need fewer cables, " +
    "fewer busbar bays on the OSS, and smaller cable trenches on the seabed. That adds up to millions of euros in savings.",

  technicalExplanation:
    "A three-phase array cable rated I_max carries power P = √3 × V_LL × I_max × cos(φ). Doubling V_LL doubles P " +
    "for the same cable cross-section and current rating. In practice, moving from 33 kV to 66 kV: " +
    "(1) reduces the number of feeder strings by ~4× for the same farm capacity, " +
    "(2) reduces cable losses (I²R losses drop as I halves), " +
    "(3) reduces the number of OSS HV bays needed. " +
    "The 66 kV nacelle transformer (step-up from ~0.69 kV or 3.3 kV generator) is heavier than a 33 kV unit, " +
    "but turbine nacelles at 15 MW class already handle 300+ tonnes — the transformer mass increment is manageable. " +
    "132 kV is not used because: no standard submarine cable product exists at that voltage for inter-turbine lengths " +
    "(IEC 60502-2 covers up to 30 kV; IEC 60840 covers 30–150 kV but not as a standard array-cable product); " +
    "nacelle step-up transformers at 132 kV are bespoke and very heavy; GIS switchgear at 132 kV significantly " +
    "increases OSS footprint and cost.",

  standards: [
    {
      label: "IEC 60502-2 — Power cables with extruded insulation (6 kV to 30 kV)",
      type: "standard",
    },
    {
      label: "IEC 60840 — Power cables with extruded insulation (30 kV to 150 kV)",
      type: "standard",
    },
    {
      label: "CIGRE TB 610 — 66 kV systems for offshore wind farms",
      type: "standard",
      url: "https://www.e-cigre.org/",
    },
    {
      label: "ENTSO-E NC RfG Annex IV — Connection requirements at 66 kV level",
      type: "standard",
      url: "https://www.entsoe.eu/network_codes/rfg/",
    },
  ],

  formulas: [
    {
      expression: "P_string = √3 × V_LL × I_max",
      variables: [
        { symbol: "P_string", name: "Maximum power per feeder string", unit: "MW" },
        { symbol: "V_LL", name: "Line-to-line voltage", unit: "kV" },
        { symbol: "I_max", name: "Cable rated current (thermally limited)", unit: "A" },
      ],
      explanation:
        "At 33 kV with I_max = 900 A: P_string = √3 × 33 × 0.9 = 51 MW → need ≥10 strings for 510 MW. " +
        "At 66 kV with I_max = 900 A: P_string = √3 × 66 × 0.9 = 103 MW → need only 5 strings. " +
        "Halving the string count reduces OSS bays, cable trenching, and installation vessel time.",
    },
    {
      expression: "P_loss = 3 × I² × R × L",
      variables: [
        { symbol: "P_loss", name: "Three-phase resistive cable loss", unit: "W" },
        { symbol: "I", name: "Current (halved at double voltage for same power)", unit: "A" },
        { symbol: "R", name: "AC resistance per unit length", unit: "Ω/km" },
        { symbol: "L", name: "Cable length", unit: "km" },
      ],
      explanation:
        "Losses scale as I². Halving current (same power, double voltage) reduces losses by 75%. " +
        "For a 10 km string at 500 mm² Cu: 33 kV loses ~400 kW vs 66 kV losing ~100 kW per string — " +
        "an energy saving of ~260 GWh over 25 years for the whole farm.",
    },
  ],

  workedExamples: [
    {
      title: "String count comparison: 510 MW at 33 kV vs 66 kV",
      scenario:
        "34 × 15 MW turbines (510 MW), cable I_max = 900 A, power factor 0.95.",
      steps: [
        "33 kV: P_string = √3 × 33 × 0.9 × 0.95 = 48.7 MW → ceil(510/48.7) = 11 strings",
        "66 kV: P_string = √3 × 66 × 0.9 × 0.95 = 97.5 MW → ceil(510/97.5) = 6 strings",
        "OSS feeder bays: 11 (33 kV) vs 6 (66 kV) — 45% fewer bays",
        "Cable trench length: ~11 × 10 km = 110 km vs ~6 × 10 km = 60 km of array cable",
        "Array cable cost at €0.8M/km: €88M (33 kV) vs €48M (66 kV) — saving €40M",
      ],
      result:
        "66 kV saves approximately €40M in array cable CAPEX alone for this 510 MW project, " +
        "plus OSS platform size reduction (fewer bays) and lower array cable losses over 25 years. " +
        "The heavier nacelle transformer is justified many times over.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea One (UK, 2019) — First major 66 kV array deployment",
      description:
        "1.2 GW project using 66 kV inter-array cables — at the time the largest offshore wind farm in the world. " +
        "Its success proved 66 kV offshore products were commercially mature, triggering widespread industry adoption.",
      takeaway:
        "66 kV is now the standard for any new offshore wind project > 300 MW. No major new project has been designed " +
        "at 33 kV since approximately 2018.",
    },
    {
      title: "Baltic Power (Poland, 2025–26) — 66 kV at 76 × V236",
      description:
        "1.2 GW array using 66 kV. Direct precedent for Baltic Wind Alpha confirming the voltage level, cable " +
        "cross-sections, and OSS GIS configuration in the same sea area and grid connection point.",
      takeaway:
        "The 66 kV choice for Baltic Wind Alpha simply follows the established standard demonstrated immediately " +
        "next door by Baltic Power.",
    },
  ],

  furtherReading: [
    {
      label: "CIGRE TB 610 — 66 kV systems for offshore wind farms (2015)",
      type: "website",
      url: "https://www.e-cigre.org/",
    },
    {
      label: "Carbon Trust — Offshore Wind Accelerator: 66 kV array systems",
      type: "website",
      url: "https://www.carbontrust.com/our-work/projects/offshore-wind-accelerator",
    },
  ],

  relatedLessons: ["lesson-009"],
};
