/**
 * Wind-field visualization — educational overlay.
 *
 * Shows the three things every wind-energy textbook diagrams:
 *   1. Freestream vector V∞ — a labelled arrow upstream of the rotor.
 *   2. Streamlines — 24 tubes flowing through the actuator disc, bent by
 *      the induction factor a ≈ 1/3 (Betz optimum). Downstream velocity
 *      u = V∞(1 − 2a). UV-scrolled animated texture gives flow direction.
 *   3. Wake deficit ribbon — horizontal plane downstream coloured by
 *      Jensen analytical model:  u(x)/U∞ = 1 − 2a/(1 + 2kx/R)²  (k=0.04).
 *      Red near rotor → green by 10D downstream.
 *   4. Tip vortex helices — 3 thin helical tubes trailing blade tips.
 *   5. Tip-speed gauge — HTML sprite at blade tip with |ΩR|, λ, Mach.
 *
 * All geometry assumes the rotor axis points +X (wind from +X). The
 * V236 nacelle yaws to face the wind, so we draw the field in world
 * coordinates aligned with the yawed rotor (parent group transforms it).
 *
 * Reference: Burton et al., "Wind Energy Handbook" (3rd ed.), §3.3–3.4.
 */

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

const ROTOR_RADIUS = 118;          // V236 rotor radius [m]
const HUB_HEIGHT = 151;             // nacelle Y [m]
const INDUCTION_A = 1 / 3;          // Betz-optimum axial induction
const JENSEN_K = 0.04;              // offshore wake decay constant
const N_STREAMLINES = 16;

interface WindFieldVizProps {
  /** Measured / slider wind speed in m/s. */
  windMs: number;
  /** Rotor angular speed in rad/s (for tip-speed gauge). */
  rotorSpeedRpm: number;
  /** Nacelle yaw in degrees (0 = +X upstream). Field rotates with nacelle. */
  yawDeg: number;
}

export const WindFieldViz = memo(function WindFieldViz({
  windMs,
  rotorSpeedRpm,
  yawDeg,
}: WindFieldVizProps) {
  const active = windMs > 0.1;

  // Rotation around Y so +X always points upwind (wind-bearing-driven, not yaw —
  // the field must match real wind direction, not where the turbine happens to
  // be pointing during a transient yaw).
  const yawRad = (yawDeg * Math.PI) / 180;

  return (
    <group position={[0, HUB_HEIGHT, 0]} rotation={[0, yawRad, 0]}>
      {active && <FreestreamArrow windMs={windMs} />}
      {active && <Streamlines windMs={windMs} />}
      {active && <WakeDeficitRibbon />}
      {active && <TipVortexHelices rotorSpeedRpm={rotorSpeedRpm} />}
      {active && <TipSpeedGauge rotorSpeedRpm={rotorSpeedRpm} windMs={windMs} />}
    </group>
  );
});

// ── Always-on wind-direction arrow ───────────────────────────────
//
// A single bold arrow upstream of the rotor that points in the direction
// the wind is blowing TOWARD. Visible in every view mode (Normal / Cutaway
// / Exploded) so the user always knows "where is the wind coming from".
//
// Meteorological convention: windDirectionDeg = bearing the wind comes
// FROM (0° = from N, 90° = from E). Internally we rotate +X axis so the
// arrow shaft points from upwind to the rotor.

interface WindDirectionArrowProps {
  /** Measured wind speed, m/s. */
  windMs: number;
  /** Meteorological wind bearing (0° = wind from N). */
  windDirectionDeg: number;
}

