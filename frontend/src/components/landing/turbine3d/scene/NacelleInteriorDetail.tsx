/**
 * Nacelle interior fine-detail overlay — layered on top of Drivetrain +
 * NacelleSubsystems in cutaway / exploded modes. Adds the features that
 * push the interior from "primitive boxes" to "engineering model":
 *
 *   1. Stator slot ring — 96 rectangular slots around the generator
 *      stator bore (the copper-filled slots you see in PMSG cross-sections).
 *   2. End windings — copper-coloured toroidal end turns bulging out both
 *      sides of the stator (the signature look of a PMSG).
 *   3. IGBT heatsink fins — vertical fin arrays on converter cabinet fronts,
 *      emissive intensity modulated by power fraction.
 *   4. Oil flow ribbons — animated UV-scrolled tube from gearbox sump to
 *      oil cooler and back, colour graded by temperature.
 *   5. Medium-voltage cable run — catenary curve from transformer to
 *      cable routing nexus (sheath red).
 *   6. Low-voltage cable run — converter to transformer (grey sheath).
 *   7. HPU pressure gauge — small dial sprite on top of HPU tank.
 *   8. Billboard labels — small drei <Text> sprites for each subsystem.
 *   9. Dashed functional-group rings (hydraulic / cooling / electrical).
 *
 * All of these are shown only in cutaway or exploded mode. The component
 * takes its data from the current turbine selector so power/temperature
 * scaling is live.
 */

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import {
  selectNacelleData,
  useNacelleSubsystemsStore,
} from "../../../../store/nacelleSubsystemsStore";
import { CableTray } from "./nacelle/CableTray";

const NACELLE_Y = 151;
const RATED_POWER_MW = 15.0;

interface NacelleInteriorDetailProps {
  turbineId: string;
  viewerMode: "normal" | "cutaway" | "exploded";
  showLabels: boolean;
}

export const NacelleInteriorDetail = memo(function NacelleInteriorDetail({
  turbineId,
  viewerMode,
  showLabels,
}: NacelleInteriorDetailProps) {
  if (viewerMode === "normal") return null;
  return (
    <group position={[0, NACELLE_Y, 0]}>
      <StatorSlotRing />
      <EndWindings />
      <IGBTHeatsinks turbineId={turbineId} />
      <OilFlowLoop turbineId={turbineId} />
      <GeneratorToConverterTray />
      <ConverterToTransformerTray />
      <TransformerToCableRoutingTray />
      <HPUPressureGauge turbineId={turbineId} />
      {showLabels && <InteriorLabels />}
      <FunctionalGroupRings />
    </group>
  );
});

// ── Stator slot ring (96 slots) ────────────────────────────────────

