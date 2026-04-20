/**
 * NacelleSubsystems — additional nacelle interior components.
 *
 * Visible in cutaway / exploded modes. All world-space positions match
 * the nacelle volume (y 147–155, z -15 to +5, x -4.5 to +4.5).
 *
 * Components (IEC / ISO references):
 *   B1  HPU              — Hydraulic Power Unit + accumulator (ISO 4413)
 *   B3  Control cabinets — Main TCS + Safety PLC (IEC 61508 SIL 2)
 *   B4  Transformer      — 784 V / 66 kV, 16 MVA Dyn11 (IEC 60076-1)
 *   B5  Oil cooler       — Gearbox heat exchanger, 500 kW thermal
 *   B6  Coupling         — Flexible disc-pack coupling, Ø1.4 m (ISO 10441)
 *   B7  Crane rail       — 10 t SWL ceiling crane, two I-beam rails (EN 13001)
 *   B8  UPS cabinet      — 6.6 kWh VRLA battery, 15 min backup (IEC 62040-1)
 *   B9  Yaw brakes       — 4 × SAHR hydraulic disc calipers (EN 13849)
 *   B10 Cable routing    — MV + control cables, ±3.5-turn twist loop
 *   B11 Fire suppression — 4 × 20 kg HFC-227ea cylinders (ISO 14520)
 *   B12 Lightning        — IEC 62305 LPL I down-conductor, 50 mm² copper
 */

import { memo } from "react";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";
import {
  metalPolished,
  metalPaintedShell,
  metalPaintedDetail,
  rubberSeal,
} from "../materials";
import { BoltRing } from "./nacelle/BoltRing";
import { Nameplate } from "./nacelle/Nameplate";

interface NacelleSubsystemsProps {
  selectedPart: TurbinePartId | null;
}

const HL = "#60a5fa";
const HL_EM = "#1d4ed8";

function col(id: TurbinePartId, sel: TurbinePartId | null, base: string) {
  return sel === id ? HL : base;
}
function em(id: TurbinePartId, sel: TurbinePartId | null) {
  return sel === id ? HL_EM : "#000000";
}
function emI(id: TurbinePartId, sel: TurbinePartId | null) {
  return sel === id ? 0.4 : 0;
}

