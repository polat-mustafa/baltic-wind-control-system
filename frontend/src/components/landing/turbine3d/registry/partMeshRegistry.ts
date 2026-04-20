/**
 * Camera-focus registry for turbine parts.
 *
 * Two strategies are supported:
 *   1. AUTO — compute eye position from the mesh bounding box at runtime,
 *      using a preferred viewing direction and a distance multiplier.
 *      Robust against geometry changes, exploded offsets, animation.
 *   2. OVERRIDE — for a handful of parts where auto framing is awkward
 *      (very tall things, things hidden inside housings), we still keep
 *      explicit eye + lookAt vectors.
 *
 * The viewer resolves the target via `resolvePartCameraTarget(partId, scene)`
 * which returns a CameraTarget (eye + lookAt vectors). If the mesh isn't
 * in the scene (e.g. turned off by viewerMode), it falls back to DEFAULT_CAMERA_TARGET.
 */

import * as THREE from "three";
import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

export interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

export interface AutoFocus {
  kind: "auto";
  /** Unit vector from part centre toward the camera. */
  direction: [number, number, number];
  /** Multiplier on bounding-sphere radius. 1.8 is comfortable framing. */
  distanceMultiplier: number;
  /** Optional minimum-distance clamp so tiny parts don't put the camera inside them. */
  minDistance?: number;
}

export interface FixedFocus {
  kind: "fixed";
  position: [number, number, number];
  lookAt: [number, number, number];
}

export type PartFocus = AutoFocus | FixedFocus;

/**
 * Per-part focus spec. Direction is in world space, unit-ish.
 * ( 1, 0, 0) = camera on east side looking west
 * ( 0, 1, 0) = looking down from above
 * ( 0, 0, 1) = looking from north (back of scene toward front)
 * (-1, 0, 0) = looking from west
 */
export const PART_FOCUS: Record<TurbinePartId, PartFocus> = {
  // Hero exterior parts — auto-framed from front-right-above
  blades:       { kind: "auto", direction: [ 0.6,  0.4,  0.7], distanceMultiplier: 1.6 },
  hub:          { kind: "auto", direction: [ 0.7,  0.3,  0.7], distanceMultiplier: 2.4, minDistance: 12 },
  tower:        { kind: "auto", direction: [ 0.7,  0.1,  0.7], distanceMultiplier: 1.3 },
  foundation:   { kind: "auto", direction: [ 0.7, -0.2,  0.7], distanceMultiplier: 1.6, minDistance: 25 },
  nacelle:      { kind: "auto", direction: [ 0.7,  0.3,  0.7], distanceMultiplier: 2.2, minDistance: 22 },
  yaw:          { kind: "auto", direction: [ 0.6,  0.4,  0.7], distanceMultiplier: 2.5, minDistance: 18 },

  // Drivetrain (interior) — camera pulled slightly above, from port side
  shaft:        { kind: "auto", direction: [ 0.8,  0.25, 0.55], distanceMultiplier: 2.6, minDistance: 8 },
  bearing:      { kind: "auto", direction: [ 0.8,  0.3,  0.55], distanceMultiplier: 3.2, minDistance: 7 },
  brake:        { kind: "auto", direction: [ 0.8,  0.3,  0.55], distanceMultiplier: 3.2, minDistance: 7 },
  gearbox:      { kind: "auto", direction: [ 0.75, 0.3,  0.6 ], distanceMultiplier: 2.4, minDistance: 9 },
  generator:    { kind: "auto", direction: [ 0.75, 0.3,  0.6 ], distanceMultiplier: 2.4, minDistance: 9 },
  converter:    { kind: "auto", direction: [ 0.85, 0.25, 0.45], distanceMultiplier: 2.8, minDistance: 7 },
  cooler:       { kind: "auto", direction: [ 0.65, 0.55, 0.55], distanceMultiplier: 2.4, minDistance: 8 },
  anemometer:   { kind: "auto", direction: [ 0.55, 0.55, 0.65], distanceMultiplier: 3.0, minDistance: 9 },

  // Abstract "parts" (wind, power_output) — framed from specific angles
  wind:         { kind: "fixed", position: [  0, 155, 200], lookAt: [  0, 150,   0] },
  power_output: { kind: "fixed", position: [ 25, 155,  25], lookAt: [  4, 152,   0] },

  // Nacelle interior subsystems — pull camera closer; most are ≤ 2 m
  bedplate:            { kind: "auto", direction: [ 0.75, 0.25, 0.6 ], distanceMultiplier: 3.0, minDistance: 8 },
  hpu:                 { kind: "auto", direction: [ 0.75, 0.25, 0.6 ], distanceMultiplier: 3.5, minDistance: 6 },
  control_cabinet:     { kind: "auto", direction: [-0.7,  0.3,  0.65], distanceMultiplier: 3.5, minDistance: 5 },
  transformer:         { kind: "auto", direction: [ 0.65, 0.25, 0.7 ], distanceMultiplier: 3.0, minDistance: 6 },
  oil_cooler:          { kind: "auto", direction: [ 0.75, 0.35, 0.55], distanceMultiplier: 3.5, minDistance: 5 },
  coupling:            { kind: "auto", direction: [ 0.75, 0.3,  0.6 ], distanceMultiplier: 4.0, minDistance: 5 },
  ups:                 { kind: "auto", direction: [-0.7,  0.3,  0.65], distanceMultiplier: 3.5, minDistance: 5 },
  crane_rail:          { kind: "auto", direction: [ 0.65, 0.55, 0.55], distanceMultiplier: 3.0, minDistance: 8 },
  yaw_brake:           { kind: "auto", direction: [ 0.75, 0.3,  0.6 ], distanceMultiplier: 4.0, minDistance: 5 },
  cable_routing:       { kind: "auto", direction: [ 0.7,  0.25, 0.65], distanceMultiplier: 3.5, minDistance: 5 },
  fire_suppression:    { kind: "auto", direction: [ 0.75, 0.3,  0.6 ], distanceMultiplier: 3.5, minDistance: 5 },
  lightning_conductor: { kind: "auto", direction: [ 0.65, 0.55, 0.55], distanceMultiplier: 3.0, minDistance: 8 },
};