function StatorSlotRing() {
  const slots = useMemo(() => {
    const n = 96;
    return Array.from({ length: n }).map((_, i) => {
      const a = (i * Math.PI * 2) / n;
      return { a };
    });
  }, []);
  return (
    <group position={[0, -2.5, 0]}>
      {slots.map(({ a }, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0]}
          rotation={[0, 0, a]}
        >
          <boxGeometry args={[0.04, 0.12, 1.65]} />
          <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

// ── End windings — copper torus at both faces ──────────────────────

function EndWindings() {
  return (
    <group position={[0, -2.5, 0]}>
      {[0.95, -0.95].map((z) => (
        <mesh key={z} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z]}>
          <torusGeometry args={[1.95, 0.18, 12, 48]} />
          <meshStandardMaterial
            color="#b45309"
            metalness={0.9}
            roughness={0.35}
            emissive="#78350f"
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}
    </group>
  );
}

// ── IGBT heatsink fins ─────────────────────────────────────────────

function IGBTHeatsinks({ turbineId }: { turbineId: string }) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const powerFrac = Math.min(1, (turbine?.powerOutputMW ?? 0) / RATED_POWER_MW);
  const emissive = 0.3 + powerFrac * 0.9;

  const fins = useMemo(() => Array.from({ length: 10 }).map((_, i) => i), []);

  return (
    <>
      {[-3.5, 3.5].map((x) => (
        <group key={x} position={[x, -3, 0.8]}>
          {fins.map((i) => (
            <mesh key={i} position={[-0.9 + i * 0.2, 0, 0]}>
              <boxGeometry args={[0.04, 1.0, 0.35]} />
              <meshStandardMaterial
                color="#9ca3af"
                metalness={0.7}
                roughness={0.3}
                emissive="#f97316"
                emissiveIntensity={emissive * 0.3}
              />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

// ── Oil flow loop — animated coolant tube ──────────────────────────

function OilFlowLoop({ turbineId }: { turbineId: string }) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const liveOilTempC = useNacelleSubsystemsStore(selectNacelleData(turbineId))?.cooling.oil_temp_c;
  const powerFrac = Math.min(1, (turbine?.powerOutputMW ?? 0) / RATED_POWER_MW);
  // Prefer live backend oil temperature; fall back to local steady-state proxy.
  const tempC = liveOilTempC ?? (55 + powerFrac * 35);
  const tempFrac = Math.min(1, Math.max(0, (tempC - 55) / 35));

  const color = useMemo(() => {
    const c = new THREE.Color().lerpColors(
      new THREE.Color("#fbbf24"),
      new THREE.Color("#dc2626"),
      tempFrac,
    );
    return c;
  }, [tempFrac]);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.3 + 0.15 * Math.sin(performance.now() * 0.003);
    }
  });

  // Path: gearbox (x=0, y=-2, z=0) → oil cooler (x=-2.5, y=-3.5, z=2)
  // → back (returning on opposite side).
  const outbound = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.5, -2, 1.2),
        new THREE.Vector3(-1.8, -2.8, 1.8),
        new THREE.Vector3(-2.6, -3.4, 2.0),
      ]),
    [],
  );
  const returnPath = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-2.6, -3.4, -0.5),
        new THREE.Vector3(-1.8, -2.8, -1.0),
        new THREE.Vector3(-0.5, -2, -0.5),
      ]),
    [],
  );

  return (
    <group>
      <mesh>
        <tubeGeometry args={[outbound, 16, 0.08, 8, false]} />
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      <mesh>
        <tubeGeometry args={[returnPath, 16, 0.08, 8, false]} />
        <meshStandardMaterial
          color="#0891b2"
          emissive="#0e7490"
          emissiveIntensity={0.2}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

// ── Cable runs ─────────────────────────────────────────────────────

// Generator (LV 784 V) → port converter — grey sheath, 3 conductors.
function GeneratorToConverterTray() {
  const points = useMemo<[number, number, number][]>(
    () => [
      [0, -2, 1.4],
      [-1.4, -2.5, 1.2],
      [-2.5, -2.85, 0.95],
      [-3.5, -3, 0.6],
    ],
    [],
  );
  return (
    <CableTray
      points={points}
      width={0.32}
      height={0.14}
      cableCount={3}
      cableDiameter={0.07}
      sheathColor="#94a3b8"
    />
  );
}

// Port converter → transformer — LV 0.69 kV aux, grey sheath.
function ConverterToTransformerTray() {
  const points = useMemo<[number, number, number][]>(
    () => [
      [-3.5, -3, 0.4],
      [-2.4, -3.1, -0.6],
      [-1.0, -3.15, -1.4],
      [0, -3.15, -2.3],
    ],
    [],
  );
  return (
    <CableTray
      points={points}
      width={0.28}
      height={0.12}
      cableCount={3}
      cableDiameter={0.06}
      sheathColor="#9ca3af"
    />
  );
}

// Transformer (HV 66 kV) → cable routing nexus — MV red sheath, 3 conductors.
function TransformerToCableRoutingTray() {
  const points = useMemo<[number, number, number][]>(
    () => [
      [0, -2.6, -3],
      [1.4, -3.1, -4.2],
      [2.2, -3.5, -5.5],
      [2.6, -3.8, -7.0],
    ],
    [],
  );
  return (
    <CableTray
      points={points}
      width={0.36}
      height={0.16}
      cableCount={3}
      cableDiameter={0.085}
      sheathColor="#b91c1c"
      trayColor="#3f3f46"
    />
  );
}

// ── HPU pressure gauge ─────────────────────────────────────────────

function HPUPressureGauge({ turbineId }: { turbineId: string }) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const liveLineBar = useNacelleSubsystemsStore(selectNacelleData(turbineId))?.hpu.line_pressure_bar;
  const powerFrac = Math.min(1, (turbine?.powerOutputMW ?? 0) / RATED_POWER_MW);
  // Map a 140–260 bar range to needle sweep [0, π]. Use live value if polled.
  const bar = liveLineBar ?? (180 + powerFrac * 60);
  const barFrac = Math.min(1, Math.max(0, (bar - 140) / 120));
  const needleAng = barFrac * Math.PI - Math.PI / 2;

  return (
    <group position={[3.8, -2.6, 3.2]} rotation={[0, 0, 0]}>
      {/* Gauge face */}
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Rim */}
      <mesh>
        <torusGeometry args={[0.22, 0.02, 8, 24]} />
        <meshStandardMaterial color="#111827" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Needle */}
      <mesh rotation={[0, 0, needleAng]} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.03, 0.16, 0.005]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
    </group>
  );
}

