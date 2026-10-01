/**
 * Top-mounted nacelle cooler (radiator unit).
 * Sits on the nacelle roof at approximately y=155.
 */

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { BufferGeometry, MeshBasicMaterial } from "three";

import { useLandingStore } from "../../../../store/landingStore";
import { useV236Model } from "../model/useV236Model";

interface CoolerProps {
  isSelected: boolean;
}

export const Cooler = memo(function Cooler({ isSelected }: CoolerProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
  const model = useV236Model();

  if (model?.cooler) {
    // CoolerTop: frame with two inclined radiator banks at the rear of the
    // roof, passive (wind-driven) — plus the nacelle aviation lights on top.
    return (
      <group>
        <mesh
          geometry={model.cooler}
          castShadow
          name="cooler"
          onClick={(e) => { e.stopPropagation(); setSelectedPart("cooler"); }}
        >
          <meshStandardMaterial
            color={isSelected ? "#60a5fa" : "#3c434a"}
            roughness={0.45}
            metalness={0.6}
            emissive={isSelected ? "#1d4ed8" : "#000000"}
            emissiveIntensity={isSelected ? 0.3 : 0}
          />
        </mesh>
        {model.nav_lights && <AviationLights geometry={model.nav_lights} />}
      </group>
    );
  }

  return (
    <group position={[0, 155.5, -4]}>
      <mesh
        castShadow
        name="cooler"
        onClick={(e) => { e.stopPropagation(); setSelectedPart("cooler"); }}
      >
        <boxGeometry args={[4.5, 1.2, 6]} />
        <meshStandardMaterial
          color={isSelected ? "#60a5fa" : "#4b5563"}
          roughness={0.5}
          metalness={0.4}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      {/* Vent slats */}
      {[-2, -0.5, 1, 2.5].map((z, i) => (
        <mesh key={i} position={[0, 0.7, z]}>
          <boxGeometry args={[4.3, 0.1, 0.8]} />
          <meshStandardMaterial color="#374151" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
});

/**
 * Red obstruction lights, flashing in sync (ICAO medium-intensity type B:
 * 20–60 flashes/min; here 30/min, 1 s on / 1 s off).
 */
export function AviationLights({ geometry }: { geometry: BufferGeometry }) {
  const matRef = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.color.setScalar(0).setRGB(clock.getElapsedTime() % 2 < 1 ? 1 : 0.25, 0.05, 0.03);
  });
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial ref={matRef} color="#ff2a1a" toneMapped={false} />
    </mesh>
  );
}
