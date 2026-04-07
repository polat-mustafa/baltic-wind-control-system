import type { EducationContent } from "../../../types/education";

export const availabilityHeatmapEducation: EducationContent = {
  id: "p1.availability-heatmap",
  title: "Availability Heatmap (TBA)",
  subtitle: "Time-based availability per turbine, broken out by downtime category",
  discipline: "Operations",

  overview:
    "IEC 61400-26 defines a hierarchy of availability metrics. The heatmap shows time-based availability (TBA) per " +
    "turbine, with cells coloured by the leading downtime category: forced outage, scheduled maintenance, grid loss, " +
    "force majeure, and so on. Operators use it to spot fleet-wide weaknesses (one component model failing across many " +
    "turbines) before they show up in revenue.",

  simpleExplanation:
    "Imagine a school report card with one row per turbine and one column per type of problem. A red cell means that " +
    "turbine had a lot of downtime from that problem this month. Patterns matter: if every turbine has a red 'gearbox' " +
    "column, it is a fleet issue and the manufacturer needs to fix it.",

  technicalExplanation:
    "TBA = (Total time − Downtime) / Total time. IEC 61400-26-1 distinguishes time-based, energy-based (EBA) and " +
    "production-based (PBA) availability. PBA excludes force majeure (lightning, ice, force majeure curtailment), so it " +
    "is what OEM service contracts are scored against. The 9 downtime categories follow the IEC taxonomy: requested " +
    "shutdown, forced outage, scheduled maintenance, suspended, environmental, force majeure, repair, technical standby, " +
    "and out-of-electrical-specification.",

  standards: [
    {
      label: "IEC 61400-26-1 — Availability time-based & operational",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-26-2 — Production-based availability",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "IEC 61400-26-3 — Information categories",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
  ],

  formulas: [
    {
      expression: "TBA = T_up / T_total",
      variables: [
        { symbol: "TBA", name: "Time-based availability", unit: "—" },
        { symbol: "T_up", name: "Hours in operating state", unit: "h" },
        { symbol: "T_total", name: "Total hours in period", unit: "h" },
      ],
      explanation:
        "Conceptually simple but ambiguous in practice — IEC 61400-26-1 defines exactly which states count as 'up' and " +
        "which count as 'down', closing many disputes between operators and OEMs.",
      reference: "IEC 61400-26-1 §4",
    },
    {
      expression: "EBA = E_actual / E_potential",
      variables: [
        { symbol: "EBA", name: "Energy-based availability", unit: "—" },
        { symbol: "E_actual", name: "Energy actually produced", unit: "MWh" },
        { symbol: "E_potential", name: "Energy that could have been produced", unit: "MWh" },
      ],
      explanation:
        "Weights downtime by the energy that would have flowed in those hours. A 4-hour outage at 4 a.m. (low wind) hurts " +
        "EBA much less than a 4-hour outage at 4 p.m. on a stormy day.",
    },
    {
      expression: "PBA = E_actual / (E_potential − E_force_majeure)",
      variables: [
        { symbol: "PBA", name: "Production-based availability", unit: "—" },
        { symbol: "E_force_majeure", name: "Energy lost to events outside the operator's control", unit: "MWh" },
      ],
      explanation:
        "PBA is what OEM availability warranties are written against. Excluding force majeure protects the OEM from " +
        "lightning storms and grid trips that are not their fault.",
      reference: "IEC 61400-26-2 §5",
    },
  ],

  workedExamples: [
    {
      title: "Convert raw downtime to TBA / EBA / PBA",
      scenario:
        "One turbine over 8,760 h: 8,400 h up, 200 h forced outage, 100 h scheduled maintenance, 60 h force majeure (storm). " +
        "E_actual = 70 GWh; E_potential = 73 GWh; force-majeure energy loss = 1.5 GWh.",
      steps: [
        "TBA = 8,400 / 8,760 = 0.9589 → 95.89%",
        "EBA = 70 / 73 = 0.9589 → 95.89%",
        "PBA = 70 / (73 − 1.5) = 70 / 71.5 = 0.9790 → 97.90%",
      ],
      result:
        "TBA and EBA happen to coincide here; PBA is ~2 pp higher because it excludes the force-majeure storm. PBA is " +
        "what the OEM contract pays out against.",
    },
  ],

  realWorldCases: [
    {
      title: "Vestas warranty claims pattern",
      description:
        "Across the Vestas offshore fleet 2018–2022, ~60% of warranty payouts were triggered by gearbox bearing wear " +
        "appearing after year 5. The fleet pattern showed up in availability heatmaps before it became a financial crisis.",
      takeaway:
        "Heatmaps reveal correlated failures earlier than financial reports. Use them as a leading indicator, not a lagging one.",
    },
    {
      title: "Anholt (Denmark) — first 5 years",
      description:
        "Average TBA 96.7% after the first 18-month bedding-in period. Achieved >98% PBA in 2018–2020.",
      takeaway:
        "Mature offshore farms consistently exceed 96% TBA / 98% PBA — a useful benchmark when reviewing availability data.",
    },
  ],

  furtherReading: [
    {
      label: "Pfaffel et al. — Performance and reliability of wind turbines",
      type: "paper",
      citation: "Energies 10 (2017), doi:10.3390/en10111904",
    },
    {
      label: "Tavner — Offshore Wind Turbines: Reliability, Availability, and Maintenance",
      type: "textbook",
      citation: "IET 2012, ISBN 978-1-84919-229-2",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/availability.py",
      description:
        "Synthetic deterministic event generator (rng.lognormvariate); fleet/turbine TBA/EBA/PBA roll-ups; M13 module.",
    },
  ],

  relatedLessons: ["lesson-006"],
};
