/**
 * Nacelle shell — aerodynamic enclosure housing the drivetrain.
 *
 * Dimensions: ~20 m long × 7 m wide × 8 m tall (V236 approximate).
 * In normal mode: solid shell, slightly reflective steel/fibreglass.
 * In cutaway mode: becomes wireframe + 40% opacity to reveal internals.
 * In exploded mode: also transparent.
 *
 * The nacelle shell does NOT rotate — the Rotor+YawAssembly group handles
 * yaw rotation at the tower top. The nacelle sits at y=150, z-offset -3
 * (aft of hub centre).
 */

import { memo } from "react";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";

interface NacelleProps {
  viewerMode: "normal" | "cutaway" | "exploded";
  selectedPart: TurbinePartId | null;
}

export const Nacelle = memo(function Nacelle({ viewerMode, selectedPart }: NacelleProps) {
  const isSelected = selectedPart === "nacelle";
  const isCutaway = viewerMode === "cutaway" || viewerMode === "exploded";
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  return (
    <group position={[0, 151, -5]}>
      {/* Main nacelle body */}
      <mesh
        castShadow
        receiveShadow
        name="nacelle"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("nacelle"); }}
      >
        <boxGeometry args={[7, 7, 20]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#6b7280"}
          roughness={0.4}
          metalness={0.5}
          transparent={isCutaway}
          opacity={isCutaway ? 0.2 : 1}
          wireframe={isCutaway}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>

      {/* Nacelle cover — slightly raised aerodynamic cowling */}
      <mesh position={[0, 4.2, -2]} castShadow>
        <boxGeometry args={[6.5, 1.5, 16]} />
        <meshStandardMaterial
          color="#9ca3af"
          roughness={0.35}
          metalness={0.45}
          transparent={isCutaway}
          opacity={isCutaway ? 0.15 : 1}
          wireframe={isCutaway}
        />
      </mesh>
    </group>
  );
});
