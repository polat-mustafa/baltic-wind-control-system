import type { EducationContent } from "../../../types/education";

export const gridFormingEducation: EducationContent = {
  id: "p2.grid-forming",
  title: "Grid-Following vs Grid-Forming Converters",
  subtitle: "Who sets the voltage: the grid or the converter?",
  discipline: "Control",

  overview:
    "Wind turbine converters today are mostly grid-following (GFL): a phase-locked loop (PLL) measures the grid " +
    "voltage angle and the converter injects current in step with it. That needs a stiff grid to lock onto. " +
    "Grid-forming (GFM) converters instead behave like a voltage source with a virtual rotor: they set their own " +
    "voltage angle and respond to grid changes instantly, like a synchronous machine. As synchronous generation " +
    "retires, TSOs are starting to ask for GFM capability.",

  simpleExplanation:
    "A grid-following converter dances to the grid's beat — if the beat gets faint (weak grid) it can lose step. A " +
    "grid-forming converter keeps its own beat and pushes back when the grid changes, which steadies everyone else.",

  technicalExplanation:
    "The tab simulates the aggregate 510 MW converter behind the farm + grid impedance after a sudden grid phase jump " +
    "(50 µs steps). GFL: 5 ms current loop, 10 Hz PLL (ζ = 0.707), including the jωL·i term that couples the PLL " +
    "frequency into the measured voltage. A PLL equilibrium exists only while x·i_d < E; the weaker the grid the " +
    "closer the operating angle is to 90° and the smaller the jump that makes it slip a pole. GFM: virtual synchronous " +
    "machine, H = 4 s, D = 80 p.u., behind 0.15 p.u. filter reactance, current limited to 1.2 p.u. A phase jump Δθ " +
    "instantly changes its power by ≈ K_s·Δθ (synchronising power) — inertial response. In a stiff grid K_s is large, " +
    "so the current can hit the limit: GFM's weakness is the strong grid, GFL's the weak one. Note the grid strength " +
    "at the turbines: the transformers and 45 km cable add ≈ 0.25 p.u., so SCR 19.6 at the POC is only ≈ 3.3 at the " +
    "66 kV busbar. Not modelled: DC link, outer voltage loops, inner-loop/LCL dynamics, controller interaction.",

  standards: [
    { label: "CIGRE TB 671 (2016) — Connection of wind farms to weak AC networks", type: "standard" },
    {
      label: "NGESO Grid Code modification GC0137 — Minimum specification for GB grid forming capability (2022)",
      type: "regulation",
      citation: "National Grid ESO, GB Grid Code, implemented 2022",
    },
  ],

  formulas: [
    {
      expression: "GFL: v_q = −E sin(θ − θ_g) + X·i_d·(1 + Δω/ω₀),   Δω = K_p·v_q + ∫K_i·v_q",
      variables: [
        { symbol: "θ", name: "PLL angle", unit: "rad" },
        { symbol: "θ_g", name: "Grid voltage angle", unit: "rad" },
        { symbol: "X", name: "Grid + farm reactance on 510 MVA", unit: "p.u." },
      ],
      explanation: "Equilibrium needs sin(θ − θ_g) = X·i_d / E < 1 — the weak-grid limit of a current source.",
      reference: "Wang et al., IEEE Open J. Ind. Appl. 1 (2020) 115–134",
    },
    {
      expression: "GFM: 2H · dΔω/dt = P_ref − P_e − D·Δω,   dδ/dt = ω₀·Δω",
      variables: [
        { symbol: "H", name: "Virtual inertia constant", unit: "s" },
        { symbol: "D", name: "Damping", unit: "p.u." },
      ],
      explanation: "Swing equation of a virtual synchronous machine.",
      reference: "Rosso et al., IEEE Open J. Ind. Appl. 2 (2021) 93–109",
    },
    {
      expression: "SCR = S_sc / P_n",
      variables: [{ symbol: "S_sc", name: "Short-circuit power at the point considered", unit: "MVA" }],
      explanation: "Below ≈ 3 a grid is called weak, below ≈ 2 very weak (CIGRE TB 671).",
    },
  ],

  workedExamples: [
    {
      title: "20° phase jump, strong grid (10 GVA)",
      scenario: "SCR 19.6 at the POC, 3.3 at the 66 kV busbar; farm at 510 MW.",
      steps: [
        "GFL: active power moves by only ≈ 10 MW; the PLL frequency estimate spikes by ≈ 5 Hz for a few ms",
        "GFM: synchronising power swing ≈ 390 MW, peak current ≈ 1.10 p.u., settles in ≈ 0.6 s",
        "At 40° the GFM current reaches its 1.2 p.u. limit",
      ],
      result:
        "GFM gives the grid an inertial response a GFL unit cannot; GFL rides a strong grid more gently. Try the very " +
        "weak grid with 40°: the GFL PLL slips a pole, the GFM unit stays in step.",
    },
  ],

  realWorldCases: [
    {
      title: "GB power disruption, 9 August 2019 — Hornsea One",
      description:
        "After a lightning-induced transmission fault, the Hornsea One offshore wind farm's voltage control reacted " +
        "with insufficiently damped oscillations and the farm de-loaded by 737 MW, contributing to a frequency drop " +
        "that triggered demand disconnection. Ørsted changed the control settings afterwards.",
      takeaway: "Converter control stability depends on grid strength at the plant — weak-grid tuning is a safety issue.",
      source: "National Grid ESO, Technical Report on the events of 9 August 2019 (September 2019)",
    },
  ],

  furtherReading: [
    {
      label: "Rosso, Wang, Liserre, Lu, Engelken — Grid-forming converters: control approaches, grid-synchronization, and future trends",
      type: "paper",
      citation: "IEEE Open Journal of Industry Applications 2 (2021) 93–109",
    },
    {
      label: "Wang, Taul, Wu, Liao, Blaabjerg, Huang — Grid-synchronization stability of converter-based resources: an overview",
      type: "paper",
      citation: "IEEE Open Journal of Industry Applications 1 (2020) 115–134",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/converter_comparison.py", description: "SMIB GFL (PLL) and GFM (VSM) simulations, SCR at POC and terminals." },
  ],
};
