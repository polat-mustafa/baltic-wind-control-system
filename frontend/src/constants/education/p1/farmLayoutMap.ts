import type { EducationContent } from "../../../types/education";

export const farmLayoutMapEducation: EducationContent = {
  id: "p1.farm-layout-map",
  title: "Farm Layout Map",
  subtitle: "Where each turbine stands and how much energy it makes",
  discipline: "Civil",

  overview:
    "The layout chart shows the 34 turbine positions on a local metric grid, coloured by each turbine's net AEP from " +
    "the PyWake run. The arrow marks the prevailing wind direction. The pattern is the point: turbines facing the " +
    "prevailing wind get clean air and the most energy; those deep inside the array sit in their neighbours' wakes.",

  simpleExplanation:
    "Each dot is a turbine; the darker (or brighter, in the dark theme) the dot, the more energy it makes in a year. " +
    "The edge facing the wind wins. Turbines in the middle are always behind someone, whatever the wind direction.",

  technicalExplanation:
    "Positions are in metres on a flat local grid — never compute wake distances from latitude/longitude directly. " +
    "Electrically the farm is six radial 66 kV strings (6-6-6-6-5-5 turbines) into the offshore substation. A 6-turbine " +
    "string carries 90 MW at its OSS end: I = 90 MW / (√3 · 66 kV) ≈ 787 A at unity power factor, which sets the " +
    "conductor size of the first section (1000 mm² Cu, 825 A datasheet rating, 95 % loaded — 800 mm² at 775 A would " +
    "be overloaded); sections further out carry fewer turbines and use smaller conductors.",

  standards: [
    {
      label: "IEC 60287 — Current rating of electric cables",
      type: "standard",
    },
    {
      label: "DNV-ST-0359 — Subsea power cables for wind power plants",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "I = P / (√3 · U · cos φ)",
      variables: [
        { symbol: "P", name: "Active power carried", unit: "MW" },
        { symbol: "U", name: "Line-to-line voltage", unit: "kV" },
        { symbol: "cos φ", name: "Power factor", unit: "—" },
      ],
      explanation: "Three-phase current; the string's OSS-end section carries the sum of all its turbines.",
    },
  ],

  workedExamples: [
    {
      title: "How many 15 MW turbines per 66 kV string?",
      scenario:
        "15 MW per turbine; first-section cable 1000 mm² Cu XLPE rated 825 A (ABB/NKT 2GM5007 Table 33: 1 m deep, " +
        "20 °C seabed, 1.0 K·m/W).",
      steps: [
        "Per turbine: 15 MW / (√3 × 66 kV) = 131 A",
        "6 turbines: 787 A → 95 % of 825 A (800 mm², 775 A, would be overloaded)",
        "7 turbines: 918 A → over the rating of every section",
      ],
      result:
        "Six turbines per string is the maximum on 1000 mm² at 66 kV — hence 34 turbines in six strings " +
        "(6-6-6-6-5-5). Going to 132 kV array voltage would halve the current for the same power.",
    },
  ],

  realWorldCases: [
    {
      title: "Why 66 kV became the offshore array standard",
      description:
        "With 8–15 MW turbines, 33 kV strings could only carry two to four machines each. Moving to 66 kV doubled the " +
        "power per string for similar cable sizes and became the norm for new offshore farms around 2016–2020.",
      takeaway: "Turbine size drives array voltage; 132 kV arrays are being studied for the next turbine generation.",
    },
  ],

  furtherReading: [
    {
      label: "EMODnet Human Activities — European offshore wind farm data",
      type: "website",
      url: "https://emodnet.ec.europa.eu/en/human-activities",
    },
  ],

  codeReferences: [
    {
      file: "backend/app/services/p1/layout_optimizer.py",
      description: "generate_regular_grid() / generate_staggered_grid() — the two layouts on this tab.",
    },
    {
      file: "backend/app/services/p2/network_model.py",
      description: "STRING_LAYOUT and the graded 500/630/800 mm² array cable specs.",
    },
  ],

};
