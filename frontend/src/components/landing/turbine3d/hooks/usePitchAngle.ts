/**
 * Smoothly animates each blade to the target pitch angle.
 *
 * The pitch actuator is rate-limited to 2°/s (IEA 15 MW, ROSCO PC_MaxRat). Each blade turns about its OWN
 * long axis — local +y in the blade frame (span direction). Toward feather
 * (+pitch) the leading edge (local +x) turns into the wind (+z, upwind), which
 * is a negative rotation about +y.
 *
 * pitchAngleDeg: 0 = fine pitch (max power), 90 = feathered (shutdown).
 */

import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const DEG_TO_RAD = Math.PI / 180;
const MAX_PITCH_RATE_RAD_PER_S = 2.0 * DEG_TO_RAD; // 2°/s (ROSCO PC_MaxRat 0.0349 rad/s)

export function usePitchAngle(
  blade1Ref: React.RefObject<Group | null>,
  blade2Ref: React.RefObject<Group | null>,
  blade3Ref: React.RefObject<Group | null>,
  pitchAngleDeg: number,
): void {
  const targetRad = -pitchAngleDeg * DEG_TO_RAD;

  useFrame((_state, delta) => {
    for (const bladeRef of [blade1Ref, blade2Ref, blade3Ref]) {
      if (!bladeRef.current) continue;

      const current = bladeRef.current.rotation.y;
      const diff = targetRad - current;
      const maxStep = MAX_PITCH_RATE_RAD_PER_S * delta;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
      bladeRef.current.rotation.y += step;
    }
  });
}
