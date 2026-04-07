import type { EducationContent } from "../../../types/education";

export const foundationDesignEducation: EducationContent = {
  id: "library.foundation-design",
  title: "Foundation Design (Mono / Jacket / Floating)",
  subtitle: "How to anchor 15 MW to the seabed for 25 years",
  discipline: "Civil",

  overview:
    "The foundation is typically 25–40% of CAPEX for a fixed-bottom offshore farm. Selection depends primarily on water " +
    "depth and seabed conditions: monopiles dominate up to ~50 m, jackets take over to ~70 m, and beyond that floating " +
    "platforms (semi-submersible, spar, TLP) become the only option. The Polish Baltic at 25–40 m water depth is squarely " +
    "in monopile territory, but with 15 MW turbines the diameters now reach 11 m and the masses 2,000 t — outside the " +
    "envelope of installation vessels built for the 6 MW generation.",

  simpleExplanation:
    "Imagine planting a giant fence post in mud so a 280 m tall machine can sit on it without falling over for 25 years. " +
    "If the water is shallow, you use one giant post (a monopile). If it is deeper, you use four legs joined like an oil " +
    "rig (a jacket). If it is really deep, you build a floating platform held by chains and anchors (a floater). The " +
    "decision is mostly about water depth and the cost of installation vessels.",

  technicalExplanation:
    "Monopile design uses the p–y curve method (API RP 2A WSD) — a beam on non-linear elastic foundation, with lateral " +
    "soil resistance varying with depth. The diameter is sized for stiffness (1st natural frequency must avoid the 1P/3P " +
    "rotor harmonic crossover) rather than ultimate strength. Jacket design is governed by joint fatigue (DNV-OS-J101). " +
    "Floating design uses a dynamic-coupled aero-hydro-servo simulation (OpenFAST) to capture pitch motions that re-couple " +
    "into the rotor loads. Mooring lines are typically catenary chain in shallow-to-medium depth, taut polyester at deep.",

  standards: [
    {
      label: "IEC 61400-3-1 — Offshore wind turbine design",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "DNV-ST-0126 — Support structures for wind turbines",
      type: "standard",
    },
    {
      label: "DNV-ST-0119 — Floating wind turbine structures",
      type: "standard",
    },
    {
      label: "Byrne et al. (2020) — PISA monopile design model (open access)",
      type: "paper",
      url: "https://doi.org/10.1680/jgeot.18.PISA.005",
    },
  ],

  formulas: [
    {
      expression: "f_n ≈ (1/2π) · √(k_eff / m_eff)",
      variables: [
        { symbol: "f_n", name: "First fore-aft natural frequency", unit: "Hz" },
        { symbol: "k_eff", name: "Effective stiffness (tower + foundation + soil)", unit: "N/m" },
        { symbol: "m_eff", name: "Effective modal mass (RNA + ~25% tower)", unit: "kg" },
      ],
      explanation:
        "The frequency must lie in the 'soft-stiff' band — between the 1P (rotor speed) and 3P (blade-passing) excitation, " +
        "typically 0.22–0.31 Hz for a 15 MW turbine. Soft-soft (below 1P) is fatigue-dangerous; stiff-stiff (above 3P) is " +
        "prohibitively expensive in mass.",
      reference: "DNV-ST-0126 §6",
    },
    {
      expression: "p(y) = A · p_u · tanh((k·H/A·p_u)·y)",
      variables: [
        { symbol: "p(y)", name: "Soil reaction at lateral displacement y", unit: "N/m" },
        { symbol: "p_u", name: "Ultimate soil resistance per unit length", unit: "N/m" },
        { symbol: "k", name: "Initial subgrade modulus", unit: "N/m³" },
        { symbol: "A", name: "Loading factor (0.9 cyclic, 3 − 0.8 H/D static)", unit: "—" },
      ],
      explanation:
        "API p–y curve for sand (Reese & O'Neill). The integral of these curves over the embedded length gives the " +
        "monopile lateral capacity. Modern practice supplements with PISA design rules (Byrne et al.) which add " +
        "distributed moment springs and drastically reduce required embedment for stiff sands.",
    },
  ],

  workedExamples: [
    {
      title: "Indicative monopile sizing for V236 in 35 m water",
      scenario:
        "V236-15.0 MW, 35 m water depth, dense sand. Target f_n = 0.27 Hz.",
      steps: [
        "RNA mass ≈ 850 t, tower mass ≈ 1,200 t (30% modal contribution → 360 t)",
        "m_eff ≈ 1,210 t = 1.21 × 10⁶ kg",
        "Required k_eff = (2π · 0.27)² · 1.21e6 = 3.48e6 N/m",
        "Practical monopile diameter to deliver this k_eff: ~10.5 m, wall ≈ 110 mm at mudline",
        "Embedment depth ≈ 32 m (≈ 5 × D for stability)",
        "Total monopile mass ≈ 2,100 t",
      ],
      result:
        "10.5 m diameter, 67 m total length, ~2,100 t. This pushes installation onto only the largest jack-ups (Voltaire, " +
        "Wind Orca) and requires noise mitigation (bubble curtain) for marine mammal compliance.",
    },
  ],

  realWorldCases: [
    {
      title: "Hywind Tampen (Norway) — first floating commercial",
      description:
        "11 × 8.6 MW spar-buoy floaters supplying power to oil platforms. Average water depth 260–300 m. CAPEX still " +
        "~3× fixed-bottom but trending down with serial production.",
      takeaway:
        "Floating wind opens up sites previously economically unreachable (Mediterranean, Pacific). The bottleneck is " +
        "harbour and quayside capacity, not turbine technology.",
    },
    {
      title: "WTIV bottleneck",
      description:
        "Voltaire and Wind Orca were the only vessels capable of installing 15 MW monopiles in 2024. Slot prices on " +
        "these vessels exceeded €350,000/day, forcing several projects to slip schedules into 2026+.",
      takeaway:
        "Vessel availability is the hidden critical-path resource of every offshore project. Lock in installation slots " +
        "before the foundation tender closes.",
    },
  ],

  furtherReading: [
    {
      label: "Byrne et al. — PISA design model for monopile foundations",
      type: "paper",
      citation: "Géotechnique 70 (2020), doi:10.1680/jgeot.18.PISA.005",
    },
    {
      label: "NREL — Floating offshore wind: Cost reduction pathways",
      type: "website",
      url: "https://www.nrel.gov/docs/fy22osti/82820.pdf",
    },
  ],

  relatedLessons: ["lesson-004", "lesson-007"],
};
