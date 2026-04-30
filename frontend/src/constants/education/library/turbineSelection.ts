import type { EducationContent } from "../../../types/education";

export const turbineSelectionEducation: EducationContent = {
  id: "library.turbine-selection",
  title: "Turbine Selection — Why the V236-15.0 MW?",
  subtitle: "Comparing 15 MW offshore turbine candidates for the Polish Baltic",
  discipline: "Mechanical",

  overview:
    "Selecting the right turbine for an offshore wind farm is not simply a matter of picking the largest machine. " +
    "It involves balancing rated power, rotor diameter, drive-train technology, grid-code pre-qualification status, " +
    "supply-chain availability, and site-specific wind conditions. For the Baltic Wind 510 MW project, three 15 MW-class " +
    "machines were evaluated: the Vestas V236-15.0 MW, the Siemens Gamesa SG 14-236 DD, and the GE Haliade-X 13 MW. " +
    "The V236 was selected because it is the only machine with full-scale serial production already underway on the Polish " +
    "Baltic (Baltic Power project, 76 units) and carries PSE grid-code pre-qualification.",

  simpleExplanation:
    "Think of turbine selection like choosing a car for a specific road. The V236 is already being built and operated " +
    "in the same sea conditions, by the same grid operator. Choosing it means we can copy proven lessons directly — " +
    "foundation designs, installation vessel compatibility, spare-parts logistics, and maintenance procedures. " +
    "A new or unproven machine, however powerful, would add risk and delay to the project.",

  technicalExplanation:
    "The three key technical filters applied were: (1) capacity factor at Baltic mean wind speed 9.0–9.5 m/s — the V236 " +
    "reaches rated power at 11.1 m/s, giving ~45% CF, while the SG 14-236 DD reaches rated at 11 m/s (slightly higher CF " +
    "but lower absolute rated power at 14 MW nominal); (2) nacelle mass — the V236 uses a medium-speed gearbox + PMSG " +
    "reducing nacelle mass vs. a full direct-drive machine at equivalent rating; (3) grid code — PSE IRiESP Type D " +
    "pre-qualification requires LVRT to 15% Un for 140 ms + reactive current injection ≥2%/% voltage drop. " +
    "All three candidates can meet this in principle, but the V236 has completed PSE pre-qualification process " +
    "specifically for the Polish grid as demonstrated by the Baltic Power project.",

  standards: [
    {
      label: "IEC 61400-1 — Wind turbines: Design requirements",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-3-1 — Design requirements for offshore wind turbines",
      type: "standard",
    },
    {
      label: "IEC 61400-12-1 — Power performance measurements (power curve certification)",
      type: "standard",
    },
    {
      label: "PSE IRiESP — Instrukcja Ruchu i Eksploatacji Sieci Przesyłowej (Polish grid code)",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "CF = AEP / (P_rated × 8760 h)",
      variables: [
        { symbol: "CF", name: "Capacity factor", unit: "—" },
        { symbol: "AEP", name: "Annual energy production", unit: "GWh/yr" },
        { symbol: "P_rated", name: "Rated power", unit: "MW" },
        { symbol: "8760", name: "Hours per year", unit: "h" },
      ],
      explanation:
        "Capacity factor is the ratio of actual annual energy to maximum possible energy at full rated power. " +
        "For Baltic Sea sites with mean wind speed 9.0–9.5 m/s at hub height, offshore turbines typically achieve CF = 42–50%.",
    },
    {
      expression: "P_Betz = (16/27) × 0.5 × ρ × A × v³",
      variables: [
        { symbol: "P_Betz", name: "Betz limit power (theoretical max)", unit: "W" },
        { symbol: "ρ", name: "Air density", unit: "kg/m³" },
        { symbol: "A", name: "Rotor swept area = π(D/2)²", unit: "m²" },
        { symbol: "v", name: "Wind speed", unit: "m/s" },
      ],
      explanation:
        "The Betz limit (59.3%) is the theoretical maximum fraction of wind kinetic energy extractable by a rotor. " +
        "Modern turbines achieve Cp ≈ 0.45–0.50 at design tip-speed ratio — very close to the Betz limit.",
    },
  ],

  workedExamples: [
    {
      title: "Capacity factor comparison at 9.2 m/s mean wind",
      scenario:
        "Baltic mean wind speed at 150 m hub height ≈ 9.2 m/s (Weibull k = 2.1, ERA5). " +
        "Compare V236-15.0 vs SG 14-236 DD vs Haliade-X 13 MW.",
      steps: [
        "V236: rated at 11.1 m/s, cut-in 3 m/s, cut-out 31 m/s → AEP ≈ 2,140 GWh for 34 units → CF ≈ 45%",
        "SG 14-236 DD: rated at ~11 m/s, 14 MW → slightly higher CF per turbine but 36.4 units needed for same capacity",
        "Haliade-X: rated at ~13 m/s, 13 MW → lower CF in Baltic (optimised for North Sea ~10 m/s)",
        "V236 wins on: serial production in Poland, supply chain certainty, PSE pre-qualification",
      ],
      result:
        "V236-15.0 MW is selected. At 34 turbines it exactly fills the 510 MW PSE connection agreement slot, " +
        "it uses the same foundation geometry as Baltic Power (copying structural designs), and Vestas has a " +
        "European manufacturing footprint (blades in Szczecin, Poland from 2026).",
    },
  ],

  realWorldCases: [
    {
      title: "Baltic Power (Poland) — 1.2 GW, 76 × V236-15.0 MW",
      description:
        "Operated by ORLEN + Northland Power. All 78 foundations installed by late 2025; turbine installation " +
        "ongoing 2025–2026. First commercial power expected Q2 2026. This project provides direct cost benchmarks, " +
        "installation vessel availability, and grid-code compliance data for Baltic Wind.",
      takeaway:
        "Having a reference project with the same turbine model 60 km to the west substantially de-risks the " +
        "turbine selection — foundation loads, cable schedules, and grid-code submissions are directly transferable.",
    },
    {
      title: "Bałtyk 2 & 3 (Poland) — ~1.4 GW, SG 14-236 DD",
      description:
        "Equinor + Polenergia projects using the competing direct-drive machine. Offshore construction started " +
        "January 2026. The SG 14-236 DD is technically equivalent but uses a different drive-train philosophy " +
        "(no gearbox) and was not yet PSE pre-qualified when Baltic Power made its turbine selection.",
      takeaway:
        "Both machines are viable for Polish Baltic conditions. V236 was selected here specifically because " +
        "Baltic Power's ongoing project provides an immediately transferable reference data set.",
    },
  ],

  furtherReading: [
    {
      label: "Vestas V236-15.0 MW product page",
      type: "website",
      url: "https://www.vestas.com/en/products/offshore/V236-15MW",
    },
    {
      label: "ORLEN Baltic Power project milestones",
      type: "website",
      url: "https://balticpower.pl/en/",
    },
    {
      label: "IEC 61400-12-1: Power performance measurements — standard overview",
      type: "website",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
  ],

  relatedLessons: ["lesson-001", "lesson-002"],
};
