/**
 * Isometric schematic layout — part rectangles, labels, leader lines.
 *
 * Coordinate system: SVG viewBox 1200×700, origin top-left.
 * The isometric projection is emulated by shearing group transforms; each
 * sub-part is authored here in flat 2D and the group wrapping them applies
 * the tilt ("matrix(1, -0.18, -0.9, -0.18, ...)" for a 30° iso skew).
 *
 * Parts reuse the TurbinePartId union from turbinePartEducation so clicking
 * on the schematic sets the same global selection and the 3D camera still
 * flies to the corresponding mesh.
 */

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

export interface SchematicCitation {
  source: string;
  url: string;
}

export interface SchematicPart {
  id: TurbinePartId;
  /** Rectangle in flat (pre-iso) local space. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Display label (may differ from partId). */
  label: string;
  /** One-line purpose shown under the label. */
  sublabel?: string;
  /** Leader-line tip — where the callout line attaches to the viewBox. */
  callout?: { x: number; y: number };
  /** Rendering hint — "metal", "winding", "tank", "cabinet", "cooling". */
  tone: "metal" | "winding" | "tank" | "cabinet" | "cooling" | "rotating" | "structural";
  /** Published sources backing the sublabel / rated values. */
  cite?: SchematicCitation[];
  /** Functional group tags — used by the Focus dropdown to dim non-matching parts. */
  groups?: Array<"drivetrain" | "electrical" | "hydraulic" | "cooling" | "safety" | "maintenance" | "structural">;
}

/**
 * Nacelle interior schematic — view is from above, port-side cut open.
 *
 * Layout (left = rotor side, right = rear of nacelle):
 *   [Rotor] → [Main bearing] → [Shaft/brake] → [Gearbox] → [Coupling] →
 *   [Generator] → [Converter] → [Transformer]
 *
 * Above the drivetrain: crane rail, lightning conductor, control cabinets.
 * Below:                 HPU, oil cooler, cable routing, yaw brakes, UPS.
 */
const CITE_V236 = { source: "thewindpower.net — V236-15 MW datasheet", url: "https://www.thewindpower.net/turbine_en_1798_vestas_v236-15-0-mw.php" };
const CITE_ZF = { source: "WindSystemsMag — Vestas/ZF powertrain launch", url: "https://www.windsystemsmag.com/vestas-zf-wind-power-launch-serially-produced-powertrain/" };
const CITE_PMSG = { source: "NREL TP-84919 — MS-PMSG 96 % η", url: "https://docs.nrel.gov/docs/fy23osti/84919.pdf" };
const CITE_TRANSFORMER = { source: "IEC 60076-14 — liquid-filled 66 kV transformer", url: "https://www.npcelectric.com/transformers/66kv-69kv-power-transformer.html" };
const CITE_CONVERTER = { source: "Wiley Wind Energy we.2499 — full-power converter", url: "https://onlinelibrary.wiley.com/doi/full/10.1002/we.2499" };
const CITE_IEC_61400_24 = { source: "IEC 61400-24 — lightning protection", url: "https://webstore.iec.ch/publication/26327" };
const CITE_IEC_62040 = { source: "IEC 62040-1 — UPS safety", url: "https://webstore.iec.ch/publication/32136" };

