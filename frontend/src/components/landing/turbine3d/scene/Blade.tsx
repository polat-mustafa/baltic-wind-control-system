/**
 * Single V236 blade — lofted airfoil shape.
 *
 * Dimensions: 115.5 m long, chord 6 m at root → 1.2 m at tip.
 *
 * We approximate the airfoil loft using a BoxGeometry with tapered width/depth,
 * which gives the recognisable blade silhouette at a reasonable polygon count.
 * The blade extends along +Y in its local group space; the Rotor group rotates
 * it to position (120° apart) and controls pitch via rotation.z.
 *
 * The blade is positioned with its root at the local origin, tip at y=115.5.
 */

import { memo, forwardRef } from "react";
import { Group } from "three";

import { useLandingStore } from "../../../../store/landingStore";

interface BladeProps {
  isSelected: boolean;
  statusColor: string;
}

export const Blade = memo(
  forwardRef<Group, BladeProps>(function Blade({ isSelected, statusColor }, ref) {
    const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

    return (
      <group ref={ref}>
        {/* Root section — wide, thick aerofoil. Name drives outline + clicks. */}
        <mesh
          position={[0, 20, 0]}
          castShadow
          name="blades"
          onClick={(e) => { e.stopPropagation(); setSelectedPart("blades"); }}
        >
          <boxGeometry args={[6, 40, 1.2]} />
          <meshStandardMaterial
            color={isSelected ? "#60a5fa" : "#e2e8f0"}
            roughness={0.35}
            metalness={0.05}
            emissive={isSelected ? "#1d4ed8" : statusColor}
            emissiveIntensity={isSelected ? 0.3 : 0.03}
          />
        </mesh>

        {/* Mid section — narrowing */}
        <mesh position={[0, 62, 0.1]} castShadow>
          <boxGeometry args={[3.5, 45, 0.9]} />
          <meshStandardMaterial
            color={isSelected ? "#60a5fa" : "#e2e8f0"}
            roughness={0.35}
            metalness={0.05}
            emissive={isSelected ? "#1d4ed8" : statusColor}
            emissiveIntensity={isSelected ? 0.3 : 0.03}
          />
        </mesh>

        {/* Tip section — narrow; spans y = 90 → 115 (25 m long) */}
        <mesh position={[0, 102.5, 0.15]} castShadow>
          <boxGeometry args={[1.4, 25, 0.6]} />
          <meshStandardMaterial
            color={isSelected ? "#60a5fa" : "#e2e8f0"}
            roughness={0.35}
            metalness={0.05}
            emissive={isSelected ? "#1d4ed8" : statusColor}
            emissiveIntensity={isSelected ? 0.3 : 0.03}
          />
        </mesh>

        {/* Blade tip cap — exact V236 blade length (115.5 m from root) */}
        <mesh position={[0, 115.5, 0.15]}>
          <sphereGeometry args={[0.7, 8, 8]} />
          <meshStandardMaterial color="#d1d5db" roughness={0.3} metalness={0.1} />
        </mesh>
      </group>
    );
  }),
);
