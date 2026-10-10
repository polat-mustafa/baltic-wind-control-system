import type { EducationContent } from "../../../types/education";

export const turbineSelectionEducation: EducationContent = {
  id: "library.turbine-selection",
  title: "Turbine Selection — why a 15 MW direct-drive class?",
  subtitle: "SB-510's \"V236 class\" choice and the open IEA-15-240-RWT model every module uses",
  discipline: "Mechanical",

  overview:
    "Selecting the right turbine for an offshore wind farm is not simply a matter of picking the largest machine. " +
    "It involves balancing rated power, rotor diameter, drive-train technology, grid-code pre-qualification status, " +
    "supply-chain availability, and site-specific wind conditions. For the SB-510 (510 MW) project, three 15 MW-class " +
    "machines were evaluated: the Vestas V236-15.0 MW, the Siemens Gamesa SG 14-236 DD, and the GE Haliade-X 13 MW. " +
    "The V236 was selected because it is the only machine with full-scale serial production already underway on the Polish " +
    "Baltic (Baltic Power project, 76 units), being connected under PSE's grid code. Vestas publishes no power " +
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
    "the platform's drivetrain losses and nacelle layout are those of the direct drive; (3) grid code — PSE's type D " +
    "requirements (NC RfG, 2018) ask the plant to ride through a fault down to 0 pu at the connection point for 150 ms " +
    "and to inject fast fault current with K = 2–10 (Art. 16(3)(a), 20(2)(b)). " +
    "All three candidates can meet this in principle; the V236 is the one being connected to the PSE grid " +
    "(Baltic Power), which shortens the compliance-simulation work rather than removing it.",

  standards: [
    {
      label: "IEC 61400-1 — Wind turbines: Design requirements",
      type: "standard",
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
        "the supply chain, installation vessels and PSE grid-code experience of Baltic Power carry over (foundations stay " +
        "site-specific: SB-510's 37–51 m depths point to jackets), and Vestas announced in January 2024 a V236 " +
        "blade factory in Szczecin, Poland, planned to start operating in 2026.",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/turbine_models.py",
      description: "get_turbine() — the IEA-15-240-RWT power and thrust curves every module uses; rosco() — its ROSCO rotor and controller data.",
    },
    {
      file: "frontend/src/constants/turbineModels.ts",
      description: "TURBINE_MODELS — the same reference turbine in the browser: layout yield (lib/layout/energy.ts), project report and the 3D model dimensions.",
    },
  ],

  realWorldCases: [
    {
      title: "Baltic Power (Poland) — 76 × Vestas V236-15.0 MW",
      description:
        "ORLEN (51 %) and Northland Power (49 %). Monopile installation began in early 2025 (78 monopiles); the farm " +
        "delivered Poland's first offshore wind power to the grid on 10 July 2026 with 54 of 76 turbines installed, " +
        "and commercial operation was expected in the second half of 2026.",
      takeaway:
        "A project with the same turbine class further east along the same coast (off Łeba) de-risks the selection — " +
        "vessels, port logistics and the PSE compliance route are proven; foundation and load calculations still " +
        "have to be redone for this site.",
      source: "Northland Power press release, 10 Jul 2026; Notes from Poland, 6 Feb 2025",
    },
    {
      title: "Bałtyk 2 & 3 (Poland) — 1.44 GW, 100 × SG 14-236 DD",
      description:
        "Equinor and Polenergia took the final investment decision in May 2025 for 100 Siemens Gamesa SG 14-236 DD " +
        "turbines of 14.4 MW; monopiles go in during 2026 and first power is planned for 2027. The SG 14-236 DD is a " +
        "competing 15 MW-class machine with a different drive-train philosophy " +
        "(no gearbox).",
      takeaway:
        "Both machines are viable for Polish Baltic conditions. The V236 class was chosen here because Baltic " +
        "Power provides an immediately transferable reference; the open model the platform computes with is itself " +
        "a direct drive, like the SG 14-236 DD.",
      source: "offshorewind.biz, 20 May 2025 (FID) and 16 Feb 2024 (turbine choice)",
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
    },
  ],

};
