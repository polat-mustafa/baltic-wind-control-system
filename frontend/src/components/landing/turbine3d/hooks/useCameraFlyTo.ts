/**
 * Smooth camera fly-to animation when a turbine part is selected.
 *
 * Lerps both camera.position AND OrbitControls.target each frame so the
 * orbit pivot follows the look-at point instead of fighting with the
 * controls. OrbitControls must have `makeDefault` set in the scene so
 * that `useThree().controls` resolves to the OrbitControls instance.
 *
 * LERP_FACTOR 0.08 → approximately 0.6 s transition at 60 fps.
 */

import { useRef, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

import {
  DEFAULT_CAMERA_TARGET,
  PART_CAMERA_TARGETS,
  type CameraTarget,
} from "../registry/partMeshRegistry";
import type { TurbinePartId } from "../../../../constants/turbinePartEducation";

const LERP_FACTOR = 0.08;
const SNAP_DISTANCE = 0.5; // metres — stop animation when this close

export function useCameraFlyTo(): (partId: TurbinePartId | null) => void {
  const { camera, controls } = useThree() as {
    camera: THREE.Camera;
    controls: { target: Vector3; update: () => void } | null;
  };
  const targetRef = useRef<CameraTarget>(DEFAULT_CAMERA_TARGET);
  const animating = useRef(false);

  // Re-used scratch vectors (avoid GC pressure per frame)
  const tmpPos = useRef(new Vector3());
  const tmpLook = useRef(new Vector3());

  useFrame(() => {
    if (!animating.current) return;

    tmpPos.current.set(...targetRef.current.position);
    tmpLook.current.set(...targetRef.current.lookAt);

    camera.position.lerp(tmpPos.current, LERP_FACTOR);

    if (controls?.target) {
      controls.target.lerp(tmpLook.current, LERP_FACTOR);
      controls.update();
    }

    if (camera.position.distanceTo(tmpPos.current) < SNAP_DISTANCE) {
      camera.position.copy(tmpPos.current);
      if (controls?.target) {
        controls.target.copy(tmpLook.current);
        controls.update();
      }
      animating.current = false;
    }
  });

  return useCallback(
    (partId: TurbinePartId | null) => {
      targetRef.current = partId
        ? (PART_CAMERA_TARGETS[partId] ?? DEFAULT_CAMERA_TARGET)
        : DEFAULT_CAMERA_TARGET;
      animating.current = true;
    },
    [], // stable — targetRef and animating are refs
  );
}

// Type import used only for the `as` cast above
import type * as THREE from "three";
