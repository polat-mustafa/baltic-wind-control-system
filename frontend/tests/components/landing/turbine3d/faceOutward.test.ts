import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { faceOutward, outwardness } from "../../../../src/components/landing/turbine3d/model/faceOutward";
import { BLADE_GEOM_BASE } from "../../../../src/components/landing/turbine3d/scene/bladeGeometry";

/** Open cylinder along +y, optionally inside-out (winding + normals inward). */
function cylinder(inward: boolean): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(2, 2, 10, 24, 4, true);
  if (inward) {
    const idx = g.index!.array;
    for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
    const n = g.attributes.normal.array;
    for (let i = 0; i < n.length; i++) n[i] = -n[i];
  }
  return g;
}

/** Fraction of triangles whose winding normal points away from the section centre. */
function outwardTriangles(g: THREE.BufferGeometry): number {
  const p = g.attributes.position;
  const idx = g.index!.array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let out = 0;
  let n = 0;
  for (let t = 0; t < idx.length; t += 3) {
    a.fromBufferAttribute(p, idx[t]);
    b.fromBufferAttribute(p, idx[t + 1]);
    c.fromBufferAttribute(p, idx[t + 2]);
    const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (Math.abs(nrm.y) > 0.9 * nrm.length()) continue; // caps
    const m = a.clone().add(b).add(c).divideScalar(3);
    n += 1;
    if (nrm.x * m.x + nrm.z * m.z > 0) out += 1;
  }
  return out / n;
}

describe("faceOutward", () => {
  it("leaves an outward shell alone", () => {
    const g = cylinder(false);
    expect(outwardness(g)).toBeGreaterThan(0);
    expect(faceOutward(g)).toBe(false);
  });

  it("re-winds an inside-out shell and negates its normals", () => {
    const g = cylinder(true);
    expect(outwardTriangles(g)).toBe(0);
    expect(faceOutward(g)).toBe(true);
    expect(outwardTriangles(g)).toBe(1);
    expect(outwardness(g)).toBeGreaterThan(0);
  });

  it("procedural blade loft already faces outward", () => {
    expect(outwardness(BLADE_GEOM_BASE)).toBeGreaterThan(0);
  });

  it("the shipped v236.glb blade faces outward once loaded", async () => {
    // no @types/node in this project: load node:fs untyped
    const fsName = "node:fs";
    const fs = (await import(/* @vite-ignore */ fsName)) as { readFileSync(p: string): Uint8Array };
    const buf = fs.readFileSync("public/models/v236.glb"); // vitest runs from frontend/
    // copy into this realm's ArrayBuffer (jsdom) so GLTFLoader sees binary glTF
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    const gltf = await new GLTFLoader().parseAsync(ab, "");
    const blade = gltf.scene.getObjectByName("blade") as THREE.Mesh;
    faceOutward(blade.geometry);
    expect(outwardness(blade.geometry)).toBeGreaterThan(0);
  });
});
