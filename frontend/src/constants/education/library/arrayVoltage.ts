import type { EducationContent } from "../../../types/education";

export const arrayVoltageEducation: EducationContent = {
  id: "library.array-voltage",
  title: "Array Voltage Selection — Why 66 kV?",
  subtitle: "How the offshore wind industry moved from 33 kV to 66 kV — and why 132 kV is not the next step",
  discipline: "Electrical",

  overview:
    "The array voltage (the voltage level inside the wind farm, from turbine transformer to OSS) is one of the most " +
    "consequential design choices in an offshore wind project. Too low, and you need many parallel feeder cables " +
    "eating into the OSS busbar space and cable CAPEX. Too high, and nacelle transformers become impractically large " +
    "and heavy. The industry converged on 33 kV before 2010 and has been transitioning to 66 kV for large farms since " +
    "~2015. For a 510 MW project like SB-510, 66 kV is the clear choice.",

  simpleExplanation:
    "Power = Voltage × Current. If you double the voltage, you halve the current for the same power — and because " +
    "cables are sized by current, the same cable carries twice the power. Going from 33 kV to 66 kV therefore halves " +
    "the number of feeder strings, halves the number of switchgear bays at the OSS and cuts the cable losses to a " +
    "quarter for the same power.",

  technicalExplanation:
    "A three-phase array cable rated I_max carries P = √3 × V_LL × I_max × cos φ. Doubling V_LL doubles P for the " +
    "same cross-section and current rating (the 66 kV ratings of three-core Cu XLPE cables are the same as at " +
    "33 kV for a given section, ABB/NKT 2GM5007 rev 5 Table 33: 10–90 kV). Moving from 33 kV to 66 kV: (1) halves " +
    "the number of feeder strings for the same farm, (2) cuts I²R losses to a quarter (I halves), (3) halves the " +
    "OSS feeder bays. The 66 kV turbine transformer and switchgear in the tower are larger than 33 kV units, which " +
    "the 15 MW class accommodates. Above 66 kV, three-core array cables, turbine switchgear and transformers become " +
    "special products rather than series products, so 66 kV is the current industry level.",

  standards: [
    {
      label: "IEC 60502-2 — Power cables with extruded insulation (6 kV to 30 kV)",
      type: "standard",
    },
    {
      label: "IEC 60840 — Power cables with extruded insulation (30 kV to 150 kV)",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "P_string = √3 × V_LL × I_max",
      variables: [
        { symbol: "P_string", name: "Maximum power per feeder string", unit: "MW" },
        { symbol: "V_LL", name: "Line-to-line voltage", unit: "kV" },
        { symbol: "I_max", name: "Cable rated current (thermally limited)", unit: "A" },
      ],
      explanation:
        "Largest section in the model, 1000 mm² Cu at 825 A: at 66 kV P_string = √3 × 66 × 0.825 = 94.3 MW → six " +
        "15 MW turbines (SB-510: 6-6-6-6-5-5); at 33 kV 47.2 MW → three turbines per string, 12 strings for 34 turbines.",
    },
    {
      expression: "P_loss = 3 × I² × R × L",
      variables: [
        { symbol: "P_loss", name: "Three-phase resistive cable loss", unit: "W" },
        { symbol: "I", name: "Current (halved at double voltage for same power)", unit: "A" },
        { symbol: "R", name: "AC resistance per unit length", unit: "Ω/km" },
        { symbol: "L", name: "Cable length", unit: "km" },
      ],
      explanation:
        "Losses scale as I². 45 MW through 1.5 km of 630 mm² Cu (R_AC,90 = 0.0395 Ω/km): at 66 kV I = 394 A and " +
        "P_loss = 3 × 394² × 0.0395 × 1.5 = 27.6 kW; at 33 kV I = 787 A — beyond the 715 A rating — and 110 kW.",
    },
  ],

  workedExamples: [
    {
      title: "String count comparison: 510 MW at 33 kV vs 66 kV",
      scenario: "34 × 15 MW turbines (510 MW), largest cable 1000 mm² Cu (825 A), unity power factor.",
      steps: [
        "33 kV: 131 A × 2 = 262 A per turbine → ⌊825 / 262⌋ = 3 turbines per string → ⌈34 / 3⌉ = 12 strings",
        "66 kV: 131 A per turbine → ⌊825 / 131⌋ = 6 turbines per string → ⌈34 / 6⌉ = 6 strings",
        "OSS feeder bays: 12 (33 kV) vs 6 (66 kV)",
        "Same cable section, half the current per MW: a quarter of the I²R loss for the same power",
      ],
      result:
        "66 kV halves the strings, the OSS bays and the trenching for the cables to the OSS, and quarters the array " +
        "losses — the reason the industry moved to it for 10–15 MW turbines.",
    },
  ],

  realWorldCases: [
    {
      title: "Baltic Power (Poland) — 76 × Vestas V236-15.0 MW",
      description:
        "The ≈ 1.1 GW Polish Baltic project uses the same turbine class as SB-510's reference with a 66 kV array.",
      takeaway: "66 kV is the array voltage of today's 15 MW-class projects, including in the Polish Baltic.",
    },
  ],

  furtherReading: [
    {
      label: "ABB (now NKT) — XLPE Submarine Cable Systems, 2GM5007 rev 5 (ratings and data for 10–420 kV)",
      type: "website",
      url: "https://tethys.pnnl.gov/sites/default/files/publications/ABB_et_al_2019.pdf",
    },
  ],

};