export const NacelleSubsystems = memo(function NacelleSubsystems({
  selectedPart,
}: NacelleSubsystemsProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const pick = (id: TurbinePartId) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart(id);
  };

  return (
    <group>
      {/* ── B6 Generator Flexible Coupling ───────────────────────── */}
      {/* Between gearbox (y≈150.5) and generator (y≈148.5) */}
      <group position={[0, 149.5, 0]} name="coupling" onClick={pick("coupling")}>
        {/* Main disc — precision-ground, polished */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.7, 0.7, 0.4, 32]} />
          <meshPhysicalMaterial
            {...metalPolished}
            color={col("coupling", selectedPart, metalPolished.color)}
            emissive={em("coupling", selectedPart)}
            emissiveIntensity={emI("coupling", selectedPart)}
          />
        </mesh>
        {/* Disc-pack laminate ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.05, 10, 32]} />
          <meshPhysicalMaterial {...metalPolished} color="#9ca3af" roughness={0.18} />
        </mesh>
        {/* Flange bolts — 12 × M24 */}
        <BoltRing axis="z" radius={0.55} count={12} boltRadius={0.035} boltLength={0.16} />
      </group>

      {/* ── B1 Hydraulic Power Unit (HPU) ────────────────────────── */}
      {/* Nacelle floor, starboard side, forward of gearbox */}
      <group position={[2.5, 147.8, 2]} name="hpu" onClick={pick("hpu")}>
        {/* Main pump/reservoir box — RAL 2010 safety orange painted steel */}
        <mesh castShadow>
          <boxGeometry args={[1.5, 1.0, 1.2]} />
          <meshPhysicalMaterial
            {...metalPaintedShell}
            color={col("hpu", selectedPart, "#ea580c")}
            clearcoat={0.6}
            emissive={em("hpu", selectedPart)}
            emissiveIntensity={emI("hpu", selectedPart)}
          />
        </mesh>
        {/* Accumulator cylinder */}
        <mesh position={[0, 0.95, -0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 1.0, 20]} />
          <meshPhysicalMaterial {...metalPaintedShell} color="#c2410c" clearcoat={0.55} />
        </mesh>
        {/* Pressure gauge indicator */}
        <mesh position={[0.76, 0.1, 0.35]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
          <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.5} />
        </mesh>
        {/* Engineering nameplate — front face */}
        <Nameplate
          position={[0, 0.2, 0.605]}
          rotation={[0, 0, 0]}
          title="HPU · 210 bar"
          lines={["ISO 4413 · VG 46", "6.5 kW · 12 L/min", "SIL 2 · SN-HPU-V236"]}
          width={0.78}
          height={0.34}
        />
      </group>

      {/* ── B3 Control Cabinets (TCS + Safety PLC) ───────────────── */}
      {/* Port aft section, two side-by-side cabinets */}
      <group position={[-3, 149.5, -9]} name="control_cabinet" onClick={pick("control_cabinet")}>
        {/* Cabinet 1 — Main TCS (RAL 7035 light grey) */}
        <mesh position={[-0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.8, 2.0, 0.6]} />
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color={col("control_cabinet", selectedPart, "#d1d5db")}
            emissive={em("control_cabinet", selectedPart)}
            emissiveIntensity={emI("control_cabinet", selectedPart)}
          />
        </mesh>
        {/* Cabinet 2 — Safety PLC */}
        <mesh position={[0.45, 0, 0]} castShadow>
          <boxGeometry args={[0.8, 2.0, 0.6]} />
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color={col("control_cabinet", selectedPart, "#d1d5db")}
          />
        </mesh>
        {/* Nameplates on both cabinet doors */}
        <Nameplate
          position={[-0.45, 0.75, 0.305]}
          title="TCS · PLC"
          lines={["IEC 61131-3", "SIL 2"]}
          width={0.55}
          height={0.24}
        />
        <Nameplate
          position={[0.45, 0.75, 0.305]}
          title="SAFETY PLC"
          lines={["IEC 61508", "SIL 3"]}
          width={0.55}
          height={0.24}
        />
        {/* Status LED indicators — 3 green dots on each cabinet */}
        {([-0.45, 0.45] as number[]).flatMap((cx) =>
          ([0.35, 0.15, -0.05] as number[]).map((cy, j) => (
            <mesh key={`${cx}-${j}`} position={[cx + 0.41, cy, 0.31]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.9} />
            </mesh>
          ))
        )}
      </group>

      {/* ── B8 UPS / Battery Cabinet ─────────────────────────────── */}
      <group position={[-3, 148.8, -6.5]} name="ups" onClick={pick("ups")}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 1.5, 0.6]} />
          <meshPhysicalMaterial
            {...metalPaintedShell}
            color={col("ups", selectedPart, "#1e40af")}
            clearcoat={0.55}
            emissive={em("ups", selectedPart)}
            emissiveIntensity={emI("ups", selectedPart)}
          />
        </mesh>
        {/* Battery charge indicator strip */}
        <mesh position={[0.51, 0.2, 0]}>
          <boxGeometry args={[0.02, 0.8, 0.3]} />
          <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.7} />
        </mesh>
        {/* Engineering nameplate */}
        <Nameplate
          position={[0, 0.55, 0.305]}
          title="UPS · 6.6 kWh"
          lines={["VRLA · 15 min backup", "IEC 62040-1", "230 V AC · 5 kVA"]}
          width={0.72}
          height={0.32}
        />
      </group>

      {/* ── B4 Nacelle Transformer ────────────────────────────────── */}
      {/* 784 V / 66 kV, 16 MVA, Dyn11 — nacelle aft base */}
      <group position={[0, 148.0, -11]} name="transformer" onClick={pick("transformer")}>
        {/* Main tank — IEC green enamel over cast steel */}
        <mesh castShadow>
          <boxGeometry args={[2.5, 2.0, 2.5]} />
          <meshPhysicalMaterial
            {...metalPaintedShell}
            color={col("transformer", selectedPart, "#14532d")}
            clearcoat={0.55}
            emissive={em("transformer", selectedPart)}
            emissiveIntensity={emI("transformer", selectedPart)}
          />
        </mesh>
        {/* Cooling fins — 3 flat boxes on each side */}
        {([-1.3, 0, 1.3] as number[]).flatMap((fz) =>
          ([-1, 1] as number[]).map((side, i) => (
            <mesh key={`fin-${fz}-${i}`} position={[side * 1.32, 0.1, fz]}>
              <boxGeometry args={[0.06, 1.6, 0.35]} />
              <meshPhysicalMaterial {...metalPaintedDetail} color="#166534" />
            </mesh>
          ))
        )}
        {/* LV bushing (784 V) — porcelain + bolt ring at base */}
        <mesh position={[0, 1.1, 0.8]}>
          <cylinderGeometry args={[0.09, 0.09, 0.4, 14]} />
          <meshPhysicalMaterial {...rubberSeal} color="#92400e" />
        </mesh>
        <BoltRing
          center={[0, 0.9, 0.8]}
          axis="y"
          radius={0.16}
          count={8}
          boltRadius={0.018}
          boltLength={0.08}
        />
        {/* HV bushing (66 kV) — taller glazed porcelain */}
        <mesh position={[0, 1.15, -0.5]}>
          <cylinderGeometry args={[0.12, 0.07, 0.55, 16]} />
          <meshPhysicalMaterial {...metalPolished} color="#e5e7eb" roughness={0.35} />
        </mesh>
        <BoltRing
          center={[0, 0.9, -0.5]}
          axis="y"
          radius={0.2}
          count={10}
          boltRadius={0.022}
          boltLength={0.09}
        />
        {/* Engineering nameplate — front face */}
        <Nameplate
          position={[0, -0.6, 1.255]}
          title="TRANSFORMER · 16 MVA"
          lines={["784 V / 66 kV · Dyn11", "IEC 60076-14 · ONAN", "η 99.3 %"]}
          width={1.15}
          height={0.42}
        />
      </group>

      {/* ── B5 Oil Cooler / Heat Exchanger ────────────────────────── */}
      {/* Starboard side wall, gearbox oil circuit */}
      <group position={[4.6, 151, -3]} name="oil_cooler" onClick={pick("oil_cooler")}>
        {/* Main radiator body — copper-brown painted heat exchanger */}
        <mesh castShadow>
          <boxGeometry args={[0.3, 1.5, 2.0]} />
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color={col("oil_cooler", selectedPart, "#92400e")}
            emissive={em("oil_cooler", selectedPart)}
            emissiveIntensity={emI("oil_cooler", selectedPart)}
          />
        </mesh>
        {/* Fin pattern — 8 thin horizontal fins */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[0.19, -0.6 + i * 0.18, 0]}>
            <boxGeometry args={[0.08, 0.04, 1.9]} />
            <meshPhysicalMaterial {...metalPolished} color="#b45309" roughness={0.28} />
          </mesh>
        ))}
        {/* Engineering nameplate — faces into nacelle */}
        <Nameplate
          position={[-0.155, 0.1, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          title="OIL COOLER · 500 kW"
          lines={["ISO VG 320", "ΔT 15 K @ rated", "IEC 61400-4"]}
          width={0.72}
          height={0.32}
        />
      </group>

      {/* ── B7 Service Crane Rail ─────────────────────────────────── */}
      {/* Two I-beam rails at nacelle ceiling, y≈154.5, running along z */}
      <group name="crane_rail" onClick={pick("crane_rail")}>
        {/* Port rail */}
        <mesh position={[-2, 154.6, -4]} castShadow>
          <boxGeometry args={[0.15, 0.2, 18]} />
          <meshStandardMaterial
            color={col("crane_rail", selectedPart, "#eab308")}
            roughness={0.4}
            metalness={0.6}
            emissive={em("crane_rail", selectedPart)}
            emissiveIntensity={emI("crane_rail", selectedPart)}
          />
        </mesh>
        {/* Starboard rail */}
        <mesh position={[2, 154.6, -4]} castShadow>
          <boxGeometry args={[0.15, 0.2, 18]} />
          <meshStandardMaterial
            color={col("crane_rail", selectedPart, "#eab308")}
            roughness={0.4}
            metalness={0.6}
          />
        </mesh>
        {/* Trolley body */}
        <mesh position={[0, 154.3, -3]}>
          <boxGeometry args={[4.2, 0.35, 0.8]} />
          <meshStandardMaterial color="#ca8a04" roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Hoist hook */}
        <mesh position={[0, 153.8, -3]}>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color="#78716c" roughness={0.4} metalness={0.8} />
        </mesh>
      </group>

      {/* ── B9 Yaw Brake Calipers ─────────────────────────────────── */}
      {/* 4 × hydraulic disc calipers at 45°/135°/225°/315° on yaw ring */}
      {/* Yaw ring is at y=147.5 world space, radius 3.2 m */}
      {([45, 135, 225, 315] as number[]).map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const r = 3.0;
        return (
          <mesh
            key={deg}
            position={[Math.cos(rad) * r, 147.9, Math.sin(rad) * r]}
            rotation={[0, -rad, 0]}
            name="yaw_brake"
            castShadow
            onClick={pick("yaw_brake")}
          >
            <boxGeometry args={[0.45, 0.55, 0.4]} />
            <meshStandardMaterial
              color={col("yaw_brake", selectedPart, "#991b1b")}
              roughness={0.5}
              metalness={0.5}
              emissive={em("yaw_brake", selectedPart)}
              emissiveIntensity={emI("yaw_brake", selectedPart)}
            />
          </mesh>
        );
      })}

      {/* ── B10 Cable Routing (nacelle floor → tower) ─────────────── */}
      {/* Bundle of 3 MV power cables + 1 control cable bundle */}
      <group name="cable_routing" onClick={pick("cable_routing")}>
        {/* Twist loop arc — shows the cable loop for ±3.5 yaw rotations */}
        <mesh position={[0, 148.5, -5]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.6, 0.08, 8, 24, Math.PI]} />
          <meshStandardMaterial
            color={col("cable_routing", selectedPart, "#171717")}
            roughness={0.8}
            metalness={0.2}
            emissive={em("cable_routing", selectedPart)}
            emissiveIntensity={emI("cable_routing", selectedPart)}
          />
        </mesh>
        {/* 3 MV cable drops into tower */}
        {([-0.2, 0, 0.2] as number[]).map((xo, i) => (
          <mesh key={i} position={[xo, 147.0, -5]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 2.5, 8]} />
            <meshStandardMaterial
              color={["#171717", "#1a1a2e", "#1c1c2e"][i]}
              roughness={0.9}
              metalness={0.1}
            />
          </mesh>
        ))}
        {/* Control cable bundle (fibre + Profibus) */}
        <mesh position={[0.35, 147.0, -5]}>
          <cylinderGeometry args={[0.04, 0.04, 2.5, 6]} />
          <meshStandardMaterial color="#374151" roughness={0.8} metalness={0.1} />
        </mesh>
      </group>

      {/* ── B11 Fire Suppression Cylinders ───────────────────────── */}
      {/* 4 × red cylinders near high-risk areas */}
      {(
        [
          [1.5, 150.2, 0.8],    // Near gearbox
          [1.5, 148.5, 0.8],    // Near generator
          [3.2, 149.5, -2.5],   // Near converter port
          [-3.2, 149.5, -2.5],  // Near converter starboard
        ] as [number, number, number][]
      ).map((pos, i) => (
        <mesh key={i} position={pos} rotation={[Math.PI / 2, 0, 0]} castShadow
          name="fire_suppression"
          onClick={pick("fire_suppression")}
        >
          <cylinderGeometry args={[0.075, 0.075, 0.5, 10]} />
          <meshStandardMaterial
            color={col("fire_suppression", selectedPart, "#dc2626")}
            roughness={0.4}
            metalness={0.5}
            emissive={em("fire_suppression", selectedPart)}
            emissiveIntensity={emI("fire_suppression", selectedPart)}
          />
        </mesh>
      ))}

      {/* ── B12 Lightning Down-Conductor ─────────────────────────── */}
      {/* 50 mm² copper conductor along nacelle exterior roof */}
      <group name="lightning_conductor" onClick={pick("lightning_conductor")}>
        {/* Horizontal run along nacelle top */}
        <mesh position={[0, 155.15, -4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 18, 6]} />
          <meshStandardMaterial
            color={col("lightning_conductor", selectedPart, "#b45309")}
            roughness={0.3}
            metalness={0.9}
            emissive={em("lightning_conductor", selectedPart)}
            emissiveIntensity={emI("lightning_conductor", selectedPart)}
          />
        </mesh>
        {/* Drop down nacelle aft face to tower entry */}
        <mesh position={[0.5, 152.5, -15]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 5.5, 6]} />
          <meshStandardMaterial color="#b45309" roughness={0.3} metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
});
