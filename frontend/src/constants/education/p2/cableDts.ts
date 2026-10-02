import type { EducationContent } from "../../../types/education";

export const cableDtsEducation: EducationContent = {
  id: "p2.cable-dts",
  title: "Export Cable Temperature Monitoring (DTS)",
  subtitle: "What the fibre measures, what limits the cable, and how long it can be overloaded",
  discipline: "Electrical",

  overview:
    "Each 45 km, 220 kV export circuit carries an optical fibre. A distributed temperature sensing (DTS) " +
    "interrogator reads its temperature along the whole route. The cable's limit, though, is its conductor " +
    "temperature (90 °C for XLPE), which nobody can measure directly. A thermal model turns the fibre reading " +
    "and the current into a conductor estimate, and from that into a rating that follows the real ambient.",

  simpleExplanation:
    "The fibre is a thermometer that runs the full length of the cable. The copper inside is hotter than the " +
    "fibre, so the system adds the calculated difference. The worst place is not the long subsea run but the " +
    "few hundred metres where the cable climbs the J-tube on the platform: in the air, it cools poorly.",

  technicalExplanation:
    "IEC 60287-1-1 sets the heat balance. The Joule loss I²R_AC grows with temperature, since R_AC at 90 °C is " +
    "27 % above its 20 °C value. For XLPE from U0 = 127 kV the dielectric loss ωCU0²tanδ must also be counted; " +
    "that is exactly this cable's 220/√3 kV, and it adds about 1 W/m per core even with no current. The " +
    "conductor runs hotter than the fibre by the loss times the internal thermal resistance. Zones differ only " +
    "in their external resistance. The rating at a given ambient is the current that brings the worst zone to " +
    "90 °C; here the J-tube sets the rating for the whole 45 km. Above that rating the cable still takes hours " +
    "to heat up, because copper, insulation, armour and the soil around it store heat. IEC 60853 reduces this " +
    "to a thermal ladder. After an N-1 trip, this heat storage is the time the operator has to curtail.",

  standards: [
    { label: "IEC 60287-1-1 — Current rating: losses, including dielectric loss from U0 = 127 kV for XLPE", type: "standard" },
    { label: "IEC 60287-2-1 — Thermal resistances", type: "standard" },
    { label: "IEC 60853-2 — Cyclic and emergency current rating", type: "standard" },
    { label: "IEC 62067 — Extruded cables above 150 kV (XLPE: 90 °C continuous)", type: "standard" },
  ],

  formulas: [
    {
      expression: "T_c − T_amb = (W_c + ½W_d)·T_int + (W_c + W_d)·R_ext",
      variables: [
        { symbol: "W_c", name: "Joule loss I²·R_AC(T_c) per core", unit: "W/m" },
        { symbol: "W_d", name: "Dielectric loss ωCU0²tanδ ≈ 0.96", unit: "W/m" },
        { symbol: "T_int", name: "Conductor → fibre (assumed 0.5)", unit: "K·m/W" },
        { symbol: "R_ext", name: "Fibre → ambient, per zone", unit: "K·m/W" },
      ],
      explanation: "Steady state per conductor. The fibre sees only the second term.",
    },
    {
      expression: "I_rating = √[(90 − T_amb − W_d(½T_int + R_ext)) / (R_AC,90·(T_int + R_ext))]",
      variables: [
        { symbol: "R_AC,90", name: "AC resistance at 90 °C, 0.0233", unit: "Ω/km" },
        { symbol: "T_amb", name: "Ambient (one value for the route)", unit: "°C" },
      ],
      explanation: "Current that holds the conductor at 90 °C. The lowest zone value is the route rating.",
    },
  ],

  workedExamples: [
    {
      title: "Why is the J-tube the limit?",
      scenario: "950 A per circuit, 15 °C ambient. R_ext: J-tube 2.92, subsea 2.09 K·m/W.",
      steps: [
        "W_c at 90 °C = 950² × 0.0233 × 10⁻³ ≈ 21.0 W/m per core",
        "J-tube: (21.0 + 0.5) × 0.5 + 22.0 × 2.92 ≈ 75 K → 90 °C",
        "Subsea: R_ext is 1/1.4 of the J-tube's, so the rise is ≈ 56 K → 71 °C",
      ],
      result:
        "0.3 km of cable in air limits all 45 km. Better J-tube cooling would raise the rating of the whole circuit.",
    },
  ],

  realWorldCases: [],

  furtherReading: [
    {
      label: "CIGRE TB 756 — Thermal monitoring of cable circuits and grid operators' use of dynamic rating systems",
      type: "website",
      citation: "CIGRE, 2019",
    },
  ],

  codeReferences: [
    { file: "backend/app/services/p2/cable_dts.py", description: "Losses, fibre and conductor temperatures, zone ratings, N-1 thermal ladder." },
  ],
};
