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
import { TechnicianFigure } from "./nacelle/TechnicianFigure";

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
      <ServiceCatwalk />
      <TechnicianFigure />
      {showLabels && <InteriorLabels />}
      <FunctionalGroupRings />
    </group>
  );
});

/**
 * Service catwalk + safety handrails — gives the nacelle interior a
 * walkable-space spatial anchor. Grating is approximated with a dark
 * panel + subtle stripe pattern via a procedural CanvasTexture.
 */
function ServiceCatwalk() {
  const grateTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#1f2937";
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = "#475569";
      g.lineWidth = 1;
      for (let i = 0; i < 64; i += 8) {
        g.beginPath();
        g.moveTo(0, i);
        g.lineTo(64, i);
        g.stroke();
      }
      g.strokeStyle = "#334155";
      for (let i = 0; i < 64; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i, 64);
        g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 20);
    return tex;
  }, []);

  // Anti-slip hatch pattern — diagonal safety stripes atop the grating.
  const antiSlipTexture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "rgba(30, 41, 59, 0.0)";
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = "rgba(234, 179, 8, 0.55)";
      g.lineWidth = 3;
      for (let i = -64; i < 128; i += 12) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 64, 64);
        g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 20);
    return tex;
  }, []);

  return (
    <group>
      {/* Catwalk deck — 1.2 m × 18 m, local y=-3.8 (≈ world 147.2) */}
      <mesh
        position={[0, -3.8, -3]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[1.2, 18]} />
        <meshStandardMaterial
          map={grateTexture}
          color="#334155"
          roughness={0.85}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Anti-slip safety stripes — subtle yellow hatching just above the grate */}
      <mesh position={[0, -3.795, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 18]} />
        <meshStandardMaterial
          map={antiSlipTexture}
          transparent
          opacity={0.65}
          roughness={0.95}
          metalness={0.0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* I-beam stringers — two longitudinal structural members under the catwalk */}
      {([-0.55, 0.55] as number[]).map((x) => (
        <mesh key={`stringer-${x}`} position={[x, -3.95, -3]}>
          <boxGeometry args={[0.08, 0.25, 18]} />
          <meshStandardMaterial color="#334155" roughness={0.75} metalness={0.55} />
        </mesh>
      ))}
      {/* Yellow kickplates — 10 cm strips along both deck edges, hazard-marked */}
      {([-0.6, 0.6] as number[]).map((x) => (
        <mesh key={`kick-${x}`} position={[x, -3.72, -3]}>
          <boxGeometry args={[0.02, 0.1, 18]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {/* Handrails — two yellow tubes at 1.1 m height flanking the walkway */}
      {([-0.65, 0.65] as number[]).map((x) => (
        <mesh key={`rail-${x}`} position={[x, -2.7, -3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 18, 8]} />
          <meshStandardMaterial color="#eab308" roughness={0.55} metalness={0.5} />
        </mesh>
      ))}
      {/* Mid-rail — second horizontal tube at ~0.55 m */}
      {([-0.65, 0.65] as number[]).map((x) => (
        <mesh key={`midrail-${x}`} position={[x, -3.25, -3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 18, 8]} />
          <meshStandardMaterial color="#eab308" roughness={0.55} metalness={0.5} />
        </mesh>
      ))}
      {/* Handrail uprights — 10 stanchions per side along the 18 m run */}
      {([-0.65, 0.65] as number[]).flatMap((x) =>
        Array.from({ length: 10 }).map((_, i) => {
          const z = -3 + (i - 4.5) * 1.8;
          return (
            <mesh key={`stanch-${x}-${i}`} position={[x, -3.25, z]}>
              <cylinderGeometry args={[0.025, 0.025, 1.2, 8]} />
              <meshStandardMaterial color="#eab308" roughness={0.55} metalness={0.5} />
            </mesh>
          );
        }),
      )}
      {/* Overhead LED strip lights — two parallel emissive planes with matching
          pointLights. Without light sources inside the nacelle, PBR materials on
          cabinets/HPU look flat. The emissive planes give the eye visible
          fixtures; the pointLights drive specular reflections on the hardware. */}
      {([-1.0, 1.0] as number[]).map((x) => (
        <mesh
          key={`strip-${x}`}
          position={[x, -1.2, -3]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.2, 16]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive="#f8fafc"
            emissiveIntensity={1.2}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
      {/* Centreline LED ceiling lamps — reduced to 0.6 so port fill doesn't wash */}
      {[-6, -3, 0].map((z) => (
        <pointLight
          key={`lamp-${z}`}
          position={[0, -1.3, z]}
          intensity={0.6}
          distance={5.5}
          decay={2}
          color="#f8fafc"
        />
      ))}
      {/* Port-side warm fill — bounced off painted steel walls, softens shadows */}
      <pointLight position={[-4.0, -1.0, -3]} intensity={0.45} distance={8} decay={2} color="#e8e0d0" />
      {/* Generator-area key light — aims straight down from above PMSG */}
      <spotLight
        position={[0, 1.5, -5]}
        angle={0.42}
        penumbra={0.35}
        intensity={1.1}
        distance={12}
        decay={2}
        color="#f0f4ff"
        castShadow={false}
      />
    </group>
  );
}

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

  // Path: gearbox sump (starboard base) → oil cooler (starboard wall at [4.6,0,-3])
  // → return line back to gearbox.
  // OilCooler world [4.6,151,-3] → local to this group [4.6,0,-3].
  // Gearbox world [0,150.5,0] → local [0,-0.5,0]; exit starboard side ~[1.75,-1.6,0].
  const outbound = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.75, -1.6, 0.0),   // gearbox sump, starboard
        new THREE.Vector3(3.5,  -0.8, -1.5),  // route along starboard nacelle wall
        new THREE.Vector3(4.6,   0.0, -3.0),  // oil cooler inlet
      ]),
    [],
  );
  const returnPath = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(4.6,   0.2, -3.0),  // oil cooler outlet (cooled)
        new THREE.Vector3(3.2,  -0.4, -1.5),  // return arc
        new THREE.Vector3(1.75, -1.4,  0.2),  // back to gearbox lube inlet
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
    // HPU world [2.5,147.8,2] → local [-0.25,-3.1,2]; gauge indicator on top face.
    // Matches the small indicator on NacelleSubsystems HPU at local [0.76,0.1,0.35].
    <group position={[3.26, -3.1, 2.35]} rotation={[0, 0, 0]}>
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

// All positions are local to NacelleInteriorDetail group at world [0, 151, 0].
// Derivation: world_pos − [0, 151, 0] = local_pos.
//   Main bearing:  drivetrain [0,151,0]+[0,3,0]  → local [0, 3, 0]
//   Gearbox:       drivetrain [0,151,0]+[0,-0.5,0]→ local [0,-0.5, 0]
//   Generator:     drivetrain [0,151,0]+[0,-2.5,0]→ local [0,-2.5, 0]
//   Conv port:     drivetrain [0,151,0]+[-3.5,-3,0]→local [-3.5,-3, 0]
//   Conv stbd:     drivetrain [0,151,0]+[3.5,-3,0] → local [3.5,-3, 0]
//   Transformer:   world [0,148,-11]             → local [0,-3,-11]
//   HPU:           world [2.5,147.8,2]           → local [2.5,-3.2, 2]
//   OilCooler:     world [4.6,151,-3]            → local [4.6, 0, -3]
const LABELS: Array<{ pos: [number, number, number]; text: string }> = [
  { pos: [0,  3.8,  1.5], text: "MAIN BEARING"  },
  { pos: [0,  0.8,  0.0], text: "GEARBOX 48:1"  },
  { pos: [0, -1.0, -0.5], text: "PMSG · 15 MW"  },
  { pos: [-3.5, -1.5, 0.8], text: "CONVERTER"   },
  { pos: [ 3.5, -1.5, 0.8], text: "CONVERTER"   },
  { pos: [0,   -1.5, -11.0], text: "TRANSFORMER" },
  { pos: [2.5, -2.0,  2.0], text: "HPU · 210 bar"},
  { pos: [3.8,  0.8, -3.0], text: "OIL COOLER"  },
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
