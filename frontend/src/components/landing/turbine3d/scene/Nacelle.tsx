/**
 * Nacelle shell — aerodynamic enclosure housing the drivetrain.
 *
 * Geometry (V236-15.0 MW corrected dimensions, ~520 tonne nacelle):
 *   Central bay:          9 m wide × 8 m tall × 20 m long (drivetrain/generator)
 *   Port side compartment: 2 m × 6 m × 12 m (converter, cooling, UPS)
 *   Starboard compartment: 2 m × 6 m × 12 m (converter, switchgear)
 *   Rear service bay:      9 m × 6 m × 5 m (access platform, controls)
 *   Aerodynamic cowling:   8.5 m × 1.5 m × 16 m (top cover)
 *   Rear access hatch:     2 m × 3 m × 0.1 m (personnel access)
 *
 * Cutaway mode now uses a THREE.Plane clipping plane on the X axis
 * (x < 0 is removed) — gives a clean "cut open" reveal instead of the
 * prior flat-grey wireframe that made the interior look terrible.
 * Animated from +10 → 0 on transition so the cut rolls in.
 *
 * Requires `gl.localClippingEnabled = true` (set in TurbineViewer3D.tsx).
 *
 * The nacelle shell does NOT rotate — the YawAssembly group handles
 * yaw rotation at the tower top. The nacelle sits at y=151, z-offset -5.
 */

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";
import { metalPaintedShell, metalPaintedDetail } from "../materials";

interface NacelleProps {
  viewerMode: "normal" | "cutaway" | "exploded";
  selectedPart: TurbinePartId | null;
}

export const Nacelle = memo(function Nacelle({ viewerMode, selectedPart }: NacelleProps) {
  const isSelected = selectedPart === "nacelle";
  const isCutaway = viewerMode === "cutaway" || viewerMode === "exploded";
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  // One plane shared by every shell mesh. Normal points +X — everything
  // with x > plane.constant is kept, x < plane.constant is clipped away.
  // constant = 0 cuts at the nacelle centreline; we animate in from +6.
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 6), []);
  const targetConstant = useRef(6);

  useFrame((_, dt) => {
    targetConstant.current = isCutaway ? 0 : 6;
    // Critically damped approach — ~0.25 s settling.
    const k = 1 - Math.exp(-dt * 8);
    clipPlane.constant += (targetConstant.current - clipPlane.constant) * k;
  });

  const clippingPlanes = isCutaway ? [clipPlane] : [];

  const shellColor = isSelected ? "#7fb1ff" : metalPaintedShell.color;
  const sideColor  = isSelected ? "#7fb1ff" : "#5b6470";
  const cowlColor  = isSelected ? "#93c5fd" : "#a7b0ba";

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart("nacelle");
  };

  return (
    <group position={[0, 151, -5]}>
      {/* Central drivetrain bay — 9 m × 8 m × 20 m */}
      <mesh castShadow receiveShadow name="nacelle" onClick={handleClick}>
        <boxGeometry args={[9, 8, 20]} />
        <meshPhysicalMaterial
          color={shellColor}
          roughness={metalPaintedShell.roughness}
          metalness={metalPaintedShell.metalness}
          clearcoat={metalPaintedShell.clearcoat}
          clearcoatRoughness={metalPaintedShell.clearcoatRoughness}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.18 : 0}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Port side compartment — converter / cooling / UPS */}
      <mesh position={[-5.5, -1, -2]} castShadow onClick={handleClick}>
        <boxGeometry args={[2, 6, 12]} />
        <meshPhysicalMaterial
          color={sideColor}
          roughness={0.45}
          metalness={metalPaintedDetail.metalness}
          clearcoat={0.4}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Starboard side compartment — converter / switchgear */}
      <mesh position={[5.5, -1, -2]} castShadow onClick={handleClick}>
        <boxGeometry args={[2, 6, 12]} />
        <meshPhysicalMaterial
          color={sideColor}
          roughness={0.45}
          metalness={metalPaintedDetail.metalness}
          clearcoat={0.4}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rear service bay — access platform, control cabinets */}
      <mesh position={[0, -1, -7.5]} castShadow onClick={handleClick}>
        <boxGeometry args={[9, 6, 5]} />
        <meshPhysicalMaterial
          color={sideColor}
          roughness={0.5}
          metalness={0.4}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Aerodynamic cowling — raised top cover over drivetrain */}
      <mesh position={[0, 4.5, -2]} castShadow onClick={handleClick}>
        <boxGeometry args={[8.5, 1.5, 16]} />
        <meshPhysicalMaterial
          color={cowlColor}
          roughness={metalPaintedShell.roughness}
          metalness={metalPaintedShell.metalness}
          clearcoat={0.85}
          clearcoatRoughness={0.12}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Rear access hatch — personnel entry at aft face */}
      <mesh position={[0, 0.5, -10.06]} castShadow onClick={handleClick}>
        <boxGeometry args={[2, 3, 0.12]} />
        <meshStandardMaterial
          color="#374151"
          roughness={0.6}
          metalness={0.3}
          clippingPlanes={clippingPlanes}
        />
      </mesh>
    </group>
  );
});
