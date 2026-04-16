/**
 * Baltic Sea water surface — animated with two overlapping sine waves.
 *
 * Vertex mutation in useFrame; geometry created once in useMemo.
 * NOT wrapped in React.memo — memo blocks useFrame from firing.
 */
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function SeaPlane() {
  const meshRef = useRef<THREE.Mesh>(null);

  // 60×60 segments = 7,442 vertices. Created once — never recreated.
  const geometry = useMemo(() => new THREE.PlaneGeometry(600, 600, 60, 60), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array; // cast required: typed as ArrayLike<number>
    for (let i = 0; i < pos.count; i++) {
      const x = arr[i * 3];
      const y = arr[i * 3 + 1];
      // Z = vertical displacement in local geometry space (becomes Y-up after mesh rotation)
      arr[i * 3 + 2] =
        Math.sin(x * 0.015 + t * 0.6) * 0.8 +
        Math.sin(y * 0.012 + t * 0.45 + 1.2) * 0.5;
    }
    pos.needsUpdate = true;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color="#0a1628"
        roughness={0.2}
        metalness={0.15}
        transparent
        opacity={0.92}
      />
    </mesh>
  );
}