/** Default overview camera (full turbine visible). */
export const DEFAULT_CAMERA_TARGET: CameraTarget = {
  position: [180, 160, 180],
  lookAt:   [  0,  80,   0],
};

const FOV_RAD = (45 * Math.PI) / 180;
const tmpBox = new THREE.Box3();
const tmpCenter = new THREE.Vector3();
const tmpSphere = new THREE.Sphere();

/**
 * Compute a concrete camera eye+lookAt for a part at the moment of call.
 *
 * For AUTO parts: reads the object's world-space bounding sphere and places
 * the camera along the preferred direction, distanceMultiplier × radius back.
 * For FIXED parts: returns the hard-coded values.
 * If the part mesh is not currently in the scene, returns null so the caller
 * can fall back to DEFAULT_CAMERA_TARGET.
 */
export function resolvePartCameraTarget(
  partId: TurbinePartId,
  scene: THREE.Object3D,
): CameraTarget | null {
  const focus = PART_FOCUS[partId];
  if (!focus) return null;

  if (focus.kind === "fixed") {
    return { position: focus.position, lookAt: focus.lookAt };
  }

  const obj = scene.getObjectByName(partId);
  if (!obj) return null;

  tmpBox.setFromObject(obj);
  if (tmpBox.isEmpty()) return null;
  tmpBox.getCenter(tmpCenter);
  tmpBox.getBoundingSphere(tmpSphere);

  const radius = Math.max(tmpSphere.radius, 0.3);
  const fit = radius / Math.tan(FOV_RAD / 2);
  const distance = Math.max(focus.minDistance ?? 0, fit * focus.distanceMultiplier * 0.6);

  const d = new THREE.Vector3(...focus.direction).normalize();
  // Interior parts are children of the yaw-rotated nacelle group. Rotate the
  // preferred direction into the mesh's world frame so the camera tracks yaw.
  const parent = obj.parent;
  if (parent) {
    const q = new THREE.Quaternion();
    parent.getWorldQuaternion(q);
    d.applyQuaternion(q);
  }
  const eye = tmpCenter.clone().addScaledVector(d, distance);

  return {
    position: [eye.x, eye.y, eye.z],
    lookAt:   [tmpCenter.x, tmpCenter.y, tmpCenter.z],
  };
}
