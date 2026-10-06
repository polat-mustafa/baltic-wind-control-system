/**
 * V236 blade — lofted aerodynamic surface.
 *
 * Geometry: built from 12 spanwise stations, each with a 24-vertex airfoil
 * cross-section (NACA-style closed curve, half-cosine spaced). Stations carry
 * realistic chord, twist, prebend (forward curve, +Z), and aft sweep (+X)
 * derived from public data on Vestas V164/V236 and IEC 61400-1 reference
 * blades. Tip prebend = 5 m forward, twist = 22° peak → 1° tip, max chord
 * 6.4 m at r=0.17, sweep onset at r=0.7.
 *
 * Local frame: root at y=0, span along +Y, chord along ±X, thickness along ±Z.
 *   The rotor turns clockwise seen from upwind, so blade 1 moves toward +X:
 *   leading edge = +X, trailing edge = −X; pressure side = +Z (facing the
 *   wind), suction side = −Z (lift points downwind-and-forward → torque).
 *   Prebend translates the blade along +Z (toward incoming wind, away from tower).
 *   Sweep translates along −X (toward the trailing edge — "aft sweep").
 *   Twist follows the BEM optimum at λ ≈ 9.3 (α ≈ 5°): ~9.5° at 35 m → ~0° at the tip.
 *
 * Field overlay (Blade Analysis): Rotor passes a live vertex-coloured clone
 *   of this geometry (hooks/useBladeField, physics in model/bladeField) —
 *   kinetic-heating temperature, surface pressure Cp·q, or flapwise bending
 *   moment — drawn lit, with the field fed into the emissive term.
 *
 * Geometry budget: ~290 verts, ~590 tris per blade (3 blades = ~1.8k tris/rotor).
 */

import { memo, forwardRef } from "react";
import * as THREE from "three";
import { Group } from "three";

import { useLandingStore } from "../../../../store/landingStore";
import { metalPaintedShell } from "../materials";
import { useV236Model } from "../model/useV236Model";
import { bladeFieldOnBeforeCompile, bladeMarkOnBeforeCompile, bladeOnBeforeCompile } from "./bladeShader";
import { BLADE_GEOM_BASE } from "./bladeGeometry";

interface BladeProps {
  isSelected: boolean;
  statusColor: string;
  /** Vertex-coloured blade for the Blade Analysis overlay (null = off). */
  fieldGeom?: THREE.BufferGeometry | null;
}

// ─── Component ────────────────────────────────────────────────────────────

export const Blade = memo(
  forwardRef<Group, BladeProps>(function Blade(
    { isSelected, statusColor, fieldGeom = null },
    ref,
  ) {
    const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
    // Blender blade (96-point DU/NACA-type sections, 72 stations, flatback root)
    const model = useV236Model();
    const baseGeom = model?.blade ?? BLADE_GEOM_BASE;

    const renderField = !!fieldGeom;
    const baseColor = isSelected ? "#60a5fa" : metalPaintedShell.color;
    const baseEmissive = isSelected ? "#1d4ed8" : statusColor;
    const baseEmissiveIntensity = isSelected ? 0.3 : 0.03;

    return (
      <group ref={ref}>
        <mesh
          name="blades"
          castShadow
          onClick={(e) => { e.stopPropagation(); setSelectedPart("blades"); }}
          geometry={fieldGeom ?? baseGeom}
        >
          {renderField ? (
            <meshStandardMaterial
              vertexColors
              roughness={0.55}
              metalness={0}
              envMapIntensity={0.4}
              onBeforeCompile={bladeFieldOnBeforeCompile}
            />
          ) : (
            <meshPhysicalMaterial
              color={baseColor}
              roughness={metalPaintedShell.roughness}
              metalness={metalPaintedShell.metalness}
              clearcoat={metalPaintedShell.clearcoat}
              clearcoatRoughness={metalPaintedShell.clearcoatRoughness}
              reflectivity={metalPaintedShell.reflectivity}
              envMapIntensity={metalPaintedShell.envMapIntensity}
              emissive={baseEmissive}
              emissiveIntensity={baseEmissiveIntensity}
              onBeforeCompile={bladeOnBeforeCompile}
            />
          )}
        </mesh>

        {/* Aviation obstruction marking — 3 high-visibility red bands at the
            blade tip per ICAO Annex 14 vol I & IEC 61400-1. Each band wraps
            the blade chord. We place them inside the tip 6 m of the blade,
            offset along the local prebend + sweep so they sit ON the blade
            surface as it curves forward. Rendered unlit (toneMapped=false)
            so they stay visibly red even in low-light scenes. */}
        {!renderField && model?.blade_marks && (
          <>
            {/* Red–white–red 6 m tip bands, painted on the blade surface */}
            <mesh geometry={model.blade_marks} castShadow={false}>
              <meshStandardMaterial color="#c1121f" roughness={0.45} onBeforeCompile={bladeMarkOnBeforeCompile} />
            </mesh>
            {model.blade_root && (
              <mesh geometry={model.blade_root}>
                <meshStandardMaterial color="#3c434a" roughness={0.45} metalness={0.6} />
              </mesh>
            )}
          </>
        )}
        {!renderField && !model?.blade_marks && (
          <group>
            {[
              { span: 109.0, chord: 1.15, sweep: 0.95, prebend: 4.55 },
              { span: 112.0, chord: 0.85, sweep: 1.05, prebend: 4.80 },
              { span: 114.5, chord: 0.55, sweep: 1.15, prebend: 4.95 },
            ].map((b, i) => (
              <mesh
                key={i}
                position={[-b.sweep, b.span, b.prebend]}
                castShadow={false}
              >
                {/* x = chord-width, y = band height along span, z = thickness */}
                <boxGeometry args={[b.chord * 1.05, 0.7, 0.35]} />
                <meshBasicMaterial color="#d62828" toneMapped={false} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    );
  }),
);
