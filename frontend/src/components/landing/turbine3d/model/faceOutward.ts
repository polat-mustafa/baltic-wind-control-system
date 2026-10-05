/**
 * Make a span-wise lofted shell (blade, blade tip marks) face outward.
 *
 * The Blender blade (v236.glb, MODEL_REV 4) was exported inside-out: its
 * section rings run clockwise in the blade frame, so winding and normals
 * point into the blade. With front-face culling the viewer then drew the
 * *inside of the far wall* — wrong lighting, and a surface field showed the
 * downwind (suction) side to an upwind observer.
 *
 * Detection: normals vs. the offset from the section centroid (1 m span
 * bins, xz plane). If they point inward on balance, every triangle is
 * re-wound and every normal negated. A correctly built model is left as is.
 */

import type { BufferGeometry } from "three";

/** Σ n·(p − c) over all vertices (xz plane): > 0 outward, < 0 inward. */
export function outwardness(geom: BufferGeometry): number {
  const pos = geom.attributes.position;
  const nrm = geom.attributes.normal;
  if (!pos || !nrm) return 0;
  const sums = new Map<number, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(pos.getY(i));
    const s = sums.get(k) ?? [0, 0, 0];
    s[0] += pos.getX(i);
    s[1] += pos.getZ(i);
    s[2] += 1;
    sums.set(k, s);
  }
  let total = 0;
  for (let i = 0; i < pos.count; i++) {
    const s = sums.get(Math.round(pos.getY(i)))!;
    total += nrm.getX(i) * (pos.getX(i) - s[0] / s[2]) + nrm.getZ(i) * (pos.getZ(i) - s[1] / s[2]);
  }
  return total;
}

/** Flip an inside-out indexed shell in place. Returns true if it was flipped. */
export function faceOutward(geom: BufferGeometry): boolean {
  const index = geom.index;
  if (!index || outwardness(geom) >= 0) return false;
  const idx = index.array;
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const b = idx[t + 1];
    idx[t + 1] = idx[t + 2];
    idx[t + 2] = b;
  }
  index.needsUpdate = true;
  const nrm = geom.attributes.normal;
  const n = nrm.array;
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  nrm.needsUpdate = true;
  return true;
}
