import type { EducationContent } from "../../../types/education";

export const powerQualityEducation: EducationContent = {
  id: "p2.power-quality",
  title: "Harmonics, Resonance and Flicker",
  subtitle:
    "Why a cable-connected wind farm can amplify a small converter emission",
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
    "76.5 km export circuits as exact distributed π sections, the 4 × 120 MVAR reactors (one per cable at each end) " +
    "and the array cable charging. " +
    "WTG emission (% of rated current) is summed over 34 units with the IEC 61000-3-6 exponent (α = 2 above the " +
    "10th: √34 ≈ 5.8×) and multiplied by |Z(h)| to give harmonic voltages. Judged against IEC TR 61000-3-6 Table 2 " +
    "planning levels (HV-EHV: h5 2 %, h17 1.2 %, THD 3 %). Planning levels bound the total distortion; the share " +
    "PSE would allocate to this plant is lower. Converter output impedance, loads and background distortion are " +
    "not modelled, so the resonance peaks are upper bounds.",

  standards: [
    {
      label:
        "IEC TR 61000-3-6:2008 — Emission limits for distorting installations (planning levels, Table 2)",
      type: "standard",
    },
    {
      label:
        "IEC 61000-3-7:2008 — Emission limits for fluctuating installations (flicker)",
      type: "standard",
    },
    {
      label: "IEC 61400-21 — Power quality characteristics of wind turbines",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "U_h = |Z(h)| · N^(1/α) · I_h,WTG",
      variables: [
        {
          symbol: "Z(h)",
          name: "Network harmonic impedance seen from the converters",
          unit: "Ω",
        },
        {
          symbol: "α",
          name: "Summation exponent (1, 1.4 or 2 by order)",
          unit: "—",
        },
      ],
      explanation: "Harmonic voltage from the summed emission of N turbines.",
    },
    {
      expression: "f_r ≈ 1 / (2π √(L_sc · C_cable))",
      variables: [
        {
          symbol: "L_sc",
          name: "Short-circuit inductance (grid + transformers)",
          unit: "H",
        },
        {
          symbol: "C_cable",
          name: "Cable capacitance net of reactors",
          unit: "F",
        },
      ],
      explanation:
        "First parallel resonance. A weaker grid (larger L_sc) moves it lower.",
    },
    {
      expression:
        "Z_f(h) = 1/(jhω₀C) + (jhω₀L ∥ R),  X_C − X_L = U²/Q,  X_L = X_C/h_t²,  R = q·h_t·ω₀L",
      variables: [
        { symbol: "h_t", name: "Tuned order of the filter", unit: "—" },
        {
          symbol: "q",
          name: "Quality factor (1.5: broadly damped)",
          unit: "—",
        },
        { symbol: "Q", name: "Fundamental reactive output", unit: "Mvar" },
      ],
      explanation:
        "Damped 2nd-order high-pass filter (IEEE Std 1531): a low impedance from h_t upwards, the resistor damps " +
        "the new parallel resonance it creates below h_t.",
    },
    {
      expression: "P_st = c(ψ_k) · √N · S_n / S_k",
      variables: [
        {
          symbol: "c",
          name: "Flicker coefficient from the turbine test report",
          unit: "—",
        },
        { symbol: "S_k", name: "Grid short-circuit power", unit: "MVA" },
      ],
      explanation:
        "Continuous-operation flicker of N identical turbines (IEC 61400-21).",
    },
  ],

  workedExamples: [
    {
      title: "Where the network rings — and the filter that fixes it",
      scenario:
        "10 GVA grid, 2 × 76.5 km cable, reactors in, typical full-converter emission.",
      steps: [
        "Without a filter, scan from OSS 66 kV: parallel resonances at ≈ 130 Hz (h 2.6), ≈ 725 Hz (h 14.5) and ≈ 960 Hz (h 19.2)",
        "At h19 |Z| ≈ 288 Ω versus ≈ 2.8 Ω at 50 Hz: ≈ 5.5× more than a plain inductance (2.8 Ω × 19 = 53 Ω)",
        "0.2 % h19 emission × √34 → 1.16 % at OSS 66 kV, 108 % of the 1.07 % HV planning level — FAIL",
        "Filter design: worst order h19 → tune to h18 (900 Hz); smallest size with every order ≤ 50 % of its planning " +
          "level at 0.5, 1 and 2 × S_sc and no resonance on h5…h25 = 5 Mvar",
        "Elements at 66 kV: X_C − X_L = 66²/5 = 871 Ω, X_L = X_C/18² → C = 3.64 µF, L = 8.59 mH, R = 1.5 × 18 × ω₀L = 72.8 Ω",
        "With the filter: h19 |Z| = 26 Ω, 0.105 % = 9.8 % of the planning level; the 960 Hz peak moves to ≈ 645 Hz (h 12.9) " +
          "at amplification 2.6; worst order h13 at 50 %, THD 0.98 %",
        "At the PSE 400 kV POC THD ≈ 0.17 % (0.18 % without) — the grid side was never the problem",
      ],
      result:
        "The farm's own 66 kV busbar needs the filter: the 960 Hz resonance (array cable capacitance against the OSS " +
        "transformers and the grid) sits next to h19. A 5 Mvar damped high-pass at OSS 66 kV brings h19 from 108 % to " +
        "10 % of the planning level. At 50 Hz it is a 5 Mvar capacitor the STATCOM absorbs (−2.8 → −7.8 Mvar at full " +
        "load). A 2–3 Mvar filter leaves an amplified peak next to h13 at some grid strengths; a real study re-checks it once the converter " +
        "harmonic models are final.",
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
    {
      file: "backend/app/services/p2/power_quality.py",
      description: "Harmonic network, planning levels, scan, flicker, filter.",
    },
  ],
};
