/**
 * Single V236 blade — lofted airfoil shape with optional vertex-color field overlay.
 *
 * Geometry: 115.5 m long (root at y=0, tip at y=115.5), chord 6 m → 1.2 m.
 * Approximated as 3 tapered box segments (root / mid / tip) plus tip cap.
 *
 * Field overlay (fieldMode !== "off"):
 *   Per-vertex colours are computed from the normalised span r = y/115.5
 *   and applied as a `color` BufferAttribute. The base material uses
 *   `vertexColors: true`, emissive = the same colour (so the field is
 *   visible even against dark sky).
 *
 *   thermal  — leading-edge friction + icing reference (NREL icing study).
 *              root = warm orange (boundary-layer friction, 38 °C typical),
 *              mid  = amber / yellow (25 °C),
 *              tip  = cool cyan (−2 °C, icing-prone in Baltic winter).
 *
 *   pressure — chord-wise Cp proxy, span-graded. Larwood/van Dam NREL TP-500
 *              style: suction-side minimum Cp near tip (~−3, bright purple),
 *              stagnation region near root (+1, deep blue), mid (neutral grey).
 *
 *   strain   — bending-moment proxy: root sees max M ≈ 0.5 × T × R (red),
 *              ramping linearly to zero at the tip (green).
 */

import { memo, forwardRef, useMemo } from "react";
import * as THREE from "three";
import { BoxGeometry, BufferAttribute, Color, Group } from "three";

import { useLandingStore } from "../../../../store/landingStore";

type FieldMode = "off" | "thermal" | "pressure" | "strain";

interface BladeProps {
  isSelected: boolean;
  statusColor: string;
  fieldMode?: FieldMode;
}

// Normalised span ramps (r = y/115.5 within segment, combined via base offset)
//   - thermal: 3-stop ramp (warm → yellow → cyan)
//   - pressure: deep blue (stagnation, root) → magenta (suction peak, mid) → yellow-green (recovery, tip)
//   - strain: red (root) → green (tip), linear
function sampleFieldColor(mode: FieldMode, r: number, out: Color): Color {
  const t = Math.min(1, Math.max(0, r));
  if (mode === "thermal") {
    if (t < 0.5) out.setRGB(
      THREE.MathUtils.lerp(0.98, 0.97, t / 0.5),
      THREE.MathUtils.lerp(0.45, 0.82, t / 0.5),
      THREE.MathUtils.lerp(0.10, 0.20, t / 0.5),
    );
    else out.setRGB(
      THREE.MathUtils.lerp(0.97, 0.18, (t - 0.5) / 0.5),
      THREE.MathUtils.lerp(0.82, 0.78, (t - 0.5) / 0.5),
      THREE.MathUtils.lerp(0.20, 0.95, (t - 0.5) / 0.5),
    );
  } else if (mode === "pressure") {
    // Stagnation root → suction peak mid → recovery tip
    if (t < 0.6) out.setRGB(
      THREE.MathUtils.lerp(0.10, 0.78, t / 0.6),
      THREE.MathUtils.lerp(0.25, 0.15, t / 0.6),
      THREE.MathUtils.lerp(0.75, 0.82, t / 0.6),
    );
    else out.setRGB(
      THREE.MathUtils.lerp(0.78, 0.95, (t - 0.6) / 0.4),
      THREE.MathUtils.lerp(0.15, 0.88, (t - 0.6) / 0.4),
      THREE.MathUtils.lerp(0.82, 0.25, (t - 0.6) / 0.4),
    );
  } else {
    // strain: red → amber → green
    out.setRGB(
      THREE.MathUtils.lerp(0.95, 0.10, t),
      THREE.MathUtils.lerp(0.12, 0.85, t),
      THREE.MathUtils.lerp(0.10, 0.25, t),
    );
  }
  return out;
}

/** Build a subdivided BoxGeometry with per-vertex colors baked from span fraction.
 *  Height segments give a smooth gradient — without them, each box has only
 *  two y-levels (top & bottom) so the ramp looks like 3 flat bands. */
