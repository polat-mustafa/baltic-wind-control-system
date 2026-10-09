import type { EducationContent } from "../../../types/education";

export const loadFlowEducation: EducationContent = {
  id: "p2.load-flow",
  title: "Load Flow — Voltages, Loadings and Losses",
  subtitle: "Where the 510 MW goes between the turbines and the PSE 400 kV busbar",
  discipline: "Electrical",

  overview:
    "A load flow (power flow) finds the steady-state voltage magnitude and angle at every busbar for a given " +
    "generation, then derives the current, loading and losses of every cable and transformer. It is the first study " +
    "for any grid connection: it shows whether voltages stay inside the operating band and whether equipment is " +
    "overloaded, for every operating point that matters (full load, part load, no load, contingencies).",

  simpleExplanation:
    "Power flows from the turbines through 66 kV array cables to the offshore substation, is stepped up to 220 kV, " +
    "travels 108 km to the grid in two cables, and is stepped up again to 400 kV. Every element has a little resistance " +
    "(it gets warm — losses) and reactance (the voltage shifts). The load flow calculates those shifts and how close " +
    "each cable and transformer runs to its limit.",

  technicalExplanation:
    "pandapower solves the AC power-flow equations with Newton–Raphson: each bus balances P and Q, the Jacobian is " +
    "updated each iteration until the mismatch is below 10⁻⁸ MVA. The PSE grid is the slack bus (400 kV, 1.0 p.u.). " +
    "Cables are π-models with R at 90 °C (worst-case losses), transformers use vk/vkr and magnetising data, the 34 " +
    "WTGs are static generators at unity power factor and the STATCOM is dispatched to hold the 220 kV offshore " +
    "busbar at 1.0 p.u. Bus results are reported as injections, generating positive (Rule 4). The platform checks a " +
    "0.95–1.05 p.u. planning band; NC RfG allows 0.90–1.118 p.u. continuously at 110–300 kV.",

  standards: [
    {
      label: "Commission Regulation (EU) 2016/631 — NC RfG, Table 6.1 (voltage ranges)",
      type: "regulation",
      url: "https://eur-lex.europa.eu/eli/reg/2016/631/oj",
    },
    { label: "IEC 60287-1-1 — Cable current rating (AC resistance at 90 °C)", type: "standard" },
  ],

  formulas: [
    {
      expression: "P_i = V_i Σ_j V_j (G_ij cos θ_ij + B_ij sin θ_ij),   Q_i = V_i Σ_j V_j (G_ij sin θ_ij − B_ij cos θ_ij)",
      variables: [
        { symbol: "V_i, θ_i", name: "Bus voltage magnitude and angle", unit: "p.u., rad" },
        { symbol: "G_ij + jB_ij", name: "Element of the bus admittance matrix", unit: "p.u." },
      ],
      explanation: "The power balance Newton–Raphson solves at every bus.",
      reference: "Glover, Overbye & Sarma, Power System Analysis and Design, ch. 6",
    },
    {
      expression: "ΔV ≈ (R·P + X·Q) / V",
      variables: [
        { symbol: "R, X", name: "Series resistance and reactance", unit: "p.u." },
        { symbol: "P, Q", name: "Power flowing through the element", unit: "p.u." },
      ],
      explanation:
        "Approximate voltage change across a branch. In HV networks X ≫ R, so reactive power — not active power — " +
        "moves the voltage. That is why the STATCOM and reactors, not the turbines' MW, control the profile.",
    },
  ],

  workedExamples: [
    {
      title: "Full load: 510 MW generated, how much reaches PSE?",
      scenario: "All 34 WTGs at 15 MW, STATCOM holding OSS 220 kV at 1.0 p.u. (Load-flow tab, full-load scenario).",
      steps: [
        "Losses: array cables + export cables (6.65 MW) + two transformer stages (2.1 MW) = 10.1 MW",
        "Delivered at the POC: 510 − 10.1 = 499.8 MW (1.98 % electrical loss at this instant)",
        "Export cables carry ≈ 501 MW + their own charging current → 99.1 % of the two-circuit rating (108 km)",
        "Each transformer stage (2 × 300 MVA) runs at ≈ 83–84 %",
      ],
      result:
        "Full-load losses are 1.98 %; averaged over a year (most hours below rated, and I²R falls with the square of the load) the energy loss is lower — " +
        "the P1 cascade uses 2 %, which also covers auxiliary consumption.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "pandapower — An open-source Python tool for convenient modeling, analysis and optimization of electric power systems",
      type: "paper",
      citation: "Thurner et al., IEEE Trans. Power Systems 33(6) (2018) 6510–6521, doi:10.1109/TPWRS.2018.2829021",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/network_model.py", description: "Cables, transformers, OLTC, reactors, STATCOM; build_network()." },
    { file: "backend/app/services/p2/load_flow.py", description: "Scenarios, STATCOM auto-dispatch, result extraction." },
  ],
};
