/**
 * Drives rotor group rotation from live rotorSpeedRpm.
 *
 * Physics: ω = (rpm × 2π) / 60  [rad/s]
 *
 * The rotation is accumulated each frame using delta time from
 * useFrame, giving frame-rate-independent animation that matches
 * the exact RPM value in the store.
 */

import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const TWO_PI_OVER_60 = (2 * Math.PI) / 60;

export function useRotorSpin(
  rotorRef: React.RefObject<Group | null>,
  rotorSpeedRpm: number,
): void {
  useFrame((_state, delta) => {
    const rotor = rotorRef.current;
    if (!rotor) return;
    const omega = rotorSpeedRpm * TWO_PI_OVER_60; // rad/s
    const { x, y, z } = rotor.rotation;
    rotor.rotation.set(x, y, z + omega * delta);
  });
}
