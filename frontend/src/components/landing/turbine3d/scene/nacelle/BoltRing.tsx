/**
 * Bolt ring — array of cylinders around a flange, drawn as an InstancedMesh.
 *
 * Used to add engineering detail on component interfaces:
 *   - Main-bearing pillow-block to bedplate
 *   - Gearbox housing flange to torque arms
 *   - Transformer bushings
 *   - Yaw-bearing to tower top
 *   - Generator mount to bedplate
 *
 * Axis: "x" | "y" | "z" picks the ring's plane (normal).
 * Bolts are short cylinders laid along the chosen axis, positioned on a
 * circle of the given radius in the plane perpendicular to the axis.
 */

import { memo, useMemo } from "react";
import { CylinderGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Vector3 } from "three";

export interface BoltRingProps {
  /** Ring centre in local coords. */
  center?: [number, number, number];
  /** Axis the bolts lie along. The ring is in the plane ⟂ to this axis. */
  axis?: "x" | "y" | "z";
  radius: number;
  count: number;
  boltRadius?: number;
  boltLength?: number;
  color?: string;
  metalness?: number;
  roughness?: number;
}

export const BoltRing = memo(function BoltRing({
  center = [0, 0, 0],
  axis = "y",
  radius,
  count,
  boltRadius = 0.05,
  boltLength = 0.22,
  color = "#3f434a",
  metalness = 0.9,
  roughness = 0.35,
}: BoltRingProps) {
  const { geom, mat, matrices } = useMemo(() => {
    const g = new CylinderGeometry(boltRadius, boltRadius, boltLength, 10);
    const m = new MeshStandardMaterial({ color, metalness, roughness });
    const mats: Matrix4[] = [];
    const o = new Object3D();
    const alignQ = new Quaternion();
    // Default Three cylinder long axis = Y. Re-orient to selected axis.
    if (axis === "x") alignQ.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
    else if (axis === "z") alignQ.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      // Circle in the plane perpendicular to `axis`.
      const x = center[0] + (axis === "x" ? 0 : Math.cos(a) * radius);
      const y = center[1] + (axis === "y" ? 0 : (axis === "x" ? Math.cos(a) * radius : Math.sin(a) * radius));
      const z = center[2] + (axis === "z" ? 0 : (axis === "x" ? Math.sin(a) * radius : (axis === "y" ? Math.sin(a) * radius : 0)));
      o.position.set(x, y, z);
      o.quaternion.copy(alignQ);
      o.updateMatrix();
      mats.push(o.matrix.clone());
    }
    return { geom: g, mat: m, matrices: mats };
  }, [center, axis, radius, count, boltRadius, boltLength, color, metalness, roughness]);

  return (
    <instancedMesh args={[geom, mat, count]} ref={(ref) => {
      if (!ref) return;
      matrices.forEach((mx, i) => ref.setMatrixAt(i, mx));
      ref.instanceMatrix.needsUpdate = true;
    }}>
    </instancedMesh>
  );
});

export type { InstancedMesh };
