/**
 * Nacelle interior service detail — shown in cutaway / exploded modes, on top
 * of the Blender drivetrain and NacelleSubsystems. All positions come from
 * model/layout (yaw frame, metres):
 *
 *   1. Service catwalk along the starboard side of the drivetrain (the side
 *      the cutaway opens), with handrails, kick plates and LED lighting.
 *   2. Generator / converter coolant loop to the coolant skid, coloured by the
 *      stator-winding temperature (live from the nacelle subsystem API when
 *      available). Direct drive: there is no gearbox oil circuit.
 *   3. Cable trays: generator → converter (LV), converter → transformer (LV),
 *      transformer → tower (66 kV, red sheath).
 *   4. HPU pressure gauge (live line pressure).
 *   5. Component labels.
 */

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";
import {
  selectNacelleData,
  useNacelleSubsystemsStore,
} from "../../../../store/nacelleSubsystemsStore";
import { onShaft, PARTS, SHAFT_Z } from "../model/layout";
import { generatorWindingC } from "../model/nacelleThermal";
import { CableTray } from "./nacelle/CableTray";

const RATED_POWER_MW = 15.0;
const FLOOR_Y = 147.35; // catwalk grating on the rear frame
const CATWALK_X = 2.45;

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
    <group>
      <CoolantLoop turbineId={turbineId} />
      <GeneratorToConverterTray />
      <ConverterToTransformerTray />
      <TransformerToTowerTray />
      <HPUPressureGauge turbineId={turbineId} />
      <ServiceCatwalk />
      {showLabels && <InteriorLabels />}
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
    tex.repeat.set(1.5, 15);
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
    tex.repeat.set(1.5, 15);
    return tex;
  }, []);

  return (
    <group position={[CATWALK_X, FLOOR_Y + 3.8, -6.5]}>
      {/* Catwalk deck — 1.2 m × 18 m, local y=-3.8 (≈ world 147.2) */}
      <mesh
        position={[0, -3.8, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[1.2, 13]} />
        <meshStandardMaterial
          map={grateTexture}
          color="#334155"
          roughness={0.85}
          metalness={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Anti-slip safety stripes — subtle yellow hatching just above the grate */}
      <mesh position={[0, -3.795, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 13]} />
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
        <mesh key={`stringer-${x}`} position={[x, -3.95, 0]}>
          <boxGeometry args={[0.08, 0.25, 13]} />
          <meshStandardMaterial color="#334155" roughness={0.75} metalness={0.55} />
        </mesh>
      ))}
      {/* Yellow kickplates — 10 cm strips along both deck edges, hazard-marked */}
      {([-0.6, 0.6] as number[]).map((x) => (
        <mesh key={`kick-${x}`} position={[x, -3.72, 0]}>
          <boxGeometry args={[0.02, 0.1, 13]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} metalness={0.3} />
        </mesh>
      ))}
      {/* Handrails — two yellow tubes at 1.1 m height flanking the walkway */}
      {([-0.65, 0.65] as number[]).map((x) => (
        <mesh key={`rail-${x}`} position={[x, -2.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 13, 8]} />
          <meshStandardMaterial color="#eab308" roughness={0.55} metalness={0.5} />
        </mesh>
      ))}
      {/* Mid-rail — second horizontal tube at ~0.55 m */}
      {([-0.65, 0.65] as number[]).map((x) => (
        <mesh key={`midrail-${x}`} position={[x, -3.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 13, 8]} />
          <meshStandardMaterial color="#eab308" roughness={0.55} metalness={0.5} />
        </mesh>
      ))}
      {/* Handrail uprights — 10 stanchions per side along the 18 m run */}
      {([-0.65, 0.65] as number[]).flatMap((x) =>
        Array.from({ length: 10 }).map((_, i) => {
          const z = (i - 4.5) * 1.3;
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
          position={[x - CATWALK_X, 1.6, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.2, 14]} />
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
      {[-5, 0, 5].map((z) => (
        <pointLight
          key={`lamp-${z}`}
          position={[-CATWALK_X, 1.5, z]}
          intensity={0.6}
          distance={5.5}
          decay={2}
          color="#f8fafc"
        />
      ))}
      {/* Port-side warm fill — bounced off painted steel walls, softens shadows */}
      <pointLight position={[-6.4, 1.0, 0]} intensity={0.45} distance={8} decay={2} color="#e8e0d0" />
      {/* Generator-area key light — aims straight down from above PMSG */}
      <spotLight
        position={[-CATWALK_X, 3.2, -1.5]}
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

// ── Coolant loop — animated tube, coloured by the generator winding ─────

function CoolantLoop({ turbineId }: { turbineId: string }) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const liveWindingC = useNacelleSubsystemsStore(selectNacelleData(turbineId))?.cooling.winding_temp_c;
  const airC = useLandingStore((s) => s.environment.airTemperatureC);
  // Prefer the live backend winding temperature; fall back to the same model.
  const tempC = liveWindingC ?? generatorWindingC(turbine?.powerOutputMW ?? 0, airC);
  const tempFrac = Math.min(1, Math.max(0, (tempC - 40) / (130 - 40)));

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

  // Stator coolant outlet (through the turret into the nacelle front) → coolant
  // skid on the starboard wall → return to the stator inlet.
  const [gx, gy, gz] = onShaft(SHAFT_Z.turretInside, 0.6, -1.4);
  const [cx, cy, cz] = PARTS.coolantSkid;
  const outbound = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(gx + 1.2, gy - 1.3, gz),
        new THREE.Vector3(3.6, gy - 0.4, (gz + cz) / 2),
        new THREE.Vector3(cx - 0.3, cy - 0.3, cz),
      ]),
    [gx, gy, gz, cx, cy, cz],
  );
  const returnPath = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(cx - 0.3, cy + 0.3, cz),
        new THREE.Vector3(3.0, gy + 1.8, (gz + cz) / 2),
        new THREE.Vector3(gx + 0.6, gy + 1.75, gz),
      ]),
    [gx, gy, gz, cx, cy, cz],
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