export const WindDirectionArrow = memo(function WindDirectionArrow({
  windMs,
  windDirectionDeg,
}: WindDirectionArrowProps) {
  if (windMs < 0.1) return null;

  // Rotate group so +X axis points INTO the wind's origin (upwind).
  // In meteorological convention, windDirectionDeg is the bearing FROM which
  // the wind comes; we want the arrow shaft to extend in that bearing.
  const yawRad = (windDirectionDeg * Math.PI) / 180;

  const shaftLen = 100;
  const originX = 250;                  // tail (upwind) — 250 m from hub
  const tipX = originX - shaftLen;      // head (rotor-side)

  return (
    <group position={[0, HUB_HEIGHT, 0]} rotation={[0, yawRad, 0]}>
      {/* Shaft — cylinder rotated 90° around Z so its length lies on +X */}
      <mesh position={[(originX + tipX) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, shaftLen, 12]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>
      {/* Arrowhead — cone pointing toward rotor (–X) */}
      <mesh position={[tipX - 5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[5, 12, 16]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
      </mesh>
      {/* Tail fletching — small disc at origin for readability */}
      <mesh position={[originX, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[2.2, 2.2, 1.5, 16]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.9} />
      </mesh>
      {/* Label anchored at the tail */}
      <Html position={[originX + 6, 10, 0]} center>
        <div className="text-[10px] font-mono text-sky-200 bg-black/60 px-2 py-0.5 rounded border border-sky-400/50 whitespace-nowrap shadow-lg shadow-black/50">
          WIND · {windMs.toFixed(1)} m/s · {Math.round(windDirectionDeg)}°
        </div>
      </Html>
    </group>
  );
});

// ── Freestream arrow ──────────────────────────────────────────────

function FreestreamArrow({ windMs }: { windMs: number }) {
  const shaftLen = Math.max(60, Math.min(140, windMs * 8));
  const originX = 220;
  const tipX = originX - shaftLen;
  return (
    <group>
      {/* Shaft */}
      <mesh position={[(originX + tipX) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.6, 0.6, shaftLen, 8]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
      {/* Head */}
      <mesh position={[tipX - 3, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[3, 8, 12]} />
        <meshBasicMaterial color="#60a5fa" />
      </mesh>
      {/* Label */}
      <Html position={[originX + 5, 8, 0]} center>
        <div className="text-[10px] font-mono text-sky-300 bg-black/50 px-1.5 py-0.5 rounded border border-sky-500/40 whitespace-nowrap">
          V∞ = {windMs.toFixed(1)} m/s
        </div>
      </Html>
    </group>
  );
}

// ── Streamlines — N tubes bent by actuator-disc induction ─────────

function Streamlines({ windMs }: { windMs: number }) {
  const scrollRef = useRef(0);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#93c5fd",
        transparent: true,
        opacity: 0.55,
      }),
    [],
  );

  // Animate a UV scroll-like effect by oscillating opacity along the tube.
  useFrame((_, dt) => {
    scrollRef.current = (scrollRef.current + dt * windMs * 0.08) % 1;
    material.opacity = 0.45 + 0.15 * Math.sin(scrollRef.current * Math.PI * 2);
  });

  const lines = useMemo(() => {
    const tubes: THREE.Vector3[][] = [];
    for (let i = 0; i < N_STREAMLINES; i++) {
      // Distribute across a vertical rectangle in front of the rotor.
      const phi = (i / N_STREAMLINES) * Math.PI * 2;
      const r = 20 + (i % 4) * 20;
      const y = r * Math.sin(phi) * 0.9;
      const z = r * Math.cos(phi) * 0.9;
      if (Math.hypot(y, z) < 8 || Math.hypot(y, z) > ROTOR_RADIUS) continue;

      // From upstream x=+260, through disc at x=0, to downstream x=-340.
      // Expansion downstream (actuator disc theory): radius grows (1-a)/(1-2a).
      const expand = (1 - INDUCTION_A) / (1 - 2 * INDUCTION_A);
      const pts: THREE.Vector3[] = [];
      for (let t = 0; t <= 1; t += 0.04) {
        const x = 260 - t * 600;
        let scale = 1;
        if (x < 0) {
          // Downstream — linear interpolation of radial expansion.
          const frac = Math.min(1, -x / 200);
          scale = 1 + (expand - 1) * frac;
        }
        pts.push(new THREE.Vector3(x, y * scale, z * scale));
      }
      tubes.push(pts);
    }
    return tubes;
  }, []);

  return (
    <>
      {lines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#93c5fd"
          lineWidth={1}
          transparent
          opacity={0.35}
        />
      ))}
    </>
  );
}

// ── Jensen wake-deficit ribbon ────────────────────────────────────

function WakeDeficitRibbon() {
  // Horizontal strip downstream, vertex coloured by Jensen analytical model.
  // Strip is 10 × rotor-diameter long and rotor-diameter wide, at hub height.
  const geometry = useMemo(() => {
    const length = 10 * 2 * ROTOR_RADIUS;   // 10D
    const width = 2 * ROTOR_RADIUS;
    const nX = 64;
    const nZ = 16;
    const geom = new THREE.PlaneGeometry(length, width, nX, nZ);
    geom.rotateX(-Math.PI / 2);
    // Centre so the ribbon starts at the rotor and extends -X downstream.
    geom.translate(-length / 2 - 10, -HUB_HEIGHT + 2, 0);

    const colors = new Float32Array(geom.attributes.position.count * 3);
    const pos = geom.attributes.position.array as Float32Array;
    for (let i = 0; i < geom.attributes.position.count; i++) {
      const x = pos[i * 3];
      const z = pos[i * 3 + 2];
      // Distance downstream — x is negative downstream of rotor.
      const d = Math.max(0, -x);
      // Jensen: u/U∞ = 1 − 2a/(1 + 2k·d/R)²
      const denom = 1 + (2 * JENSEN_K * d) / ROTOR_RADIUS;
      const uRatio = 1 - (2 * INDUCTION_A) / (denom * denom);
      // Also fade outside the expanding wake cone (radius R + k·d).
      const wakeR = ROTOR_RADIUS + JENSEN_K * d;
      const rFrac = Math.abs(z) / wakeR;
      const masked = rFrac < 1 ? uRatio : 1;
      // Colour: red (low u) → amber → green (recovered). 0 m/s = #ef4444, U∞ = #22c55e.
      const c = new THREE.Color().lerpColors(
        new THREE.Color("#ef4444"),
        new THREE.Color("#22c55e"),
        masked,
      );
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geom;
  }, []);

  return (
    <group>
      <mesh geometry={geometry} position={[0, 0, 0]}>
        <meshBasicMaterial vertexColors transparent opacity={0.35} depthWrite={false} />
      </mesh>
      {/* Distance markers */}
      {[1, 3, 5, 10].map((d) => (
        <Html
          key={d}
          position={[-d * 2 * ROTOR_RADIUS, -HUB_HEIGHT + 5, ROTOR_RADIUS + 4]}
          center
        >
          <div className="text-[9px] font-mono text-emerald-300 bg-black/50 px-1 py-0.5 rounded border border-emerald-500/30 whitespace-nowrap">
            {d}D
          </div>
        </Html>
      ))}
    </group>
  );
}

// ── Tip vortex helices ────────────────────────────────────────────

function TipVortexHelices({ rotorSpeedRpm }: { rotorSpeedRpm: number }) {
  const phaseRef = useRef(0);
  const omega = (rotorSpeedRpm * 2 * Math.PI) / 60;

  useFrame((_, dt) => {
    phaseRef.current += dt * omega;
  });

  const helices = useMemo(() => {
    // 3 helical lines, one per blade, trailing downstream.
    const tubes: THREE.Vector3[][] = [];
    for (let b = 0; b < 3; b++) {
      const bladePhase = (b * 2 * Math.PI) / 3;
      const pts: THREE.Vector3[] = [];
      const length = 90;
      for (let t = 0; t <= 1; t += 0.02) {
        const x = -t * length;
        const theta = bladePhase - t * 6;   // 6 rad over the trail
        // Radius tapers from rotor tip to ~90% downstream.
        const r = ROTOR_RADIUS * (1 - 0.08 * t);
        pts.push(
          new THREE.Vector3(
            x,
            r * Math.sin(theta),
            r * Math.cos(theta),
          ),
        );
      }
      tubes.push(pts);
    }
    return tubes;
  }, []);

  return (
    <>
      {helices.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#a78bfa"
          lineWidth={1.2}
          transparent
          opacity={0.55}
        />
      ))}
    </>
  );
}

// ── Tip-speed gauge ────────────────────────────────────────────────

function TipSpeedGauge({
  rotorSpeedRpm,
  windMs,
}: {
  rotorSpeedRpm: number;
  windMs: number;
}) {
  const omega = (rotorSpeedRpm * 2 * Math.PI) / 60;
  const tipSpeed = omega * ROTOR_RADIUS;
  const tsr = windMs > 0.5 ? tipSpeed / windMs : 0;
  const mach = tipSpeed / 340;  // speed of sound at sea level
  return (
    <Html position={[0, ROTOR_RADIUS + 6, 0]} center>
      <div className="text-[10px] font-mono text-amber-300 bg-black/70 px-2 py-1 rounded border border-amber-500/40 whitespace-nowrap leading-tight">
        <div>|ΩR| = {tipSpeed.toFixed(0)} m/s</div>
        <div>λ = {tsr.toFixed(1)}</div>
        <div>Mach {mach.toFixed(2)}</div>
      </div>
    </Html>
  );
}
