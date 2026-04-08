import type { EducationContent } from "../../../types/education";

export const statcomSizingEducation: EducationContent = {
  id: "library.statcom-sizing",
  title: "STATCOM Sizing & Reactive Power Design",
  subtitle: "Why ±120 MVAR — and why not a cheaper SVC?",
  discipline: "Electrical",

  overview:
    "A 45 km subsea 220 kV HVAC cable is not a simple wire — it behaves like a capacitor, generating reactive power " +
    "that must be absorbed to prevent overvoltage at the offshore busbar (the Ferranti effect). The STATCOM " +
    "(Static Synchronous Compensator) is selected over the older SVC (Static VAR Compensator) for this project " +
    "because of superior low-voltage performance during faults — critical for PSE FRT compliance. " +
    "The ±120 MVAR rating is derived from cable charging power plus N-1 margin, not chosen arbitrarily.",

  simpleExplanation:
    "Imagine blowing air through a very long balloon hose. The hose itself inflates and pushes back — that is what " +
    "the cable's capacitance does to the grid: it generates reactive power nobody asked for. The STATCOM is like a " +
    "variable pressure relief valve at the offshore end — it absorbs exactly as much reactive power as the cable " +
    "generates, keeping the voltage steady. We size it 20% bigger than strictly needed so that one transformer " +
    "failing (N-1 contingency) doesn't take the whole farm offline.",

  technicalExplanation:
    "Three-phase 220 kV XLPE cable capacitance is approximately 200–270 nF/km depending on conductor size and " +
    "insulation geometry (IEC 60840 Class 3). At 45 km, the no-load charging reactive power is: " +
    "Q_cable = ω·C·V²·L = 2π×50 × 230e-9 × (220e3)² × 45 ≈ 100–130 MVAR (range reflects cable class uncertainty). " +
    "A 50 MVAR continuously-rated shunt reactor at the OSS absorbs the base load; the STATCOM handles the variable " +
    "remainder plus fault support. STATCOM uses VSC (voltage-source converter) technology — unlike SVC which uses " +
    "thyristor-switched capacitors/reactors — and maintains full reactive current capability even at 15% residual " +
    "voltage (required by PSE LVRT envelope). SVC output collapses at low voltage (Q ∝ V²) making it unsuitable " +
    "for FRT support. Response time < 5 ms (per manufacturer datasheets, e.g. ABB SVC Light, Siemens SVC PLUS) " +
    "versus ~20 ms for SVC, satisfying the PSE IRiESP FRT reactive current injection timeline.",

  standards: [
    {
      label: "IEC 61954 — Testing of thyristor valves for SVCs",
      type: "standard",
    },
    {
      label: "IEEE Std 1031 — Guide for functional specifications of transmission static VAR compensators",
      type: "standard",
    },
    {
      label: "PSE IRiESP §7 — Reactive power and voltage requirements for Type D generators",
      type: "standard",
    },
    {
      label: "ENTSO-E NC RfG Art. 20 — Fault-ride-through capability",
      type: "standard",
      url: "https://www.entsoe.eu/network_codes/rfg/",
    },
  ],

  formulas: [
    {
      expression: "Q_cable = ω · C' · (V_LL/√3)² · L · 3",
      variables: [
        { symbol: "Q_cable", name: "Three-phase cable charging power", unit: "MVAR" },
        { symbol: "ω", name: "Angular frequency = 2π × 50", unit: "rad/s" },
        { symbol: "C'", name: "Cable capacitance per unit length (manufacturer)", unit: "F/km" },
        { symbol: "V_LL", name: "Line-to-line voltage (220 kV)", unit: "V" },
        { symbol: "L", name: "Cable length (45 km)", unit: "km" },
      ],
      explanation:
        "For a 220 kV cable with C' = 230 nF/km: Q = 2π×50 × 230e-9 × (127e3)² × 45 × 3 ≈ 140 MVAR. " +
        "A 50 MVAR shunt reactor reduces the dynamic burden to ~90 MVAR. " +
        "Note: the value cited in §3.2 (85.5 MVAR) uses C' = 0.25 μF/km (= 250 nF/km per-phase), which is " +
        "an approximation. Exact value requires the specific cable manufacturer's datasheet.",
      reference: "IEC 60840 Clause 12 (capacitance test requirements)",
    },
    {
      expression: "Q_STATCOM = Q_net × f_N1 × f_derating",
      variables: [
        { symbol: "Q_net", name: "Net cable Q after shunt reactor", unit: "MVAR" },
        { symbol: "f_N1", name: "N-1 margin factor (typically 1.15)", unit: "—" },
        { symbol: "f_derating", name: "Temp + aging derating (1.05)", unit: "—" },
      ],
      explanation:
        "Sizing: 90 MVAR × 1.15 × 1.05 ≈ 109 MVAR → round up to standard rating ±120 MVAR. " +
        "The ± symmetry allows absorbing excess Q at light load and injecting Q during faults.",
    },
  ],

  workedExamples: [
    {
      title: "STATCOM vs SVC — platform cost comparison for 510 MW OSS",
      scenario:
        "Offshore substation must house reactive compensation rated ±120 MVAR. Compare STATCOM vs SVC platform cost.",
      steps: [
        "STATCOM: equipment €15 M + offshore platform €8 M = €23 M total",
        "SVC: equipment €10 M + offshore platform €20 M (500 m² vs 200 m²) = €30 M total",
        "Offshore platform cost dominates because space costs ~€40,000/m²",
        "STATCOM wins on total cost despite higher equipment cost",
        "STATCOM also wins on FRT performance — SVC cannot inject rated current at 15% Un",
      ],
      result:
        "STATCOM selected at ±120 MVAR + 50 MVAR shunt reactor. " +
        "Cost advantage over SVC: ~€7 M. FRT advantage: full reactive current at any voltage ≥0 pu. " +
        "Note: these cost figures are illustrative estimates based on published industry references for " +
        "this rating class; actual tender prices will differ.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea One (UK) — ±150 MVAR STATCOM at 500 kV",
      description:
        "ABB SVC Light (VSC-STATCOM) installed at the Killingholme onshore substation to manage the reactive " +
        "power from 140 km of 132 kV submarine cable. Response time <5 ms, providing FRT support during faults.",
      takeaway:
        "VSC-STATCOM is now standard for large HVAC offshore export systems. The technology is proven at " +
        "rating up to ±400 MVAR and at voltage levels up to 500 kV.",
    },
    {
      title: "Baltic Power (Poland) — STATCOM at OSS",
      description:
        "The ±120 MVAR STATCOM rating for Baltic Wind Alpha is calibrated to Baltic Power, which uses a " +
        "similar 220 kV export at comparable distance. Baltic Power's STATCOM specification is not publicly disclosed, " +
        "but the same cable-compensation calculation methodology applies.",
      takeaway:
        "Baltic Power provides the closest real-world precedent for the STATCOM sizing methodology used here.",
    },
  ],

  furtherReading: [
    {
      label: "ABB SVC Light — technical overview",
      type: "website",
      url: "https://new.abb.com/facts/svc-light",
    },
    {
      label: "CIGRE TB 663 — Guidelines for the procurement and testing of STATCOMs",
      type: "website",
      url: "https://www.e-cigre.org/",
    },
    {
      label: "Hingorani & Gyugyi — Understanding FACTS (IEEE Press, 2000)",
      type: "paper",
      citation: "Hingorani, N.G. & Gyugyi, L. (2000). Understanding FACTS. IEEE Press.",
    },
  ],

  relatedLessons: ["lesson-009"],
};