function makeColoredGeometry(
  w: number, h: number, d: number,
  yCenter: number,            // mesh's y-position in blade frame
  bladeLength: number,        // 115.5 m
  mode: Exclude<FieldMode, "off">,
): BoxGeometry {
  const geom = new BoxGeometry(w, h, d, 1, 24, 1);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const yLocal = pos.getY(i);        // −h/2 … +h/2
    const yBlade = yCenter + yLocal;   // 0 … 115.5
    const r = yBlade / bladeLength;
    sampleFieldColor(mode, r, c);
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute("color", new BufferAttribute(colors, 3));
  return geom;
}

const BLADE_LENGTH = 115.5;

export const Blade = memo(
  forwardRef<Group, BladeProps>(function Blade({ isSelected, statusColor, fieldMode = "off" }, ref) {
    const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);

    // Build gradient geometry per segment only when a field mode is active.
    const mode = fieldMode === "off" ? null : fieldMode;
    const rootGeom = useMemo(() => mode ? makeColoredGeometry(6,   40, 1.2, 20,    BLADE_LENGTH, mode) : null, [mode]);
    const midGeom  = useMemo(() => mode ? makeColoredGeometry(3.5, 45, 0.9, 62,    BLADE_LENGTH, mode) : null, [mode]);
    const tipGeom  = useMemo(() => mode ? makeColoredGeometry(1.4, 25, 0.6, 102.5, BLADE_LENGTH, mode) : null, [mode]);

    // Base material colour when no field overlay.
    const baseColor = isSelected ? "#60a5fa" : "#e2e8f0";
    const baseEmissive = isSelected ? "#1d4ed8" : statusColor;
    const baseEmissiveIntensity = isSelected ? 0.3 : 0.03;

    // When a field mode is active, we render the blade as an unlit surface so
    // the thermal/pressure/strain gradient reads cleanly regardless of sky
    // preset or time-of-day — this is standard engineering-visualization
    // practice (flat colour ramp, no lighting interference, no tone mapping).
    const renderField = !!mode;

    return (
      <group ref={ref}>
        {/* Root section — wide, thick aerofoil. Name drives outline + clicks. */}
        <mesh
          position={[0, 20, 0]}
          castShadow={!renderField}
          name="blades"
          onClick={(e) => { e.stopPropagation(); setSelectedPart("blades"); }}
          geometry={rootGeom ?? undefined}
        >
          {!rootGeom && <boxGeometry args={[6, 40, 1.2]} />}
          {renderField ? (
            <meshBasicMaterial vertexColors toneMapped={false} />
          ) : (
            <meshStandardMaterial
              color={baseColor}
              roughness={0.35}
              metalness={0.05}
              emissive={baseEmissive}
              emissiveIntensity={baseEmissiveIntensity}
            />
          )}
        </mesh>

        {/* Mid section — narrowing */}
        <mesh position={[0, 62, 0.1]} castShadow={!renderField} geometry={midGeom ?? undefined}>
          {!midGeom && <boxGeometry args={[3.5, 45, 0.9]} />}
          {renderField ? (
            <meshBasicMaterial vertexColors toneMapped={false} />
          ) : (
            <meshStandardMaterial
              color={baseColor}
              roughness={0.35}
              metalness={0.05}
              emissive={baseEmissive}
              emissiveIntensity={baseEmissiveIntensity}
            />
          )}
        </mesh>

        {/* Tip section — narrow; spans y = 90 → 115 (25 m long) */}
        <mesh position={[0, 102.5, 0.15]} castShadow={!renderField} geometry={tipGeom ?? undefined}>
          {!tipGeom && <boxGeometry args={[1.4, 25, 0.6]} />}
          {renderField ? (
            <meshBasicMaterial vertexColors toneMapped={false} />
          ) : (
            <meshStandardMaterial
              color={baseColor}
              roughness={0.35}
              metalness={0.05}
              emissive={baseEmissive}
              emissiveIntensity={baseEmissiveIntensity}
            />
          )}
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
