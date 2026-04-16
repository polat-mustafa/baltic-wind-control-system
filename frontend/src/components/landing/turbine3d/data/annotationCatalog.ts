/**
 * Static annotation catalog for the V236-15.0 MW turbine viewer.
 *
 * Annotations are rendered in the 3D scene as circle nodes + optional
 * dimension arrows, clicking opens an AnnotationDetailPopup.
 *
 * Scene coordinate system: Y is UP, units = metres.
 * Origin is at the waterline base of the monopile (sea floor level).
 * Hub centre is at y=150 (hub height above mean sea level).
 */

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

// ── Types ────────────────────────────────────────────────────────

export type AnnotationKind = "dimension" | "telemetry" | "component";
export type AnnotationCategory = "geometry" | "thermal" | "electrical" | "kinematic" | "comms";

export interface AnnotationDetail {
  title: string;
  value: string | (() => string);
  unit?: string;
  formula?: string;
  source: string;
  description?: string;
}

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  category: AnnotationCategory;
  /** Primary 3D anchor point (scene metres). */
  anchor: [number, number, number];
  /** Dimension arrow start (optional). */
  arrowFrom?: [number, number, number];
  /** Dimension arrow end (optional). */
  arrowTo?: [number, number, number];
  label: string | (() => string);
  detail: AnnotationDetail;
  /** Clicking also fires setSelectedTurbinePart if set. */
  relatedPartId?: TurbinePartId;
  /** Which viewer modes render this annotation. Defaults to all. */
  visibleInModes?: Array<"normal" | "cutaway" | "exploded">;
}

// ── Category → colour map (used by AnnotationMarker) ────────────

export const ANNOTATION_CATEGORY_COLOR: Record<AnnotationCategory, string> = {
  geometry:   "#3b82f6", // blue
  thermal:    "#ef4444", // red
  electrical: "#22c55e", // green
  kinematic:  "#f59e0b", // amber
  comms:      "#8b5cf6", // violet
};

// ── Static annotations (geometry dimensions + component callouts) ─

