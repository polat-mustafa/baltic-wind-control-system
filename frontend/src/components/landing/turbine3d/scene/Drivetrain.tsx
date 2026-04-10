/**
 * Internal drivetrain — visible in cutaway / exploded modes.
 *
 * Components (all positioned relative to nacelle interior, hub at y=150):
 *   Main shaft:      Ø 1.1 m × 8 m long (z-axis)
 *   Main bearing:    Ø 2.2 m × 1.5 m wide (front of shaft)
 *   Gearbox:         3.5 m × 2 m × 2 m box (medium-speed: 1P + 1H stage)
 *   Generator (PMSG): Ø 4 m × 1.8 m disc (aft of gearbox)
 *   Brake disc:      Ø 1.6 m × 0.3 m (between shaft and gearbox)
 *   Converter cabinet: 2 m × 1.5 m × 1.2 m (nacelle base, aft)
 *
 * explodedOffset: moves components along -Z to visualise separation.
 */

import { memo } from "react";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";

interface DrivetrainProps {
  selectedPart: TurbinePartId | null;
  explodedOffset: number; // 0 = normal, 1 = fully exploded (offsets applied)
}

const HIGHLIGHT = "#60a5fa";
const HIGHLIGHT_EMISSIVE = "#1d4ed8";

function usePartColor(partId: TurbinePartId, selectedPart: TurbinePartId | null, base: string) {
  return selectedPart === partId ? HIGHLIGHT : base;
}
function usePartEmissive(partId: TurbinePartId, selectedPart: TurbinePartId | null) {
  return selectedPart === partId ? HIGHLIGHT_EMISSIVE : "#000000";
}
function usePartEmissiveIntensity(partId: TurbinePartId, selectedPart: TurbinePartId | null) {
  return selectedPart === partId ? 0.4 : 0;
}

export const Drivetrain = memo(function Drivetrain({
  selectedPart,
  explodedOffset,
}: DrivetrainProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const exp = explodedOffset * 8; // max separation 8 m per unit

  const pickPart = (id: TurbinePartId) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart(id);
  };

  return (
    <group position={[0, 151, 0]}>
      {/* Main shaft — horizontal, pointing toward rotor (+Y in world = rotor side) */}
      <mesh
        position={[0, 2, -exp * 0.2]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        name="shaft"
        onClick={pickPart("shaft")}
      >
        <cylinderGeometry args={[0.55, 0.55, 8, 16]} />
        <meshStandardMaterial
          color={usePartColor("shaft", selectedPart, "#4b5563")}
          roughness={0.3}
          metalness={0.7}
          emissive={usePartEmissive("shaft", selectedPart)}
          emissiveIntensity={usePartEmissiveIntensity("shaft", selectedPart)}
        />
      </mesh>

      {/* Main bearing — large forged ring */}
      <mesh
        position={[0, 3, -exp * 0.1]}
        name="bearing"
        castShadow
        onClick={pickPart("bearing")}
      >
        <torusGeometry args={[1.1, 0.55, 12, 24]} />
        <meshStandardMaterial
          color={usePartColor("bearing", selectedPart, "#374151")}
          roughness={0.25}
          metalness={0.8}
          emissive={usePartEmissive("bearing", selectedPart)}
          emissiveIntensity={usePartEmissiveIntensity("bearing", selectedPart)}
        />
      </mesh>

      {/* Brake disc */}
      <mesh
        position={[0, 1, -exp * 0.3]}
        rotation={[Math.PI / 2, 0, 0]}
        name="brake"
        castShadow
        onClick={pickPart("brake")}
      >
        <cylinderGeometry args={[0.8, 0.8, 0.3, 24]} />
        <meshStandardMaterial
          color={usePartColor("brake", selectedPart, "#1f2937")}
          roughness={0.4}
          metalness={0.6}
          emissive={usePartEmissive("brake", selectedPart)}
          emissiveIntensity={usePartEmissiveIntensity("brake", selectedPart)}
        />
      </mesh>

      {/* Gearbox (medium-speed) */}
      <mesh
        position={[0, -0.5, -exp * 0.5]}
        name="gearbox"
        castShadow
        onClick={pickPart("gearbox")}
      >
        <boxGeometry args={[3.5, 2, 2]} />
        <meshStandardMaterial
          color={usePartColor("gearbox", selectedPart, "#374151")}
          roughness={0.4}
          metalness={0.6}
          emissive={usePartEmissive("gearbox", selectedPart)}
          emissiveIntensity={usePartEmissiveIntensity("gearbox", selectedPart)}
        />
      </mesh>

      {/* Generator (PMSG disc) */}
      <mesh
        position={[0, -2.5, -exp * 0.7]}
        rotation={[Math.PI / 2, 0, 0]}
        name="generator"
        castShadow
        onClick={pickPart("generator")}
      >
        <cylinderGeometry args={[2, 2, 1.8, 24]} />
        <meshStandardMaterial
          color={usePartColor("generator", selectedPart, "#1e3a5f")}
          roughness={0.3}
          metalness={0.7}
          emissive={
            selectedPart === "generator"
              ? HIGHLIGHT_EMISSIVE
              : "#0a2040"
          }
          emissiveIntensity={selectedPart === "generator" ? 0.5 : 0.15}
        />
      </mesh>

      {/* Converter cabinet */}
      <mesh
        position={[3.5, -3, -exp * 0.6]}
        name="converter"
        castShadow
        onClick={pickPart("converter")}
      >
        <boxGeometry args={[2, 1.5, 1.2]} />
        <meshStandardMaterial
          color={usePartColor("converter", selectedPart, "#1f2937")}
          roughness={0.5}
          metalness={0.5}
          emissive={usePartEmissive("converter", selectedPart)}
          emissiveIntensity={usePartEmissiveIntensity("converter", selectedPart)}
        />
      </mesh>
    </group>
  );
});
