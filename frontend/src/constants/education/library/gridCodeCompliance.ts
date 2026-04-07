import type { EducationContent } from "../../../types/education";

export const gridCodeComplianceEducation: EducationContent = {
  id: "library.grid-code-compliance",
  title: "Grid Code Compliance & FRT",
  subtitle: "How a wind farm proves it's a good citizen of the power system",
  discipline: "Electrical",

  overview:
    "Grid codes are the rulebooks that every generator connected to the transmission system must follow. They specify " +
    "fault-ride-through capability, frequency response, voltage support, harmonic injection limits, protection " +
    "coordination, communication, and dozens of other behaviours. For offshore wind in Poland, the binding documents " +
    "are PSE IRiESP (national operating manual) and ENTSO-E NC RfG (Type D, > 75 MW connection at HV). A failed " +
    "compliance test blocks commissioning until remediated — a multi-million-euro per week revenue hit.",

  simpleExplanation:
    "Connecting a 510 MW wind farm to the national grid is a bit like joining a busy motorway in a heavy lorry. There " +
    "are rules: you must stay in your lane, you must indicate, you must brake when the car in front does, you must not " +
    "block the slow lane. Grid codes are those rules for power plants. Wind farms have to ride through faults, help " +
    "support voltage, slow down when frequency rises and speed up when it falls. The grid operator tests every new farm " +
    "before it is allowed to feed power.",

  technicalExplanation:
    "Compliance is demonstrated through a combination of factory tests (single turbine), site tests (whole farm under " +
    "the PPC) and ongoing performance monitoring (PMU streams). FRT capability is proven by intentional voltage dips " +
    "applied via on-site dip generators (down to 0% retained voltage for 250 ms) — the farm must remain connected and " +
    "supply reactive current proportional to the dip depth. Frequency response is tested by injecting setpoint changes " +
    "and verifying the 5% droop is honoured within ENTSO-E NC RfG timing windows. Harmonic compliance is the most " +
    "intricate test — IEC 61400-21 defines turbine-level emissions, but the farm-level compliance depends on the " +
    "interaction with the grid impedance at the POC.",

  standards: [
    {
      label: "ENTSO-E NC RfG — Requirements for generators (EU Regulation 2016/631)",
      type: "regulation",
      url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0631",
    },
    {
      label: "PSE IRiESP — Polish transmission grid operating manual",
      type: "regulation",
      url: "https://www.pse.pl/en/transmission-system-operator/regulatory-framework/iriesp",
    },
    {
      label: "IEC 61400-21 — Power quality measurements for wind turbines",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "VDE-AR-N 4131 — Technical conditions for offshore VSC-HVDC",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "I_q,inj / I_n = k · ΔU/U_n,    k ≥ 2",
      variables: [
        { symbol: "I_q,inj", name: "Reactive current injection during dip", unit: "A" },
        { symbol: "ΔU", name: "Voltage drop below the dead band", unit: "V" },
        { symbol: "k", name: "Reactive support gain (≥ 2 per ENTSO-E)", unit: "—" },
      ],
      explanation:
        "ENTSO-E NC RfG requires a turbine (or PPC) to respond to a voltage dip with proportional reactive current — at " +
        "least 2× the per-unit voltage drop. A 0.5 pu dip → 1.0 pu reactive current within 30 ms.",
      reference: "ENTSO-E NC RfG Annex II",
    },
    {
      expression: "Δf_droop = (f − f_0) / f_0 · (1 / s_droop)",
      variables: [
        { symbol: "Δf_droop", name: "Active power change command", unit: "pu" },
        { symbol: "s_droop", name: "Frequency droop slope (5% typical)", unit: "—" },
      ],
      explanation:
        "FCR-N droop relationship. PSE IRiESP requires Type D generators to respond within 30 s to a frequency excursion " +
        "outside the ±200 mHz dead band, contributing primary frequency control proportional to the droop setting.",
    },
  ],

  workedExamples: [
    {
      title: "FRT response sizing for Baltic Wind PPC",
      scenario:
        "510 MW farm, voltage dip to 0.3 pu retained voltage at the 220 kV POC for 200 ms.",
      steps: [
        "ΔU/U_n = 1.0 − 0.3 = 0.7 pu",
        "Required reactive current contribution = 2 × 0.7 = 1.4 pu (clamped at 1.0 pu by inverter limit)",
        "Total reactive current = 1.0 × I_n = √2 · S_n / √3 / U_n = √2 · 510e6 / √3 / 220e3 ≈ 1,890 A",
        "Active current during dip = √(I_max² − I_q²) = √(I_n² − I_n²) = 0 → all current diverted to reactive",
      ],
      result:
        "Farm acts as an effective dynamic var source for 200 ms, then resumes active power output within 100 ms after " +
        "voltage recovery. The PPC arbitrates between turbines and the STATCOM to deliver the response on the timescale " +
        "the grid code demands.",
    },
  ],

  realWorldCases: [
    {
      title: "Spanish 2019 grid code update — retroactive FRT retrofit",
      description:
        "Following several wind-related instability events Spain mandated FRT capability across the existing fleet, " +
        "forcing a multi-year retrofit campaign worth several hundred million euros. The lesson: grid codes evolve.",
      takeaway:
        "Design new offshore farms with headroom in the inverter VA rating for future grid code requirements (grid-" +
        "forming, harmonic damping, sub-synchronous oscillation suppression). Headroom is much cheaper to build in than " +
        "retrofit.",
    },
    {
      title: "Hornsea 1 trip and 2019 GB blackout",
      description:
        "Hornsea 1 disconnected during a lightning-initiated transient on 9 August 2019, contributing to a national " +
        "blackout that left 1 million GB customers without power. National Grid traced the trip to a too-conservative " +
        "voltage protection setting on the OSS.",
      takeaway:
        "Protection settings are part of grid-code compliance, not a separate engineering activity. Co-ordinate them " +
        "with the TSO, not just the OEM.",
    },
  ],

  furtherReading: [
    {
      label: "EirGrid Grid Code — example NC RfG national implementation",
      type: "regulation",
      url: "https://www.eirgrid.ie/grid-management/connecting-to-the-grid/grid-code",
    },
    {
      label: "CIGRE TB 766 — Network requirements for power electronic generators",
      type: "standard",
      url: "https://www.e-cigre.org/",
    },
  ],

  relatedLessons: ["lesson-011"],
};
