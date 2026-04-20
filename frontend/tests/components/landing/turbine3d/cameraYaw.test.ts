/**
 * resolvePartCameraTarget — yaw-awareness test.
 *
 * Interior nacelle parts live under a yaw-rotated parent group. The preferred
 * direction in PART_FOCUS is stored in the nacelle's local frame; the resolver
 * must rotate it by the parent's world quaternion so the camera tracks yaw
 * instead of pointing at where the part *would* be at yaw=0.
 */

import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { resolvePartCameraTarget } from "../../../../src/components/landing/turbine3d/registry/partMeshRegistry";

function buildScene(yawRad: number) {
  const scene = new THREE.Scene();
  const nacelleGroup = new THREE.Group();
  nacelleGroup.rotation.y = yawRad;
  scene.add(nacelleGroup);

  // A 2×2×2 mesh at local origin of the nacelle group — stands in for the generator.
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshBasicMaterial(),
  );
  mesh.name = "generator";
  nacelleGroup.add(mesh);

  scene.updateMatrixWorld(true);
  return scene;
}

describe("resolvePartCameraTarget — yaw awareness", () => {
  it("rotates the preferred camera direction by the parent yaw", () => {
    const yawed = resolvePartCameraTarget("generator", buildScene(Math.PI / 2));
    const flat = resolvePartCameraTarget("generator", buildScene(0));

    expect(yawed).not.toBeNull();
    expect(flat).not.toBeNull();
    if (!yawed || !flat) return;

    // Distance from centre should be identical — only the direction changes.
    const [yx, , yz] = yawed.position;
    const [fx, , fz] = flat.position;
    const rYawed = Math.hypot(yx, yz);
    const rFlat = Math.hypot(fx, fz);
    expect(rYawed).toBeCloseTo(rFlat, 3);

    // A +90° Y rotation takes (x, z) → (z, -x). Verify within 0.5° tolerance.
    const angleYawed = Math.atan2(yz, yx);
    const angleFlat = Math.atan2(fz, fx);
    const delta = ((angleYawed - angleFlat + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    expect(Math.abs(delta + Math.PI / 2)).toBeLessThan(0.5 * (Math.PI / 180));
  });

  it("returns null when the named mesh is absent", () => {
    const scene = new THREE.Scene();
    scene.updateMatrixWorld(true);
    expect(resolvePartCameraTarget("generator", scene)).toBeNull();
  });
});
