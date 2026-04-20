/**
 * Cable tray — extruded rectangular channel following a Catmull-Rom path,
 * with N cylindrical conductors laid inside as instanced meshes.
 *
 * Used to replace the flat <Line> power runs with readable 3D cable routing.
 *   - Low voltage (0.69 kV): grey sheath, 3 cables (generator → converter,
 *     converter → transformer)
 *   - Medium voltage (66 kV): red sheath, 3 cables
 *     (transformer → cable_routing nexus)
 *
 * The tray is a tube around the path (rectangular flat profile achieved via
 * tubeGeometry radial segments = 4 rotated), with three conductors drawn as
 * tube instances along a slightly-below-centre offset.
 */

import { memo, useMemo } from "react";
import * as THREE from "three";

export interface CableTrayProps {
  /** World-space points defining the tray path. */
  points: [number, number, number][];
  /** Cross-section inside width (m). */
  width?: number;
  /** Cross-section inside height (m). */
  height?: number;
  /** Number of conductors laid along the path. */
  cableCount?: number;
  /** Diameter of each conductor (m). */
  cableDiameter?: number;
  /** Conductor sheath colour — grey for LV, red for MV. */
  sheathColor?: string;
  /** Tray body colour — galvanised steel grey. */
  trayColor?: string;
}

export const CableTray = memo(function CableTray({
  points,
  width = 0.28,
  height = 0.12,
  cableCount = 3,
  cableDiameter = 0.06,
  sheathColor = "#94a3b8",
  trayColor = "#4b5563",
}: CableTrayProps) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    [points],
  );

  const trayGeom = useMemo(() => {
    // Use a thin rectangular extrude along the curve via tube with 3 radial
    // segments (triangle) then scale non-uniformly via a flat Frame. Simpler
    // approach: two extruded planes welded as ⌄.
    const tubeSegments = Math.min(120, Math.max(24, points.length * 12));
    return new THREE.TubeGeometry(curve, tubeSegments, Math.max(width, height) * 0.5, 4, false);
  }, [curve, points.length, width, height]);

  const cables = useMemo(() => {
    // Offset each cable laterally by building a small curve copy translated
    // along the curve's normal at each sample.
    const out: THREE.BufferGeometry[] = [];
    for (let c = 0; c < cableCount; c++) {
      // Space cables across the inside width.
      const fx = cableCount === 1 ? 0 : (c / (cableCount - 1) - 0.5) * (width - cableDiameter);
      // Build a shifted curve by resampling along the base and offsetting.
      const samples = 32;
      const offsetPts: THREE.Vector3[] = [];
      const tangent = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      const lateral = new THREE.Vector3();
      for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const p = curve.getPoint(u);
        curve.getTangent(u).normalize();
        tangent.copy(curve.getTangent(u)).normalize();
        lateral.crossVectors(tangent, up).normalize();
        offsetPts.push(p.clone().addScaledVector(lateral, fx).addScaledVector(up, -height * 0.2));
      }
      const offCurve = new THREE.CatmullRomCurve3(offsetPts);
      out.push(new THREE.TubeGeometry(offCurve, samples * 2, cableDiameter * 0.5, 8, false));
    }
    return out;
  }, [curve, cableCount, cableDiameter, width, height]);

  return (
    <group>
      <mesh geometry={trayGeom}>
        <meshStandardMaterial color={trayColor} metalness={0.75} roughness={0.45} transparent opacity={0.55} />
      </mesh>
      {cables.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={sheathColor} metalness={0.15} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
});
