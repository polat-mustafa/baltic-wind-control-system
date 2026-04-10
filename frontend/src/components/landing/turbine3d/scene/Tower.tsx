/**
 * V236 offshore steel tower.
 *
 * Dimensions:
 *   Base Ø: 10 m (at y=26, top of transition piece)
 *   Top Ø: 5 m (at y=150, hub height)
 *   Height: 124 m (from y=26 to y=150)
 *
 * The tower is a tapered steel cylinder (conical frustum).
 * Three access platforms are shown as thin rings at y=50, y=100.
 */

import { memo } from "react";

import { useLandingStore } from "../../../../store/landingStore";

interface TowerProps {
  isSelected: boolean;
}

export const Tower = memo(function Tower({ isSelected }: TowerProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const H = 124;
  const yBottom = 26;
  const yCentre = yBottom + H / 2; // 88

  return (
    <group>
      {/* Main tower body — tapered cylinder (CylinderGeometry: top, bottom, height) */}
      <mesh
        position={[0, yCentre, 0]}
        castShadow
        receiveShadow
        name="tower"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("tower"); }}
      >
        <cylinderGeometry args={[2.5, 5, H, 48, 8]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#6b7280"}
          roughness={0.55}
          metalness={0.45}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>

      {/* Access platform rings */}
      {[50, 100].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[3.2, 0.25, 8, 32]} />
          <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.5} />
        </mesh>
      ))}

      {/* Aviation light at top */}
      <mesh position={[0, 150, 0]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial
          color="#ff4444"
          emissive="#ff0000"
          emissiveIntensity={1.5}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
});
