/**
 * Renders its children in the nacelle's (yaw) frame, including the tower
 * lean — by copying the world matrix of the V236Turbine yaw group every
 * frame. Overlays authored in yaw-frame coordinates (model/layout) then stay
 * glued to the drivetrain whatever the nacelle heading.
 */

import { useRef, type ReactNode } from "react";
import type { Group } from "three";
import { useFrame, useThree } from "@react-three/fiber";

export const NACELLE_YAW_NAME = "nacelle-yaw";

export function InNacelleFrame({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    const src = scene.getObjectByName(NACELLE_YAW_NAME);
    const g = ref.current;
    if (!src || !g) return;
    g.matrix.copy(src.matrixWorld);
    g.matrixWorldNeedsUpdate = true;
  });
  return (
    <group ref={ref} matrixAutoUpdate={false}>
      {children}
    </group>
  );
}
