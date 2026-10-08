import type { EducationContent } from "../../../types/education";

export const reactiveCompensationEducation: EducationContent = {
  id: "p2.reactive-compensation",
  title: "Reactive Compensation — Reactors, STATCOM and the PSE Q Range",
  subtitle: "Why a 76.5 km cable needs 3 × 170 MVAR of reactors, and what sizes the STATCOM",
  discipline: "Electrical",

  overview:
    "An XLPE cable is a long capacitor: at 220 kV the two 76.5 km export circuits generate about 442 MVAR whether the " +
    "farm produces or not. Uncompensated, that current flows through the cable, the transformers and the grid and " +
    "lifts the offshore voltage by about 15 %. Shunt reactors absorb most of it; a STATCOM covers the rest dynamically. The grid " +
    "code then asks the farm to deliver a defined reactive range at the connection point.",

  simpleExplanation:
    "Cables store electric charge and push 'reactive power' back into the grid all the time. Too much of it raises the " +
    "voltage. Reactors are big coils that soak it up; the STATCOM is a fast power-electronic valve that adds or " +
    "absorbs whatever is still needed, second by second.",

  technicalExplanation:
    "Two effects are often confused. The Ferranti effect is the rise along an open-ended line, V_r = V_s / cos(βL): " +
    "for 76.5 km of this cable ≈ 2 %. Most of the 15 % rise is charging current through the series reactance " +
    "(ΔV ≈ Q·X). The scheme: 3 × 170 MVAR reactors (N+1) at OSS 220 kV. All three would over-compensate " +
    "(442 − 510), so the operator keeps the spare out: with two in, the ±120 MVAR STATCOM absorbs ≈ 50 MVAR at no " +
    "load and ≈ 0 at full output, when the transformers' I²X takes the rest. PSE requires " +
    "Q/P_max from −0.35 to +0.40 at the connection point for P ≥ 0.1 P_max (−178.5 / +204 MVAR). The check combines " +
    "WTG reactive capability (assumed ±0.33 p.u. — the V236 data sheet is not public), the STATCOM, switching reactors " +
    "and both OLTCs, keeping every farm bus within 0.90–1.10 p.u.",

  standards: [
    {
      label: "PSE — Wymogi ogólnego stosowania wynikające z NC RfG (18-12-2018), Art. 21(3)(b)–(c)",
      type: "regulation",
      url: "https://www.pse.pl/documents/20182/31216853/20181218_Wymogi_ogolnego_stosowania_OSP_i_OSD.pdf",
    },
    {
      label: "Commission Regulation (EU) 2016/631 — NC RfG Art. 21 (reactive capability of type-D PPMs)",
      type: "regulation",
      url: "https://eur-lex.europa.eu/eli/reg/2016/631/oj",
    },
  ],

  formulas: [
    {
      expression: "Q_cable = ω · C · V² · L",
      variables: [
        { symbol: "C", name: "Capacitance per km (190 nF/km)", unit: "F/km" },
        { symbol: "V", name: "Line-to-line voltage", unit: "V" },
        { symbol: "L", name: "Length × circuits (2 × 76.5 km)", unit: "km" },
      ],
      explanation: "Charging power (Rule 7: capacitive, positive). 2π·50 × 190e-9 × 220 000² × 153 ≈ 442 MVAR.",
    },
    {
      expression: "V_r / V_s = 1 / cos(βL),   β = ω√(L′C′)",
      variables: [
        { symbol: "L′, C′", name: "Inductance and capacitance per km", unit: "H/km, F/km" },
        { symbol: "βL", name: "Electrical length (0.20 rad for 76.5 km)", unit: "rad" },
      ],
      explanation: "Ferranti rise along the open cable: ≈ 2 % here — small compared with the 15 % from charging current.",
    },
  ],

  workedExamples: [
    {
      title: "Does the scheme meet PSE's reactive range at 510 MW?",
      scenario: "P = P_max, OLTCs regulating, farm buses kept within 0.90–1.10 p.u.",
      steps: [
        "Required: +0.40 × 510 = +204 MVAR, −0.35 × 510 = −178.5 MVAR at PSE 400 kV",
        "Producing: WTGs + STATCOM at full capacitive output, reactors switched out → +543 MVAR",
        "Absorbing: WTGs + STATCOM inductive with all reactors in → −542 MVAR",
      ],
      result:
        "The range is met with margin. The STATCOM is therefore not sized by the steady-state Q range; it is sized for " +
        "the reactor N-1 case and for fast voltage control — the WTGs and switched reactors do the slow, large moves.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    { label: "P. Kundur — Power System Stability and Control", type: "textbook", citation: "McGraw-Hill, 1994, ch. 11" },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p2/statcom_sizing.py",
      description: "Cable Q, Ferranti vs uncompensated rise, reactor N-1, poc_q_capability() bisection.",
    },
  ],
};
