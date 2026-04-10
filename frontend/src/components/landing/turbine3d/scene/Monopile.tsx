/**
 * Monopile foundation + transition piece.
 *
 * Dimensions (V236 Baltic typical):
 *   Diameter: Ø 9 m
 *   Above waterline: ~20 m (y=0 → y=20)
 *   Below seabed: ~40 m (y=0 → y=-40) — shown semi-transparent
 *   Transition piece: tapers from 9 m → 6 m over top 8 m
 *
 * The monopile is grey with a corrosion protection yellow stripe
 * at the splash zone (approx y = -2 to +3 m).
 */

import { memo } from "react";

import { useLandingStore } from "../../../../store/landingStore";

interface MonopileProps {
  isSelected: boolean;
}

export const Monopile = memo(function Monopile({ isSelected }: MonopileProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  return (
    <group>
      {/* Below-water section (semi-transparent) */}
      <mesh position={[0, -20, 0]}>
        <cylinderGeometry args={[4.5, 4.5, 40, 32]} />
        <meshStandardMaterial
          color="#3a4255"
          roughness={0.8}
          metalness={0.2}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Above-water monopile body */}
      <mesh
        position={[0, 10, 0]}
        castShadow
        receiveShadow
        name="foundation"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("foundation"); }}
      >
        <cylinderGeometry args={[4.5, 4.5, 20, 32]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#4a5568"}
          roughness={0.7}
          metalness={0.3}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* Splash zone corrosion protection (yellow) */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[4.55, 4.55, 5, 32]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Transition piece (tapers to match tower base Ø 10 m → Ø 9 m) */}
      <mesh position={[0, 23, 0]} castShadow>
        <cylinderGeometry args={[5, 4.5, 6, 32]} />
        <meshStandardMaterial color="#4a5568" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
});
