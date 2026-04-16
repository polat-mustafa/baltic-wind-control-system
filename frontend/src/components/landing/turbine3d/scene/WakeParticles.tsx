/**
 * Downwind wake particle effect — 300 points recycling through a cone
 * that widens from 50 m near the rotor to 130 m at 270 m downwind.
 *
 * Hub height = y=150 in scene space. Downwind direction = -Z.
 * Invisible (returns null) when rpm < 0.1 — stops useFrame mutation.
 */
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 300;

interface WakeParticlesProps {
  rpm: number;
}

export function WakeParticles({ rpm }: WakeParticlesProps) {
  const ref = useRef<THREE.Points>(null);

  const { geometry, velocities, origins } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const ori = new Float32Array(COUNT * 3);

    for (let i = 0; i < COUNT; i++) {
      const t = Math.random();                        // 0 = near hub, 1 = far wake
      const spread = (50 + t * 80) * Math.random() * 0.3;
      const angle = Math.random() * Math.PI * 2;
      pos[i * 3]     = Math.cos(angle) * spread;
      pos[i * 3 + 1] = 150 + Math.sin(angle) * spread;
      pos[i * 3 + 2] = -(20 + t * 250);              // 20..270 m downwind
      vel[i * 3 + 2] = -(2 + Math.random() * 3);     // drift velocity (negative Z)
      ori[i * 3]     = pos[i * 3];
      ori[i * 3 + 1] = pos[i * 3 + 1];
      ori[i * 3 + 2] = pos[i * 3 + 2];
    }

    // CRITICAL: pass pos.slice() to BufferAttribute so geometry owns a copy.
    // The `pos` array above is our "origin" reference; the geometry mutates its own buffer.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos.slice(), 3));
    return { geometry: geo, velocities: vel, origins: ori };
  }, []);

  useFrame((_state, delta) => {
    if (!ref.current || rpm < 0.1) return;
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 2] += velocities[i * 3 + 2] * delta * 8;
      // Recycle particle when it passes 280 m downwind
      if (arr[i * 3 + 2] < -280) {
        arr[i * 3]     = origins[i * 3];
        arr[i * 3 + 1] = origins[i * 3 + 1];
        arr[i * 3 + 2] = origins[i * 3 + 2];
      }
    }
    attr.needsUpdate = true;
  });

  if (rpm < 0.1) return null;

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={1.2} color="#a8d8ea" transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}
