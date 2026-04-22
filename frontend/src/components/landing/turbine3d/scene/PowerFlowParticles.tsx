/**
 * D3 — Power Flow Animation
 *
 * Animated particle trails visualising the energy conversion chain through
 * the drivetrain. Five segments, each with a dedicated colour:
 *
 *   Wind → Rotor         (blue   #3b82f6)  aerodynamic capture
 *   Rotor → Gearbox      (green  #22c55e)  mechanical transmission
 *   Gearbox → Generator  (yellow #eab308)  electromagnetic conversion
 *   Generator → Converter (orange #f97316)  power electronics (split L/R)
 *
 * Particle speed is proportional to electrical power output:
 *   speed = IDLE + SPEED_SCALE × (P / P_rated)
 *
 * Implementation notes
 * --------------------
 * All segments share ONE BufferGeometry, ONE Points object, and ONE useFrame
 * subscription. Per-particle segment data (origin, direction, length, colour)
 * is baked into Float32Arrays at mount-time. This avoids the 5× subscription
 * storm and undisposed-geometry churn the previous version caused whenever the
 * overlay was toggled on top of the post-processing stack.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";

interface PowerFlowParticlesProps {
  turbineId: string;
}

const RATED_MW = 15.0;
const SPEED_SCALE = 2.5;
const IDLE_SPEED = 0.05;

interface Segment {
  colour: string;
  start: [number, number, number];
  end: [number, number, number];
  count: number;
  spread: number;
}

const SEGMENTS: Segment[] = [
  // Wind → Rotor (hub approach)
  { colour: "#3b82f6", start: [0, 150,  5.0], end: [0, 150,  1.5], count: 40, spread: 1.2 },
  // Rotor → Gearbox (main shaft)
  { colour: "#22c55e", start: [0, 150,  1.5], end: [0, 150, -1.5], count: 40, spread: 0.5 },
  // Gearbox → Generator
  { colour: "#eab308", start: [0, 150, -1.5], end: [0, 150, -5.5], count: 40, spread: 0.5 },
  // Generator → Converter port
  { colour: "#f97316", start: [0, 150, -5.5], end: [-3.5, 149, -3.0], count: 30, spread: 0.3 },
  // Generator → Converter starboard
  { colour: "#f97316", start: [0, 150, -5.5], end: [ 3.5, 149, -3.0], count: 30, spread: 0.3 },
];

const TOTAL_COUNT = SEGMENTS.reduce((sum, s) => sum + s.count, 0);

/**
 * Build per-particle Float32Arrays. Runs once per mount.
 *
 * Returns raw typed arrays — the BufferGeometry itself is created
 * declaratively in JSX (`<bufferGeometry>`) so R3F manages its lifecycle.
 * Previous revisions built and disposed a THREE.BufferGeometry here, which
 * broke under React Strict Mode: the cleanup effect fired between the fake
 * unmount and the real mount, disposing the GPU buffer before first render
 * and blanking the entire Canvas subtree via the parent Suspense fallback.
 */
function buildParticleBuffers() {
  const positions = new Float32Array(TOTAL_COUNT * 3);
  const colors    = new Float32Array(TOTAL_COUNT * 3);
  const origins   = new Float32Array(TOTAL_COUNT * 3);
  const dirs      = new Float32Array(TOTAL_COUNT * 3);
  const lengths   = new Float32Array(TOTAL_COUNT);

  const tmpDir    = new THREE.Vector3();
  const tmpStart  = new THREE.Vector3();
  const tmpEnd    = new THREE.Vector3();
  const tmpPerp1  = new THREE.Vector3();
  const tmpPerp2  = new THREE.Vector3();
  const tmpColour = new THREE.Color();
  const tmpPoint  = new THREE.Vector3();

  let idx = 0;
  for (const seg of SEGMENTS) {
    tmpStart.fromArray(seg.start);
    tmpEnd.fromArray(seg.end);
    tmpDir.subVectors(tmpEnd, tmpStart);
    const len = tmpDir.length();
    if (len < 1e-6) continue;
    tmpDir.divideScalar(len);
    tmpColour.set(seg.colour);

    for (let i = 0; i < seg.count; i++) {
      const t     = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const r     = Math.random() * seg.spread;

      tmpPerp1.set(1, 0, 0);
      if (Math.abs(tmpDir.dot(tmpPerp1)) > 0.9) tmpPerp1.set(0, 1, 0);
      tmpPerp2.crossVectors(tmpDir, tmpPerp1).normalize();
      tmpPerp1.crossVectors(tmpPerp2, tmpDir).normalize();

      tmpPoint
        .copy(tmpStart)
        .addScaledVector(tmpDir, t * len)
        .addScaledVector(tmpPerp1, Math.cos(angle) * r)
        .addScaledVector(tmpPerp2, Math.sin(angle) * r);

      const p3 = idx * 3;
      positions[p3    ] = tmpPoint.x;
      positions[p3 + 1] = tmpPoint.y;
      positions[p3 + 2] = tmpPoint.z;

      origins[p3    ] = tmpStart.x;
      origins[p3 + 1] = tmpStart.y;
      origins[p3 + 2] = tmpStart.z;

      dirs[p3    ] = tmpDir.x;
      dirs[p3 + 1] = tmpDir.y;
      dirs[p3 + 2] = tmpDir.z;

      lengths[idx] = len;

      colors[p3    ] = tmpColour.r;
      colors[p3 + 1] = tmpColour.g;
      colors[p3 + 2] = tmpColour.b;

      idx++;
    }
  }

  return { positions, colors, origins, dirs, lengths };
}

export function PowerFlowParticles({ turbineId }: PowerFlowParticlesProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const rawFraction = turbine ? turbine.powerOutputMW / RATED_MW : 0;
  const powerFraction = Number.isFinite(rawFraction)
    ? Math.max(0, Math.min(1, rawFraction))
    : 0;
  const speed = IDLE_SPEED + SPEED_SCALE * powerFraction;

  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors, origins, dirs, lengths } = useMemo(
    () => buildParticleBuffers(),
    [],
  );

  useFrame((_state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const step = speed * delta;

    for (let i = 0; i < TOTAL_COUNT; i++) {
      const p3 = i * 3;
      const dx = dirs[p3    ];
      const dy = dirs[p3 + 1];
      const dz = dirs[p3 + 2];

      arr[p3    ] += dx * step;
      arr[p3 + 1] += dy * step;
      arr[p3 + 2] += dz * step;

      // Recycle: project current position onto segment axis, reset near origin
      // with a small random stagger if it has overshot the end.
      const ox = origins[p3    ];
      const oy = origins[p3 + 1];
      const oz = origins[p3 + 2];
      const proj =
        (arr[p3    ] - ox) * dx +
        (arr[p3 + 1] - oy) * dy +
        (arr[p3 + 2] - oz) * dz;

      if (proj > lengths[i]) {
        const t2 = Math.random() * 0.3 * lengths[i];
        arr[p3    ] = ox + dx * t2;
        arr[p3 + 1] = oy + dy * t2;
        arr[p3 + 2] = oz + dz * t2;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points
      ref={pointsRef}
      frustumCulled={false}
      raycast={() => null}
      name="power-flow"
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors,    3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.18}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