export const STATIC_ANNOTATIONS: Annotation[] = [
  // ── Geometry / dimensions ────────────────────────────────────
  {
    id: "dim:hub-height",
    kind: "dimension",
    category: "geometry",
    anchor: [-18, 75, 0],
    arrowFrom: [-15, 0, 0],
    arrowTo:   [-15, 150, 0],
    label: "150 m",
    detail: {
      title: "Hub height",
      value: "150 m above mean sea level",
      unit: "m",
      formula: "h_hub = h_tower + h_transition",
      source: "V236 offshore typical (Vestas, 2024)",
      description:
        "Hub height above sea level. Higher hubs reach faster, more consistent wind — key driver of annual energy production.",
    },
  },
  {
    id: "dim:tip-height",
    kind: "dimension",
    category: "geometry",
    anchor: [22, 134, 0],
    arrowFrom: [20, 0, 0],
    arrowTo:   [20, 268, 0],
    label: "268 m",
    detail: {
      title: "Total tip height",
      value: "≈ 268 m (hub 150 + rotor radius 118 m)",
      unit: "m",
      source: "Derived from V236 spec",
      description:
        "Maximum height swept by blade tip — relevant for aviation lighting (ICAO Annex 14) and installation crane reach.",
    },
  },
  {
    id: "dim:rotor-diameter",
    kind: "dimension",
    category: "geometry",
    anchor: [0, 150, 25],
    arrowFrom: [-118, 150, 20],
    arrowTo:   [ 118, 150, 20],
    label: "Ø 236 m",
    detail: {
      title: "Rotor diameter (wingspan)",
      value: "236 m",
      unit: "m",
      formula: "A = π (D/2)² = 43,742 m²",
      source: "Vestas V236-15.0 MW product card",
      description:
        "Swept area determines how much wind power is available. Doubling diameter quadruples swept area — the single biggest lever on energy yield.",
    },
  },
  {
    id: "dim:blade-length",
    kind: "dimension",
    category: "geometry",
    anchor: [10, 208, 0],
    arrowFrom: [0, 150, 0],
    arrowTo:   [0, 265.5, 0],
    label: "115.5 m",
    detail: {
      title: "Blade length",
      value: "115.5 m",
      unit: "m",
      source: "Vestas V236 product card",
      description:
        "Each carbon/glass-fibre blade is longer than a football pitch. Carbon spar cap keeps mass manageable despite the extreme length.",
    },
  },
  {
    id: "dim:monopile-depth",
    kind: "dimension",
    category: "geometry",
    anchor: [-14, -20, 0],
    arrowFrom: [-12, 0, 0],
    arrowTo:   [-12, -40, 0],
    label: "~40 m",
    detail: {
      title: "Monopile penetration depth",
      value: "≈ 40 m below seabed (Baltic ~30 m water depth)",
      unit: "m",
      source: "Polish Baltic offshore typical (PSE design basis)",
      description:
        "Drives soil-structure dynamics. Natural frequency must sit in the 'soft-stiff' window between 1P and 3P rotor frequencies to avoid resonance.",
    },
  },
  // ── Component callouts (visible in cutaway / exploded) ─────────
  {
    id: "cmp:gearbox",
    kind: "component",
    category: "kinematic",
    anchor: [-3, 150.5, -2],
    label: "Medium-speed gearbox 36:1",
    relatedPartId: "gearbox",
    visibleInModes: ["cutaway", "exploded"],
    detail: {
      title: "Medium-speed gearbox",
      value: "36:1 ratio (1-stage planetary + 1-stage helical)",
      source: "Vestas V236 drivetrain",
      description:
        "Steps rotor 9.55 rpm up to ~344 rpm for the PMSG. Lower ratio than legacy 3-stage = fewer wear parts, smaller oil volume.",
    },
  },
  {
    id: "cmp:pmsg",
    kind: "component",
    category: "electrical",
    anchor: [3, 148.5, -2],
    label: "PMSG 15 MW",
    relatedPartId: "generator",
    visibleInModes: ["cutaway", "exploded"],
    detail: {
      title: "Permanent Magnet Synchronous Generator",
      value: "15 MW, ~344 rpm, full-power converter",
      source: "Vestas V236 spec",
      description:
        "Permanent magnets eliminate rotor excitation windings → higher efficiency, lower maintenance vs DFIG. Full converter decouples from grid frequency.",
    },
  },
  {
    id: "cmp:yaw-drives",
    kind: "component",
    category: "kinematic",
    anchor: [0, 148, 5],
    label: "Yaw drives ×4",
    relatedPartId: "yaw",
    detail: {
      title: "Yaw drive assembly",
      value: "4 electric drives, ~0.5°/s slew rate",
      source: "V-class typical, IEC 61400-1",
      description:
        "Rotates the nacelle to face the wind. Slow by design — gyroscopic moments on a 280-tonne nacelle would be destructive at higher speed.",
    },
  },
  {
    id: "cmp:pitch-bearings",
    kind: "component",
    category: "kinematic",
    anchor: [-2, 150, 3],
    label: "Pitch bearings ×3",
    relatedPartId: "blades",
    detail: {
      title: "Blade pitch bearings",
      value: "3 × four-point contact ball bearing, Ø ~3.5 m",
      source: "IEC 61400-4 gearbox/bearing standard",
      description:
        "Each blade root rotates independently. Pitch angle 0° at rated wind, feathers to 90° at cut-out. Pitch rate ~6°/s.",
    },
  },
  {
    id: "cmp:converter",
    kind: "component",
    category: "electrical",
    anchor: [5, 148, 1],
    label: "Full-power converter",
    relatedPartId: "converter",
    visibleInModes: ["cutaway", "exploded"],
    detail: {
      title: "Full-power converter (back-to-back IGBT)",
      value: "15 MVA, variable-speed decoupling",
      source: "IEC 61400-21-1",
      description:
        "Converts variable-frequency generator output to fixed 50 Hz grid. Enables full FRT compliance and reactive power control.",
    },
  },
];
