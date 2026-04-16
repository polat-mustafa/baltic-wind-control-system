/**
 * Anemometer + wind vane assembly on nacelle roof.
 * Cup anemometer at y=157.5, positioned aft of nacelle (z offset).
 */

import { memo } from "react";

import { useLandingStore } from "../../../../store/landingStore";

interface AnemometerProps {
  isSelected: boolean;
}

export const Anemometer = memo(function Anemometer({ isSelected }: AnemometerProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const color = isSelected ? "#60a5fa" : "#9ca3af";
  const emissive = isSelected ? "#1d4ed8" : "#000000";
  const emissiveIntensity = isSelected ? 0.4 : 0;

  return (
    <group position={[2, 157, -8]}>
      {/* Mast */}
      <mesh
        position={[0, 0, 0]}
        name="anemometer"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("anemometer"); }}
      >
        <cylinderGeometry args={[0.08, 0.08, 2, 8]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.6}
          emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>

      {/* Cup arms — 3 × at 120° */}
      {[0, 1, 2].map((i) => {
        const angle = (i * 2 * Math.PI) / 3;
        const cx = Math.cos(angle) * 0.5;
        const cz = Math.sin(angle) * 0.5;
        return (
          <group key={i}>
            <mesh position={[cx * 0.5, 1.2, cz * 0.5]}>
              <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[cx, 1.2, cz]}>
              <sphereGeometry args={[0.15, 6, 6]} />
              <meshStandardMaterial color={color} roughness={0.3} metalness={0.4}
                emissive={emissive} emissiveIntensity={emissiveIntensity} />
            </mesh>
          </group>
        );
      })}

      {/* Wind vane */}
      <mesh position={[-1.5, 1, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.3]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
});
