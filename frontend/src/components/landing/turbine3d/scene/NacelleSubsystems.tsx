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
import { RoundedBox } from "@react-three/drei";

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
import { statusPalette } from "./palette";

interface NacelleSubsystemsProps {
  selectedPart: TurbinePartId | null;
}

const HL = statusPalette.selected;
const HL_EM = statusPalette.selectedGlow;

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
      {/* ── B0 Structural Bedplate Frame ──────────────────────────── */}
      {/* The cast-steel bedplate is what every other component bolts to.
          Without it visible the interior reads as floating cabinets. We model
          the ZF-style ladder frame: 2 longitudinal main beams + 5 cross-beams
          + a bolted main-shaft pedestal cradle. Top of frame at y=147.6
          (matches transformer skid + HPU base). */}
      {/* Two main longitudinal I-beams (port + starboard) */}
      {([-3.6, 3.6] as number[]).map((bx) => (
        <group key={`beam-${bx}`}>
          {/* Top flange */}
          <mesh position={[bx, 147.65, -3]} castShadow receiveShadow>
            <boxGeometry args={[0.55, 0.06, 18]} />
            <meshStandardMaterial color="#2d3543" roughness={0.6} metalness={0.55} />
          </mesh>
          {/* Web */}
          <mesh position={[bx, 147.40, -3]} castShadow>
            <boxGeometry args={[0.08, 0.45, 18]} />
            <meshStandardMaterial color="#2d3543" roughness={0.65} metalness={0.5} />
          </mesh>
          {/* Bottom flange */}
          <mesh position={[bx, 147.15, -3]} castShadow>
            <boxGeometry args={[0.55, 0.06, 18]} />
            <meshStandardMaterial color="#2d3543" roughness={0.6} metalness={0.55} />
          </mesh>
        </group>
      ))}
      {/* Cross-beams every 4 m bolting the two longitudinals together */}
      {[-10.5, -6.5, -2.5, 1.5, 5.5].map((bz) => (
        <mesh key={`xbeam-${bz}`} position={[0, 147.40, bz]} castShadow>
          <boxGeometry args={[7.2, 0.4, 0.18]} />
          <meshStandardMaterial color="#3a4452" roughness={0.6} metalness={0.55} />
        </mesh>
      ))}
      {/* Main-shaft pedestal cradle — diagonal gusset rising to bearing y=151 */}
      {([-1.5, 1.5] as number[]).map((px) => (
        <group key={`ped-${px}`}>
          <mesh position={[px, 149, 1]} castShadow>
            <boxGeometry args={[0.35, 3.0, 0.5]} />
            <meshStandardMaterial color="#3a4452" roughness={0.6} metalness={0.5} />
          </mesh>
          {/* Diagonal brace */}
          <mesh position={[px * 1.6, 149, 1]} rotation={[0, 0, px > 0 ? -0.3 : 0.3]}>
            <boxGeometry args={[0.18, 2.6, 0.18]} />
            <meshStandardMaterial color="#3a4452" roughness={0.65} metalness={0.5} />
          </mesh>
        </group>
      ))}
      {/* Aisle floor grating — 1.2 m wide steel grating between the two main
          beams, gives the catwalk a mounted-to-frame feel */}
      <mesh position={[0, 147.7, -3]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.2, 18]} />
        <meshStandardMaterial color="#1f2937" roughness={0.85} metalness={0.45} />
      </mesh>
      {/* Steel kickplates flanking the aisle */}
      {([-0.65, 0.65] as number[]).map((kx) => (
        <mesh key={`kick-${kx}`} position={[kx, 147.78, -3]} castShadow>
          <boxGeometry args={[0.04, 0.16, 18]} />
          <meshStandardMaterial color="#eab308" roughness={0.55} metalness={0.4} />
        </mesh>
      ))}
      {/* Tower-top access ladder cage — 4 vertical tubes at the rear bay */}
      {([[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]] as [number, number][]).map(([lx, lz], i) => (
        <mesh key={`ladder-${i}`} position={[lx, 145.0, -10 + lz]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 4.5, 8]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} metalness={0.5} />
        </mesh>
      ))}
      {/* Ladder rungs — 12 short bars between the front and rear pair */}
      {Array.from({ length: 12 }).map((_, i) => {
        const y = 143.0 + i * 0.32;
        return (
          <mesh key={`rung-${i}`} position={[0, y, -10]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.85, 0.025, 0.04]} />
            <meshStandardMaterial color="#eab308" roughness={0.5} metalness={0.5} />
          </mesh>
        );
      })}

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
        <RoundedBox args={[1.5, 1.0, 1.2]} radius={0.04} smoothness={4} castShadow>
          <meshPhysicalMaterial
            {...metalPaintedShell}
            color={col("hpu", selectedPart, "#c2410c")}
            clearcoat={0.6}
            emissive={em("hpu", selectedPart)}
            emissiveIntensity={emI("hpu", selectedPart)}
          />
        </RoundedBox>
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
        {/* Hydraulic hose stubs — three short black rubber stubs leaving the
            top manifold and exiting toward the yaw-brake circuit. Polished
            stainless fittings at each exit point. */}
        {([-0.4, 0.0, 0.4] as number[]).map((hx, i) => (
          <group key={i}>
            {/* Stainless fitting at HPU top */}
            <mesh position={[hx, 0.55, 0.3]} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.08, 12]} />
              <meshPhysicalMaterial {...metalPolished} color="#cbd5e1" />
            </mesh>
            {/* Hose stub — short rubber section leaving manifold */}
            <mesh position={[hx, 0.78, 0.3]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.4, 8]} />
              <meshStandardMaterial color="#0a0a0a" roughness={0.85} metalness={0.05} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── B3 Control Cabinets (TCS + Safety PLC) ───────────────── */}
      {/* Port aft section, two side-by-side cabinets, axis-aligned to aft wall */}
      <group position={[-3.3, 149.0, -8.5]} name="control_cabinet" onClick={pick("control_cabinet")}>
        {/* Cabinet 1 — Main TCS (RAL 7035 light grey) */}
        <RoundedBox args={[0.8, 2.0, 0.6]} radius={0.03} smoothness={4} position={[-0.45, 0, 0]} castShadow>
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color={col("control_cabinet", selectedPart, "#cbd5e1")}
            emissive={em("control_cabinet", selectedPart)}
            emissiveIntensity={emI("control_cabinet", selectedPart)}
          />
        </RoundedBox>
        {/* Cabinet 2 — Safety PLC */}
        <RoundedBox args={[0.8, 2.0, 0.6]} radius={0.03} smoothness={4} position={[0.45, 0, 0]} castShadow>
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color={col("control_cabinet", selectedPart, "#cbd5e1")}
          />
        </RoundedBox>
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
      {/* Mirror of the control cabinet: same z (-8.5), opposite x, deeper navy
          paint so it doesn't read toy-like next to the RAL 7035 cabinets. */}
      <group position={[3.3, 149.0, -8.5]} name="ups" onClick={pick("ups")}>
        <RoundedBox args={[1.0, 2.0, 0.6]} radius={0.035} smoothness={4} castShadow>
          <meshPhysicalMaterial
            {...metalPaintedShell}
            color={col("ups", selectedPart, "#0f4c75")}
            clearcoat={0.55}
            emissive={em("ups", selectedPart)}
            emissiveIntensity={emI("ups", selectedPart)}
          />
        </RoundedBox>
        {/* Battery charge indicator strip */}
        <mesh position={[-0.51, 0.2, 0]}>
          <boxGeometry args={[0.02, 0.8, 0.3]} />
          <meshStandardMaterial color="#34d399" emissive="#10b981" emissiveIntensity={0.7} />
        </mesh>
        {/* Ventilation louvres — 4 horizontal slits on the door */}
        {[-0.55, -0.25, 0.05, 0.35].map((y, i) => (
          <mesh key={i} position={[0, y, 0.305]}>
            <boxGeometry args={[0.7, 0.04, 0.005]} />
            <meshStandardMaterial color="#0a2b42" roughness={0.4} metalness={0.6} />
          </mesh>
        ))}
        {/* Engineering nameplate */}
        <Nameplate
          position={[0, 0.78, 0.305]}
          title="UPS · 6.6 kWh"
          lines={["VRLA · 15 min backup", "IEC 62040-1", "230 V AC · 5 kVA"]}
          width={0.72}
          height={0.32}
        />
      </group>

      {/* ── B4 Nacelle Transformer ────────────────────────────────── */}
      {/* 784 V / 66 kV, 16 MVA, Dyn11 — nacelle aft base, sits on a fabricated
          steel skid so the 16-tonne tank doesn't appear to float in the bay. */}
      <group position={[0, 148.0, -11]} name="transformer" onClick={pick("transformer")}>
        {/* Support skid — 4 longitudinal I-beams + cross-members at y = -1.05 */}
        <mesh position={[0, -1.08, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 0.15, 2.6]} />
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color="#3f3f46"
            roughness={0.55}
          />
        </mesh>
        {/* 4 stub feet under the skid corners */}
        {([[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]] as [number, number][]).map(([fx, fz], i) => (
          <mesh key={i} position={[fx, -1.32, fz]} castShadow>
            <boxGeometry args={[0.18, 0.32, 0.18]} />
            <meshStandardMaterial color="#27272a" roughness={0.7} metalness={0.5} />
          </mesh>
        ))}
        {/* Main tank — IEC green enamel over cast steel */}
        <RoundedBox args={[2.5, 2.0, 2.5]} radius={0.05} smoothness={4} castShadow>
          <meshPhysicalMaterial
            {...metalPaintedShell}
            color={col("transformer", selectedPart, "#14532d")}
            clearcoat={0.55}
            emissive={em("transformer", selectedPart)}
            emissiveIntensity={emI("transformer", selectedPart)}
          />
        </RoundedBox>
        {/* Conservator tank — small horizontal cylinder atop the rear face,
            holds expansion oil per IEC 60076-1. */}
        <mesh position={[0, 1.35, -1.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 1.6, 16]} />
          <meshPhysicalMaterial {...metalPaintedShell} color="#166534" clearcoat={0.5} />
        </mesh>
        {/* Conservator end caps */}
        {([-0.8, 0.8] as number[]).map((cx) => (
          <mesh key={cx} position={[cx, 1.35, -1.05]}>
            <sphereGeometry args={[0.18, 14, 8]} />
            <meshPhysicalMaterial {...metalPaintedShell} color="#166534" clearcoat={0.5} />
          </mesh>
        ))}
        {/* Buchholz relay — small cylinder mounted between conservator and tank */}
        <mesh position={[0, 1.18, -0.4]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.18, 12]} />
          <meshStandardMaterial color="#1a2e22" roughness={0.6} metalness={0.5} />
        </mesh>
        {/* Connecting pipe — conservator → Buchholz → tank top */}
        <mesh position={[0, 1.27, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.65, 8]} />
          <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.7} />
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
      {/* Starboard wall mount, gearbox oil circuit. Hung from 4 short brackets
          off the side compartment ceiling so the radiator visibly attaches to
          the nacelle structure rather than floating. */}
      <group position={[4.6, 151, -3]} name="oil_cooler" onClick={pick("oil_cooler")}>
        {/* 4 mounting brackets — short stubs to the starboard wall above */}
        {([[-0.85, 0.85], [-0.85, -0.85], [0.85, 0.85], [0.85, -0.85]] as [number, number][]).map(([bz, _by], i) => (
          <mesh key={i} position={[-0.18, 0.95, bz]} castShadow>
            <boxGeometry args={[0.06, 0.18, 0.08]} />
            <meshStandardMaterial color="#52525b" roughness={0.55} metalness={0.65} />
          </mesh>
        ))}
        {/* Main radiator body — copper-brown painted heat exchanger */}
        <RoundedBox args={[0.3, 1.5, 2.0]} radius={0.03} smoothness={4} castShadow>
          <meshPhysicalMaterial
            {...metalPaintedDetail}
            color={col("oil_cooler", selectedPart, "#92400e")}
            emissive={em("oil_cooler", selectedPart)}
            emissiveIntensity={emI("oil_cooler", selectedPart)}
          />
        </RoundedBox>
        {/* Header tank — top horizontal manifold collecting fin returns */}
        <mesh position={[0.05, 0.85, 0]} castShadow>
          <boxGeometry args={[0.36, 0.18, 2.05]} />
          <meshPhysicalMaterial {...metalPaintedDetail} color="#7c2d12" />
        </mesh>
        {/* Bottom collector tank */}
        <mesh position={[0.05, -0.85, 0]} castShadow>
          <boxGeometry args={[0.36, 0.18, 2.05]} />
          <meshPhysicalMaterial {...metalPaintedDetail} color="#7c2d12" />
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
        {/* Trolley wheels — 4 flanged wheels riding the I-beam top flanges,
            two per side, gives the trolley actual contact with the rails */}
        {([[-2, -0.3], [-2, 0.3], [2, -0.3], [2, 0.3]] as [number, number][]).map(([wx, wz], i) => (
          <mesh key={i} position={[wx, 154.55, -3 + wz]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.09, 0.05, 16]} />
            <meshPhysicalMaterial {...metalPolished} color="#a8a29e" />
          </mesh>
        ))}
        {/* Hoist gearbox — small box hanging below trolley centre */}
        <mesh position={[0, 154.0, -3]}>
          <boxGeometry args={[0.5, 0.3, 0.4]} />
          <meshStandardMaterial color="#78716c" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* Wire rope drop */}
        <mesh position={[0, 153.7, -3]}>
          <cylinderGeometry args={[0.012, 0.012, 0.5, 6]} />
          <meshStandardMaterial color="#52525b" roughness={0.3} metalness={0.85} />
        </mesh>
        {/* Hoist hook — proper crane hook shape */}
        <mesh position={[0, 153.3, -3]}>
          <torusGeometry args={[0.08, 0.025, 8, 16, Math.PI * 1.4]} />
          <meshPhysicalMaterial {...metalPolished} color="#78716c" />
        </mesh>
        <mesh position={[0, 153.45, -3]}>
          <boxGeometry args={[0.05, 0.2, 0.05]} />
          <meshStandardMaterial color="#78716c" roughness={0.4} metalness={0.8} />
        </mesh>
      </group>

      {/* ── B9 Yaw Brake Calipers ─────────────────────────────────── */}
      {/* 4 × SAHR hydraulic disc calipers at 45°/135°/225°/315° on yaw ring.
          Each shows the caliper body + a polished piston rod feeding into the
          pad housing — the visual cue that these are powered actuators, not
          static blocks. */}
      {([45, 135, 225, 315] as number[]).map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const r = 3.0;
        const cx = Math.cos(rad) * r;
        const cz = Math.sin(rad) * r;
        return (
          <group key={deg} name="yaw_brake" onClick={pick("yaw_brake")}>
            {/* Caliper body */}
            <mesh
              position={[cx, 147.9, cz]}
              rotation={[0, -rad, 0]}
              castShadow
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
            {/* Piston rod — polished stainless cylinder protruding outward */}
            <mesh
              position={[cx + Math.cos(rad) * 0.32, 147.9, cz + Math.sin(rad) * 0.32]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.045, 0.045, 0.22, 12]} />
              <meshPhysicalMaterial {...metalPolished} color="#e5e7eb" />
            </mesh>
            {/* Hydraulic line stub — black rubber feed from above */}
            <mesh
              position={[cx, 148.25, cz]}
            >
              <cylinderGeometry args={[0.025, 0.025, 0.25, 8]} />
              <meshStandardMaterial color="#171717" roughness={0.85} metalness={0.05} />
            </mesh>
          </group>
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
      {/* 4 × HFC-227ea cylinders, ceiling-mounted at uniform y=154.0 just below
          the cowling, each with a drop nozzle pointed at its protected zone.
          Standardised height + uniform manifold reads as engineered, not random. */}
      {(
        [
          [1.5,  154.0,  0.8, 150.4],   // Above gearbox — drops to y=150.4
          [-1.5, 154.0, -2.0, 148.8],   // Above generator
          [3.2,  154.0, -2.5, 149.6],   // Above converter starboard
          [-3.2, 154.0, -2.5, 149.6],   // Above converter port
        ] as [number, number, number, number][]
      ).map(([x, y, z, nozzleY], i) => (
        <group key={i} name="fire_suppression" onClick={pick("fire_suppression")}>
          {/* Cylinder body — vertical, top-mounted */}
          <mesh position={[x, y, z]} castShadow>
            <cylinderGeometry args={[0.085, 0.085, 0.7, 12]} />
            <meshStandardMaterial
              color={col("fire_suppression", selectedPart, "#dc2626")}
              roughness={0.4}
              metalness={0.5}
              emissive={em("fire_suppression", selectedPart)}
              emissiveIntensity={emI("fire_suppression", selectedPart)}
            />
          </mesh>
          {/* Top valve manifold + pressure indicator */}
          <mesh position={[x, y + 0.42, z]} castShadow>
            <boxGeometry args={[0.18, 0.12, 0.18]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh position={[x + 0.12, y + 0.42, z]}>
            <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
            <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.5} />
          </mesh>
          {/* Drop pipe — runs from cylinder bottom down to nozzle elevation */}
          <mesh position={[x, (y - 0.35 + nozzleY + 0.1) / 2, z]}>
            <cylinderGeometry args={[0.022, 0.022, y - 0.35 - (nozzleY + 0.1), 8]} />
            <meshStandardMaterial color="#991b1b" roughness={0.4} metalness={0.6} />
          </mesh>
          {/* Drop nozzle — IEC 14520 spray head */}
          <mesh position={[x, nozzleY + 0.05, z]}>
            <coneGeometry args={[0.08, 0.12, 8]} />
            <meshStandardMaterial color="#e7e5e4" roughness={0.4} metalness={0.7} />
          </mesh>
        </group>
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

      {/* ── Cable Ladders — port & starboard nacelle walls ────────── */}
      {/* Hot-dip galvanised steel perforated cable trays running the nacelle
          length. Provide realistic cable management and visual depth. */}
      {([-4.35, 4.35] as number[]).map((x) => (
        <group key={`ladder-${x}`}>
          {/* Longitudinal side rails */}
          {([-0.18, 0.18] as number[]).map((dy) => (
            <mesh key={dy} position={[x, 149.5 + dy, -4]} rotation={[Math.PI / 2, 0, 0]}>
              <boxGeometry args={[0.04, 17, 0.03]} />
              <meshStandardMaterial color="#71717a" roughness={0.4} metalness={0.75} />
            </mesh>
          ))}
          {/* Cross-rungs every 300 mm — 28 rungs over 8.4 m visible length */}
          {Array.from({ length: 28 }).map((_, i) => (
            <mesh key={i} position={[x, 149.5, -12 + i * 0.6]}>
              <boxGeometry args={[0.03, 0.36, 0.02]} />
              <meshStandardMaterial color="#71717a" roughness={0.45} metalness={0.75} />
            </mesh>
          ))}
          {/* MV cable bundle on ladder — 3 × 95 mm² (IEC 60502-2 red sheaths) */}
          {([-0.06, 0, 0.06] as number[]).map((dy, ci) => (
            <mesh key={ci} position={[x, 149.5 + dy - 0.04, -4]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 17, 6]} />
              <meshStandardMaterial
                color={["#b91c1c", "#111827", "#374151"][ci]}
                roughness={0.8}
                metalness={0.1}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
});
