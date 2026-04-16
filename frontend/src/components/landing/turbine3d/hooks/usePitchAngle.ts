/**
 * Smoothly animates each blade to the target pitch angle.
 *
 * The V236 pitch actuator moves at ~6°/s (hydraulic/electric).
 * Each blade rotates around its own long axis (Z-axis in blade-local space,
 * which is X in the parent hub frame where blades point radially).
 *
 * pitchAngleDeg: 0 = fine pitch (max power), 90 = feathered (shutdown).
 */

import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const DEG_TO_RAD = Math.PI / 180;
const MAX_PITCH_RATE_RAD_PER_S = 6.0 * DEG_TO_RAD; // 6°/s

export function usePitchAngle(
  blade1Ref: React.RefObject<Group | null>,
  blade2Ref: React.RefObject<Group | null>,
  blade3Ref: React.RefObject<Group | null>,
  pitchAngleDeg: number,
): void {
  const targetRad = pitchAngleDeg * DEG_TO_RAD;

  useFrame((_state, delta) => {
    for (const bladeRef of [blade1Ref, blade2Ref, blade3Ref]) {
      if (!bladeRef.current) continue;

      const current = bladeRef.current.rotation.z;
      const diff = targetRad - current;
      const maxStep = MAX_PITCH_RATE_RAD_PER_S * delta;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
      bladeRef.current.rotation.z += step;
    }
  });
}
