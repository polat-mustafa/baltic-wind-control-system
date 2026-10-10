import type { EducationContent } from "../../../types/education";

export const availabilityHeatmapEducation: EducationContent = {
  id: "p1.availability-heatmap",
  title: "Availability per Turbine (TBA)",
  subtitle: "Time-based availability across the fleet",
  discipline: "Operations",

  overview:
    "The heatmap shows each turbine's time-based availability (TBA) for the year against the 97 % target. Fleet-wide " +
    "patterns — many turbines dipping at once — point to a common cause (a component series, a logistics problem), " +
    "while a single red cell points to one machine. The fleet average is what the AEP cascade's availability loss " +
    "should be based on.",

  simpleExplanation:
    "One cell per turbine. Green: available nearly all year. Red: down too often. If lots of cells are red together, " +
    "the problem is shared — a design fault, a missing spare part or a boat that can't get out.",

  technicalExplanation:
    "IEC 61400-26-1 defines time categories (operating, available but not operating, unavailable — scheduled, " +
    "unscheduled, external…) on which availability is computed. Which categories count against the turbine is set by " +
    "the contract. This platform reports a technical TBA that excludes external causes (force majeure, grid " +
    "curtailment) from both numerator and denominator, so the turbine is not penalised for them; energy-based (EBA) " +
    "and production-based (PBA) availability weight the lost time by the energy that could have been produced.",

  standards: [
    {
      label: "IEC 61400-26-1 — Availability for wind energy generation systems",
      type: "standard",
    },
    {
      label: "IEC TS 61400-26-3 — Availability for wind power stations",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "TBA = T_producing / (T_total − T_FM − T_curtailment)",
      variables: [
        { symbol: "T_producing", name: "Hours available (not in maintenance or fault)", unit: "h" },
        { symbol: "T_FM", name: "Force-majeure hours (excluded)", unit: "h" },
        { symbol: "T_curtailment", name: "Grid-curtailment hours (excluded)", unit: "h" },
      ],
      explanation: "Technical, contract-style TBA: external causes neither count as up nor as down.",
    },
    {
      expression: "EBA = E_actual / E_potential",
      variables: [
        { symbol: "E_potential", name: "Energy that could have been produced", unit: "MWh" },
      ],
      explanation:
        "Weights each lost hour by its wind: a 4-hour stop in a calm night costs far less than one in a gale.",
    },
  ],

  workedExamples: [
    {
      title: "One turbine, one year",
      scenario: "8,760 h; scheduled 60 h, unscheduled 50 h, force majeure 25 h, grid curtailment 100 h.",
      steps: [
        "T_producing = 8,760 − 60 − 50 − 25 − 100 = 8,525 h",
        "Denominator = 8,760 − 25 − 100 = 8,635 h",
        "TBA = 8,525 / 8,635 = 98.7 %",
        "Without the exclusions: 8,525 / 8,760 = 97.3 %",
      ],
      result:
        "The definition alone moves availability by 1.4 points — why contracts spell out the time categories exactly.",
    },
  ],

  realWorldCases: [
    {
      title: "Horns Rev 1 (Denmark, 2003–2004): a fleet-wide pattern",
      description:
        "Transformer failures began in August 2003 and many generators turned out to have production defects. In 2004 Vestas took all 80 V80 nacelles of the farm ashore for repair and upgrading.",
      takeaway: "When many turbines dip at the same time, look for a common cause — a component series — not 80 separate faults.",
      source: "Vestas / Elsam (2004); IEEE Spectrum, \"Danish wind turbines take unfortunate turn\"",
    },
  ],

  furtherReading: [
    {
      label: "Tavner — Offshore Wind Turbines: Reliability, Availability and Maintenance",
      type: "textbook",
      citation: "IET 2012",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/availability.py",
      description: "Synthetic downtime events per turbine; TBA / EBA / PBA, MTBF / MTTR; fleet roll-up (M13).",
    },
  ],

};
