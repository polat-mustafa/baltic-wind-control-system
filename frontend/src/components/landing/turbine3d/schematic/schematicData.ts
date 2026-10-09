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
  /** Omitted for paywalled standards whose catalogue page we could not verify. */
  url?: string;
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
 * Layout (left = rotor side, right = rear of nacelle) — IEA 15 MW direct drive:
 *   [Rotor] → [Main bearings] → [Main shaft] → [Rotor brake] →
 *   [Direct-drive PMSG, outside the nacelle] → [Converter] → [Transformer]
 *
 * Above the drivetrain: crane rail, lightning conductor, control cabinets.
 * Below:                 HPU, coolant skid, cable routing, yaw brakes, UPS.
 */
const CITE_IEA15 = { source: "Gaertner et al. 2020 — IEA 15 MW reference turbine, NREL/TP-5000-75698", url: "https://docs.nlr.gov/docs/fy20osti/75698.pdf" };
const CITE_ROSCO = { source: "IEA-15-240-RWT v1.1.18 — ROSCO DISCON.IN / ElastoDyn", url: "https://github.com/IEAWindTask37/IEA-15-240-RWT" };
const CITE_TRANSFORMER = { source: "IEC 60076-16 — transformers for wind turbine applications (66 kV step-up)" };
const CITE_IEC_61400_24 = { source: "IEC 61400-24 — lightning protection" };
const CITE_IEC_62040 = { source: "IEC 62040-1 — UPS safety",  };

export const NACELLE_SCHEMATIC_PARTS: SchematicPart[] = [
  // ── Main driveline (left → right) ─────────────────────────────
  { id: "hub",       x:  20, y: 260, w:  80, h: 120, label: "Rotor Hub",          sublabel: "Pitch system × 3",       tone: "rotating",    callout: { x:  60, y: 210 },
    groups: ["drivetrain", "structural"], cite: [CITE_IEA15] },
  { id: "bearing",   x: 110, y: 285, w:  70, h:  80, label: "Main Bearings",      sublabel: "TDO + SRB · 1.2 m apart", tone: "rotating",    callout: { x: 145, y: 240 },
    groups: ["drivetrain"], cite: [CITE_IEA15] },
  { id: "shaft",     x: 185, y: 300, w:  70, h:  50, label: "Main Shaft",         sublabel: "Hollow Ø 6 m · 2.2 m",   tone: "metal",       callout: { x: 220, y: 265 },
    groups: ["drivetrain"], cite: [CITE_IEA15] },
  { id: "brake",     x: 260, y: 295, w:  40, h:  60, label: "Rotor Brake",        sublabel: "Calipers on rotor disc", tone: "metal",       callout: { x: 280, y: 250 },
    groups: ["drivetrain", "safety", "hydraulic"] },
  { id: "generator", x: 305, y: 235, w: 255, h: 190, label: "Direct-Drive PMSG",  sublabel: "200 poles · 7.56 rpm · 12.6 Hz · 4.77 kV", tone: "winding", callout: { x: 430, y: 200 },
    groups: ["drivetrain", "electrical"], cite: [CITE_IEA15] },
  { id: "converter", x: 570, y: 260, w: 150, h: 140, label: "Full-Power Converter", sublabel: "MV AC/DC/AC · 12.6 → 50 Hz", tone: "cabinet",   callout: { x: 645, y: 220 },
    groups: ["electrical"], cite: [CITE_ROSCO] },
  { id: "transformer", x: 730, y: 260, w: 120, h: 140, label: "Step-Up Transformer", sublabel: "3.3 → 66 kV · Dyn11", tone: "cabinet", callout: { x: 790, y: 220 },
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

  // ── Lower deck — HPU, coolant skid, cables, yaw, fire ────────
  { id: "hpu",            x: 130, y: 440, w: 140, h:  80, label: "Hydraulic Power Unit",  sublabel: "Pitch + brake + yaw · 220 bar", tone: "tank",    callout: { x: 200, y: 560 },
    groups: ["hydraulic"] },
  { id: "coolant_skid",   x: 280, y: 440, w: 140, h:  80, label: "Coolant Skid",          sublabel: "Generator + converter",   tone: "cooling", callout: { x: 350, y: 560 },
    groups: ["cooling"] },
  { id: "cable_routing",  x: 430, y: 440, w: 160, h:  80, label: "Cable Routing",         sublabel: "Twist loop ±3½ turns",    tone: "cabinet", callout: { x: 510, y: 560 },
    groups: ["electrical", "maintenance"] },
  { id: "yaw_brake",      x: 600, y: 440, w: 140, h:  80, label: "Yaw Bearing & Brakes",  sublabel: "2-row ball bearing · hydraulic calipers", tone: "metal", callout: { x: 670, y: 560 },
    groups: ["hydraulic", "safety"] },
  { id: "fire_suppression", x: 750, y: 440, w: 130, h:  80, label: "Fire Suppression",    sublabel: "HFC-227ea · ISO 14520",   tone: "cabinet", callout: { x: 815, y: 560 },
    groups: ["safety"] },
  { id: "bedplate",       x: 890, y: 440, w: 100, h:  80, cite: [CITE_IEA15], label: "Bedplate",              sublabel: "Hollow curved steel beam · 50 mm · 70 t",   tone: "structural", callout: { x: 940, y: 560 },
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
  tank:       { fill: "#102030", stroke: "#45c8d9" },                    // hydraulic oil
  cabinet:    { fill: "#0f1722", stroke: "#94a3b8" },
  cooling:    { fill: "#082030", stroke: "#22d3ee" },
  rotating:   { fill: "#18222f", stroke: "#eab308" },                    // amber — moving parts
  structural: { fill: "#0b141f", stroke: "#475569" },
};

// ── P&ID-style functional connections ────────────────────────────
//
// Colour conventions match plant piping & instrumentation diagrams:
//   coolant      → cyan   (water-glycol cooling circuit)
//   hydraulic    → orange (pressurised oil — pitch / brake / yaw)
//   electrical_mv → red   (medium voltage, 66 kV class)
//   electrical_lv → slate (generator / converter side, 4.77 kV generator)
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
  hydraulic:    { stroke: "#fb923c", label: "Hydraulic (220 bar)" },
  electrical_lv:{ stroke: "#94a3b8", label: "Generator / converter side" },
  electrical_mv:{ stroke: "#f25c54", label: "MV 66 kV" },
  coolant:      { stroke: "#22d3ee", label: "Coolant (water-glycol)" },
  data:         { stroke: "#4ade80", label: "Data · IEC 61850" },
};

export const NACELLE_CONNECTIONS: SchematicConnection[] = [
  // Hydraulic loop — HPU feeds pitch actuators (via hub), rotor brake, yaw brakes
  { from: "hpu", to: "hub",       kind: "hydraulic" },
  { from: "hpu", to: "brake",     kind: "hydraulic" },
  { from: "hpu", to: "yaw_brake", kind: "hydraulic" },

  // Cooling loop — coolant skid serves the generator stator and the converter
  { from: "coolant_skid", to: "generator", kind: "coolant" },
  { from: "coolant_skid", to: "converter", kind: "coolant" },

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
