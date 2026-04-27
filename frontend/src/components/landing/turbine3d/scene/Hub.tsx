/**
 * Rotor hub — single aerodynamic ovoid built with LatheGeometry.
 *
 * The hub is the central casting that connects the three blades to the main
 * shaft. Modern Vestas spinners are blunt-nosed (NOT pointed cones); the
 * silhouette flows continuously from the rear flange, expands to the
 * blade-root equator (~6 m diameter), then tapers smoothly to a rounded
 * forward apex.
 *
 * Local frame (matches Rotor.tsx orientation):
 *   +Y = forward (toward incoming wind, away from generator).
 *   Lathe rotates the silhouette about the Y axis → 48 radial segments.
 *
 * Geometry: 20 profile points, 48 radial segments → ~960 verts, ~1.9k tris.
 * Single mesh = single outline-pass extraction (selecting "hub" now also
 * highlights the spinner, fixing a prior visual bug).
 */

import { memo, useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";

import { useLandingStore } from "../../../../store/landingStore";
import { metalPaintedShell } from "../materials";

interface HubProps {
  isSelected: boolean;
}

/**
 * Hub-spinner silhouette, profile from rear flange to forward apex.
 * x = off-axis radius, y = axial position along spin axis.
 *
 *   y = -2.0 → rear flange (bolts to main shaft)
 *   y =  0.0 → max radius 3.0 m (blade-root equator)
 *   y = 10.0 → rounded forward apex
 *
 * Total length 12 m, max diameter 6 m.
 */
const HUB_PROFILE: Vector2[] = [
  new Vector2(0.00, -2.00),  // rear cap centre (closes lathe on axis)
  new Vector2(0.60, -2.00),  // rear flange outer edge
  new Vector2(0.80, -1.85),
  new Vector2(1.60, -1.55),
  new Vector2(2.40, -1.10),
  new Vector2(2.85, -0.55),
  new Vector2(3.00,  0.00),  // max radius — blade-root flange equator
  new Vector2(2.95,  0.60),
  new Vector2(2.80,  1.20),
  new Vector2(2.55,  1.90),
  new Vector2(2.20,  2.80),  // shoulder
  new Vector2(1.85,  3.80),
  new Vector2(1.50,  5.00),
  new Vector2(1.15,  6.30),
  new Vector2(0.85,  7.50),
  new Vector2(0.60,  8.50),
  new Vector2(0.40,  9.30),
  new Vector2(0.22,  9.80),
  new Vector2(0.10, 10.00),  // apex (rounded, not pointed)
  new Vector2(0.00, 10.00),  // close on axis
];

const HUB_RADIAL_SEGMENTS = 48;

export const Hub = memo(function Hub({ isSelected }: HubProps) {
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  const hubGeom = useMemo(() => {
    const g = new LatheGeometry(HUB_PROFILE, HUB_RADIAL_SEGMENTS);
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }, []);

  return (
    <group>
      <mesh
        castShadow
        receiveShadow
        name="hub"
        geometry={hubGeom}
        onClick={(e) => { e.stopPropagation(); setSelectedPart("hub"); }}
      >
        <meshPhysicalMaterial
          color={isSelected ? "#60a5fa" : metalPaintedShell.color}
          roughness={metalPaintedShell.roughness}
          metalness={metalPaintedShell.metalness}
          clearcoat={metalPaintedShell.clearcoat}
          clearcoatRoughness={metalPaintedShell.clearcoatRoughness}
          reflectivity={metalPaintedShell.reflectivity}
          envMapIntensity={metalPaintedShell.envMapIntensity}
          emissive={isSelected ? "#1d4ed8" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
    </group>
  );
});
