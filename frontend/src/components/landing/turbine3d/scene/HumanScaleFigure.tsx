/**
 * 1.8 m human-scale figure at the tower base.
 *
 * Simple capsule silhouette — just enough to show how tiny a person is
 * next to a 268 m turbine. Toggle via ViewerControls.
 */

import { memo } from "react";

export const HumanScaleFigure = memo(function HumanScaleFigure() {
  return (
    <group position={[7, 0, 0]}>
      {/* Body */}
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.2, 1.0, 4, 8]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.6} metalness={0.0} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.65, 0]}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshStandardMaterial color="#fde68a" roughness={0.5} metalness={0.0} />
      </mesh>
      {/* Height label handled by AnnotationMarker */}
    </group>
  );
});
