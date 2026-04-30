/**
 * Nacelle shell — aerodynamic enclosure housing the drivetrain.
 *
 * Shell geometry uses drei's RoundedBox for the four box-like volumes (so
 * corners read as fillets, not 90° edges) and a custom ExtrudeGeometry for
 * the cowling top — a rounded-trapezoid front-view profile extruded along
 * the nacelle Z axis, giving the curved "Vestas helmet" silhouette.
 *
 * Geometry (V236-15.0 MW corrected dimensions, ~520 tonne nacelle):
 *   Central bay:           9 m wide × 8 m tall × 20 m long (drivetrain/generator)
 *   Port side compartment: 2 m × 6 m × 12 m (converter, cooling, UPS)
 *   Starboard compartment: 2 m × 6 m × 12 m (converter, switchgear)
 *   Rear service bay:      9 m × 6 m × 5 m (access platform, controls)
 *   Aerodynamic cowling:   8.5 m base × 5.5 m top × 1.6 m tall × 16 m long
 *                          (extruded from rounded-trapezoid 2D shape with
 *                           bezier helmet curve on top)
 *   Rear access hatch:     2 m × 3 m × 0.12 m (personnel access)
 *
 * Cutaway mode uses a THREE.Plane clipping plane on the X axis (x < plane.constant
 * is removed). Animated from +6 → 0 on transition so the cut rolls in.
 * Requires `gl.localClippingEnabled = true` (set in TurbineViewer3D.tsx).
 *
 * The nacelle shell does NOT rotate — the YawAssembly group handles yaw
 * rotation at the tower top. The nacelle sits at y=151, z-offset -5.
 */

