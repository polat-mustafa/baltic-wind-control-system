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
    "share of that maximum you actually get. 48.4 % — this farm's P50 — is the same energy as running at full power for about 4,240 hours.",

  technicalExplanation:
    "CF = AEP_net / (P_rated · 8,760 h). A big rotor on a modest generator (low specific power) reaches rated power at " +
    "a lower wind speed and stays there longer, which raises CF. The SB-510 turbine (IEA 15 MW) has 15,000 kW / 45,750 m² = 328 W/m²; " +
    "earlier offshore machines were around 400 W/m² (e.g. 3.6 MW on a 107 m rotor: 3,600 / 8,992 = 400 W/m²). Always " +
    "state which AEP the CF refers to (gross, net P50, P90) — they differ by 10–25 %.",

  standards: [
    {
      label: "IEC 61400-12-1 — Power performance measurements",
      type: "standard",
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
      title: "This platform (34 × IEA 15 MW, P50 from the AEP tab)",
      scenario: "Installed 510 MW, gross AEP 2,557 GWh/yr, net P50 2,161 GWh/yr, P90 1,948 GWh/yr.",
      steps: [
        "Maximum = 510 MW × 8,760 h = 4,467,600 MWh = 4,468 GWh",
        "Gross CF = 2,557 / 4,468 = 57.2 %",
        "Net CF (P50) = 2,161 / 4,468 = 48.4 %  → 4,237 full-load hours",
      ],
      result:
        "The 8.8-point gap between gross and net CF is the whole loss cascade. A P90-based CF is another 9.9 % " +
        "lower (1,948 / 4,468 ≈ 43.6 %).",
    },
  ],

  realWorldCases: [
    {
      title: "UK offshore fleet, 2023",
      description:
        "The average load factor of UK offshore wind was 39.7 % in 2023, lower than in 2022 because it was a less windy year.",
      takeaway: "A single year's capacity factor moves with the weather; compare farms and designs on long-term values.",
      source: "IEA Wind TCP, UK country report 2023",
    },
    {
      title: "Ørsted portfolio expectation, 2019",
      description:
        "Ørsted lowered the expected lifetime load factor of a defined European offshore portfolio from 48–50 % to about 48 % after better modelling of wake and blockage losses.",
      takeaway: "Modern offshore farms are planned around a 40–50 % capacity factor — and a one-point change is worth a revision of the business case.",
      source: "Ørsted company announcement, 29 Oct 2019",
    },
  ],

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
