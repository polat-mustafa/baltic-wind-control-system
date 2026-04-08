import type { EducationContent } from "../../../types/education";

export const cableCrossSectionEducation: EducationContent = {
  id: "library.cable-cross-section",
  title: "Cable Cross-Section & Graded Design",
  subtitle: "Why strings near the OSS need fatter cables than strings at the edge",
  discipline: "Electrical",

  overview:
    "Offshore array cables are not all the same size. The cables closest to the offshore substation (OSS) carry " +
    "the cumulative power of every turbine on the string — up to 6 × 15 MW = 90 MW — and therefore need the largest " +
    "conductor cross-section to stay within their thermal rating. Turbines at the far end of a string carry only " +
    "their own 15 MW, so a much smaller cable is adequate. This 'graded' or 'tapered' cable design saves 15–25% on " +
    "array cable CAPEX compared to using the largest size throughout, which is significant on a project with 60+ km " +
    "of inter-turbine cables.",

  simpleExplanation:
    "Picture a river with tributaries. The stream near the source carries a trickle — you only need a narrow pipe. " +
    "But where all tributaries join near the mouth, you need a wide river. Cable strings work the same way: near " +
    "each turbine at the far end, only one turbine's power flows, so a small cable is enough. Near the OSS, all six " +
    "turbines' power flows through the same cable — that one must be much larger. Using large cables everywhere " +
    "wastes money on the sections that only carry a little power.",

  technicalExplanation:
    "Current rating of submarine cables is governed by IEC 60287 (current rating calculations for power cables). " +
    "The thermal model balances Joule heating (I²R) against heat dissipation through insulation, armour, " +
    "and seabed sediment. Each cross-section has a rated continuous current I_rated. For a 66 kV string with " +
    "turbines each contributing 15 MW / (√3 × 66 kV × 0.95 pf) ≈ 138 A per turbine: " +
    "position 1 (far end): 1 × 138 A → 500 mm² Cu is adequate (rated ~715 A); " +
    "position 2: 2 × 138 = 276 A → 500 mm² still adequate; " +
    "position 3–4: 3–4 × 138 = 414–552 A → 630 mm² Cu (rated ~818 A); " +
    "position 5–6: 5–6 × 138 = 690–828 A → 800 mm² Cu (rated ~900 A). " +
    "The cable manufacturer specifies IEC 60287-compliant current ratings including burial depth correction, " +
    "soil thermal resistivity, and wave loading corrections for J-tube sections. " +
    "Copper is used (not aluminium) because offshore splice joints require welding — copper joints are more " +
    "reliable in seawater, and the smaller cross-section offsets the higher material cost.",

  standards: [
    {
      label: "IEC 60287 — Electric cables: Calculation of the current rating",
      type: "standard",
    },
    {
      label: "IEC 60840 — Power cables with extruded insulation 30–150 kV",
      type: "standard",
    },
    {
      label: "IEC 62067 — Power cables with extruded insulation above 150 kV",
      type: "standard",
    },
    {
      label: "CIGRE TB 490 — Offshore submarine cable system design",
      type: "standard",
      url: "https://www.e-cigre.org/",
    },
  ],

  formulas: [
    {
      expression: "I_string(n) = n × P_turbine / (√3 × V_LL × cos φ)",
      variables: [
        { symbol: "I_string(n)", name: "Current at position n from far end", unit: "A" },
        { symbol: "n", name: "Number of turbines beyond this cable section", unit: "—" },
        { symbol: "P_turbine", name: "Individual turbine rated power (15 MW)", unit: "W" },
        { symbol: "V_LL", name: "Array voltage (66 kV)", unit: "V" },
        { symbol: "cos φ", name: "Power factor (~0.95 for WTG with reactive control)", unit: "—" },
      ],
      explanation:
        "At n = 1: I = 1 × 15e6 / (√3 × 66e3 × 0.95) ≈ 138 A. " +
        "At n = 6: I = 6 × 138 = 828 A → requires 800 mm² Cu (rated 900 A with 15% headroom).",
    },
    {
      expression: "I_rated(IEC 60287) = √[(Δθ − Wd·T_insul) / (R·(T_total))]",
      variables: [
        { symbol: "Δθ", name: "Allowed conductor temperature rise (max 90°C − ambient)", unit: "K" },
        { symbol: "Wd", name: "Dielectric loss per unit length", unit: "W/m" },
        { symbol: "T_insul", name: "Thermal resistance of insulation", unit: "K·m/W" },
        { symbol: "R", name: "AC conductor resistance at max temp", unit: "Ω/m" },
        { symbol: "T_total", name: "Total thermal resistance (insulation + sheath + burial)", unit: "K·m/W" },
      ],
      explanation:
        "IEC 60287 calculates the steady-state current that maintains conductor temperature at or below 90°C " +
        "for XLPE-insulated cables. The burial correction factor is critical — seabed thermal resistivity varies " +
        "from 0.7 K·m/W (wet sand) to 2.0 K·m/W (dry clay), significantly affecting the rating.",
      reference: "IEC 60287-1-1 §1.4",
    },
  ],

  workedExamples: [
    {
      title: "Cross-section selection for a 6-turbine 66 kV string",
      scenario:
        "Six 15 MW turbines on one feeder string. String length: turbine spacing 8D = 1,888 m → ~11 km total. " +
        "Burial depth 1.5 m, seabed thermal resistivity 1.0 K·m/W, sea temperature 8°C.",
      steps: [
        "Turbine current per unit: I_T = 15e6 / (√3 × 66e3 × 0.95) ≈ 138 A",
        "Position 1 (far end, 1 turbine): I = 138 A → 500 mm² Cu adequate (I_rated = 715 A)",
        "Position 2 (2 turbines): I = 276 A → 500 mm² adequate",
        "Position 3 (3 turbines): I = 414 A → 500 mm² adequate (715 A rating ≫ 414 A)",
        "Position 4 (4 turbines): I = 552 A → 630 mm² Cu selected (I_rated = 818 A, 48% headroom)",
        "Position 5 (5 turbines): I = 690 A → 800 mm² Cu selected (I_rated = 900 A, 30% headroom)",
        "Position 6 = cable to OSS (6 turbines): I = 828 A → 800 mm² Cu (9% headroom — within N-1 design)",
        "Cable cost: (2×3km × 500mm²) + (1×2km × 630mm²) + (2×2km × 800mm²) = optimised bill of materials",
      ],
      result:
        "Graded design: 6 km of 500 mm², 2 km of 630 mm², 4 km of 800 mm² per string. " +
        "Uniform design: 12 km of 800 mm² per string. " +
        "Cost saving: ~€3M per string × 5 strings = ~€15M for the whole farm (15–25% of array cable CAPEX). " +
        "Note: these are illustrative estimates; actual savings depend on manufacturer pricing.",
    },
  ],

  realWorldCases: [
    {
      title: "Dogger Bank (UK) — graded 66 kV array cables",
      description:
        "The 3.6 GW Dogger Bank project uses graded 66 kV submarine cables with cross-sections from 185 mm² " +
        "(far-end turbines) to 800 mm² (near-OSS). The graded design was a key CAPEX optimisation in a project " +
        "where array cable length exceeds 200 km.",
      takeaway:
        "Graded cable design is now standard practice for any 66 kV offshore array. The IEC 60287 methodology " +
        "is used universally — the only project-specific inputs are burial depth, soil properties, and local sea temperature.",
    },
  ],

  furtherReading: [
    {
      label: "IEC 60287 — Current ratings for power cables (overview)",
      type: "website",
      url: "https://en.wikipedia.org/wiki/IEC_60287",
    },
    {
      label: "ABB — XLPE Submarine Cable Systems, Application Guide",
      type: "website",
      url: "https://library.e.abb.com/public/ab02245fb5b8ec3dc1257c4b002b3456/XLPE%20Submarine%20Cable%20Systems%202GM5007%20rev%205.pdf",
    },
    {
      label: "CIGRE TB 490 — 60+ page guide to submarine cable system design",
      type: "website",
      url: "https://www.e-cigre.org/",
    },
  ],

  relatedLessons: ["lesson-009"],
};
