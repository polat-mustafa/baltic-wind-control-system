import type { EducationContent } from "../../../types/education";

export const oamCostEducation: EducationContent = {
  id: "p1.oam-cost",
  title: "Maintenance & Logistics Cost",
  subtitle: "What it costs to keep an offshore farm running",
  discipline: "Operations",

  overview:
    "Operations and maintenance is a large share of offshore LCOE — commonly cited around a quarter to a third. Total " +
    "OPEX is typically quoted as 70–120 €/kW per year, but it bundles very different items: vessels and technicians, " +
    "spare parts, the OEM service agreement, port and onshore base, insurance, seabed lease and grid charges. This panel " +
    "models the maintenance & marine logistics part bottom-up and shows it as a share of that range.",

  simpleExplanation:
    "Keeping turbines at sea running is mostly about boats, people and parts. Some costs you pay whatever happens (a " +
    "service vessel on contract, insurance); others come with each fault (a call-out, a replacement part, a jack-up " +
    "vessel for a big component).",

  technicalExplanation:
    "Bottom-up: planned visits (CTV, scheduled in good weather), unplanned call-outs (mobilisation premium, waiting " +
    "time, parts), a seasonal SOV charter, heavy-lift campaigns with a jack-up vessel for major components, and " +
    "insurance as a share of CAPEX. Unplanned work costs more than planned because it cannot wait for the best " +
    "weather and needs emergency mobilisation. Not modelled here: OEM service fees, permanent staff and base, seabed " +
    "lease, transmission charges — the reason the result sits below a total-OPEX benchmark.",

  standards: [
    {
      label: "IEA Wind TCP Task 26 — Cost of wind energy",
      type: "standard",
      url: "https://iea-wind.org/task26/",
    },
    {
      label: "G+ Global Offshore Wind health & safety good practice",
      type: "standard",
      url: "https://www.gplusoffshorewind.com/resources/publications/",
    },
  ],

  formulas: [
    {
      expression: "C_event = mobilisation + day-rate · days + crew · rate · days + parts",
      variables: [
        { symbol: "C_event", name: "Cost of one maintenance visit", unit: "€" },
      ],
      explanation: "Per-visit cost; multiplied by visits per turbine per year and the number of turbines.",
    },
    {
      expression: "OPEX_specific = OPEX_annual / P_installed",
      variables: [{ symbol: "OPEX_specific", name: "Specific OPEX", unit: "€/kW·yr" }],
      explanation: "The usual benchmarking figure; always say which cost items it includes.",
    },
  ],

  workedExamples: [
    {
      title: "Unplanned CTV call-out (this model's inputs)",
      scenario: "CTV mobilisation 5 k€ (×2 emergency premium), day rate 4 k€, 3 days, 10 technicians at 800 €/day, parts 8 k€.",
      steps: [
        "Mobilisation = 2 × 5,000 = 10,000 €",
        "Vessel = 3 × 4,000 = 12,000 €",
        "Crew = 10 × 800 = 8,000 €",
        "Parts = 8,000 €  → 38,000 € per event",
        "6 events × 34 turbines = 204 events → 7.75 M€/yr",
      ],
      result:
        "Unplanned maintenance is the largest bottom-up item — the lever is reliability (fewer faults) and an SOV on " +
        "station (no mobilisation, shorter waits).",
    },
  ],

  realWorldCases: [
    {
      title: "How large O&M is in LCOE",
      description:
        "A SINTEF review of O&M models found published estimates of the OPEX share of offshore wind LCOE between 12 % and 32 %, typically about 25 %, counting direct O&M costs only.",
      takeaway: "A quarter of the cost of every MWh is operations — a cheaper vessel strategy or better access weather can matter as much as a cheaper turbine.",
      source: "Welte et al., SINTEF Energy Research, O&M modelling (2017)",
    },
  ],

  furtherReading: [
    {
      label: "IRENA — Renewable Power Generation Costs (latest edition)",
      type: "website",
      url: "https://www.irena.org/Publications",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/weather_window.py",
      description: "get_oam_cost_breakdown() — bottom-up maintenance & logistics cost (M14).",
    },
  ],

};
