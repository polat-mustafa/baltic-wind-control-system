/**
 * Turns the nacelle group to the simulated nacelle heading.
 *
 * The yaw *dynamics* live in the landing simulation (landingStore: yaw rate
 * ≤ 1 °/s, 0.5° deadband, shortest path), which updates nacellePositionDeg
 * every 5 s tick. This hook only interpolates between those ticks at the same
 * 1 °/s so the 3D nacelle never lags or leads the SCADA value.
 *
 * On mount (and after a big jump — another turbine selected, tab was hidden)
 * it snaps to the heading: the old version started every nacelle at 0° (north)
 * and slewed at 0.5 °/s, so a turbine opened with the wind from 225° spent
 * ~4.5 min pointing the wrong way.
 *
 * Sign convention: nacellePositionDeg is a compass bearing (CW from N) of the
 * rotor axis (upwind). Three.js rotation.y is CCW about +y, and the rotor sits
 * on local +z, so rotation.y = −ψ maps +z to (−sin ψ, 0, cos ψ) = bearing ψ
 * in the world frame (N = +z, E = −x).
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

const DEG_TO_RAD = Math.PI / 180;
const YAW_RATE_RAD_PER_S = 1.0 * DEG_TO_RAD; // same as the simulation
const SNAP_RAD = 10 * DEG_TO_RAD;

export function useYawRotation(
  nacelleRef: React.RefObject<Group | null>,
  nacellePositionDeg: number,
): void {
  const initialised = useRef(false);
  useFrame((_state, delta) => {
    const nacelle = nacelleRef.current;
    if (!nacelle) return;

    const target = -(nacellePositionDeg * DEG_TO_RAD);
    const current = nacelle.rotation.y;

    // Shortest-path difference on circle [-π, π]
    let diff = target - current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    if (!initialised.current || Math.abs(diff) > SNAP_RAD) {
      initialised.current = true;
      nacelle.rotation.set(nacelle.rotation.x, target, nacelle.rotation.z);
      return;
    }
    const maxStep = YAW_RATE_RAD_PER_S * Math.min(delta, 0.1);
    const next = current + Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
    nacelle.rotation.set(nacelle.rotation.x, next, nacelle.rotation.z);
  });
}
