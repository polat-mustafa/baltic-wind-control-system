import type { EducationContent } from "../../../types/education";

export const cableCrossSectionEducation: EducationContent = {
  id: "library.cable-cross-section",
  title: "Cable Cross-Section & Graded Design",
  subtitle: "Why strings near the OSS need fatter cables than strings at the edge",
  discipline: "Electrical",

  overview:
    "Offshore array cables are not all the same size. The cable closest to the offshore substation (OSS) carries " +
    "the power of every turbine on the string — up to 6 × 15 MW = 90 MW — and therefore needs the largest " +
    "conductor cross-section to stay within its thermal rating. The cable to the last turbine carries only its own " +
    "15 MW, so a much smaller section is enough. This 'graded' or 'tapered' design buys the large, expensive " +
    "section only where the current needs it.",

  simpleExplanation:
    "Picture a river with tributaries. The stream near the source carries a trickle — you only need a narrow pipe. " +
    "But where all tributaries join near the mouth, you need a wide river. Cable strings work the same way: near " +
    "each turbine at the far end, only one turbine's power flows, so a small cable is enough. Near the OSS, all six " +
    "turbines' power flows through the same cable — that one must be much larger. Using large cables everywhere " +
    "wastes money on the sections that only carry a little power.",

  technicalExplanation:
    "The current rating of a cable follows IEC 60287: Joule heating (I²R) against the heat that can flow through " +
    "insulation, armour and seabed. The platform uses the 66 kV three-core Cu XLPE ratings of the ABB/NKT brochure " +
    "2GM5007 rev 5, Table 33 — one cable 1 m deep in a 20 °C seabed of 1.0 K·m/W: 500 mm² 655 A, 630 mm² 715 A, " +
    "800 mm² 775 A, 1000 mm² 825 A. Design rule (backend `_get_cable_grade`): each segment gets the smallest section " +
    "whose rating carries the turbines downstream at rated power, unity power factor and 1.0 p.u. — 15 MW / " +
    "(√3 × 66 kV) = 131 A per turbine. 1–4 turbines (≤ 525 A) → 500 mm²; 5 turbines (656 A) → 630 mm² (500 mm² is " +
    "1 A short); 6 turbines (787 A) → 1000 mm², because 800 mm² carries only 775 A. Seven turbines (918 A) exceed " +
    "every section, so a string holds at most six. The rule assumes the turbines run near unity power factor while " +
    "the STATCOM and reactors handle reactive power, as in normal operation. If the turbines also delivered their " +
    "full reactive capability (±0.33 p.u., 15.8 MVA) at 0.95 p.u. voltage, six would draw 873 A — more than any " +
    "listed section: such a design needs a project-specific IEC 60287 rating (a colder seabed raises it) or " +
    "five-turbine strings. Copper is used because it carries the same current with a smaller section than " +
    "aluminium.",

  standards: [
    {
      label: "IEC 60287 — Electric cables: Calculation of the current rating",
      type: "standard",
    },
    {
      label: "IEC 60228 — Conductors of insulated cables (DC resistance at 20 °C)",
      type: "standard",
    },
    {
      label: "IEC 60840 — Power cables with extruded insulation 30–150 kV",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "I_string(n) = n × P_turbine / (√3 × V_LL × cos φ)",
      variables: [
        { symbol: "I_string(n)", name: "Current in a segment that carries n turbines", unit: "A" },
        { symbol: "n", name: "Turbines beyond this cable segment", unit: "—" },
        { symbol: "P_turbine", name: "Individual turbine rated power (15 MW)", unit: "W" },
        { symbol: "V_LL", name: "Array voltage (66 kV)", unit: "V" },
        { symbol: "cos φ", name: "Power factor (1.0 in the model's design rule)", unit: "—" },
      ],
      explanation:
        "At n = 1: I = 15e6 / (√3 × 66e3) ≈ 131 A. " +
        "At n = 6: I = 787 A → 1000 mm² Cu (825 A, 95 % loaded); 800 mm² (775 A) would be overloaded.",
    },
    {
      expression: "I_rated(IEC 60287) = √[(Δθ − Wd·T_insul) / (R·(T_total))]",
      variables: [
        { symbol: "Δθ", name: "Allowed conductor temperature rise (max 90°C − ambient)", unit: "K" },
        { symbol: "Wd", name: "Dielectric loss per unit length", unit: "W/m" },
        { symbol: "T_insul", name: "Thermal resistance of insulation", unit: "K·m/W" },
        { symbol: "R", name: "AC conductor resistance at max temp", unit: "Ω/m" },
        { symbol: "T_total", name: "Total thermal resistance (insulation + sheath + burial)", unit: "K·m/W" },
      ],
      explanation:
        "IEC 60287 calculates the steady-state current that maintains conductor temperature at or below 90°C " +
        "for XLPE-insulated cables. The burial conditions matter: a datasheet rating holds for its reference depth, " +
        "seabed temperature and soil thermal resistivity, and a real project recalculates it for its own route.",
      reference: "IEC 60287-1-1 §1.4",
    },
  ],

  workedExamples: [
    {
      title: "Cross-section selection for a 6-turbine 66 kV string",
      scenario:
        "Six 15 MW turbines on one feeder string, 1.5 km between turbines (SB-510 model), datasheet ratings " +
        "(1 m deep, 20 °C seabed, 1.0 K·m/W).",
      steps: [
        "Turbine current: I_T = 15e6 / (√3 × 66e3) ≈ 131 A (unity power factor)",
        "Far-end segments, 1–4 turbines: 131–525 A → 500 mm² Cu (655 A)",
        "Fifth segment from the end, 5 turbines: 656 A → 630 mm² Cu (715 A, 92 %)",
        "Segment to the OSS, 6 turbines: 787 A → 1000 mm² Cu (825 A, 95 %); 800 mm² (775 A) is too small",
        "Bill of materials per 6-turbine string: 6.0 km of 500 mm², 1.5 km of 630 mm², 1.5 km of 1000 mm²",
      ],
      result:
        "SB-510 (6-6-6-6-5-5): 24 segments of 500 mm², 6 of 630 mm² and 4 of 1000 mm². The P2 load flow puts the " +
        "1000 mm² OSS segments at 95 % at 510 MW — the binding cables of the array.",
    },
  ],

  codeReferences: [
    {
      file: "frontend/src/lib/layout/cables.ts",
      description: "ARRAY_SECTIONS and sectionFor() — the smallest 66 kV section whose rating carries the turbines downstream; routeCables() grades every segment of the layout.",
    },
    {
      file: "backend/app/services/p2/network_model.py",
      description: "CableSpec — resistance at 90 °C with the IEC 60287 ac factor, reactance, capacitance and rating of each section, with their sources.",
    },
  ],

  realWorldCases: [
    {
      title: "Cables dominate offshore wind insurance losses",
      description:
        "GCube's review of a decade of claims (2010–2020) found subsea cables behind about 30 % of offshore wind claims and over half of the money paid out; Allianz reported cable failures in 53 % of its offshore wind claims for 2014–2020.",
      takeaway: "A cable sized with no thermal margin, or damaged in installation, is the most expensive single failure on an offshore farm — the rating table is a safety limit, not a target.",
      source: "GCube Insurance, Uncharted Waters (2020); Allianz Global Corporate & Specialty (2021)",
    },
  ],

  furtherReading: [
    {
      label: "ABB (now NKT) — XLPE Submarine Cable Systems, 2GM5007 rev 5",
      type: "website",
      url: "https://tethys.pnnl.gov/sites/default/files/publications/ABB_et_al_2019.pdf",
    },
    {
      label: "CIGRE TB 490 — Recommendations for testing of long AC submarine cables with extruded insulation",
      type: "website",
      url: "https://www.e-cigre.org/",
    },
  ],

};