export const NACELLE_SCHEMATIC_PARTS: SchematicPart[] = [
  // ── Main driveline (left → right) ─────────────────────────────
  { id: "hub",       x:  20, y: 260, w:  80, h: 120, label: "Rotor Hub",          sublabel: "Pitch system × 3",       tone: "rotating",    callout: { x:  60, y: 210 },
    groups: ["drivetrain", "structural"], cite: [CITE_V236] },
  { id: "bearing",   x: 110, y: 290, w:  55, h:  70, label: "Main Bearing",       sublabel: "SKF TQO spherical",      tone: "rotating",    callout: { x: 138, y: 240 },
    groups: ["drivetrain"], cite: [CITE_ZF] },
  { id: "shaft",     x: 170, y: 305, w: 110, h:  40, label: "Main Shaft",         sublabel: "Forged 42CrMo4",         tone: "metal",       callout: { x: 225, y: 265 },
    groups: ["drivetrain"] },
  { id: "brake",     x: 285, y: 295, w:  40, h:  60, label: "Rotor Brake",        sublabel: "Hydraulic caliper",      tone: "metal",       callout: { x: 305, y: 250 },
    groups: ["drivetrain", "safety", "hydraulic"] },
  { id: "gearbox",   x: 330, y: 250, w: 170, h: 150, label: "3-Stage Gearbox",    sublabel: "48:1 planetary · ZF",    tone: "rotating",    callout: { x: 415, y: 210 },
    groups: ["drivetrain"], cite: [CITE_ZF] },
  { id: "coupling",  x: 505, y: 310, w:  60, h:  50, label: "Flexible Coupling",  sublabel: "Torsion-isolating",      tone: "metal",       callout: { x: 535, y: 260 },
    groups: ["drivetrain"] },
  { id: "generator", x: 570, y: 250, w: 180, h: 170, label: "PMSG Generator",     sublabel: "15 MW · ≈460 rpm @ rated", tone: "winding",   callout: { x: 660, y: 210 },
    groups: ["drivetrain", "electrical"], cite: [CITE_PMSG] },
  { id: "converter", x: 760, y: 260, w: 120, h: 140, label: "Power Converter",    sublabel: "Dual IGBT · 4-quadrant", tone: "cabinet",     callout: { x: 820, y: 220 },
    groups: ["electrical"], cite: [CITE_CONVERTER] },
  { id: "transformer", x: 890, y: 260, w: 100, h: 140, label: "Step-Up Transformer", sublabel: "0.69 kV → 66 kV · Dyn11", tone: "cabinet", callout: { x: 940, y: 220 },
    groups: ["electrical"], cite: [CITE_TRANSFORMER] },

  // ── Upper deck — crane, lightning, cabinets ──────────────────
  { id: "crane_rail",        x: 110, y:  90, w: 870, h:  30, label: "Overhead Crane Rail",     sublabel: "10 t SWL · EN 13001",     tone: "structural", callout: { x: 545, y:  70 },
    groups: ["maintenance", "structural"] },
  { id: "lightning_conductor", x: 950, y: 130, w:  20, h: 120, label: "Lightning Conductor",   sublabel: "IEC 61400-24 LPL I",      tone: "metal",      callout: { x: 1020, y: 160 },
    groups: ["safety"], cite: [CITE_IEC_61400_24] },
  { id: "control_cabinet",   x: 130, y: 150, w: 160, h:  90, label: "Control Cabinet",         sublabel: "TCS + Safety PLC · SIL 2", tone: "cabinet",   callout: { x: 210, y: 130 },
    groups: ["electrical", "safety"] },
  { id: "ups",               x: 300, y: 150, w: 100, h:  90, label: "UPS",                     sublabel: "6.6 kWh · 15 min backup", tone: "cabinet",    callout: { x: 350, y: 130 },
    groups: ["electrical", "safety"], cite: [CITE_IEC_62040] },

  // ── Lower deck — HPU, oil cooler, cables, yaw, fire ──────────
  { id: "hpu",            x: 130, y: 440, w: 140, h:  80, label: "Hydraulic Power Unit",  sublabel: "Pitch + brake + yaw · 210 bar", tone: "tank",    callout: { x: 200, y: 560 },
    groups: ["hydraulic"] },
  { id: "oil_cooler",     x: 280, y: 440, w: 140, h:  80, label: "Oil Cooler",            sublabel: "Gearbox + gen. coolant",  tone: "cooling", callout: { x: 350, y: 560 },
    groups: ["cooling"] },
  { id: "cable_routing",  x: 430, y: 440, w: 160, h:  80, label: "Cable Routing",         sublabel: "Twist loop ±3½ turns",    tone: "cabinet", callout: { x: 510, y: 560 },
    groups: ["electrical", "maintenance"] },
  { id: "yaw_brake",      x: 600, y: 440, w: 140, h:  80, label: "Yaw Bearing & Brakes",  sublabel: "4 × hydraulic calipers · EN 13849", tone: "metal", callout: { x: 670, y: 560 },
    groups: ["hydraulic", "safety"] },
  { id: "fire_suppression", x: 750, y: 440, w: 130, h:  80, label: "Fire Suppression",    sublabel: "HFC-227ea · ISO 14520",   tone: "cabinet", callout: { x: 815, y: 560 },
    groups: ["safety"] },
  { id: "bedplate",       x: 890, y: 440, w: 100, h:  80, label: "Bedplate",              sublabel: "Cast GGG-40 mainframe",   tone: "structural", callout: { x: 940, y: 560 },
    groups: ["structural"] },
];

