import type { EducationContent } from "../../../types/education";

export const sensorArchitectureEducation: EducationContent = {
  id: "library.sensor-architecture",
  title: "Sensor Architecture & Measurement Chain",
  subtitle: "What instruments are installed, where, and to what standard",
  discipline: "Control",

  overview:
    "A 510 MW offshore wind farm contains approximately 300–350 field instruments across 34 turbines, the offshore " +
    "substation, and the 45 km export cable. These sensors form the measurement chain from physical process " +
    "(wind, temperature, vibration, current) to the SCADA historian. Every sensor is specified to an IEC standard " +
    "and is mapped to at least one IEC 61850 logical node in the substation automation system. " +
    "This primer documents the full sensor register for Baltic Wind Alpha.",

  simpleExplanation:
    "A wind turbine is like a patient in intensive care — it has sensors for everything. Two anemometers measure " +
    "the wind (in case one fails), four thermometers watch the bearings and gearbox, two vibration sensors listen " +
    "for bearing damage starting to form, and dozens of digital inputs report every switch position and relay state. " +
    "All of this data arrives at the control room every second, and the SCADA historian stores it forever. " +
    "Without accurate sensors, you are flying blind — you won't know a bearing is overheating until it's already seized.",

  technicalExplanation:
    "Sensor specifications follow three layers: (1) physical measurement principle and accuracy class " +
    "(e.g. IEC 61400-12-1 Class 1A cup anemometer, ±0.2 m/s accuracy); " +
    "(2) signal conditioning and transmission (4–20 mA loop, PT100 3-wire, IEPE accelerometer, RS-485 Modbus); " +
    "(3) IEC 61850 logical node mapping (WMET1 for met data, WTHI1 for temperatures, MMXU1 for power measurements). " +
    "Current and voltage transformers in the OSS are specified per IEC 61869 accuracy classes: " +
    "metering class 0.5 for revenue metering, protection class 5P20 for differential and overcurrent protection. " +
    "The export cable uses Raman-backscatter DTS (Distributed Temperature Sensing) along an optical fibre " +
    "integrated into the cable armour — this gives a continuous temperature profile at 1 m spatial resolution " +
    "every 1–5 minutes, enabling hot-spot detection and dynamic cable rating.",

  standards: [
    {
      label: "IEC 61400-12-1 — Power performance measurements (anemometer requirements)",
      type: "standard",
    },
    {
      label: "ISO 10816-21 — Vibration measurement on wind turbines",
      type: "standard",
    },
    {
      label: "IEC 61869-2 — Current transformers (accuracy classes)",
      type: "standard",
    },
    {
      label: "IEC 61869-3 — Voltage transformers (accuracy classes)",
      type: "standard",
    },
    {
      label: "IEC 61850-7-4 — Logical nodes for power systems (WMET, WTHI, MMXU)",
      type: "standard",
    },
    {
      label: "IEC 60287 — Current rating (DTS thermal model input)",
      type: "standard",
    },
  ],

  formulas: [
    {
      expression: "σ_anem = √(σ_cal² + σ_icing² + σ_mounting²)",
      variables: [
        { symbol: "σ_anem", name: "Combined anemometer uncertainty (RSS)", unit: "%" },
        { symbol: "σ_cal", name: "Calibration uncertainty (Class 1A: ≤0.5%)", unit: "%" },
        { symbol: "σ_icing", name: "Icing bias (Baltic Sea: 0–2%)", unit: "%" },
        { symbol: "σ_mounting", name: "Nacelle mounting correction uncertainty (2–3%)", unit: "%" },
      ],
      explanation:
        "Nacelle anemometers suffer from rotor wake disturbance — the nacelle body and hub distort the wind field " +
        "by 5–15%. A transfer function from the nacelle anemometer to free-stream speed is derived during " +
        "power-performance testing per IEC 61400-12-2. Redundant met-mast (or lidar) measurement eliminates " +
        "this systematic error for AEP assessment.",
    },
    {
      expression: "T_hotspot(x) = T_amb + I² · R_AC · R_th · Z_f(x)",
      variables: [
        { symbol: "T_hotspot(x)", name: "Cable temperature at position x", unit: "°C" },
        { symbol: "T_amb", name: "Ambient sea-bottom temperature", unit: "°C" },
        { symbol: "R_AC", name: "AC resistance at operating temperature", unit: "Ω/m" },
        { symbol: "R_th", name: "Thermal resistance (IEC 60287)", unit: "K·m/W" },
        { symbol: "Z_f(x)", name: "Zone factor (1.0 buried; 1.4 J-tube)", unit: "—" },
      ],
      explanation:
        "DTS measures actual conductor temperature directly. The IEC 60287 thermal model predicts the expected " +
        "profile from current; DTS validation against the model identifies partial failures (e.g. loss of burial " +
        "in a storm, increased sediment thermal resistivity).",
    },
  ],

  workedExamples: [
    {
      title: "Full sensor register — Baltic Wind Alpha 510 MW",
      scenario:
        "34 turbines (V236-15.0 MW), 1 OSS (6 bays), 45 km three-core 220 kV export cable.",
      steps: [
        "=== PER TURBINE (34 units × 11 sensors = 374 instrument tags) ===",
        "1. Nacelle anemometer: IEC 61400-12-1 Class 1A cup, ±0.2 m/s, 4–20 mA → IEC 61850: WMET1.WdSpd",
        "2. Met-mast (or lidar) reference anemometer: same class, separate mounting → WMET1.WdSpd backup",
        "3. Wind vane: potentiometer type, ±2°, 4–20 mA → WMET1.WdDir",
        "4. Main bearing RTD: PT100 3-wire, –40 to +120°C, ±0.5°C → WTHI1.TmpSv[1]",
        "5. Gearbox HS bearing RTD: PT100, –40 to +120°C, ±0.5°C → WTHI1.TmpSv[2]",
        "6. Gearbox LS bearing RTD: PT100 → WTHI1.TmpSv[3]",
        "7. Generator winding RTD: PT100 (Class B per IEC 60034-1) → WTHI1.TmpSv[4]",
        "8. Main bearing accelerometer: IEPE, 0–2 kHz, 50 mV/g, ISO 10816-21 → WTUR1.VibVl",
        "9. Gearbox accelerometer: IEPE, 0–5 kHz, 100 mV/g → WTUR1.VibVl[2]",
        "10. Pitch hydraulic pressure: strain-gauge, 0–300 bar, 4–20 mA → WPPC1.PtchAnglSetPt",
        "11. Rotor encoder: absolute optical, 16-bit, SSI interface → WTUR1.RotSpd",
        "",
        "=== PER OSS BAY (6 bays × 5 instruments = 30 instrument tags) ===",
        "1–2. Current transformers: IEC 61869-2, ratio 1000/1 A, class 0.5 (metering) / 5P20 (protection)",
        "3–4. Voltage transformers: IEC 61869-3, ratio 66/0.1 kV, class 0.5 / 3P",
        "5. Digital input module: 16DI, 24 VDC, mapping to breaker/disconnector auxiliary contacts",
        "",
        "=== EXPORT CABLE (3 DTS sections + 2 joint monitors = 5 instruments) ===",
        "1. DTS section 1 (0–15 km): Raman backscatter, ±0.1°C, 1 m resolution, 5-min scan",
        "2. DTS section 2 (15–30 km): same spec",
        "3. DTS section 3 (30–45 km): same spec",
        "4. Joint box temperature monitor at km 15: PT100 in potted enclosure, 4–20 mA via cable piggyback",
        "5. Joint box temperature monitor at km 30: same spec",
      ],
      result:
        "Total sensor count: 374 (turbines) + 30 (OSS bays) + 5 (cable) = 409 instrument tags. " +
        "Note: this count covers primary process sensors only — it excludes smoke/fire detectors, " +
        "CCTV, access-control systems, and met-mast meteorological instruments.",
    },
  ],

  realWorldCases: [
    {
      title: "Hornsea 2 — DTS-enabled dynamic cable rating",
      description:
        "One of the first large offshore projects to use DTS data in real time to increase the export cable " +
        "dynamic rating (IDR) during winter periods when seabed temperatures drop. The DTS enabled a ~7% increase " +
        "in cable ampacity compared to static winter rating, capturing ~2% additional AEP annually.",
      takeaway:
        "DTS is not just a safety monitor — it is a revenue-generation tool when integrated with a dynamic " +
        "cable rating algorithm (IEC 60287 + real-time temperature input).",
    },
    {
      title: "Bearing vibration diagnosis — Anholt (Denmark)",
      description:
        "High-frequency vibration data from main bearing accelerometers detected an inner race spall developing " +
        "at 3× bearing pass frequency 8 weeks before the bearing seized. Planned bearing exchange avoided ~€1.2M " +
        "in unplanned repair cost (crane vessel, blade removal, extended downtime).",
      takeaway:
        "Condition monitoring sensor investment is justified by avoided unplanned maintenance costs — the bearing " +
        "sensor payback period on a 15 MW turbine is typically < 1 year.",
    },
  ],

  furtherReading: [
    {
      label: "IEC 61400-25 — Communications for wind power plants (sensor-to-SCADA chain)",
      type: "website",
      url: "https://en.wikipedia.org/wiki/IEC_61400",
    },
    {
      label: "ISO 10816-21: 2015 — Vibration measurement on wind turbines",
      type: "website",
      url: "https://www.iso.org/standard/63392.html",
    },
    {
      label: "Netzsch — Raman DTS for power cable monitoring (application note)",
      type: "website",
      url: "https://www.netzsch.com/",
    },
  ],

  relatedLessons: ["lesson-009", "lesson-010"],
};
