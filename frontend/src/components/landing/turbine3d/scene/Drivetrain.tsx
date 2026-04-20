/**
 * Internal drivetrain — visible in cutaway / exploded modes.
 *
 * V236-15.0 MW drivetrain spec (nacelle ~520 tonnes):
 *   Main shaft:       Ø 1.1 m × 8 m long (z-axis), forged steel
 *   Main bearing:     Ø 2.2 m × 1.5 m wide (front of shaft), spherical roller
 *   Gearbox:          3.5 m × 2 m × 2 m (3-stage planetary, ZF Wind Power, ratio 1:48)
 *                     8.33 rpm → ~17 rpm → ~67 rpm → 400 rpm (3 stages)
 *   Generator (PMSG): Ø 4 m × 1.8 m disc (784 V, max 400 RPM, four-quadrant IGBT converter)
 *                     Stator with 8 cooling fins, 12-pole permanent magnet rotor
 *   Brake disc:       Ø 1.6 m × 0.3 m (between shaft and gearbox, IEC 61400-4)
 *   Converters:       Two cabinets 2 m × 1.5 m × 1.2 m (port + starboard, full-power)
 *   Bedplate:         Steel I-beam mainframe, structural backbone of nacelle
 *
 * explodedOffset: moves components along -Z to visualise separation.
 */

import { memo } from "react";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";
import {
  metalRaw,
  metalPolished,
  metalPaintedShell,
  metalPaintedDetail,
  brushedAluminium,
} from "../materials";
import { BoltRing } from "./nacelle/BoltRing";
import { Nameplate } from "./nacelle/Nameplate";

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

