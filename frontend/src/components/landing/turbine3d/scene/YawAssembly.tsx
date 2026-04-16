/**
 * Yaw assembly — the ring + drives between tower top and nacelle base.
 *
 * Consists of:
 *   Yaw ring: large slewing ring bearing (Ø ~6 m, 0.5 m tall)
 *   Yaw drives: 4 pinion gearboxes equally spaced around the ring
 *
 * All positioned at y=147.5 (just below hub at y=150).
 */

import { memo } from "react";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";

interface YawAssemblyProps {
  isSelected: boolean;
  selectedPart: TurbinePartId | null;
}

export const YawAssembly = memo(function YawAssembly({ isSelected }: YawAssemblyProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const drivePositions: [number, number, number][] = [
    [ 3.2, 0, 0],
    [-3.2, 0, 0],
    [0, 0,  3.2],
    [0, 0, -3.2],
  ];

  return (
    <group position={[0, 147.5, 0]}>
      {/* Yaw slewing ring */}
      <mesh
        castShadow
        name="yaw"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("yaw"); }}
      >
        <torusGeometry args={[3.2, 0.6, 8, 32]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#374151"}
          roughness={0.35}
          metalness={0.7}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>

      {/* 4 yaw drive motors */}
      {drivePositions.map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <boxGeometry args={[0.8, 1.2, 0.8]} />
          <meshStandardMaterial
            color={isSelected ? "#93c5fd" : "#1f2937"}
            roughness={0.4}
            metalness={0.6}
            emissive={isSelected ? "#1d4ed8" : "#000000"}
            emissiveIntensity={isSelected ? 0.2 : 0}
          />
        </mesh>
      ))}
    </group>
  );
});
