/**
 * Camera heading shared between the R3F scene and the HTML HUD.
 *
 * `cameraHeading.deg` is the compass bearing (CW from N) the camera looks
 * along, projected on the horizontal plane. World frame: N = +z, E = −x, so a
 * horizontal look vector (dx, dz) has bearing atan2(−dx, dz).
 *
 * Written every frame by <CameraHeadingProbe/> inside the Canvas; the HUD
 * compass reads it in its own rAF loop (no React re-render per frame).
 */

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export const cameraHeading = { deg: 0 };

const look = new THREE.Vector3();

export function bearingOf(dx: number, dz: number): number {
  return ((Math.atan2(-dx, dz) * 180) / Math.PI + 360) % 360;
}

export function CameraHeadingProbe() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    camera.getWorldDirection(look);
    if (Math.hypot(look.x, look.z) > 1e-3) cameraHeading.deg = bearingOf(look.x, look.z);
  });
  return null;
}