/** Three planet gear cylinders evenly spaced at a given orbit radius & z */
function PlanetGears({ orbitR, z }: { orbitR: number; z: number }) {
  return (
    <>
      {[0, 120, 240].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh
            key={deg}
            position={[Math.cos(rad) * orbitR, Math.sin(rad) * orbitR, z]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.18, 0.18, 0.28, 10]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.25} />
          </mesh>
        );
      })}
    </>
  );
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
      {/* ── Bedplate / mainframe ─────────────────────────────────── */}
      {/* Two longitudinal I-beams running the nacelle length, + 3 cross-members */}
      <group name="bedplate" onClick={pickPart("bedplate")}>
        {/* Port longitudinal beam */}
        <mesh position={[-2.5, -3.5, -4]}>
          <boxGeometry args={[0.35, 0.5, 18]} />
          <meshStandardMaterial
            color={usePartColor("bedplate", selectedPart, "#1c1917")}
            roughness={0.7}
            metalness={0.8}
            emissive={usePartEmissive("bedplate", selectedPart)}
            emissiveIntensity={usePartEmissiveIntensity("bedplate", selectedPart)}
          />
        </mesh>
        {/* Starboard longitudinal beam */}
        <mesh position={[2.5, -3.5, -4]}>
          <boxGeometry args={[0.35, 0.5, 18]} />
          <meshStandardMaterial color="#1c1917" roughness={0.7} metalness={0.8} />
        </mesh>
        {/* Cross-member 1 (forward) */}
        <mesh position={[0, -3.5, 4]}>
          <boxGeometry args={[5.35, 0.4, 0.35]} />
          <meshStandardMaterial color="#292524" roughness={0.7} metalness={0.8} />
        </mesh>
        {/* Cross-member 2 (mid) */}
        <mesh position={[0, -3.5, -2]}>
          <boxGeometry args={[5.35, 0.4, 0.35]} />
          <meshStandardMaterial color="#292524" roughness={0.7} metalness={0.8} />
        </mesh>
        {/* Cross-member 3 (aft) */}
        <mesh position={[0, -3.5, -8]}>
          <boxGeometry args={[5.35, 0.4, 0.35]} />
          <meshStandardMaterial color="#292524" roughness={0.7} metalness={0.8} />
        </mesh>
      </group>

      {/* ── Main shaft ───────────────────────────────────────────── */}
      {/* Forged 42CrMo4 steel — polished mirror finish after machining. */}
      <mesh
        position={[0, 2, -exp * 0.2]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        name="shaft"
        onClick={pickPart("shaft")}
      >
        <cylinderGeometry args={[0.55, 0.55, 8, 24]} />
        <meshPhysicalMaterial
          {...metalPolished}
          color={usePartColor("shaft", selectedPart, metalPolished.color)}
          emissive={usePartEmissive("shaft", selectedPart)}
          emissiveIntensity={usePartEmissiveIntensity("shaft", selectedPart)}
        />
      </mesh>

      {/* ── Main bearing ─────────────────────────────────────────── */}
      {/* Raw-cast pillow-block + 24-bolt flange ring (ISO 898-1 class 10.9). */}
      <group position={[0, 3, -exp * 0.1]}>
        <mesh
          name="bearing"
          castShadow
          onClick={pickPart("bearing")}
        >
          <torusGeometry args={[1.1, 0.55, 14, 32]} />
          <meshPhysicalMaterial
            {...metalRaw}
            color={usePartColor("bearing", selectedPart, metalRaw.color)}
            emissive={usePartEmissive("bearing", selectedPart)}
            emissiveIntensity={usePartEmissiveIntensity("bearing", selectedPart)}
          />
        </mesh>
        <BoltRing axis="z" radius={1.1} count={24} boltRadius={0.04} boltLength={0.22} />
      </group>

      {/* ── Brake disc ───────────────────────────────────────────── */}
      <mesh
        position={[0, 1, -exp * 0.3]}
        rotation={[Math.PI / 2, 0, 0]}
        name="brake"
        castShadow
        onClick={pickPart("brake")}
      >
        <cylinderGeometry args={[0.8, 0.8, 0.3, 32]} />
        <meshPhysicalMaterial
          {...metalPolished}
          color={usePartColor("brake", selectedPart, "#6b7280")}
          roughness={0.22}
          emissive={usePartEmissive("brake", selectedPart)}
          emissiveIntensity={usePartEmissiveIntensity("brake", selectedPart)}
        />
      </mesh>

      {/* ── Gearbox — 3-stage planetary (ZF Wind Power, 1:48) ────── */}
      {/*   Stage 1 (LS): 8.33 rpm → ~17 rpm  — ring Ø3.2 m          */}
      {/*   Stage 2 (IS): ~17 rpm → ~67 rpm   — ring Ø2.4 m          */}
      {/*   Stage 3 (HS): ~67 rpm → 400 rpm   — ring Ø1.8 m          */}
      <group
        position={[0, -0.5, -exp * 0.5]}
        name="gearbox"
        onClick={pickPart("gearbox")}
      >
        {/* Ghost housing — industrial blue-grey painted cast iron. */}
        <mesh castShadow>
          <boxGeometry args={[3.5, 2.2, 2.4]} />
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color={usePartColor("gearbox", selectedPart, "#2a3441")}
            emissive={usePartEmissive("gearbox", selectedPart)}
            emissiveIntensity={usePartEmissiveIntensity("gearbox", selectedPart)}
            transparent
            opacity={0.18}
          />
        </mesh>

        {/* Input flange bolt ring (torque-arm interface, 32 × M36) */}
        <BoltRing
          center={[0, 0, 1.2]}
          axis="z"
          radius={1.4}
          count={32}
          boltRadius={0.05}
          boltLength={0.16}
        />
        {/* Output flange bolt ring */}
        <BoltRing
          center={[0, 0, -1.2]}
          axis="z"
          radius={0.95}
          count={24}
          boltRadius={0.04}
          boltLength={0.14}
        />

        {/* Stage 1 — low-speed planetary (ring Ø3.2 m at z=+0.72) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.72]}>
          <torusGeometry args={[1.6, 0.12, 10, 40]} />
          <meshPhysicalMaterial {...metalPolished} color="#4b5563" roughness={0.28} />
        </mesh>
        <PlanetGears orbitR={0.95} z={0.72} />

        {/* Stage 2 — intermediate planetary (ring Ø2.4 m at z=0) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <torusGeometry args={[1.2, 0.11, 10, 36]} />
          <meshPhysicalMaterial {...metalPolished} color="#6b7280" roughness={0.24} />
        </mesh>
        <PlanetGears orbitR={0.70} z={0} />

        {/* Stage 3 — high-speed planetary (ring Ø1.8 m at z=-0.72) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.72]}>
          <torusGeometry args={[0.9, 0.10, 10, 32]} />
          <meshPhysicalMaterial {...metalPolished} color="#9ca3af" roughness={0.18} />
        </mesh>
        <PlanetGears orbitR={0.50} z={-0.72} />

        {/* Output sun gear stub */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.72]}>
          <cylinderGeometry args={[0.22, 0.22, 2.4, 18]} />
          <meshPhysicalMaterial {...metalPolished} color="#d1d5db" roughness={0.14} />
        </mesh>

        {/* Engineering nameplate — ZF Wind Power style */}
        <Nameplate
          position={[1.75 + 0.01, 0.4, 0]}
          rotation={[0, Math.PI / 2, 0]}
          title="GEARBOX · 3-STAGE PLANETARY"
          lines={["RATIO 1:48", "15 000 Nm · IEC 61400-4", "SN V236-ZF-0001"]}
          width={0.85}
          height={0.42}
        />
      </group>

      {/* ── Generator (PMSG) — 784 V, 400 RPM ───────────────────── */}
      <group position={[0, -2.5, -exp * 0.7]} name="generator" onClick={pickPart("generator")}>
        {/* Outer stator housing — navy enamel painted cast iron */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[2.05, 2.05, 1.9, 48]} />
          <meshPhysicalMaterial
            {...metalPaintedShell}
            color={usePartColor("generator", selectedPart, "#1e3a5f")}
            roughness={0.3}
            metalness={0.55}
            emissive={selectedPart === "generator" ? "#1d4ed8" : "#0a2040"}
            emissiveIntensity={selectedPart === "generator" ? 0.5 : 0.12}
          />
        </mesh>

        {/* Generator-mount bolt ring on rear flange (drive end) */}
        <BoltRing
          center={[0, 0, 1.0]}
          axis="z"
          radius={1.95}
          count={36}
          boltRadius={0.05}
          boltLength={0.18}
        />

        {/* Engineering nameplate — top of housing, facing forward */}
        <Nameplate
          position={[0, 2.08, 0.65]}
          rotation={[-Math.PI / 2, 0, 0]}
          title="PMSG · 15 MW"
          lines={["784 V · 460 rpm @ rated", "η 96 % · NREL TP-84919", "IEC 60034-1"]}
          width={1.2}
          height={0.48}
        />

        {/* Cooling fins — 8 thin rectangular fins around circumference */}
        {Array.from({ length: 8 }).map((_, i) => {
          const ang = (i * Math.PI) / 4;
          return (
            <mesh
              key={i}
              position={[Math.cos(ang) * 2.15, Math.sin(ang) * 2.15, 0]}
              rotation={[0, 0, ang]}
            >
              <boxGeometry args={[0.08, 0.3, 1.8]} />
              <meshStandardMaterial color="#1a3350" metalness={0.7} roughness={0.3} />
            </mesh>
          );
        })}

        {/* Rotor with permanent magnet poles (12 alternating N/S segments) */}
        {Array.from({ length: 12 }).map((_, i) => {
          const ang = (i * Math.PI * 2) / 12;
          return (
            <mesh
              key={i}
              position={[Math.cos(ang) * 1.75, Math.sin(ang) * 1.75, 0]}
              rotation={[0, 0, ang]}
            >
              <boxGeometry args={[0.12, 0.35, 1.6]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#b91c1c" : "#1d4ed8"}
                metalness={0.6}
                roughness={0.4}
                emissive={i % 2 === 0 ? "#7f1d1d" : "#1e3a8a"}
                emissiveIntensity={0.15}
              />
            </mesh>
          );
        })}

        {/* Terminal box — top of housing */}
        <mesh position={[0, 2.3, 0.4]}>
          <boxGeometry args={[0.7, 0.4, 0.5]} />
          <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.5} />
        </mesh>

        {/* Cooling fan disc — drive end */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.1]}>
          <cylinderGeometry args={[1.8, 1.8, 0.12, 24]} />
          <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.6} />
        </mesh>
      </group>

      {/* ── Converter cabinets — port + starboard ────────────────── */}
      {/* Port cabinet (carries the engineering nameplate) */}
      <group name="converter" position={[-3.5, -3, -exp * 0.6]} onClick={pickPart("converter")}>
        <Nameplate
          position={[-1.01, 0.4, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          title="CONVERTER · FULL POWER"
          lines={["IGBT · 4-QUADRANT", "η 98.5 % (literature)", "IEC 62477-1"]}
          width={0.85}
          height={0.42}
        />
        <mesh castShadow>
          <boxGeometry args={[2, 1.5, 1.2]} />
          <meshPhysicalMaterial
            {...brushedAluminium}
            color={usePartColor("converter", selectedPart, brushedAluminium.color)}
            emissive={usePartEmissive("converter", selectedPart)}
            emissiveIntensity={usePartEmissiveIntensity("converter", selectedPart)}
          />
        </mesh>
        {/* IGBT module blocks on front face */}
        {([[-0.5, 0.3], [0.1, 0.3], [-0.5, -0.2], [0.1, -0.2]] as [number, number][]).map(
          ([px, py], i) => (
            <mesh key={i} position={[px, py, 0.61]}>
              <boxGeometry args={[0.4, 0.22, 0.03]} />
              <meshStandardMaterial color="#0f4c75" emissive="#1a6fa8" emissiveIntensity={0.8} />
            </mesh>
          )
        )}
      </group>

      {/* Starboard cabinet */}
      <group position={[3.5, -3, -exp * 0.6]} onClick={pickPart("converter")}>
        <mesh castShadow>
          <boxGeometry args={[2, 1.5, 1.2]} />
          <meshPhysicalMaterial
            {...brushedAluminium}
            color={usePartColor("converter", selectedPart, brushedAluminium.color)}
            emissive={usePartEmissive("converter", selectedPart)}
            emissiveIntensity={usePartEmissiveIntensity("converter", selectedPart)}
          />
        </mesh>
        {([[-0.5, 0.3], [0.1, 0.3], [-0.5, -0.2], [0.1, -0.2]] as [number, number][]).map(
          ([px, py], i) => (
            <mesh key={i} position={[px, py, 0.61]}>
              <boxGeometry args={[0.4, 0.22, 0.03]} />
              <meshStandardMaterial color="#0f4c75" emissive="#1a6fa8" emissiveIntensity={0.8} />
            </mesh>
          )
        )}
      </group>
    </group>
  );
});