// ── Billboard labels ───────────────────────────────────────────────

const LABELS: Array<{ pos: [number, number, number]; text: string }> = [
  { pos: [0, 0, 4.5], text: "MAIN BEARING" },
  { pos: [0, 0, 2.0], text: "GEARBOX 48:1" },
  { pos: [0, 0, -1.0], text: "PMSG · 15 MW" },
  { pos: [-3.5, -1.3, 0], text: "CONVERTER" },
  { pos: [3.5, -1.3, 0], text: "CONVERTER" },
  { pos: [4.2, -1.3, -2], text: "TRANSFORMER" },
  { pos: [-3.8, -2.3, 3.2], text: "HPU · 210 bar" },
  { pos: [-3.8, -3.8, 3.2], text: "OIL COOLER" },
];

function InteriorLabels() {
  return (
    <>
      {LABELS.map((l) => (
        <Text
          key={l.text}
          position={l.pos}
          fontSize={0.22}
          color="#93c5fd"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#0a0f1a"
        >
          {l.text}
        </Text>
      ))}
    </>
  );
}

// ── Dashed functional-group rings ──────────────────────────────────

function FunctionalGroupRings() {
  // Hydraulic (HPU + brake + pitch + yaw) — orange dashed.
  const hydraulic = useMemo(
    () => [
      new THREE.Vector3(-4.3, -3.2, 3.8),
      new THREE.Vector3(-4.3, -1.2, 3.8),
      new THREE.Vector3(-4.3, -1.2, -4.0),
      new THREE.Vector3(-4.3, -3.2, -4.0),
      new THREE.Vector3(-4.3, -3.2, 3.8),
    ],
    [],
  );
  // Electrical (converters + transformer + cable) — red dashed.
  const electrical = useMemo(
    () => [
      new THREE.Vector3(4.4, -1.4, 0.8),
      new THREE.Vector3(4.4, -3.6, 0.8),
      new THREE.Vector3(4.4, -3.6, -4.0),
      new THREE.Vector3(4.4, -1.4, -4.0),
      new THREE.Vector3(4.4, -1.4, 0.8),
    ],
    [],
  );
  return (
    <>
      <Line points={hydraulic} color="#fb923c" lineWidth={1} dashed dashScale={60} transparent opacity={0.5} />
      <Line points={electrical} color="#ef4444" lineWidth={1} dashed dashScale={60} transparent opacity={0.5} />
    </>
  );
}