/** Focus modes for the Focus dropdown — highlights parts matching the selected functional group. */
export const FOCUS_MODES = [
  { id: "all",         label: "All systems",       groups: null },
  { id: "drivetrain",  label: "Drivetrain / Power", groups: ["drivetrain", "electrical"] as const },
  { id: "thermal",     label: "Thermal",            groups: ["cooling"] as const },
  { id: "safety",      label: "Safety / Emergency", groups: ["safety"] as const },
  { id: "maintenance", label: "Maintenance access", groups: ["maintenance", "structural"] as const },
] as const;
export type FocusModeId = typeof FOCUS_MODES[number]["id"];

/** Tone → stroke / fill palette. Matches the 3D PBR material families. */
export const TONE_STYLES: Record<SchematicPart["tone"], { fill: string; stroke: string; hatch?: string }> = {
  metal:      { fill: "#1f2937", stroke: "#64748b", hatch: "#334155" },
  winding:    { fill: "#2a1a0a", stroke: "#c2410c" },                    // copper
  tank:       { fill: "#102030", stroke: "#3b82f6" },                    // hydraulic oil
  cabinet:    { fill: "#0f1722", stroke: "#94a3b8" },
  cooling:    { fill: "#082030", stroke: "#22d3ee" },
  rotating:   { fill: "#18222f", stroke: "#eab308" },                    // amber — moving parts
  structural: { fill: "#0b141f", stroke: "#475569" },
};

// ── P&ID-style functional connections ────────────────────────────
//
// Colour conventions match plant piping & instrumentation diagrams:
//   coolant      → cyan   (oil / water cooling circuit)
//   hydraulic    → orange (pressurised oil — pitch / brake / yaw)
//   electrical_mv → red   (medium voltage, 66 kV class)
//   electrical_lv → slate (low voltage, 0.69 kV class)
//   data         → green  (fiber / CAN bus / IEC 61850 MMS)

export type ConnectionKind =
  | "hydraulic"
  | "electrical_lv"
  | "electrical_mv"
  | "coolant"
  | "data";

export interface SchematicConnection {
  from: TurbinePartId;
  to: TurbinePartId;
  kind: ConnectionKind;
}

export const CONNECTION_STYLES: Record<ConnectionKind, { stroke: string; label: string }> = {
  hydraulic:    { stroke: "#fb923c", label: "Hydraulic (210 bar)" },
  electrical_lv:{ stroke: "#94a3b8", label: "LV 0.69 kV" },
  electrical_mv:{ stroke: "#ef4444", label: "MV 66 kV" },
  coolant:      { stroke: "#22d3ee", label: "Coolant (oil/water)" },
  data:         { stroke: "#4ade80", label: "Data · IEC 61850" },
};

export const NACELLE_CONNECTIONS: SchematicConnection[] = [
  // Hydraulic loop — HPU feeds pitch actuators (via hub), rotor brake, yaw brakes
  { from: "hpu", to: "hub",       kind: "hydraulic" },
  { from: "hpu", to: "brake",     kind: "hydraulic" },
  { from: "hpu", to: "yaw_brake", kind: "hydraulic" },

  // Cooling loop — oil cooler services gearbox and generator
  { from: "oil_cooler", to: "gearbox",   kind: "coolant" },
  { from: "oil_cooler", to: "generator", kind: "coolant" },

  // Electrical power chain — generator → converter → transformer → MV cable
  { from: "generator",   to: "converter",     kind: "electrical_lv" },
  { from: "converter",   to: "transformer",   kind: "electrical_lv" },
  { from: "transformer", to: "cable_routing", kind: "electrical_mv" },

  // Data / control — control cabinet supervises hydraulic, converter, UPS
  { from: "control_cabinet", to: "hpu",       kind: "data" },
  { from: "control_cabinet", to: "converter", kind: "data" },
  { from: "control_cabinet", to: "ups",       kind: "data" },
  { from: "ups",             to: "control_cabinet", kind: "electrical_lv" },
];