import { memo, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

import type { TurbinePartId } from "../../../../constants/turbinePartEducation";
import { useLandingStore } from "../../../../store/landingStore";
import { metalPaintedShell, metalPaintedDetail } from "../materials";

interface NacelleProps {
  viewerMode: "normal" | "cutaway" | "exploded";
  selectedPart: TurbinePartId | null;
}

/**
 * Build the cowling extrude geometry once — front-view rounded trapezoid
 * (8.5 m base, 5.5 m top, 1.6 m tall) with a bezier-curved roof, extruded
 * 16 m along Z and centred so it can be placed at the same position as
 * the previous flat box.
 */
function buildCowlingGeometry(): THREE.ExtrudeGeometry {
  const halfBaseW = 4.25;
  const halfTopW  = 2.75;
  const h = 1.6;
  const filletShoulder = 0.40;
  const filletTop = 0.35;

  const s = new THREE.Shape();
  // Bottom-left corner, going CCW around the silhouette.
  s.moveTo(-halfBaseW, 0);
  // Up the port wall, with a generous radius into the shoulder.
  s.lineTo(-halfBaseW, h - filletShoulder);
  s.quadraticCurveTo(-halfBaseW, h, -halfBaseW + filletShoulder, h);
  // Across the port shoulder onto the trapezoid top edge.
  s.lineTo(-halfTopW, h);
  // Bezier "helmet" curve over the roof to the starboard top.
  s.bezierCurveTo(
    -halfTopW * 0.55, h + 0.45,
    +halfTopW * 0.55, h + 0.45,
    +halfTopW, h,
  );
  // Down the starboard shoulder fillet.
  s.lineTo(+halfBaseW - filletShoulder, h);
  s.quadraticCurveTo(+halfBaseW, h, +halfBaseW, h - filletShoulder);
  // Down the starboard wall to the base.
  s.lineTo(+halfBaseW, 0);
  s.lineTo(-halfBaseW, 0);

  // Suppress unused-variable lint for the small top fillet (reserved for
  // future Vestas-style sharper crease detail).
  void filletTop;

  const geom = new THREE.ExtrudeGeometry(s, {
    depth: 16,
    curveSegments: 18,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.10,
    bevelThickness: 0.10,
    steps: 1,
  });

  // Centre on Z (extrude grows along +Z by default; we want the cowling
  // centred at the parent's z so it concentrically overlays the central bay).
  geom.translate(0, 0, -8);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

const COWLING_GEOM = buildCowlingGeometry();

export const Nacelle = memo(function Nacelle({ viewerMode, selectedPart }: NacelleProps) {
  const isSelected = selectedPart === "nacelle";
  const isCutaway = viewerMode === "cutaway" || viewerMode === "exploded";
  const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

  // One plane shared by every shell mesh. Normal +X — everything with
  // x > plane.constant is kept, x < plane.constant is clipped away.
  // constant = 0 cuts at centreline; we animate in from +6.
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 6), []);
  const ghostPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);
  const targetConstant = useRef(6);

  useFrame((_, dt) => {
    targetConstant.current = isCutaway ? 0 : 6;
    const k = 1 - Math.exp(-dt * 8);
    clipPlane.constant += (targetConstant.current - clipPlane.constant) * k;
    ghostPlane.constant = -clipPlane.constant;
  });

  const clippingPlanes = isCutaway ? [clipPlane] : [];
  const ghostPlanes = isCutaway ? [ghostPlane] : [];

  const shellColor = isSelected ? "#7fb1ff" : metalPaintedShell.color;
  const sideColor  = isSelected ? "#7fb1ff" : "#5b6470";
  const cowlColor  = isSelected ? "#93c5fd" : "#a7b0ba";

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setSelectedPart("nacelle");
  };

  // Shell dimensions for ghost-edge geometry (must mirror the main mesh boxes).
  const shells: { size: [number, number, number]; position: [number, number, number] }[] = [
    { size: [9, 8, 20],     position: [0, 0, 0] },
    { size: [2, 6, 12],     position: [-5.5, -1, -2] },
    { size: [2, 6, 12],     position: [5.5, -1, -2] },
    { size: [9, 6, 5],      position: [0, -1, -7.5] },
    { size: [8.5, 1.5, 16], position: [0, 4.5, -2] },
  ];

  return (
    <group position={[0, 151, -5]}>
      {/* Central drivetrain bay — 9 × 8 × 20 m, rounded corners. */}
      <RoundedBox
        args={[9, 8, 20]}
        radius={0.30}
        smoothness={4}
        castShadow
        receiveShadow
        name="nacelle"
        onClick={handleClick}
      >
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
          sheen={isCutaway ? 0.6 : 0}
          sheenColor="#93c5fd"
          sheenRoughness={0.35}
        />
      </RoundedBox>

      {/* Port side compartment — converter / cooling / UPS. */}
      <RoundedBox
        args={[2, 6, 12]}
        radius={0.18}
        smoothness={4}
        position={[-5.5, -1, -2]}
        castShadow
        onClick={handleClick}
      >
        <meshPhysicalMaterial
          color={sideColor}
          roughness={0.45}
          metalness={metalPaintedDetail.metalness}
          clearcoat={0.4}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </RoundedBox>

      {/* Starboard side compartment — converter / switchgear. */}
      <RoundedBox
        args={[2, 6, 12]}
        radius={0.18}
        smoothness={4}
        position={[5.5, -1, -2]}
        castShadow
        onClick={handleClick}
      >
        <meshPhysicalMaterial
          color={sideColor}
          roughness={0.45}
          metalness={metalPaintedDetail.metalness}
          clearcoat={0.4}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </RoundedBox>

      {/* Rear service bay — access platform, control cabinets. */}
      <RoundedBox
        args={[9, 6, 5]}
        radius={0.22}
        smoothness={4}
        position={[0, -1, -7.5]}
        castShadow
        onClick={handleClick}
      >
        <meshPhysicalMaterial
          color={sideColor}
          roughness={0.5}
          metalness={0.4}
          clippingPlanes={clippingPlanes}
          side={THREE.DoubleSide}
        />
      </RoundedBox>

      {/* Aerodynamic cowling — curved Vestas-helmet roof above the central bay.
          Built once at module load (COWLING_GEOM) and shared. */}
      <mesh
        geometry={COWLING_GEOM}
        position={[0, 4.5, -2]}
        castShadow
        onClick={handleClick}
      >
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

      {/* Rear access hatch — personnel entry at aft face. */}
      <RoundedBox
        args={[2, 3, 0.12]}
        radius={0.04}
        smoothness={3}
        position={[0, 0.5, -10.06]}
        castShadow
        onClick={handleClick}
      >
        <meshStandardMaterial
          color="#374151"
          roughness={0.6}
          metalness={0.3}
          clippingPlanes={clippingPlanes}
        />
      </RoundedBox>

      {/* Ghost-shell wireframe — only visible in cutaway mode. */}
      {isCutaway && shells.map((s, i) => (
        <GhostShell
          key={`ghost-${i}`}
          size={s.size}
          position={s.position}
          clippingPlanes={ghostPlanes}
        />
      ))}
    </group>
  );
});

/**
 * Translucent wireframe outline of a shell mesh. Renders only the edges of a
 * box geometry so the clipped-away half still reads as a volume without
 * obscuring interior components.
 */
function GhostShell({
  size,
  position,
  clippingPlanes,
}: {
  size: [number, number, number];
  position: [number, number, number];
  clippingPlanes: THREE.Plane[];
}) {
  const edges = useMemo(() => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const eg = new THREE.EdgesGeometry(box, 1);
    box.dispose();
    return eg;
  }, [size]);

  return (
    <lineSegments position={position} geometry={edges}>
      <lineBasicMaterial
        color="#7b8698"
        transparent
        opacity={0.35}
        clippingPlanes={clippingPlanes}
        depthWrite={false}
      />
    </lineSegments>
  );
}
