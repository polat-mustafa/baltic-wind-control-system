import type { EducationContent } from "../../../types/education";

export const andesDynamicsEducation: EducationContent = {
  id: "p2.andes-dynamics",
  title: "RMS Simulation with Generic Wind Plant Models",
  subtitle: "ANDES and the WECC REGCA1 / REECA1 / REPCA1 models against PSE requirements",
  discipline: "Electrical",

  overview:
    "Grid-code compliance of a power park module is demonstrated by simulation before connection and confirmed by " +
    "tests on site. The simulations are RMS (positive-sequence, phasor) for frequency and voltage events of seconds " +
    "to minutes, and EMT (instantaneous waveforms) for fast converter and switching phenomena. This tab runs an RMS " +
    "model of the whole 510 MW plant in ANDES, an open-source tool, with the vendor-neutral WECC second-generation " +
    "generic models.",

  simpleExplanation:
    "Three blocks describe the plant. REGCA1 is the converter: it pushes the current it is told to. REECA1 is the " +
    "turbine control: in a voltage dip it gives reactive current priority to hold the grid up. REPCA1 is the plant " +
    "controller at the connection point: it trims the output when the frequency rises above 50.2 Hz. A synchronous " +
    "area with inertia and governors stands in for the rest of the grid, so the frequency can actually move.",

  technicalExplanation:
    "Which tools are used in practice? For a real connection PSE receives a validated, vendor-specific model, " +
    "typically for DIgSILENT PowerFactory or Siemens PSS/E (RMS), and for EMT studies PSCAD or EMTP. ANDES is not " +
    "an industry-mandated tool; it is a peer-reviewed open-source research tool (Cui, Li, Tomsovic, IEEE Trans. " +
    "Power Systems 2021) that implements the same public WECC generic models used in PSS/E and PowerFactory. That " +
    "is why it fits an educational platform: every parameter is visible and the results can be checked by hand. " +
    "Here the steady-state LFSM-O response from REPCA1 agrees with the 5 % droop formula within a fraction of a MW, " +
    "and the reactive-current injection reaches the converter limit in about 60 ms, as PSE requires. The faster " +
    "phasor models in the Grid and PPC tabs remain for interactive what-ifs; this model cross-checks them. " +
    "Limits of this model: one aggregated generator (no turbine-to-turbine interaction), no STATCOM dynamics, a " +
    "synthetic area equivalent, and no EMT effects (harmonics, sub-synchronous control interaction) — those need " +
    "an EMT tool and vendor models.",

  standards: [
    { label: "Commission Regulation (EU) 2016/631 (NC RfG) — LFSM-O, fault ride-through, fast fault current", type: "regulation" },
    { label: "PSE requirements of general application under NC RfG (2018) — type D values", type: "standard" },
    { label: "WECC Second Generation Wind Turbine Models (REMTF, 2014) — REGC_A, REEC_A, REPC_A", type: "standard" },
  ],

  formulas: [
    {
      expression: "ΔP = −(Pmax / s) · (f − 50.2) / 50",
      variables: [
        { symbol: "s", name: "Droop (PSE: 5 %)", unit: "—" },
        { symbol: "f", name: "Frequency above the 50.2 Hz threshold", unit: "Hz" },
      ],
      explanation: "LFSM-O: the static characteristic REPCA1 settles on.",
    },
    {
      expression: "Iq = Kqv · (1 − V − 0.1)",
      variables: [
        { symbol: "Kqv", name: "Reactive current gain (PSE range 2–10)", unit: "p.u./p.u." },
        { symbol: "V", name: "Terminal voltage", unit: "p.u." },
      ],
      explanation: "Extra reactive current below the 0.9 p.u. deadband, up to the 1.1 p.u. converter limit.",
    },
  ],

  workedExamples: [
    {
      title: "Checking LFSM-O by hand",
      scenario: "Frequency settles at 50.33 Hz, plant at 510 MW, droop 5 %.",
      steps: [
        "Excess above the threshold: 50.33 − 50.2 = 0.13 Hz",
        "ΔP = −510 / 0.05 · 0.13 / 50 ≈ −27 MW",
        "ANDES with REPCA1 settles 27.2 MW lower",
      ],
      result: "The generic plant model and the grid-code formula agree; the transient dip below it is the plant-controller dynamics.",
    },
  ],

  realWorldCases: [
    {
      title: "GB power cut, 9 August 2019",
      description:
        "A lightning fault was cleared in under 0.1 s, yet Hornsea One deloaded from 799 MW to 62 MW, Little Barford lost 244 MW and loss-of-mains protection tripped hundreds of MW of embedded generation. Frequency fell below 48.8 Hz and about 5 % of demand — over a million customers — was disconnected by low-frequency demand disconnection.",
      takeaway: "Dynamic simulations of the whole plant — controllers, protection and their interaction with the grid — are what grid-code compliance is checked against; Ørsted's own studies had shown the controller problem at full output before the event.",
      source: "Ofgem, 9 August 2019 power outage report (January 2020)",
    },
  ],

  furtherReading: [
    {
      label: "H. Cui, F. Li, K. Tomsovic, Hybrid symbolic-numeric framework for power system modeling and analysis",
      type: "paper",
      citation: "IEEE Trans. Power Systems 36(2) (2021) 1373–1384",
    },
    {
      label: "E. Muljadi et al., Equivalencing the collector system of a large wind power plant",
      type: "paper",
      citation: "IEEE PES General Meeting 2006",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/andes_dynamics.py", description: "ANDES case, area equivalent, events, PSE checks." },
  ],
};
