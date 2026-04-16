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

      {/* Gearbox (medium-speed planetary) */}
      <group
        position={[0, -0.5, -exp * 0.5]}
        name="gearbox"
        onClick={pickPart("gearbox")}
      >
        {/* Ghost shell — transparent to reveal internals */}
        <mesh castShadow>
          <boxGeometry args={[3.5, 2, 2]} />
          <meshStandardMaterial
            color={usePartColor("gearbox", selectedPart, "#374151")}
            roughness={0.4}
            metalness={0.6}
            emissive={usePartEmissive("gearbox", selectedPart)}
            emissiveIntensity={usePartEmissiveIntensity("gearbox", selectedPart)}
            transparent
            opacity={0.15}
          />
        </mesh>
        {/* Ring gear (outer) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.6, 0.15, 8, 32]} />
          <meshStandardMaterial color="#374151" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Planet carrier (middle) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.0, 0.12, 8, 24]} />
          <meshStandardMaterial color="#4b5563" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Sun gear stub (centre) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 2.2, 16]} />
          <meshStandardMaterial color="#6b7280" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Generator (PMSG) */}
      <group position={[0, -2.5, -exp * 0.7]} name="generator" onClick={pickPart("generator")}>
        {/* Stator disc */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[2, 2, 1.8, 32]} />
          <meshStandardMaterial
            color={usePartColor("generator", selectedPart, "#1e3a5f")}
            roughness={0.3}
            metalness={0.7}
            emissive={selectedPart === "generator" ? "#1d4ed8" : "#0a2040"}
            emissiveIntensity={selectedPart === "generator" ? 0.5 : 0.15}
          />
        </mesh>
        {/* Copper/iron coil strips ×4 */}
        {[0, 0.45, 0.9, 1.35].map((offset, i) => (
          <mesh key={i} position={[0, offset - 0.675, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.9, 0.08, 6, 32]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#b45309" : "#374151"}
              metalness={0.6}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* Converter cabinet */}
      <group name="converter" position={[3.5, -3, -exp * 0.6]} onClick={pickPart("converter")}>
        <mesh castShadow>
          <boxGeometry args={[2, 1.5, 1.2]} />
          <meshStandardMaterial
            color={usePartColor("converter", selectedPart, "#1f2937")}
            roughness={0.5}
            metalness={0.5}
            emissive={usePartEmissive("converter", selectedPart)}
            emissiveIntensity={usePartEmissiveIntensity("converter", selectedPart)}
          />
        </mesh>
        {/* Glowing display panels on front face (z = +0.61 = half depth + overlap) */}
        {([[-0.5, 0.3], [0.1, 0.3], [-0.5, -0.2]] as [number, number][]).map(([px, py], i) => (
          <mesh key={i} position={[px, py, 0.61]}>
            <boxGeometry args={[0.35, 0.2, 0.02]} />
            <meshStandardMaterial color="#0f4c75" emissive="#1a6fa8" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
});
