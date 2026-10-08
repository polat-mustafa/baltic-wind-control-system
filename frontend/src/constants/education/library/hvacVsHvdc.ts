import type { EducationContent } from "../../../types/education";

export const hvacVsHvdcEducation: EducationContent = {
  id: "library.hvac-vs-hvdc",
  title: "HVAC vs HVDC Export Trade-off",
  subtitle: "When does direct current become cheaper than alternating current?",
  discipline: "Electrical",

  overview:
    "For offshore wind, the choice of export technology starts with one question: how far is the project from " +
    "shore? An HVAC submarine cable is a long capacitor: its charging current grows linearly with length and uses up " +
    "the conductor's current rating, so each extra kilometre leaves less room for active power and needs more " +
    "reactive compensation. HVDC has no charging current but needs a converter station at each end, a large fixed " +
    "cost and about 1 % loss per station. Where the two cross depends on power, distance and prices — this platform " +
    "computes the physics (capacity, compensation, losses), not the converter prices.",

  simpleExplanation:
    "Imagine pumping water through a leaky hose. The longer the hose, the less water comes out the far end because more " +
    "leaks out the sides. AC power has a similar problem with long cables — energy 'leaks' as charging current. If the " +
    "cable is short, AC is fine. If it's very long, you have to convert to DC at both ends (which is expensive but " +
    "doesn't leak), and at some distance the DC option becomes cheaper overall.",

  technicalExplanation:
    "A 220 kV three-core 1000 mm² Cu XLPE cable has C' = 190 nF/km and an IEC 60287 rating of 825 A (ABB/NKT " +
    "2GM5007 rev 5, Tables 34 and 49). Its charging current is I_c = ωC'·U/√3 = 7.58 A per km. With reactors at both " +
    "ends each end carries I_c/2: at 50 km that is 190 A and leaves √(825² − 190²) = 803 A for active power; at " +
    "100 km 379 A and 733 A. The AC critical length — no active power left — is where I_c/2 = I_th: 2 × 825 / 7.58 " +
    "≈ 218 km (half that with compensation at one end only). HVDC LCC (line-commutated converter) needs reactive " +
    "compensation and a strong AC system at both ends; HVDC VSC (voltage-source converter, used for modern offshore " +
    "links) provides black-start capability and decoupled P/Q control but costs more per MVA.",

  standards: [
    {
      label: "IEC 62747 — Terminology for voltage-sourced converters (VSC) for HVDC systems",
      type: "standard",
    },
    {
      label: "IEC 60287-1-1 — Current rating of cables (conductor and dielectric losses)",
      type: "standard",
    },
    {
      label: "Bahrman & Johnson (2007) — ABCs of HVDC transmission (IEEE P&E, open access)",
      type: "paper",
      url: "https://doi.org/10.1109/MPAE.2007.329194",
    },
  ],

  formulas: [
    {
      expression: "I_c = 2π · f · C' · U_LL/√3 · L",
      variables: [
        { symbol: "I_c", name: "Charging current per phase", unit: "A" },
        { symbol: "f", name: "System frequency", unit: "Hz" },
        { symbol: "C'", name: "Capacitance per unit length", unit: "F/km" },
        { symbol: "U_LL", name: "Line-to-line voltage", unit: "V" },
        { symbol: "L", name: "Cable length", unit: "km" },
      ],
      explanation:
        "Linear in length, frequency and voltage. Compensated at both ends, P_active = √3 · U · √(I_th² − (I_c/2)²) per " +
        "circuit; it falls to zero when I_c/2 = I_th — the AC critical length.",
    },
    {
      expression: "L_break ≈ (CAPEX_HVDC,fixed − CAPEX_AC,comp) / (CAPEX_AC,km − CAPEX_HVDC,km)",
      variables: [
        { symbol: "L_break", name: "Break-even distance", unit: "km" },
        { symbol: "CAPEX_HVDC,fixed", name: "Two converter stations", unit: "EUR" },
        { symbol: "CAPEX_AC,comp", name: "AC compensation (shunt reactors etc.)", unit: "EUR" },
      ],
      explanation:
        "First-order trade-off: the converter stations are a fixed cost, the AC option pays per km for more circuits " +
        "and compensation. The result depends on prices that change by project and year; use quotes, not a rule of thumb.",
    },
  ],

  workedExamples: [
    {
      title: "SB-510 (510 MW) — HVAC chosen over HVDC",
      scenario:
        "510 MW capacity, 76.5 km route, 220 kV three-core 1000 mm² Cu cable, C' = 190 nF/km, I_th = 825 A.",
      steps: [
        "I_c = 2π · 50 · 190e-9 · 220,000/√3 · 76.5 ≈ 580 A, compensated half at each end → 290 A",
        "P_active = √3 · 220 · √(825² − 290²) ≈ √3 · 220 · 772 = 294 MW per cable",
        "Two cables → ≈ 589 MW capacity, above the 510 MW farm (one cable alone is not enough)",
        "4 × 120 MVAR shunt reactors, one per cable at each end, absorb most of the ~442 MVAR charging power",
      ],
      result:
        "Two parallel 220 kV three-core cables with onshore + offshore reactors carry the 510 MW farm at 92 % of their " +
        "rating (P2 load flow). HVDC would add two converter stations and ≈ 2 % converter loss for no gain in " +
        "capacity at this distance.",
    },
    {
      title: "Counter-example: a 2 GW farm 130 km offshore",
      scenario: "Hypothetical 2 GW Baltic project 130 km from shore, same 220 kV cable.",
      steps: [
        "I_c = 7.58 A/km × 130 km = 986 A; half at each end: 493 A",
        "Per cable: √3 · 220 kV · √(825² − 493²) A ≈ 252 MW → 8 cables for 2 GW",
        "Charging power ωC'U²L ≈ 376 MVAR per cable → about 3 GVAR of reactors over the 8 cables",
        "HVDC: one ±320 kV (or ±525 kV) link and two converter stations carry the same power with no charging current",
      ],
      result:
        "Eight AC cables with 3 GVAR of compensation against one DC link: at this scale and distance HVDC is the usual " +
        "choice — why the German North Sea clusters far from shore are HVDC, while the Polish Baltic projects, closer " +
        "to shore and smaller, export by HVAC.",
    },
  ],

  realWorldCases: [
    {
      title: "BorWin / DolWin (Germany) — HVDC VSC clusters",
      description:
        "TenneT connects the German North Sea farms far from shore through ±320 kV HVDC VSC links of roughly " +
        "0.8–0.9 GW each, each with an offshore converter platform.",
      takeaway:
        "HVDC becomes the default once the AC option would need many cables and gigavars of compensation.",
    },
  ],

  furtherReading: [
    {
      label: "ENTSO-E TYNDP — Ten-Year Network Development Plan (offshore grid)",
      type: "website",
      url: "https://www.entsoe.eu/publications/tyndp/",
    },
    {
      label: "Bahrman & Johnson — The ABCs of HVDC transmission technologies",
      type: "paper",
      citation: "IEEE Power & Energy Magazine 5 (2007), doi:10.1109/MPAE.2007.329194",
    },
  ],

};
