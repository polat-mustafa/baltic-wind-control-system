import type { EducationContent } from "../../../types/education";

export const cableInstallationEducation: EducationContent = {
  id: "library.cable-installation",
  title: "Cable Installation & Routing",
  subtitle: "How a 220 kV export cable gets from a factory in Karlskrona to a Baltic seabed",
  discipline: "Marine",

  overview:
    "Cable failures account for ~80% of insurance claims on offshore wind farms — far more than any other component. " +
    "Almost all failures occur during installation: snags during pull-in, tension overload at the j-tube, kinks during " +
    "carousel turn-out, or insufficient burial depth that exposes the cable to anchor strikes. The installation contract " +
    "is the second-most-scrutinised document in the project (after the turbine TSA), and the route survey is its critical " +
    "input.",

  simpleExplanation:
    "Picture trying to lay a 200-tonne garden hose 200 km long across the bottom of the sea, in a curved corridor that " +
    "avoids shipwrecks, fishing lanes, gas pipelines and protected reefs. Now imagine that if you bend the hose too tight " +
    "or pull on it too hard, it will fail in three years and cost €60 M to replace. That's offshore cable installation.",

  technicalExplanation:
    "Cable lay vessels carry the cable on a rotating carousel and pay it out through tensioners and a stern overboarding " +
    "chute. Tension is monitored continuously and must stay below the cable's MBR-tension envelope. After lay, a separate " +
    "trenching campaign (jet plough, mechanical cutter, or controlled-flow excavator) buries the cable to 1–3 m depth " +
    "depending on seabed type and threat assessment. End-of-cable is pulled into the J-tube of the foundation, terminated " +
    "in the substation switchgear and tested by VLF/AC withstand and partial discharge.",

  standards: [
    {
      label: "DNV-ST-0359 — Subsea power cables for wind power plants",
      type: "standard",
    },
    {
      label: "DNV-RP-F401 — Electrical power cables in subsea applications",
      type: "standard",
    },
    {
      label: "IEC 60287 — Calculation of cable current rating",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_60287",
    },
    {
      label: "CIGRE TB 815 — Recommendations for testing HVAC submarine cables",
      type: "standard",
      url: "https://www.e-cigre.org/",
    },
  ],

  formulas: [
    {
      expression: "T_dyn ≤ T_max · 1/SF,    R_actual ≥ MBR",
      variables: [
        { symbol: "T_dyn", name: "Dynamic tension during lay", unit: "kN" },
        { symbol: "T_max", name: "Cable manufacturer's max permissible", unit: "kN" },
        { symbol: "SF", name: "Safety factor (1.5 typical)", unit: "—" },
        { symbol: "MBR", name: "Minimum bend radius (~25 × OD)", unit: "m" },
      ],
      explanation:
        "Two non-negotiable constraints checked in real time during cable lay. Exceeding either is grounds for re-pull and " +
        "factory test, often weeks of delay.",
    },
    {
      expression: "I_max = √((θ_c − θ_amb) / (Σ R_i · Σ T_i))",
      variables: [
        { symbol: "I_max", name: "Continuous current rating", unit: "A" },
        { symbol: "θ_c", name: "Conductor temperature limit (90 °C XLPE)", unit: "°C" },
        { symbol: "θ_amb", name: "Ambient seabed temperature", unit: "°C" },
        { symbol: "R_i", name: "AC resistance per layer", unit: "Ω/m" },
        { symbol: "T_i", name: "Thermal resistance per layer", unit: "K·m/W" },
      ],
      explanation:
        "IEC 60287-1-1 thermal model. Burial depth and seabed thermal conductivity dominate; in coarse sand the cable can " +
        "carry 10–15% more current than in fine silt for the same conductor cross-section.",
      reference: "IEC 60287-1-1",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 220 kV export cable burial spec",
      scenario:
        "1 × 1,200 mm² Cu 220 kV three-core, 45 km route, soft clay seabed (depth-of-burial 1.5 m).",
      steps: [
        "Threat assessment: anchor drag from 80,000 DWT bulk carriers → required burial depth 2.0 m (DoBI 1.4)",
        "Trenching method: 800 m³/h jet trencher (e.g. Royal IHC T1500), production rate ≈ 250 m/h in soft clay",
        "Trenching duration: 45,000 / 250 ≈ 180 h ≈ 8 days continuous (weather permitting)",
        "Total install duration including pre-lay survey + lay + termination ≈ 28 days",
      ],
      result:
        "≈ 28 days vessel time at ~€280,000/day → €7.8 M install cost on top of cable supply (~€60 M). The export cable " +
        "alone is ~€68 M — about 4% of total CAPEX for the 510 MW farm.",
    },
  ],

  realWorldCases: [
    {
      title: "Race Bank cable insurance loss",
      description:
        "Two array cables required complete replacement after a single trenching campaign exceeded MBR limits at sharp " +
        "bends. Insurance loss > £20 M; project commissioning slipped 5 months.",
      takeaway:
        "Continuous tension and bend radius monitoring during install is non-negotiable. Modern projects use real-time " +
        "telemetry from the trencher and stop work on exceedances.",
    },
    {
      title: "BorWin1 (Germany) — early HVDC subsea cable failure",
      description:
        "ABB's first commercial offshore HVDC link failed in 2014 due to sheath corrosion. Restoration took 6 months and " +
        "cost €100s M in lost generation revenue.",
      takeaway:
        "First-of-a-kind cable technology carries reliability risk. Insist on vessel and cable references with proven " +
        "operational history.",
    },
  ],

  furtherReading: [
    {
      label: "CIGRE TB 610 — Offshore generation cable connections",
      type: "standard",
      url: "https://www.e-cigre.org/",
    },
    {
      label: "Worzyk — Submarine Power Cables: Design, Installation, Repair (Springer 2009)",
      type: "textbook",
    },
  ],

  relatedLessons: ["lesson-009"],
};
