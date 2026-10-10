import type { EducationContent } from "../../../types/education";

export const availabilityWaterfallEducation: EducationContent = {
  id: "p1.availability-waterfall",
  title: "Downtime Breakdown",
  subtitle: "Where the lost hours go — by category",
  discipline: "Operations",

  overview:
    "The breakdown ranks downtime hours by cause. Controllable categories (scheduled and unscheduled maintenance) are " +
    "the operator's and OEM's lever; external ones (grid curtailment, force majeure) are not. The share that is " +
    "controllable tells you whether better O&M can still raise availability.",

  simpleExplanation:
    "Start with every hour of the year and take away each reason a turbine wasn't working. The longest bar is the " +
    "first thing to fix — if it's something you control.",

  technicalExplanation:
    "Hours alone do not equal energy: an hour of downtime at 13 m/s costs a full 15 MWh, at 5 m/s only ~1.4 MWh. " +
    "That is why EBA/PBA and the energy-loss column matter for revenue, while hours matter for logistics. Reliability " +
    "parameters drive the unscheduled bar: MTBF (operating hours between faults) and MTTR (hours to restore), the " +
    "latter dominated offshore by waiting for a weather window.",

  standards: [
    {
      label: "IEC 61400-26-1 — Availability for wind energy generation systems",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "MTBF = T_operating / N_faults,    MTTR = T_repair / N_faults",
      variables: [
        { symbol: "N_faults", name: "Unscheduled stops in the period", unit: "—" },
      ],
      explanation: "Unscheduled unavailability ≈ MTTR / (MTBF + MTTR).",
    },
    {
      expression: "Lost energy ≈ Σ_events P(v_event) · duration",
      variables: [
        { symbol: "P(v)", name: "Power the turbine would have produced", unit: "MW" },
      ],
      explanation: "Energy-weighting is what turns a time breakdown into a revenue breakdown.",
    },
  ],

  workedExamples: [
    {
      title: "Unscheduled downtime from MTBF and MTTR",
      scenario: "MTBF 1,400 h, MTTR 30 h (incl. weather wait).",
      steps: [
        "Unavailability ≈ 30 / (1,400 + 30) = 2.1 %",
        "Halving MTTR to 15 h (SOV on station instead of CTV from port): 15 / 1,415 = 1.1 %",
      ],
      result: "Getting technicians to the turbine faster is worth about one point of availability here.",
    },
  ],

  realWorldCases: [
    {
      title: "German North Sea, 2023: downtime the operator does not control",
      description:
        "TenneT reported that German North Sea offshore wind produced 19.2 TWh in 2023 against 21.1 TWh in 2022, about 9 % less, because the onshore grid could not carry the power and the turbines were curtailed in redispatch.",
      takeaway: "Grid curtailment is external downtime: it costs energy and revenue but is not the operator's failure — which is why IEC 61400-26 keeps it apart from controllable downtime.",
      source: "TenneT via Clean Energy Wire (2024)",
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
      description: "get_downtime_breakdown() — hours, energy loss and controllable share per category.",
    },
  ],

};
