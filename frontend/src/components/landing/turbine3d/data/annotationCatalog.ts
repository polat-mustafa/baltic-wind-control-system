/**
 * Static annotation catalog for the SB-510 turbine viewer (15 MW "V236 class",
 * modelled with the IEA 15 MW reference turbine — Gaertner et al. 2020).
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
      source: "IEA 15 MW reference turbine (Gaertner et al. 2020)",
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
    arrowTo:   [20, 270.7, 0],
    label: "271 m",
    detail: {
      title: "Total tip height",
      value: "≈ 271 m (hub 150 + rotor radius 120.7 m)",
      unit: "m",
      source: "Derived from the IEA 15 MW geometry",
      description:
        "Maximum height swept by blade tip — relevant for aviation lighting (ICAO Annex 14) and installation crane reach.",
    },
  },
  {
    id: "dim:rotor-diameter",
    kind: "dimension",
    category: "geometry",
    anchor: [0, 150, 25],
    arrowFrom: [-120.7, 150, 20],
    arrowTo:   [ 120.7, 150, 20],
    label: "Ø 241 m",
    detail: {
      title: "Rotor diameter (wingspan)",
      value: "241.35 m",
      unit: "m",
      formula: "A = π (D/2)² = 45,750 m²",
      source: "IEA-15-240-RWT v1.1.18 tabular data",
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
    arrowTo:   [0, 267, 0],
    label: "117 m",
    detail: {
      title: "Blade length",
      value: "117 m (root Ø 5.2 m, ≈ 65 t)",
      unit: "m",
      source: "IEA 15 MW reference turbine (Gaertner et al. 2020, Table 3-1)",
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
    id: "cmp:pmsg",
    kind: "component",
    category: "electrical",
    anchor: [0, 156.5, 7.5],
    label: "Direct-drive PMSG",
    relatedPartId: "generator",
    detail: {
      title: "Direct-drive permanent-magnet generator",
      value: "200 poles, outer rotor, air gap r 5.08 m, 4.77 kV, 12.6 Hz at 7.56 rpm, η 96.55 %",
      source: "IEA 15 MW reference turbine (Gaertner et al. 2020, Table 5-4)",
      description:
        "No gearbox: the generator turns at rotor speed, so it needs 100 pole pairs and a full-power converter to reach 50 Hz. It sits between the hub and the nacelle.",
    },
  },
  {
    id: "cmp:main-bearings",
    kind: "component",
    category: "kinematic",
    anchor: [0, 151.5, 8.5],
    label: "Main bearings ×2",
    relatedPartId: "bearing",
    visibleInModes: ["cutaway", "exploded"],
    detail: {
      title: "Main bearings on the turret",
      value: "Upwind tapered double outer-ring (locating) + downwind spherical roller, 1.2 m apart",
      source: "IEA 15 MW reference turbine (Gaertner et al. 2020, Table 5-2)",
      description:
        "The hollow main shaft (r 3.0 m, 2.2 m long) turns around the stationary turret on these two bearings; the generator rotor surrounds them.",
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
      value: "Electric drives on a 6.5 m yaw bearing, 0.5°/s, 8° error threshold",
      source: "IEA 15 MW ROSCO DISCON.IN (Y_Rate, Y_ErrThresh)",
      description:
        "Rotates the nacelle to face the wind. Slow by design — gyroscopic moments on a ≈ 1,000 t rotor-nacelle assembly would be destructive at higher speed.",
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
      value: "3 × pitch bearing at the 5.2 m blade root",
      source: "IEA 15 MW reference turbine; ROSCO DISCON.IN (PC_MaxRat)",
      description:
        "Each blade root rotates independently. Pitch follows the minimum-pitch schedule below rated (≈ 0–3.9°), rises to ≈ 23° at 25 m/s and feathers to 90° to stop. Pitch rate limit 2°/s.",
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
      value: "Full power, 12.6 Hz (4.77 kV) generator side → 50 Hz, η ≈ 99.2 %",
      source: "IEA 15 MW (ROSCO VS_GenEff 95.756 % = generator × converter); IEC 61400-21-1",
      description:
        "Converts the low-frequency direct-drive output to the fixed 50 Hz grid. Enables full FRT compliance and reactive power control.",
    },
  },
];
