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
    "108 km export circuits as exact distributed π sections, the 4 × 180 MVAR reactors (one per cable at each end) " +
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
        "10 GVA grid, 2 × 108 km cable, reactors in, typical full-converter emission.",
      steps: [
        "Without a filter, scan from OSS 66 kV: parallel resonances at ≈ 115 Hz (h 2.3, × 11), ≈ 535 Hz (h 10.7) and ≈ 770 Hz (h 15.4, × 12.5)",
        "The 770 Hz peak is the array cables (21.3 Mvar of charging) against the OSS transformers; it falls between h15 and h16, where a full converter emits little",
        "On a strong grid (2 × S_sc = 20 GVA) the 535 Hz peak rises to × 3.0 — within one order of h11, a characteristic converter harmonic",
        "h11 current: 0.5 % × 131 A = 0.66 A per turbine, × √34 (α = 2 for h ≥ 10, IEC 61000-3-6) = 3.8 A; × 57.9 Ω = 221 V = 0.58 % of the 38.1 kV phase voltage at OSS 66 kV, 38.7 % of the 1.5 % HV planning level",
        "Filter design: an amplified resonance next to h11 → tune one order below, h10.34 (517 Hz); the smallest standard size that leaves no such resonance at 0.5, 1 and 2 × S_sc: 2 Mvar",
        "Elements at 66 kV: X_C − X_L = 66²/2 = 2 178 Ω, X_L = X_C/10.34² → C = 1.45 µF, L = 65.5 mH, R = 1.5 × 10.34 × ω₀L = 319 Ω",
        "With the filter: the 535 Hz peak drops to × 2.0, h11 to 0.39 % = 26 % of the planning level; no characteristic order above 27 %; THD 0.71 % at 66 kV (0.78 % without)",
        "At the PSE 400 kV POC THD ≈ 0.12 % (0.14 % without) — the grid side was never the problem",
        "Left over: the 108 km cable against the grid rings at ≈ 105–120 Hz (h 2.1–2.4, × 10–16) — a 66 kV high-pass can't move it; on the weak grid h2 reaches 84 % of its planning level, a point for the connection-stage harmonic study",
      ],
      result:
        "The farm needs the filter for its strong-grid case: the 535 Hz resonance (export cable and array capacitance against the transformers and the grid) climbs next to h11. A 2 Mvar damped high-pass tuned to h10.34 at OSS 66 kV damps it and brings h11 from 38.7 % to 26 % of the planning level. At 50 Hz it is a 2 Mvar capacitor the STATCOM absorbs (+30.3 → +28.4 Mvar at full load). An earlier version of this model lumped only 15 Mvar of array charging (the load-flow cables give 21.3), put the array resonance at 880 Hz next to h17 and chose an h16 filter — with the correct capacitance that filter would itself leave a × 3 resonance next to h17. A real study re-checks it once the converter harmonic models are final.",
    },
  ],

  realWorldCases: [
    {
      title: "BorWin1 (Germany): harmonic interaction in a converter grid",
      description:
        "BorWin1 connects offshore wind farms through a small islanded AC grid fed only by converters. TenneT engineers published its first experiences with harmonic interactions and high-frequency oscillations between the converters and the grid; in 2014 the connected BARD Offshore 1 farm stood idle for months while power quality was investigated.",
      takeaway: "When cables and converters dominate a network, resonances move into the range converters excite — the impedance scan on this tab is how they are found before commissioning.",
      source: "Buchhagen et al., VDE (2015), \"BorWin1 – First Experiences with harmonic interactions in converter dominated grids\"; offshore-energy.biz, 26 Jun 2014",
    },
  ],

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
