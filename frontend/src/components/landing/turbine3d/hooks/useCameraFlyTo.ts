/**
 * Smooth camera fly-to animation when a turbine part is selected.
 *
 * Improvements over the prior implementation:
 *   - Easing: cubic-bezier (ease-in-out) instead of raw position.lerp() (which
 *     produced linear motion for the first few frames and "snap" at the end).
 *   - Duration: scaled by distance (clamped 0.6 s .. 1.4 s).
 *   - Bounds-derived targets: reads the selected part's world bounds at animation
 *     start and places the camera at a comfortable framing distance (no more
 *     hand-tuned lookAt vectors that break when geometry changes or exploded mode
 *     moves parts).
 *   - Lerps camera.position AND OrbitControls.target in lockstep so the pivot
 *     follows the subject instead of fighting the motion.
 *
 * OrbitControls must have `makeDefault` so that `useThree().controls` resolves.
 */

import { useRef, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type * as THREE from "three";

import {
  DEFAULT_CAMERA_TARGET,
  resolvePartCameraTarget,
  type CameraTarget,
} from "../registry/partMeshRegistry";
import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

/** cubic-bezier (0.25, 0.1, 0.25, 1) — standard "ease" curve */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

interface FlyState {
  active: boolean;
  startTime: number;
  duration: number;
  fromPos: Vector3;
  toPos: Vector3;
  fromLook: Vector3;
  toLook: Vector3;
}

export function useCameraFlyTo(): (partId: TurbinePartId | null) => void {
  const { camera, controls, scene, clock } = useThree() as {
    camera: THREE.Camera;
    controls: { target: Vector3; update: () => void } | null;
    scene: THREE.Object3D;
    clock: THREE.Clock;
  };

  const state = useRef<FlyState>({
    active: false,
    startTime: 0,
    duration: 0.9,
    fromPos: new Vector3(),
    toPos: new Vector3(),
    fromLook: new Vector3(),
    toLook: new Vector3(),
  });

  useFrame(() => {
    const s = state.current;
    if (!s.active) return;

    const elapsed = clock.getElapsedTime() - s.startTime;
    const t = Math.min(1, elapsed / s.duration);
    const k = easeInOut(t);

    camera.position.lerpVectors(s.fromPos, s.toPos, k);
    if (controls?.target) {
      controls.target.lerpVectors(s.fromLook, s.toLook, k);
      controls.update();
    }

    if (t >= 1) {
      camera.position.copy(s.toPos);
      if (controls?.target) {
        controls.target.copy(s.toLook);
        controls.update();
      }
      s.active = false;
    }
  });

  return useCallback(
    (partId: TurbinePartId | null) => {
      // Defer one frame so that matrixWorld on all meshes is up-to-date before
      // resolvePartCameraTarget reads bounds. Without this, switching from the
      // schematic back to 3D resolves against stale transforms and the camera
      // lands on the default overview instead of the selected part.
      requestAnimationFrame(() => {
        const target: CameraTarget = partId
          ? (resolvePartCameraTarget(partId, scene) ?? DEFAULT_CAMERA_TARGET)
          : DEFAULT_CAMERA_TARGET;

        const s = state.current;
        s.fromPos.copy(camera.position);
        s.toPos.set(...target.position);
        s.fromLook.copy(controls?.target ?? new Vector3(0, 80, 0));
        s.toLook.set(...target.lookAt);

        // Scale duration by travel distance (0.6–1.4 s).
        const distance = s.fromPos.distanceTo(s.toPos);
        s.duration = Math.max(0.6, Math.min(1.4, 0.6 + distance * 0.004));
        s.startTime = clock.getElapsedTime();
        s.active = true;
      });
    },
    [camera, controls, scene, clock],
  );
}
