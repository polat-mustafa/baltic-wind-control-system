import type { EducationContent } from "../../../types/education";

export const powerQualityEducation: EducationContent = {
  id: "p2.power-quality",
  title: "Harmonics, Resonance and Flicker",
  subtitle: "Why a cable-connected wind farm can amplify a small converter emission",
  discipline: "Electrical",

  overview:
    "Converters switch at kHz and leave small currents at multiples of 50 Hz. On their own these are tiny, but " +
    "a long HVAC cable is a large capacitance that, together with transformer and grid inductance, forms parallel " +
    "resonances. Near a resonance the network impedance is many times higher, so a harmless emission becomes a " +
    "noticeable voltage distortion. Flicker — fast voltage fluctuation from power swings — is the other power " +
    "quality limit; full-converter turbines on a strong grid produce very little.",

  simpleExplanation:
    "The turbines whisper at certain pitches. Most of the network ignores them, but at a few pitches the cable " +
    "and the transformers ring like a bell and make the whisper loud. The study finds those pitches and checks " +
    "the loudest note stays under the limit.",

  technicalExplanation:
    "Model: positive-sequence nodal network per harmonic order — grid Thevenin, both transformer stages, the two " +
    "76.5 km export circuits as exact distributed π sections, 3 × 170 MVAR reactors and the array cable charging. " +
    "WTG emission (% of rated current) is summed over 34 units with the IEC 61000-3-6 exponent (α = 2 above the " +
    "10th: √34 ≈ 5.8×) and multiplied by |Z(h)| to give harmonic voltages. Judged against IEC TR 61000-3-6 Table 2 " +
    "planning levels (HV-EHV: h5 2 %, h17 1.2 %, THD 3 %). Planning levels bound the total distortion; the share " +
    "PSE would allocate to this plant is lower. Converter output impedance, loads and background distortion are " +
    "not modelled, so the resonance peaks are upper bounds.",

  standards: [
    { label: "IEC TR 61000-3-6:2008 — Emission limits for distorting installations (planning levels, Table 2)", type: "standard" },
    { label: "IEC 61000-3-7:2008 — Emission limits for fluctuating installations (flicker)", type: "standard" },
    { label: "IEC 61400-21 — Power quality characteristics of wind turbines", type: "standard" },
  ],

  formulas: [
    {
      expression: "U_h = |Z(h)| · N^(1/α) · I_h,WTG",
      variables: [
        { symbol: "Z(h)", name: "Network harmonic impedance seen from the converters", unit: "Ω" },
        { symbol: "α", name: "Summation exponent (1, 1.4 or 2 by order)", unit: "—" },
      ],
      explanation: "Harmonic voltage from the summed emission of N turbines.",
    },
    {
      expression: "f_r ≈ 1 / (2π √(L_sc · C_cable))",
      variables: [
        { symbol: "L_sc", name: "Short-circuit inductance (grid + transformers)", unit: "H" },
        { symbol: "C_cable", name: "Cable capacitance net of reactors", unit: "F" },
      ],
      explanation: "First parallel resonance. A weaker grid (larger L_sc) moves it lower.",
    },
    {
      expression: "P_st = c(ψ_k) · √N · S_n / S_k",
      variables: [
        { symbol: "c", name: "Flicker coefficient from the turbine test report", unit: "—" },
        { symbol: "S_k", name: "Grid short-circuit power", unit: "MVA" },
      ],
      explanation: "Continuous-operation flicker of N identical turbines (IEC 61400-21).",
    },
  ],

  workedExamples: [
    {
      title: "Where the network rings",
      scenario: "10 GVA grid, 2 × 76.5 km cable, reactors in, typical full-converter emission.",
      steps: [
        "Scan from OSS 66 kV: parallel resonances at ≈ 135 Hz (h 2.7), ≈ 730 Hz (h 14.6) and ≈ 965 Hz (h 19.3)",
        "At h19 |Z| ≈ 215 Ω versus ≈ 2.7 Ω at 50 Hz: ≈ 4× more than a plain inductance (2.7 Ω × 19 = 51 Ω)",
        "0.2 % h19 emission × √34 → 0.87 % at OSS 66 kV, 80 % of the 1.07 % HV planning level",
        "At the PSE 400 kV POC the same emission gives THD ≈ 0.19 % — the grid side is fine",
      ],
      result:
        "The farm passes, but its own 66 kV busbar uses 80 % of the h19 planning level next to a resonance: the longer " +
        "cable moved the peak from h17 to h19. A converter-control or damped-filter question, exactly what a " +
        "real harmonic study would flag for detailed converter models.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "CIGRE TB 766 — Network modelling for harmonic studies",
      type: "standard",
      citation: "CIGRE Working Group C4.30, 2019",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/power_quality.py", description: "Harmonic network, planning levels, scan, flicker, filter." },
  ],
};
