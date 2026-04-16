/**
 * Top-mounted nacelle cooler (radiator unit).
 * Sits on the nacelle roof at approximately y=155.
 */

import { memo } from "react";

import { useLandingStore } from "../../../../store/landingStore";

interface CoolerProps {
  isSelected: boolean;
}

export const Cooler = memo(function Cooler({ isSelected }: CoolerProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  return (
    <group position={[0, 155.5, -4]}>
      <mesh
        castShadow
        name="cooler"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("cooler"); }}
      >
        <boxGeometry args={[4.5, 1.2, 6]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#4b5563"}
          roughness={0.5}
          metalness={0.4}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {/* Vent slats */}
      {[-2, -0.5, 1, 2.5].map((z, i) => (
        <mesh key={i} position={[0, 0.7, z]}>
          <boxGeometry args={[4.3, 0.1, 0.8]} />
          <meshStandardMaterial color="#374151" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
});
