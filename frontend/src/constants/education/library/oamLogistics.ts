import type { EducationContent } from "../../../types/education";

export const oamLogisticsEducation: EducationContent = {
  id: "library.oam-logistics",
  title: "O&M Logistics & Spare Parts",
  subtitle: "The mundane infrastructure behind 96% availability",
  discipline: "Operations",

  overview:
    "Achieving > 96% availability on a fleet of 34 turbines 30 km offshore depends less on cleverness and more on " +
    "logistics: a base port that can mobilise vessels in 12 h, a spare-part inventory matched to the failure modes, a " +
    "well-trained 24/7 control room and a documented escalation tree. The cost of getting any of these wrong is measured " +
    "in tens of millions of euros over the project life, far more than most engineering decisions about the turbine " +
    "itself. This is why mature operators move continuously toward predictive maintenance, fleet-wide spare-part pooling " +
    "and cluster-shared vessel charters.",

  simpleExplanation:
    "Imagine running a fleet of 34 cars 30 km offshore where every breakdown costs you €50,000 a day in lost revenue and " +
    "the only way to reach them is by boat in calm weather. To do that well you need (a) a garage on the coast, (b) a " +
    "stock of every spare part you might need, (c) people who can drive boats and fix cars, and (d) a system to decide " +
    "what to fix first. That last bit — prioritisation — is where the best operators win.",

  technicalExplanation:
    "Inventory strategy follows a classic ABC analysis: A-class items (high cost, long lead-time, e.g. blade, gearbox, " +
    "main bearing) held on consignment from the OEM at the base port; B-class (medium, e.g. yaw motor, pitch cylinder) " +
    "stocked locally with reorder triggers; C-class (consumables) JIT. Vessel strategy: at minimum 1 dedicated CTV per " +
    "30 turbines, plus access to a shared SOV for major lifts. Failure-mode-based maintenance: condition monitoring " +
    "(vibration, oil debris, temperature, SCADA-based ML) drives a P-F (potential to functional failure) curve that " +
    "schedules intervention before a hard failure. KPIs tracked daily: mean time to repair (MTTR), spare-part fill rate, " +
    "vessel utilisation, alarm-to-resolution time, and IEC 61400-26 PBA per turbine.",

  standards: [
    {
      label: "IEC 61400-26-1 — Time-based availability for wind turbines",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "ISO 13374 — Condition monitoring and diagnostics of machines",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Condition_monitoring",
    },
    {
      label: "ISO 55000 — Asset management",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/Asset_management_(ISO_55000)",
    },
    {
      label: "G+ Good Practice Guidelines — offshore wind safety publications",
      type: "standard",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
  ],

  formulas: [
    {
      expression: "A_inherent = MTBF / (MTBF + MTTR)",
      variables: [
        { symbol: "A_inherent", name: "Inherent availability", unit: "—" },
        { symbol: "MTBF", name: "Mean time between failures", unit: "h" },
        { symbol: "MTTR", name: "Mean time to repair", unit: "h" },
      ],
      explanation:
        "Idealised availability ignoring weather and logistics. Operational availability is always lower because vessels " +
        "must wait for weather windows and parts must travel from the manufacturer.",
    },
    {
      expression: "Service_Level = P(stock ≥ demand_lead_time)",
      variables: [
        { symbol: "Service_Level", name: "Probability that a part is in stock when needed", unit: "—" },
        { symbol: "demand_lead_time", name: "Failures during the resupply lead time", unit: "—" },
      ],
      explanation:
        "Standard inventory theory. For A-class items operators target 95–99% service level; below that the vessel " +
        "waits for the part, multiplying repair downtime by an order of magnitude.",
    },
  ],

  workedExamples: [
    {
      title: "Pitch cylinder spare-stock sizing for Baltic Wind",
      scenario:
        "34 turbines × 3 cylinders each = 102 cylinders in service. Failure rate 0.05/cylinder/yr → ~5 fails/yr. Vendor " +
        "lead time 12 weeks.",
      steps: [
        "Demand during lead time = 5 × 12/52 ≈ 1.15 cylinders",
        "Poisson 95% service level → stock ≥ 3 cylinders",
        "Stock cost = 3 × 90,000 EUR = 270,000 EUR (one-off)",
        "Avoided downtime (vs JIT): 12 weeks × ~5 fails × 200,000 EUR/wk × 0.4 prob = ~480,000 EUR/yr",
      ],
      result:
        "Holding 3 spare cylinders pays for itself in the first half-year by removing all weather-vessel-waiting downtime " +
        "for this failure mode. This is the canonical inventory-vs-downtime trade-off — and the canonical reason why " +
        "fleet-wide spare-part pooling is so valuable.",
    },
  ],

  realWorldCases: [
    {
      title: "Ørsted East Coast cluster — vessel and parts pooling",
      description:
        "Ørsted operates a single base port (Grimsby) serving Hornsea 1 + 2 + Race Bank + Westermost Rough — combined " +
        "~3 GW. Spare parts and CTV charters are pooled across the cluster, saving an estimated 10–15% on opex.",
      takeaway:
        "Cluster economies are real and growing. A first-of-cluster project pays the full cost; later neighbours benefit " +
        "from shared infrastructure.",
    },
    {
      title: "Vestas cluster MultiBrand — shared service for non-Vestas farms",
      description:
        "Vestas Group offers MultiBrand service contracts for farms running competing OEMs. The economic logic is the " +
        "same as the cluster: spread fixed cost (people, port, vessel) over more turbines.",
      takeaway:
        "OEM service models are commoditising. Operators with critical mass increasingly contract for parts only, " +
        "self-providing the labour and vessels at lower cost.",
    },
  ],

  furtherReading: [
    {
      label: "TNO — Offshore wind O&M research and reports",
      type: "website",
      url: "https://www.tno.nl/en/sustainable/smart-energy-system/offshore-wind/",
    },
    {
      label: "Tavner — Offshore Wind Turbines: Reliability, Availability and Maintenance",
      type: "textbook",
      citation: "IET 2012, ISBN 978-1-84919-229-2",
    },
  ],

  relatedLessons: ["lesson-006"],
};
