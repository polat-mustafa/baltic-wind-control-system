/**
 * Smoothly rotates the nacelle group toward the current nacellePositionDeg.
 *
 * Slew rate is limited to 0.5°/s — realistic for a V236 yaw system
 * driving a 280-tonne nacelle (IEC 61400-1 typical).
 *
 * Three.js Y-axis is vertical (yaw axis), so we write rotation.y.
 * Sign convention: nacellePositionDeg is a compass bearing (CW from N),
 * Three.js rotation.y is CCW from +Z in world space.
 * We negate and convert: rotation.y = -(deg × π/180)
 */

import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const DEG_TO_RAD = Math.PI / 180;
const MAX_YAW_RATE_RAD_PER_S = 0.5 * DEG_TO_RAD; // 0.5°/s

export function useYawRotation(
  nacelleRef: React.RefObject<Group | null>,
  nacellePositionDeg: number,
): void {
  useFrame((_state, delta) => {
    if (!nacelleRef.current) return;

    const target = -(nacellePositionDeg * DEG_TO_RAD);
    const current = nacelleRef.current.rotation.y;

    // Shortest-path difference on circle [-π, π]
    let diff = target - current;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    const maxStep = MAX_YAW_RATE_RAD_PER_S * delta;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
    nacelleRef.current.rotation.y += step;
  });
}
