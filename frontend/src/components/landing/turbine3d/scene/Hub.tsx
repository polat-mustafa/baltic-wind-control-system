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
// True ovoid (egg-shape) silhouette per real Vestas V236 spinner photos.
// Front portion is a half-ellipsoid with semi-major a=7 m (length) and
// semi-minor b=3 m (radius). The forward apex is intentionally blunt
// (radius 1.0 m at y=7.5) — modern Vestas/Siemens nose cones are dome-like,
// not pointed cones. Profile sampled at ~30° increments along the ellipse
// so the lathe surface stays smooth.
const HUB_PROFILE: Vector2[] = [
  // Rear half — short tapered "shoulder" back to the main shaft flange.
  new Vector2(0.00, -2.50),  // rear cap centre (closes lathe on axis)
  new Vector2(0.50, -2.50),  // rear flange centre
  new Vector2(1.00, -2.40),
  new Vector2(1.80, -2.10),
  new Vector2(2.40, -1.65),
  new Vector2(2.80, -1.05),
  new Vector2(2.98, -0.50),
  new Vector2(3.00,  0.00),  // max radius (3.0 m) — blade-root flange equator

  // Forward half — half-ellipse a=7.5, b=3.0 with blunt-rounded apex.
  // Sampled along ellipse parametric (x = b·sin θ, y = a·(1−cos θ)) for
  // θ = 10°…170° in 10° steps gives a smooth, fat egg silhouette.
  new Vector2(2.99,  0.45),  // θ=15°
  new Vector2(2.95,  0.95),  // θ=25°
  new Vector2(2.85,  1.55),  // θ=35°
  new Vector2(2.70,  2.20),  // θ=45°
  new Vector2(2.50,  2.95),  // θ=55°
  new Vector2(2.25,  3.75),  // θ=65°
  new Vector2(1.95,  4.55),  // θ=75°
  new Vector2(1.60,  5.40),  // θ=85°  — broad equator pass, nose stays fat
  new Vector2(1.25,  6.10),  // θ=100°
  new Vector2(0.95,  6.65),  // θ=115°
  new Vector2(0.70,  7.05),  // θ=130°
  new Vector2(0.50,  7.30),  // θ=145°
  new Vector2(0.25,  7.45),  // close to apex
  new Vector2(0.00,  7.50),  // apex — closes on axis with tangent = horizontal
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
    // Rotate the lathe so its symmetry axis (local +Y) maps to world +Z.
    // The rotor frame's spin axis is Z; +Z is forward (toward incoming wind).
    // Without this rotation the apex pointed UP and the blade root flange sat
    // in the XZ plane — geometrically wrong for a horizontal-axis turbine.
    <group rotation={[Math.PI / 2, 0, 0]}>
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
