import type { EducationContent } from "../../../types/education";

export const turbineSelectionEducation: EducationContent = {
  id: "library.turbine-selection",
  title: "Turbine Selection — Why the V236-15.0 MW?",
  subtitle: "Comparing 15 MW offshore turbine candidates for the Polish Baltic",
  discipline: "Mechanical",

  overview:
    "Selecting the right turbine for an offshore wind farm is not simply a matter of picking the largest machine. " +
    "It involves balancing rated power, rotor diameter, drive-train technology, grid-code pre-qualification status, " +
    "supply-chain availability, and site-specific wind conditions. For the SB-510 (510 MW) project, three 15 MW-class " +
    "machines were evaluated: the Vestas V236-15.0 MW, the Siemens Gamesa SG 14-236 DD, and the GE Haliade-X 13 MW. " +
    "The V236 was selected because it is the only machine with full-scale serial production already underway on the Polish " +
    "Baltic (Baltic Power project, 76 units) and carries PSE grid-code pre-qualification. Vestas publishes no power " +
    "curve, controller or drivetrain data for the V236, so OffshoreForge models every SB-510 turbine as a " +
    "'V236-class' machine with the open IEA 15 MW reference turbine (Gaertner et al. 2020): 241.35 m rotor, rated " +
    "10.66 m/s, low-speed direct drive. Every number in the platform comes from that published model.",

  simpleExplanation:
    "Think of turbine selection like choosing a car for a specific road. The V236 is already being built and operated " +
    "in the same sea conditions, by the same grid operator. Choosing it means we can copy proven lessons directly — " +
    "foundation designs, installation vessel compatibility, spare-parts logistics, and maintenance procedures. " +
    "A new or unproven machine, however powerful, would add risk and delay to the project.",

  technicalExplanation:
    "The three key technical filters applied were: (1) energy yield at the site — with the modelled turbine (IEA 15 MW, " +
    "specific power 328 W/m², rated at 10.66 m/s) the SB-510 wind climate (NEWA 150 m: Weibull A 10.80 m/s, k 2.04) gives " +
    "a gross capacity factor of 57 % before wake and other losses; (2) drivetrain — the real V236 uses a medium-speed " +
    "gearbox + PMSG, while the open model is a low-speed direct drive (no gearbox, 200-pole PMSG, 369 t generator), so " +
    "the platform's drivetrain losses and nacelle layout are those of the direct drive; (3) grid code — PSE IRiESP Type D " +
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
        "Gross CF (before wake, electrical, availability and other losses) of the IEA 15 MW at the SB-510 site is 57 %; " +
        "the P1 loss cascade turns it into the net value on the AEP tab.",
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
        "The IEA 15 MW rotor reaches Cp,aero = 0.462 in operation (0.469 peak of the ROSCO table at λ = 9) — about 78 % of Betz.",
    },
  ],

  workedExamples: [
    {
      title: "Gross capacity factor of the modelled turbine at the SB-510 site",
      scenario:
        "SB-510 wind climate at 150 m hub height (NEWA, averaged over the 34 positions): Weibull A = 10.80 m/s, " +
        "k = 2.04 → mean 9.57 m/s. Turbine: IEA 15 MW official power table (3 / 10.66 / 25 m/s).",
      steps: [
        "f(v) = (k/A)(v/A)^(k−1)·exp(−(v/A)^k)",
        "Gross AEP = 8760 h × ∫ P(v) f(v) dv = 75.2 GWh per turbine",
        "34 turbines: 2,557 GWh/yr gross → gross CF = 75.2 GWh / (15 MW × 8760 h) = 57 %",
        "Wake, blockage, electrical, availability and other losses (P1 loss cascade) reduce it to the net value",
      ],
      result:
        "The V236-class turbine is selected. At 34 turbines it exactly fills the 510 MW PSE connection agreement slot, " +
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
        "installation vessel availability, and grid-code compliance data for SB-510.",
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

};
