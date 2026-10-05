import type { EducationContent } from "../../../types/education";

export const statcomSizingEducation: EducationContent = {
  id: "library.statcom-sizing",
  title: "STATCOM Sizing & Reactive Power Design",
  subtitle: "Why ±120 MVAR — and why not a cheaper SVC?",
  discipline: "Electrical",

  overview:
    "Baltic Wind Alpha exports 510 MW over two parallel 45 km subsea 220 kV HVAC cables (one cable carries only " +
    "~362 MVA). Each cable behaves like a long capacitor, generating ~130 MVAR — ~260 MVAR in total — that must be " +
    "absorbed: pushed through the transformers and grid it would lift the offshore voltage by ≈ 8 % (the Ferranti " +
    "rise along the cable itself is only ≈ 0.7 %). Three 80 MVAR shunt reactors (N+1) take the constant base load; " +
    "a ±120 MVAR STATCOM (Static Synchronous Compensator) handles the variable rest and " +
    "fault support. The STATCOM is selected over the older SVC because of its low-voltage performance during faults.",

  simpleExplanation:
    "Imagine blowing air through two very long balloon hoses. The hoses inflate and push back — that is what the " +
    "cables' capacitance does to the grid: it generates reactive power nobody asked for. Fixed pressure-relief " +
    "valves (the shunt reactors) always let out the same amount; a smart adjustable valve (the STATCOM) trims the " +
    "rest second by second. Fixed valves are cheap, the smart valve is expensive — so we let the cheap ones do most " +
    "of the work.",

  technicalExplanation:
    "220 kV XLPE export cable capacitance is manufacturer data (IEC 62067 covers cables above 150 kV); the model " +
    "uses 190 nF/km per phase. Per circuit at 45 km: Q = ω·C·V_LL²·L = 2π×50 × 190e-9 × (220e3)² × 45 ≈ 130 MVAR, " +
    "so the two export circuits generate ≈ 260 MVAR. Three 80 MVAR shunt reactors (N+1) at the OSS absorb 240 MVAR " +
    "continuously; the STATCOM covers the small remainder and is sized for one reactor out. STATCOM uses VSC (voltage-source " +
    "converter) technology — unlike SVC which uses thyristor-switched capacitors/reactors — and maintains full " +
    "reactive current down to very low voltage (its output falls only ∝ V, an SVC's ∝ V²) — what PSE's fast fault " +
    "current requirement (ΔIq = K·ΔU, K 2–10) asks for during dips that may reach 0 pu for 150 ms. If one reactor " +
    "is out (N-1), 100 MVAR remain — inside the STATCOM's 120 MVAR, which is why the third (spare) reactor exists. " +
    "The steady-state Q range PSE asks at the connection point (−0.35 … +0.40 P_max) is met mainly by the WTGs and " +
    "reactor switching; the STATCOM adds speed and the N-1 margin.",

  standards: [
    {
      label: "IEC 62067 — Power cables with extruded insulation for rated voltages above 150 kV",
      type: "standard",
    },
    {
      label: "IEEE Std 1031 — Guide for functional specifications of transmission static VAR compensators",
      type: "standard",
    },
    {
      label: "PSE — Wymogi ogólnego stosowania wynikające z NC RfG (18-12-2018), Art. 20(2)(b), 21(3)",
      type: "regulation",
      url: "https://www.pse.pl/documents/20182/31216853/20181218_Wymogi_ogolnego_stosowania_OSP_i_OSD.pdf",
    },
    {
      label: "Commission Regulation (EU) 2016/631 — NC RfG Art. 20–21 (PPM reactive capability, fast fault current)",
      type: "regulation",
      url: "https://eur-lex.europa.eu/eli/reg/2016/631/oj",
    },
  ],

  formulas: [
    {
      expression: "Q_cable = n · ω · C' · V_LL² · L",
      variables: [
        { symbol: "Q_cable", name: "Three-phase charging power of all export circuits", unit: "MVAR" },
        { symbol: "n", name: "Number of parallel export cables (2)", unit: "—" },
        { symbol: "ω", name: "Angular frequency = 2π × 50", unit: "rad/s" },
        { symbol: "C'", name: "Cable capacitance per phase per km (manufacturer, 190 nF/km)", unit: "F/km" },
        { symbol: "V_LL", name: "Line-to-line voltage (220 kV)", unit: "V" },
        { symbol: "L", name: "Cable length (45 km)", unit: "km" },
      ],
      explanation:
        "ω·C'·V_LL² equals 3·ω·C'·V_phase², so no extra ×3 is needed. " +
        "Q = 2 × 2π×50 × 190e-9 × (220e3)² × 45 ≈ 2 × 130 = 260 MVAR. " +
        "Backend: calculate_cable_reactive_power() in services/p2/statcom_sizing.py.",
      reference: "Circuit theory (π-model shunt capacitance); cable data per manufacturer datasheet",
    },
    {
      expression: "Q_STATCOM = (Q_cable − Q_reactors) × (1 + k_temp + k_aging)",
      variables: [
        { symbol: "Q_reactors", name: "In-service reactor absorption in the N-1 case (2 of the 3 × 80)", unit: "MVAR" },
        { symbol: "k_temp", name: "Temperature derating (0.10)", unit: "—" },
        { symbol: "k_aging", name: "Ageing derating over 25 years (0.05)", unit: "—" },
      ],
      explanation:
        "Sizing for N-1 (one of 3 reactors out): (260 − 2 × 80) × 1.15 = 115 MVAR → round up to ±120 MVAR. " +
        "The ± symmetry allows absorbing excess Q at light load and injecting Q during faults. " +
        "Backend: size_statcom().",
    },
  ],

  workedExamples: [
    {
      title: "Reactor vs STATCOM split — who carries the 260 MVAR?",
      scenario:
        "Two export cables generate ~260 MVAR at no load. Compare covering it with a STATCOM alone versus " +
        "fixed shunt reactors plus a smaller STATCOM.",
      steps: [
        "STATCOM only: (260 − 0) × 1.15 = 299 → ±300 MVAR STATCOM on the offshore platform",
        "2 × 80 MVAR reactors + STATCOM: fine normally, but one reactor out → (260 − 80) × 1.15 = 207 → ±210 MVAR STATCOM",
        "3 × 80 MVAR reactors (N+1) + STATCOM: one out → (260 − 160) × 1.15 = 115 → ±120 MVAR STATCOM",
        "Shunt reactors cost far less per MVAR than VSC converters and need no cooling or control system",
        "The cable charging power is almost constant (it depends on V², not on wind), so a fixed device suits it",
        "The STATCOM keeps the fast, variable part: load changes, voltage control and FRT current injection",
      ],
      result:
        "Selected: ±120 MVAR STATCOM + 3 × 80 MVAR (N+1) shunt reactors. Load flow keeps every farm bus within " +
        "0.998–1.008 pu in all four scenarios; the farm then exchanges −42 MVAR (full load) to +35 MVAR (no load) " +
        "with PSE at 400 kV, well inside the −178.5 … +204 MVAR PSE range. " +
        "Note: in real projects reactors are often placed at both cable ends; this model puts them at the OSS.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea One (UK) — multiple 220 kV HVAC export circuits",
      description:
        "The 1.2 GW Hornsea One farm exports over three 220 kV HVAC circuits and uses an offshore reactive " +
        "compensation station part-way along the ~120 km route, because a single 220 kV cable cannot carry the " +
        "full output and long cables generate large charging power.",
      takeaway:
        "Large HVAC-connected farms split their export over several cables and combine shunt reactors with " +
        "dynamic compensation — the same pattern used in Baltic Wind Alpha.",
    },
  ],

  furtherReading: [
    {
      label: "CIGRE TB 663 — Guidelines for the procurement and testing of STATCOMs",
      type: "standard",
      citation: "CIGRE Technical Brochure 663, 2016",
    },
    {
      label: "Hingorani & Gyugyi — Understanding FACTS (IEEE Press, 2000)",
      type: "textbook",
      citation: "Hingorani, N.G. & Gyugyi, L. (2000). Understanding FACTS. IEEE Press.",
    },
  ],

};
