import type { EducationContent } from "../../../types/education";

export const structuralFatigueEducation: EducationContent = {
  id: "library.structural-fatigue",
  title: "Structural Loads & Fatigue",
  subtitle: "Why a turbine is a fatigue machine, not a strength machine",
  discipline: "Mechanical",

  overview:
    "A wind turbine experiences ~10⁹ load cycles in 25 years — a number unmatched by any other large machine except " +
    "aircraft. Ultimate strength is rarely the design driver; fatigue is. Every weld, bolt and bearing must survive the " +
    "lifetime damage budget under combined wind, wave and operational loading. The damage equivalent load (DEL) is the " +
    "engineering shorthand that compresses a million-cycle Rainflow histogram into a single number for vendor comparison.",

  simpleExplanation:
    "Imagine bending a paperclip back and forth. Once is fine, ten times is fine, but a thousand times and it snaps — " +
    "even though you never came close to breaking it on a single bend. That's fatigue. A wind turbine bends a billion " +
    "times in its life, so engineers count every bend and add up the damage. The first weld to run out of damage budget " +
    "is the weakest link.",

  technicalExplanation:
    "Loads are extracted from a coupled aero-servo-elastic simulation (Bladed, OpenFAST) over the 60+ DLC (design load " +
    "case) bins specified in IEC 61400-1 Annex D. Time series are converted to cycle counts using the Rainflow algorithm, " +
    "weighted by site occupancy probability, and the equivalent damage is summed via Miner's rule. A fatigue-critical " +
    "design has a damage index D ≤ 1.0 — typically with a safety factor SF ≥ 1.25 on top. S-N curves are taken from " +
    "DNV-RP-C203 (steel in seawater with cathodic protection: curve T) — a doubling of stress range gives 2³ ≈ 8× damage.",

  standards: [
    {
      label: "IEC 61400-1 — Wind turbine design requirements and load cases",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-13 — Measurement of mechanical loads",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-RP-C203 — Fatigue design of offshore steel structures",
      type: "standard",
    },
    {
      label: "Eurocode 3 EN 1993-1-9 — Fatigue of steel structures (EU JRC)",
      type: "standard",
      url: "https://eurocodes.jrc.ec.europa.eu/",
    },
  ],

  formulas: [
    {
      expression: "D = Σ_i (n_i / N_i) ≤ 1",
      variables: [
        { symbol: "D", name: "Cumulative damage index", unit: "—" },
        { symbol: "n_i", name: "Number of cycles at stress range Δσ_i", unit: "—" },
        { symbol: "N_i", name: "Cycles to failure at Δσ_i (from S-N curve)", unit: "—" },
      ],
      explanation:
        "Miner's linear damage rule. Despite its known shortcomings under variable amplitude loading, it remains the " +
        "industry standard for design verification.",
      reference: "DNV-RP-C203 §2.3",
    },
    {
      expression: "DEL = (Σ_i n_i · Δσ_i^m / N_eq)^(1/m)",
      variables: [
        { symbol: "DEL", name: "Damage equivalent load", unit: "MNm or kN" },
        { symbol: "m", name: "S-N slope exponent (3 for steel in air, 5 for tubular joints)", unit: "—" },
        { symbol: "N_eq", name: "Reference cycle count (typically 10⁷)", unit: "—" },
      ],
      explanation:
        "Single number that produces the same fatigue damage as the entire spectrum at a chosen reference frequency. " +
        "Vendor power-curve datasheets quote DEL_x per location for direct comparison.",
    },
  ],

  workedExamples: [
    {
      title: "Tower base DEL for V236",
      scenario:
        "Coupled DLC1.2 (normal turbulence) simulation outputs Rainflow histogram with 10⁹ cycles at the tower base.",
      steps: [
        "Bin the cycles by stress range Δσ_i ∈ [10, 200] MPa",
        "S-N curve T (DNV-RP-C203, seawater + CP): m=3, log A = 11.764",
        "N_i = 10^(11.764 − 3·log(Δσ_i))",
        "Damage D = Σ n_i / N_i ≈ 0.42 over 25 years",
        "DEL @ 10⁷ cycles ≈ 95 MNm",
      ],
      result:
        "D = 0.42 leaves a 58% margin for hidden fatigue uncertainty (welds, soil cyclic degradation, climate change). " +
        "A second engineer should always run independent loads to cross-check the DEL.",
    },
  ],

  realWorldCases: [
    {
      title: "Vestas V164 grout failures",
      description:
        "Early 2010s offshore farms used cementitious grouted connections between monopile and transition piece. Cyclic " +
        "loading degraded the grout, causing the TP to slip several centimetres. Industry-wide retrofit cost > €100 M.",
      takeaway:
        "Even a 'standard' interface can hide a fatigue mode the design didn't anticipate. Modern projects use shear keys " +
        "or bolted flange connections instead.",
    },
  ],

  furtherReading: [
    {
      label: "Hansen & Thomsen — A new wind turbine design loads concept",
      type: "paper",
      citation: "Wind Energy 12 (2009), doi:10.1002/we.337",
    },
    {
      label: "OpenFAST — open-source aero-servo-elastic code",
      type: "website",
      url: "https://openfast.readthedocs.io",
    },
  ],

  relatedLessons: ["lesson-007"],
};
