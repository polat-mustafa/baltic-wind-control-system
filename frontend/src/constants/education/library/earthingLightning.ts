import type { EducationContent } from "../../../types/education";

export const earthingLightningEducation: EducationContent = {
  id: "library.earthing-lightning",
  title: "Earthing & Lightning Protection",
  subtitle: "Why every offshore turbine is hit by lightning roughly every two years",
  discipline: "Electrical",

  overview:
    "Wind turbines are the tallest objects in any seascape and are routinely struck by lightning. A 280 m V236 attracts " +
    "≈ 0.5 strikes per year on the open sea. The receptor system in the blade tip carries the current down through " +
    "carbon-laminate down-conductors to the hub, through the slip ring (or spark gap), down the tower steel, and into the " +
    "monopile. From the monopile, the seabed forms the global earth. A failure anywhere in this chain leads to blade " +
    "delamination, bearing arcing, or blown SCADA cards.",

  simpleExplanation:
    "Lightning will hit a 280 m tall steel tower in the middle of the sea. There's no avoiding it. The job is to give " +
    "the strike an easy path from the blade tip all the way down to the seabed without it taking shortcuts through the " +
    "expensive electronics. We bond every metal part in the turbine to a single earth, like a giant gutter system for " +
    "electricity.",

  technicalExplanation:
    "Design follows IEC 61400-24, which is a wind-turbine-specific application of IEC 62305 (general lightning " +
    "protection). Protection level LPL I is mandatory for blades — capable of handling a 200 kA, 10/350 µs first stroke " +
    "and 100 C charge. Step and touch voltages around the tower base must satisfy IEEE 80 / IEC 60479 limits even during " +
    "a worst-case strike. For offshore, the seawater provides an effectively infinite earth electrode (R_e ≈ 0.1 Ω) — " +
    "much better than any onshore installation can achieve. The vulnerable points are: blade-to-pitch-bearing transition, " +
    "yaw bearing, and the slip ring or rotating spark gap that moves the strike current across the rotating interface.",

  standards: [
    {
      label: "IEC 61400-24 — Lightning protection of wind turbines",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 62305 — Protection against lightning",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_62305",
    },
    {
      label: "IEEE 80 — Guide for safety in AC substation grounding",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Electrical_grounding",
    },
    {
      label: "IEC 60479-1 — Effects of current on the human body",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Electrical_injury",
    },
  ],

  formulas: [
    {
      expression: "U_step = ρ · I_E · (1 / r − 1 / (r + 1)) / (2π)",
      variables: [
        { symbol: "U_step", name: "Step voltage at distance r from tower base", unit: "V" },
        { symbol: "ρ", name: "Soil/seawater resistivity (≈ 0.3 Ω·m for seawater)", unit: "Ω·m" },
        { symbol: "I_E", name: "Earth current during strike", unit: "A" },
        { symbol: "r", name: "Distance from monopile centre", unit: "m" },
      ],
      explanation:
        "Hemispherical electrode model. With seawater resistivity 1,000× lower than typical onshore soil, step voltages at " +
        "the tower base are negligible — service technicians can stand on the boat landing during a thunderstorm without " +
        "harm (although they don't!).",
    },
    {
      expression: "Q_strike,99% ≈ 300 C,    di/dt_max ≈ 200 kA/µs",
      variables: [
        { symbol: "Q_strike", name: "Total transferred charge per strike", unit: "C" },
        { symbol: "di/dt", name: "Peak current rate of change", unit: "A/s" },
      ],
      explanation:
        "IEC 62305 LPL I design parameters. The 99% percentile values size the down-conductor cross-section and the " +
        "shielding bond ratings. The di/dt drives induced voltage in nearby loops — bonded shields and short bonding " +
        "leads are essential.",
      reference: "IEC 62305-1 Annex A",
    },
  ],

  workedExamples: [
    {
      title: "Down-conductor sizing for V236 blade",
      scenario:
        "117 m blade, LPL I (200 kA peak), aluminium down-conductor with thermal limit 250 °C.",
      steps: [
        "Specific energy W/R = 5 × 10⁶ A²·s (LPL I, IEC 62305)",
        "For aluminium k_th = 5.74 × 10⁴ A²·s/mm⁴",
        "Minimum cross-section A = √(W/R) / k_th = √(5e6) / 240 ≈ 9.3 mm²",
        "Practical down-conductor 50 mm² to provide margin and ohmic redundancy",
      ],
      result:
        "50 mm² aluminium down-conductor along the full blade length, bonded at every shear web. This is one of the " +
        "earliest design decisions in blade development — it determines mould tooling.",
    },
  ],

  realWorldCases: [
    {
      title: "Vestas V164 blade-tip burns",
      description:
        "First-generation V164 blades suffered receptor burn-through in 2014–2015 because the receptor seating was bonded " +
        "to a thin GFRP layer that delaminated under repeated strikes. Retrofit involved deeper receptor wells and " +
        "additional copper braid.",
      takeaway:
        "Lightning protection failures are slow-degradation modes — most strikes don't cause immediate damage, but " +
        "cumulative damage shows up after 3–5 years. Inspection regimes must catch this early.",
    },
  ],

  furtherReading: [
    {
      label: "EUCLID — European Lightning Detection Network publications",
      type: "website",
      url: "https://www.euclid.org/science/publications",
    },
    {
      label: "Madsen et al. — Lightning protection of large wind turbine blades",
      type: "paper",
      citation: "Wind Energy 17 (2014), doi:10.1002/we.1576",
    },
  ],

  relatedLessons: ["lesson-010"],
};
