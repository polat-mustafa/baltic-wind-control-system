/**
 * Drives rotor group rotation from live rotorSpeedRpm.
 *
 * Physics: ω = (rpm × 2π) / 60  [rad/s], integrated with the frame delta so
 * the speed matches the store exactly. The rotor turns CLOCKWISE seen from
 * upwind (industry standard) — i.e. negative about the rotor axis +z, which
 * points upwind.
 *
 * The accumulated angle is shared (`rotorPhase`) so the drivetrain (main
 * shaft, direct-drive generator rotor) and the tip-vortex wake stay locked to
 * the blades.
 */

import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const TWO_PI_OVER_60 = (2 * Math.PI) / 60;

/** Rotor azimuth travelled [rad], positive = clockwise from upwind. */
export const rotorPhase = { value: 0 };

export function useRotorSpin(
  rotorRef: React.RefObject<Group | null>,
  rotorSpeedRpm: number,
): void {
  useFrame((_state, delta) => {
    const rotor = rotorRef.current;
    if (!rotor) return;
    // keep the angle bounded; 48× multiples downstream stay exact modulo 2π
    rotorPhase.value = (rotorPhase.value + rotorSpeedRpm * TWO_PI_OVER_60 * delta) % (2 * Math.PI * 1000);
    const { x, y } = rotor.rotation;
    rotor.rotation.set(x, y, -rotorPhase.value);
  });
}
