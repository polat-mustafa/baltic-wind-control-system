/**
 * Rotor hub + spinner cone.
 *
 * The hub is the central casting that connects the three blades to the
 * main shaft. The spinner cone covers the front of the hub.
 *
 * Hub Ø: ~5 m (approximate V236 scale)
 * Cone depth: ~4 m (aerodynamic fairing)
 */

import { memo } from "react";

import { useLandingStore } from "../../../../store/landingStore";

interface HubProps {
  isSelected: boolean;
}

export const Hub = memo(function Hub({ isSelected }: HubProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  return (
    <group>
      {/* Hub body */}
      <mesh
        castShadow
        name="hub"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("hub"); }}
      >
        <sphereGeometry args={[2.8, 16, 12]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#374151"}
          roughness={0.45}
          metalness={0.55}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* Spinner cone — aerodynamic nose */}
      <mesh position={[0, 3.5, 0]} castShadow>
        <coneGeometry args={[2.2, 5, 16]} />
        <meshStandardMaterial
          color="#4b5563"
          roughness={0.35}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
});
