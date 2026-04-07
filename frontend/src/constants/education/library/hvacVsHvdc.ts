import type { EducationContent } from "../../../types/education";

export const hvacVsHvdcEducation: EducationContent = {
  id: "library.hvac-vs-hvdc",
  title: "HVAC vs HVDC Export Trade-off",
  subtitle: "When does direct current become cheaper than alternating current?",
  discipline: "Electrical",

  overview:
    "For offshore wind, the choice of export technology comes down to a single question: how far is the project from " +
    "shore? HVAC submarine cables suffer from charging current that grows linearly with length and quadratically with " +
    "voltage — beyond ~70 km the active power capacity drops to nearly zero unless reactive compensation is added " +
    "mid-route. HVDC has none of this problem but pays a fixed cost of two converter stations (~€700–900 M for a 1 GW " +
    "link). The break-even distance for ≥1 GW projects is now ~70–90 km.",

  simpleExplanation:
    "Imagine pumping water through a leaky hose. The longer the hose, the less water comes out the far end because more " +
    "leaks out the sides. AC power has a similar problem with long cables — energy 'leaks' as charging current. If the " +
    "cable is short, AC is fine. If it's very long, you have to convert to DC at both ends (which is expensive but " +
    "doesn't leak), and at some distance the DC option becomes cheaper overall.",

  technicalExplanation:
    "Three-phase HVAC submarine cable is dominated by capacitance C ≈ 200 nF/km. Charging current I_c = 2π·f·C·U·L grows " +
    "with length L, eating into the conductor's thermal budget I_th. For a 220 kV three-core cable rated 800 A: at 50 km " +
    "I_c ≈ 230 A leaves 770 A for active power; at 100 km I_c ≈ 460 A leaves only 660 A. HVDC LCC (line-commutated " +
    "converter) needs reactive compensation and a strong AC system at both ends; HVDC VSC (voltage-source converter, used " +
    "for all modern offshore links) provides black-start capability and decoupled P/Q control but is more expensive per " +
    "MVA. The break-even has shifted in HVDC's favour as VSC technology matures.",

  standards: [
    {
      label: "IEC 62747 — Terminology for voltage-sourced converters (HVDC)",
      type: "standard",
      url: "https://en.wikipedia.org/wiki/High-voltage_direct_current",
    },
    {
      label: "CIGRE TB 533 — HVDC grid feasibility study (free summaries)",
      type: "standard",
      url: "https://www.e-cigre.org/",
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
        "Linear in length and frequency, linear in voltage. Active capacity P_active = √3 · U · √(I_th² − I_c²) drops to " +
        "zero when I_c = I_th — the AC critical length.",
    },
    {
      expression: "L_break ≈ (CAPEX_HVDC,fixed − CAPEX_AC,comp) / (CAPEX_AC,km − CAPEX_HVDC,km)",
      variables: [
        { symbol: "L_break", name: "Break-even distance", unit: "km" },
        { symbol: "CAPEX_HVDC,fixed", name: "Two converter stations", unit: "EUR" },
        { symbol: "CAPEX_AC,comp", name: "AC compensation (shunt reactors etc.)", unit: "EUR" },
      ],
      explanation:
        "First-order trade-off. CIGRE TB 533 reports L_break ≈ 70–90 km for ≥ 1 GW links in 2020s costs; for smaller " +
        "links HVAC remains cheaper to several hundred km because the converter station overhead is too large.",
      reference: "CIGRE TB 533 §6",
    },
  ],

  workedExamples: [
    {
      title: "Baltic Wind 510 MW — HVAC chosen over HVDC",
      scenario:
        "510 MW capacity, 45 km to shore, 220 kV three-core copper cable, C' = 200 nF/km, I_th = 800 A.",
      steps: [
        "I_c = 2π · 50 · 200e-9 · 220,000/√3 · 45 ≈ 360 A",
        "P_active = √3 · 220 · √(800² − 360²) ≈ √3 · 220 · 716 = 273 MVA per cable",
        "Two cables → 546 MVA capacity, comfortably above 510 MW gross",
        "Add 50 MVAR shunt reactor at OSS to compensate excess Q at low generation",
      ],
      result:
        "Two parallel 220 kV three-core cables with onshore + offshore reactor banks comfortably handle the 510 MW farm. " +
        "HVDC would have added €700+ M of converter cost — uneconomic at this distance and capacity.",
    },
    {
      title: "Counter-example: a 2 GW farm 130 km offshore",
      scenario:
        "Hypothetical 2 GW Baltic project 130 km from shore; HVAC option requires multiple cables and large compensation.",
      steps: [
        "Per-cable HVAC capacity at 130 km drops to ~150 MVA → need ≥ 14 cables",
        "Cable cost ~14 × 60 M EUR = 840 M EUR; compensation cost ~150 M EUR",
        "HVDC VSC bipole 2 GW: ~900 M EUR for converters + 1 cable pair (~360 M EUR) = 1.26 G EUR",
      ],
      result:
        "HVDC wins decisively at this scale and distance. Reality check: this is exactly why the German North Sea (BorWin, " +
        "DolWin clusters) is HVDC and the Polish Baltic (closer to shore, smaller individual farms) is HVAC.",
    },
  ],

  realWorldCases: [
    {
      title: "BorWin 5 (Germany) — 900 MW HVDC VSC at 130 km",
      description:
        "Siemens Energy + Petrofac contract worth ~€2.2 G for the offshore platform, converter station and cables. " +
        "Commissioning 2026.",
      takeaway:
        "HVDC has become the default for North Sea projects > 1 GW and > 80 km from shore.",
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

  relatedLessons: ["lesson-009"],
};
