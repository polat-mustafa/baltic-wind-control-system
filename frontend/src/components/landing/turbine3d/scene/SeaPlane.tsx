/**
 * Baltic Sea water surface.
 *
 * A flat, slightly transparent plane at y=0 with a dark-teal PBR material.
 * The plane is large enough (600×600 m) to extend to the horizon at the
 * default camera distance.
 */

import { memo } from "react";

export const SeaPlane = memo(function SeaPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[600, 600]} />
      <meshStandardMaterial
        color="#0a1628"
        roughness={0.3}
        metalness={0.1}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
});
