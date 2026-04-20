/**
 * D3 — Power Flow Animation
 *
 * Animated particle trails visualising the energy conversion chain through
 * the drivetrain. Four segments, each with a dedicated colour:
 *
 *   Wind → Rotor   (blue   #3b82f6)  aerodynamic capture
 *   Rotor → Shaft  (green  #22c55e)  mechanical transmission
 *   Shaft → Generator (yellow #eab308) electromagnetic conversion
 *   Generator → Converter (orange #f97316) power electronics
 *
 * Particle speed is proportional to electrical power output:
 *   speed = BASE_SPEED + SPEED_SCALE × (P / P_rated)
 *
 * Physics note: energy flows from high to low along the drivetrain Z-axis
 * (positive Z = upwind/hub side, negative Z = downwind/converter side).
 *
 * Reuses the WakeParticles design pattern (useFrame mutation on BufferAttribute).
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { selectTurbine, useLandingStore } from "../../../../store/landingStore";

interface PowerFlowParticlesProps {
  turbineId: string;
}

const RATED_MW = 15.0;
const BASE_SPEED = 0.5;
const SPEED_SCALE = 2.5;

interface Segment {
  colour: string;
  /** Start point in nacelle-local world space */
  start: THREE.Vector3;
  /** End point */
  end: THREE.Vector3;
  count: number;
  /** Radial spread around the segment axis [m] */
  spread: number;
}

const SEGMENTS: Segment[] = [
  {
    // Wind → Rotor (from ~3m in front of hub to hub face)
    colour: "#3b82f6",
    start: new THREE.Vector3(0, 150, 5),
    end:   new THREE.Vector3(0, 150, 1.5),
    count: 40,
    spread: 1.2,
  },
  {
    // Rotor → Gearbox (main shaft: hub face to gearbox centre)
    colour: "#22c55e",
    start: new THREE.Vector3(0, 150, 1.5),
    end:   new THREE.Vector3(0, 150, -1.5),
    count: 40,
    spread: 0.5,
  },
  {
    // Gearbox → Generator (gearbox output shaft to generator centre)
    colour: "#eab308",
    start: new THREE.Vector3(0, 150, -1.5),
    end:   new THREE.Vector3(0, 150, -5.5),
    count: 40,
    spread: 0.5,
  },
  {
    // Generator → Converter port
    colour: "#f97316",
    start: new THREE.Vector3(0, 150, -5.5),
    end:   new THREE.Vector3(-3.5, 149, -3.0),
    count: 30,
    spread: 0.3,
  },
  {
    // Generator → Converter starboard (symmetric split)
    colour: "#f97316",
    start: new THREE.Vector3(0, 150, -5.5),
    end:   new THREE.Vector3(3.5, 149, -3.0),
    count: 30,
    spread: 0.3,
  },
];

function useSegmentParticles(seg: Segment) {
  const ref = useRef<THREE.Points>(null);

  const { geometry, velocities } = useMemo(() => {
    const { count, start, end, spread } = seg;
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const len = start.distanceTo(end);

    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribute particles randomly along the segment
      const t = Math.random();
      // Random radial spread in the plane perpendicular to dir
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;

      // Find two axes perpendicular to dir
      const perp1 = new THREE.Vector3(1, 0, 0);
      if (Math.abs(dir.dot(perp1)) > 0.9) perp1.set(0, 1, 0);
      const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
      perp1.crossVectors(perp2, dir).normalize();

      const pt = new THREE.Vector3()
        .copy(start)
        .addScaledVector(dir, t * len)
        .addScaledVector(perp1, Math.cos(angle) * r)
        .addScaledVector(perp2, Math.sin(angle) * r);

      pos[i * 3    ] = pt.x;
      pos[i * 3 + 1] = pt.y;
      pos[i * 3 + 2] = pt.z;

      // Velocity along segment axis
      vel[i * 3    ] = dir.x;
      vel[i * 3 + 1] = dir.y;
      vel[i * 3 + 2] = dir.z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos.slice(), 3));
    return { geometry: geo, velocities: vel };
  }, [seg]);

  return { ref, geometry, velocities };
}

function SegmentParticles({
  seg,
  speed,
}: {
  seg: Segment;
  speed: number;
}) {
  const { ref, geometry, velocities } = useSegmentParticles(seg);
  const len = seg.start.distanceTo(seg.end);

  useFrame((_state, delta) => {
    if (!ref.current) return;
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const { count, start } = seg;
    const dir = new THREE.Vector3().subVectors(seg.end, seg.start).normalize();

    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      arr[ix    ] += velocities[ix    ] * speed * delta;
      arr[ix + 1] += velocities[ix + 1] * speed * delta;
      arr[ix + 2] += velocities[ix + 2] * speed * delta;

      // Recycle: check how far the particle has moved along the segment
      const relX = arr[ix    ] - start.x;
      const relY = arr[ix + 1] - start.y;
      const relZ = arr[ix + 2] - start.z;
      const proj = relX * dir.x + relY * dir.y + relZ * dir.z;

      if (proj > len) {
        // Reset to start with random t (stagger)
        const t2 = Math.random() * 0.3; // Reset near start
        arr[ix    ] = start.x + dir.x * t2 * len;
        arr[ix + 1] = start.y + dir.y * t2 * len;
        arr[ix + 2] = start.z + dir.z * t2 * len;
      }
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.18}
        color={seg.colour}
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function PowerFlowParticles({ turbineId }: PowerFlowParticlesProps) {
  const turbine = useLandingStore(selectTurbine(turbineId));
  const powerFraction = turbine ? Math.max(0.1, turbine.powerOutputMW / RATED_MW) : 0.5;
  const speed = BASE_SPEED + SPEED_SCALE * powerFraction;

  if (!turbine || turbine.powerOutputMW < 0.1) return null;

  return (
    <group name="power-flow">
      {SEGMENTS.map((seg, i) => (
        <SegmentParticles key={i} seg={seg} speed={speed} />
      ))}
    </group>
  );
}
