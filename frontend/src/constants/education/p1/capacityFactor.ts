import type { EducationContent } from "../../../types/education";

export const capacityFactorEducation: EducationContent = {
  id: "p1.capacity-factor",
  title: "Capacity Factor",
  subtitle: "How much of the nameplate rating actually comes out as energy",
  discipline: "Civil",

  overview:
    "Capacity factor (CF) is the energy produced in a year divided by what the farm would produce running at full " +
    "nameplate power for all 8,760 hours. It depends on the site's wind, on the turbine's specific power (rated power " +
    "per rotor area) and on all the losses. Modern offshore farms with large rotors commonly reach 40–50 %+.",

  simpleExplanation:
    "A 15 MW turbine running flat out for a whole year would make 15 × 8,760 = 131,400 MWh. Real turbines don't: " +
    "sometimes the wind is weak, sometimes it is too strong, sometimes they are being serviced. Capacity factor is the " +
    "share of that maximum you actually get. 46.5 % is the same energy as running at full power for 4,073 hours.",

  technicalExplanation:
    "CF = AEP_net / (P_rated · 8,760 h). A big rotor on a modest generator (low specific power) reaches rated power at " +
    "a lower wind speed and stays there longer, which raises CF. The V236-15.0 MW has 15,000 kW / 43,744 m² = 343 W/m²; " +
    "earlier offshore machines were around 400 W/m² (e.g. 3.6 MW on a 107 m rotor: 3,600 / 8,992 = 400 W/m²). Always " +
    "state which AEP the CF refers to (gross, net P50, P90) — they differ by 10–25 %.",

  standards: [
    {
      label: "IEC 61400-12-1 — Power performance measurements",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
  ],

  formulas: [
    {
      expression: "CF = AEP_net / (P_rated · 8760)",
      variables: [
        { symbol: "AEP_net", name: "Net annual energy production", unit: "MWh/yr" },
        { symbol: "P_rated", name: "Installed (nameplate) capacity", unit: "MW" },
      ],
      explanation: "Full-load hours = CF × 8,760 h — the same number expressed as hours.",
    },
    {
      expression: "Specific power = P_rated / (π D² / 4)",
      variables: [
        { symbol: "D", name: "Rotor diameter", unit: "m" },
      ],
      explanation:
        "Lower specific power → higher CF at a given site, but more rotor (and more loads) per MW. A design trade-off, " +
        "not a free lunch.",
    },
  ],

  workedExamples: [
    {
      title: "This platform (34 × V236, P50 from the AEP tab)",
      scenario: "Installed 510 MW, gross AEP 2,426 GWh/yr, net P50 2,077 GWh/yr.",
      steps: [
        "Maximum = 510 MW × 8,760 h = 4,467,600 MWh = 4,468 GWh",
        "Gross CF = 2,426 / 4,468 = 54.3 %",
        "Net CF (P50) = 2,077 / 4,468 = 46.5 %  → 4,073 full-load hours",
      ],
      result:
        "The 8-point gap between gross and net CF is the whole loss cascade. A P90-based CF would be another 8.8 % " +
        "lower (≈ 42.4 %).",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "IRENA — Renewable Power Generation Costs (latest edition)",
      type: "website",
      url: "https://www.irena.org/Publications",
    },
    {
      label: "Burton, Jenkins, Sharpe, Bossanyi — Wind Energy Handbook",
      type: "textbook",
      citation: "Wiley, 2nd ed. 2011",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/aep_calculator.py",
      description: "compute_aep_cascade() — capacity_factor = net AEP / (P_rated × 8760 × n_turbines).",
    },
  ],

};