// Generator cables through the turret → port converter line-up, grey sheath.
function GeneratorToConverterTray() {
  const [x, y, z] = onShaft(SHAFT_Z.turretInside, 0, 1.2);
  const [cx, cy, cz] = PARTS.converter;
  const points = useMemo<[number, number, number][]>(
    () => [
      [x, y + 0.2, z],
      [x - 1.4, y + 0.4, z + 0.8],
      [cx + 0.2, cy + 1.6, cz - 1.2],
      [cx, cy + 1.3, cz],
    ],
    [x, y, z, cx, cy, cz],
  );
  return <CableTray points={points} width={0.32} height={0.14} cableCount={3} cableDiameter={0.07} sheathColor="#94a3b8" />;
}

// Converter → transformer (rear) — LV, grey sheath, along the port wall.
function ConverterToTransformerTray() {
  const [cx, cy, cz] = PARTS.converter;
  const [tx, ty, tz] = PARTS.transformer;
  const points = useMemo<[number, number, number][]>(
    () => [
      [cx, cy + 1.3, cz - 2.0],
      [cx + 0.2, cy + 1.3, tz + 3.2],
      [tx - 1.6, ty + 1.4, tz + 1.4],
      [tx - 0.9, ty + 1.3, tz + 0.6],
    ],
    [cx, cy, cz, tx, ty, tz],
  );
  return <CableTray points={points} width={0.28} height={0.12} cableCount={3} cableDiameter={0.06} sheathColor="#9ca3af" />;
}

// Transformer 66 kV terminals → down the tower on the yaw axis — red sheath.
function TransformerToTowerTray() {
  const [tx, ty, tz] = PARTS.transformer;
  const [ax, ay, az] = PARTS.towerAxisFloor;
  const points = useMemo<[number, number, number][]>(
    () => [
      [tx + 0.9, ty + 1.2, tz + 1.0],
      [CATWALK_X + 1.0, ay + 0.2, tz + 4.0],
      [CATWALK_X + 1.0, ay + 0.2, az - 2.0],
      [ax + 0.4, ay, az],
    ],
    [tx, ty, tz, ax, ay, az],
  );
  return (
    <CableTray points={points} width={0.36} height={0.16} cableCount={3} cableDiameter={0.085} sheathColor="#b91c1c" trayColor="#3f3f46" />
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
  const [hx, hy, hz] = PARTS.hpu;
  return (
    <group position={[hx + 0.76, hy + 0.1, hz + 0.35]}>
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.22, 0.02, 8, 24]} />
        <meshStandardMaterial color="#111827" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh rotation={[0, 0, needleAng]} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.03, 0.16, 0.005]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
    </group>
  );
}

// ── Labels ─────────────────────────────────────────────────────────

const up = (p: [number, number, number], dy: number): [number, number, number] => [p[0], p[1] + dy, p[2]];
const LABELS: Array<{ pos: [number, number, number]; text: string }> = [
  { pos: up(PARTS.mainBearing, 1.2), text: "MAIN BEARINGS · TDO + SRB" },
  { pos: up(PARTS.generatorTop, 0.8), text: "DIRECT-DRIVE PMSG · 200 POLES · 7.56 rpm · 12.6 Hz" },
  { pos: up(PARTS.brake, 1.0), text: "ROTOR BRAKE / LOCK" },
  { pos: up(onShaft(SHAFT_Z.nacelleFront + 0.8), 2.8), text: "TURRET (STATIONARY)" },
  { pos: up(PARTS.converter, 1.8), text: "FULL-POWER CONVERTER" },
  { pos: up(PARTS.transformer, 2.2), text: "TRANSFORMER → 66 kV" },
  { pos: up(PARTS.hpu, 1.3), text: "PITCH HPU · 220 bar" },
  { pos: up(PARTS.coolantSkid, 1.3), text: "COOLANT SKID" },
];

function InteriorLabels() {
  return (
    <>
      {LABELS.map((l) => (
        <Text
          key={l.text}
          position={l.pos}
          fontSize={0.3}
          color="#e0f2fe"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#0a0f1a"
        >
          {l.text}
        </Text>
      ))}
    </>
  );
}
