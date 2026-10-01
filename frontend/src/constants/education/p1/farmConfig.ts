import type { EducationContent } from "../../../types/education";

export const farmConfigEducation: EducationContent = {
  id: "p1.farm-config",
  title: "Design Alternatives (M04)",
  subtitle: "What each input of the comparison does physically",
  discipline: "Civil",

  overview:
    "The comparison runs each design through the same chain: PyWake wakes on a square grid at the chosen spacing, the " +
    "multiplicative loss cascade, export-cable sizing and losses, then LCOE and IRR. Change one input at a time to see " +
    "its effect. Spacing trades wake loss against seabed and cable; export length trades cable cost, losses and " +
    "charging current against a windier, farther site; CAPEX and WACC dominate cost.",

  simpleExplanation:
    "Turbines need elbow room: too close and the front ones take the wind from the back ones; too far and you pay for " +
    "more cable and seabed. A longer export cable lets you go where it is windier, but costs more and loses more. The " +
    "table lets you try these trade-offs side by side.",

  technicalExplanation:
    "Wake loss falls with spacing because the deficit decays roughly as 1/(1 + 2k·x/D)² (Jensen) or with the growing " +
    "Gaussian width (Bastankhah–Porté-Agel); offshore k is small, so recovery is slow. Spacing is usually larger along " +
    "the prevailing wind direction than across it. Turbines other than 15 MW are modelled as the V236 scaled at " +
    "constant specific power (343 W/m²): same rated wind speed, rotor area ∝ rating, so wake loss depends only on " +
    "spacing in rotor diameters. Export circuits are 1000 mm² Cu XLPE (≈ 950 A each); the number of circuits follows " +
    "the current at rated power, and cable charging Q = ωCU²L grows with length.",

  standards: [
    {
      label: "IEC 61400-15 (series) — Energy yield assessment",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 60287 — Current rating of electric cables",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_60287",
    },
  ],

  formulas: [
    {
      expression: "Area ≈ N · (s_x · D) · (s_y · D)",
      variables: [
        { symbol: "N", name: "Number of turbines", unit: "—" },
        { symbol: "s_x, s_y", name: "Spacing along / across the wind in rotor diameters", unit: "—" },
        { symbol: "D", name: "Rotor diameter (236 m)", unit: "m" },
      ],
      explanation: "Rough farm footprint; 34 × V236 at 7 D × 7 D ≈ 34 × 1.65 km × 1.65 km ≈ 93 km² of cells.",
    },
    {
      expression: "Q_charging = ω · C · U² · L · n_circuits",
      variables: [
        { symbol: "C", name: "Cable capacitance (190 nF/km)", unit: "F/km" },
        { symbol: "U", name: "Line voltage", unit: "V" },
        { symbol: "L", name: "Cable length", unit: "km" },
      ],
      explanation: "Capacitive reactive power of the export cable — compensated by shunt reactors (see P2).",
    },
  ],

  workedExamples: [
    {
      title: "Export cable charging for the base case",
      scenario: "Two 220 kV circuits, 45 km, C = 190 nF/km, 50 Hz.",
      steps: [
        "ω = 2π × 50 = 314.2 rad/s",
        "Per circuit: 314.2 × 190·10⁻⁹ × (220·10³)² × 45 = 130 MVAr",
        "Two circuits: 260 MVAr",
      ],
      result:
        "260 MVAr of capacitive reactive power — half of the farm's MW rating — which is why HVAC export beyond " +
        "~80–100 km needs mid-point compensation or HVDC.",
    },
  ],

  realWorldCases: [
    {
      title: "Horns Rev 1 (Denmark) — 7 D square grid",
      description:
        "80 turbines on a regular grid with 7 D spacing in both directions; one of the first large offshore arrays and " +
        "a long-standing wake-model validation case.",
      takeaway: "Regular grids are simple to build and analyse, but they line turbines up exactly for some directions.",
    },
  ],

  furtherReading: [
    {
      label: "PyWake — wind farm wake modelling (DTU)",
      type: "website",
      url: "https://topfarm.pages.windenergy.dtu.dk/PyWake/",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/farm_comparison.py",
      description: "M04 comparison: PyWake wake loss on a grid at the chosen spacing, loss cascade, export sizing, LCOE.",
    },
  ],

  relatedLessons: ["lesson-005", "lesson-006"],
};
