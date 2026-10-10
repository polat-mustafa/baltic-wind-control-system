import type { EducationContent } from "../../../types/education";

export const statcomSizingEducation: EducationContent = {
  id: "library.statcom-sizing",
  title: "STATCOM Sizing & Reactive Power Design",
  subtitle: "Why ±120 MVAR — and why not a cheaper SVC?",
  discipline: "Electrical",

  overview:
    "SB-510 exports 510 MW over two parallel 108 km 220 kV HVAC cables (one cable carries only " +
    "√3 × 220 kV × 825 A ≈ 314 MVA). Each cable behaves like a long capacitor, generating ~312 MVAR — ~624 MVAR in " +
    "total — that must be absorbed: left in the network it would lift the offshore voltage by ≈ 24 % (the Ferranti " +
    "rise along the cable itself is ≈ 4 %). Four 180 MVAR shunt reactors — one per cable at each end — take the " +
    "constant base load; " +
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
    "uses 190 nF/km per phase. Per circuit at 108 km: Q = ω·C·V_LL²·L = 2π×50 × 190e-9 × (220e3)² × 108 ≈ 312 MVAR, " +
    "so the two export circuits generate ≈ 624 MVAR. The reactors sit one per cable at each end (two at the OSS, two " +
    "onshore), so each cable end carries only about half of the charging current: with all of them at the OSS, that " +
    "end would carry the whole charging current next to the load current — ≈ 1 060 A at 510 MW on an 825 A cable. All " +
    "four are in service at low output; near full output the cables and transformers absorb more (I²X) and the " +
    "operator switches one out. The STATCOM covers the remainder and is checked for one reactor out. STATCOM uses " +
    "VSC (voltage-source " +
    "converter) technology — unlike SVC which uses thyristor-switched capacitors/reactors — and maintains full " +
    "reactive current down to very low voltage (its output falls only ∝ V, an SVC's ∝ V²) — what PSE's fast fault " +
    "current requirement (ΔIq = K·ΔU, K 2–10) asks for during dips that may reach 0 pu for 150 ms. If one reactor " +
    "fails, 624 − 3 × 180 = 84 MVAR are left — inside the STATCOM's 120 MVAR even with its 15 % margin; with one " +
    "large reactor per cable at one end only, an outage would leave a whole cable's 312 MVAR, far beyond it. " +
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
        { symbol: "L", name: "Cable length (108 km)", unit: "km" },
      ],
      explanation:
        "ω·C'·V_LL² equals 3·ω·C'·V_phase², so no extra ×3 is needed. " +
        "Q = 2 × 2π×50 × 190e-9 × (220e3)² × 108 ≈ 2 × 312 = 624 MVAR. " +
        "Backend: calculate_cable_reactive_power() in services/p2/statcom_sizing.py.",
      reference: "Circuit theory (π-model shunt capacitance); cable data per manufacturer datasheet",
    },
    {
      expression: "Q_STATCOM = (Q_cable − Q_reactors) × (1 + k_temp + k_aging)",
      variables: [
        { symbol: "Q_reactors", name: "In-service reactor absorption in the N-1 case (3 of the 4 × 180)", unit: "MVAR" },
        { symbol: "k_temp", name: "Temperature derating (0.10)", unit: "—" },
        { symbol: "k_aging", name: "Ageing derating over 25 years (0.05)", unit: "—" },
      ],
      explanation:
        "Check for N-1 (one of 4 reactors out): (624 − 3 × 180) × 1.15 = 97 MVAR; all four in over-compensate: " +
        "(720 − 624) × 1.15 = 110 MVAR → ±120 MVAR installed (also the farm's reactive-capability share). " +
        "The ± symmetry allows absorbing excess Q at light load and injecting Q during faults. " +
        "Backend: size_statcom().",
    },
  ],

  workedExamples: [
    {
      title: "Reactor vs STATCOM split — who carries the 624 MVAR?",
      scenario:
        "Two export cables generate ~624 MVAR at no load. Compare covering it with a STATCOM alone versus " +
        "fixed shunt reactors plus a smaller STATCOM.",
      steps: [
        "STATCOM only: (624 − 0) × 1.15 = 718 → ±720 MVAR STATCOM on the offshore platform",
        "2 × 180 MVAR reactors at the OSS only: one out → (624 − 180) × 1.15 = 511 → ±520 MVAR STATCOM — and the OSS end of each cable carries the whole charging current",
        "4 × 180 MVAR, one per cable at each end: one out → (624 − 540) × 1.15 = 97 MVAR; all in → (720 − 624) × 1.15 = 110 MVAR the other way → ±120 MVAR",
        "Shunt reactors cost far less per MVAR than VSC converters and need no cooling or control system",
        "The cable charging power is almost constant (it depends on V², not on wind), so a fixed device suits it",
        "The STATCOM keeps the fast, variable part: load changes, voltage control and FRT current injection",
      ],
      result:
        "Selected: ±120 MVAR STATCOM + 4 × 180 MVAR shunt reactors (2 onshore, 2 at the OSS), one switched out from " +
        "half output up. Load flow keeps every live farm bus within 0.997–1.015 pu in all four scenarios, the export at " +
        "99 % of 825 A at 510 MW; the farm then exchanges −13 MVAR (full load), +30 MVAR (half load) and −13 MVAR " +
        "(no load) with PSE at 400 kV, well inside the −178.5 … +204 MVAR PSE range.",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p2/statcom_sizing.py",
      description: "calculate_cable_reactive_power() and ferranti_rise_pu() — the cable Q and voltage rise; size_statcom() — the rating with one reactor out and 10 % + 5 % margins; poc_q_capability() — the Q range at the PSE 400 kV point.",
    },
    {
      file: "backend/app/services/p2/network_model.py",
      description: "design() — sizes the STATCOM and the shunt reactors at both cable ends for any farm.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea One (UK) — multiple 220 kV HVAC export circuits",
      description:
        "The 1.2 GW Hornsea One farm, about 120 km off Yorkshire, exports over three 220 kV HVAC cable systems " +
        "(467 km of offshore export cable in total) and uses an offshore reactive compensation station part-way " +
        "along the route, because a single 220 kV cable cannot carry the full output and long cables generate " +
        "large charging power.",
      takeaway:
        "Large HVAC-connected farms split their export over several cables and combine shunt reactors with " +
        "dynamic compensation; SB-510 splits its reactors between both cable ends for the same reason.",
      source: "Ørsted / NKT (offshorewind.biz 2016, 2018); Jicable'19 paper A2-6",
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
