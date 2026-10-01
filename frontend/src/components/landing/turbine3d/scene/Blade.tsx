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
 * Field overlay (fieldMode !== "off"):
 *   Per-vertex colours baked from span fraction (UV.v) — thermal/pressure/strain
 *   ramps. Material switches to meshBasicMaterial (unlit, vertexColors,
 *   toneMapped=false) so the gradient reads cleanly under any sky preset.
 *
 *   thermal  — leading-edge friction + icing reference (NREL icing study).
 *   pressure — chord-wise Cp proxy, span-graded (Larwood/van Dam style).
 *   strain   — bending-moment proxy: root max → linear ramp to zero at tip.
 *
 * Geometry budget: ~290 verts, ~590 tris per blade (3 blades = ~1.8k tris/rotor).
 */

import { memo, forwardRef, useMemo } from "react";
import * as THREE from "three";
import { Group } from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { useLandingStore } from "../../../../store/landingStore";
import { metalPaintedShell } from "../materials";
import { useV236Model } from "../model/useV236Model";
import { bladeMarkOnBeforeCompile, bladeOnBeforeCompile } from "./bladeShader";
import { BLADE_LENGTH_M as BLADE_LENGTH, STATIONS } from "./bladeConstants";

type FieldMode = "off" | "thermal" | "pressure" | "strain";

interface BladeProps {
  isSelected: boolean;
  statusColor: string;
  fieldMode?: FieldMode;
}

const N_AIRFOIL = 24; // vertices per airfoil cross-section ring

// ─── Airfoil profile library ──────────────────────────────────────────────

interface AirfoilFamily {
  thickness: number; // max thickness / chord
  camber: number;    // max camber / chord (parabolic)
}

const AIRFOIL_FAMILIES = {
  cylinder:   { thickness: 1.00, camber: 0.000 },
  transition: { thickness: 0.70, camber: 0.020 },
  "du-thick": { thickness: 0.40, camber: 0.045 },
  "du-mid":   { thickness: 0.30, camber: 0.040 },
  "du-thin":  { thickness: 0.21, camber: 0.035 },
  naca64:     { thickness: 0.15, camber: 0.025 },
} satisfies Record<string, AirfoilFamily>;

type AirfoilFamilyName = keyof typeof AIRFOIL_FAMILIES;

/**
 * Closed 2D airfoil profile in chord-normalised coordinates.
 * Returns 24 (x, y) pairs as a Float32Array of length 48.
 *   x ∈ [0, 1] — leading edge (0) → trailing edge (1).
 *   y          — camber + thickness (positive = suction / upper surface).
 * Vertex order: TE upper → LE → TE lower (CCW), so the loft wraps closed.
 * Half-cosine x-spacing concentrates points at the leading edge where
 * curvature is highest.
 */
function airfoilProfile(family: AirfoilFamilyName): Float32Array {
  if (family === "cylinder") {
    // Closed circle for the cylindrical root section, 24 points.
    const pts = new Float32Array(N_AIRFOIL * 2);
    for (let i = 0; i < N_AIRFOIL; i++) {
      const a = (i / N_AIRFOIL) * Math.PI * 2;
      pts[i * 2]     = 0.5 + 0.5 * Math.cos(a);
      pts[i * 2 + 1] = 0.5 * Math.sin(a);
    }
    return pts;
  }

  const fam = AIRFOIL_FAMILIES[family];
  const t = fam.thickness;
  const cm = fam.camber;
  const N = N_AIRFOIL / 2; // 12 points per surface

  // Half-cosine x-spacing
  const xs: number[] = [];
  for (let i = 0; i < N; i++) {
    xs.push(0.5 * (1 - Math.cos((i / (N - 1)) * Math.PI)));
  }

  // NACA 4-digit symmetric thickness envelope
  const thick = (x: number) =>
    5 * t * (
      0.2969 * Math.sqrt(x)
      - 0.1260 * x
      - 0.3516 * x * x
      + 0.2843 * x * x * x
      - 0.1036 * x * x * x * x  // closed-trailing-edge variant (-0.1036 instead of -0.1015)
    );

  // Parabolic camber line
  const camberLine = (x: number) => cm * 4 * x * (1 - x);

  const pts = new Float32Array(N_AIRFOIL * 2);
  // Upper surface: TE → LE
  for (let i = 0; i < N; i++) {
    const x = xs[N - 1 - i];
    pts[i * 2]     = x;
    pts[i * 2 + 1] = camberLine(x) + thick(x);
  }
  // Lower surface: LE → TE
  for (let i = 0; i < N; i++) {
    const x = xs[i];
    pts[(i + N) * 2]     = x;
    pts[(i + N) * 2 + 1] = camberLine(x) - thick(x);
  }
  return pts;
}

// ─── Spanwise station table — V236-realistic ──────────────────────────────

// ─── Lofter ───────────────────────────────────────────────────────────────

function buildLoftedBladeGeometry(): THREE.BufferGeometry {
  const ringCount = STATIONS.length;
  const vertCount = ringCount * N_AIRFOIL + 2; // +2 for root cap centre & tip cap centre
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  // Place ring vertices.
  for (let s = 0; s < ringCount; s++) {
    const st = STATIONS[s];
    const profile = airfoilProfile(st.airfoil);
    const cosT = Math.cos(-st.twistDeg * Math.PI / 180);
    const sinT = Math.sin(-st.twistDeg * Math.PI / 180);
    const v = st.span / BLADE_LENGTH;

    for (let i = 0; i < N_AIRFOIL; i++) {
      // 1. Centre profile so quarter-chord (x=0.25) sits at origin → pitch axis.
      const px = (profile[i * 2] - 0.25) * st.chord;
      const py = profile[i * 2 + 1] * st.chord;

      // 2. Twist around the spanwise (Y) axis. Rotates in the XZ plane:
      //    px (chord direction) ↔ py (camber/thickness direction).
      const xT =  cosT * px + sinT * py;
      const zT = -sinT * px + cosT * py;

      // 3. Translate to station blade-local position.
      //    sweep adds +X (aft), span sets Y, prebend adds +Z (forward / windward).
      const idx = s * N_AIRFOIL + i;
      // Section turned 180° about the span axis (LE +X, pressure side +Z);
      // prebend stays upwind.
      positions[idx * 3]     = -(xT + st.sweep);
      positions[idx * 3 + 1] = st.span;
      positions[idx * 3 + 2] = -zT + st.prebend;
      uvs[idx * 2]     = i / (N_AIRFOIL - 1);
      uvs[idx * 2 + 1] = v;
    }
  }

  // Cap centres (root + tip), placed on each section's centroid.
  const rootCapIdx = ringCount * N_AIRFOIL;
  const tipCapIdx = rootCapIdx + 1;
  positions[rootCapIdx * 3]     = -STATIONS[0].sweep;
  positions[rootCapIdx * 3 + 1] = STATIONS[0].span;
  positions[rootCapIdx * 3 + 2] = STATIONS[0].prebend;
  uvs[rootCapIdx * 2]     = 0.5;
  uvs[rootCapIdx * 2 + 1] = 0;

  positions[tipCapIdx * 3]     = -STATIONS[ringCount - 1].sweep;
  positions[tipCapIdx * 3 + 1] = BLADE_LENGTH;
  positions[tipCapIdx * 3 + 2] = STATIONS[ringCount - 1].prebend;
  uvs[tipCapIdx * 2]     = 0.5;
  uvs[tipCapIdx * 2 + 1] = 1;

  // Build index buffer.
  const bodyTris = (ringCount - 1) * N_AIRFOIL * 2;
  const capTris  = N_AIRFOIL * 2;
  const indices = new Uint16Array((bodyTris + capTris) * 3);
  let w = 0;

  // Body quads between adjacent rings (CCW-wound for outward normals).
  for (let s = 0; s < ringCount - 1; s++) {
    const r0 = s * N_AIRFOIL;
    const r1 = (s + 1) * N_AIRFOIL;
    for (let i = 0; i < N_AIRFOIL; i++) {
      const j = (i + 1) % N_AIRFOIL;
      indices[w++] = r0 + i;
      indices[w++] = r1 + i;
      indices[w++] = r1 + j;

      indices[w++] = r0 + i;
      indices[w++] = r1 + j;
      indices[w++] = r0 + j;
    }
  }

  // Root cap (fan inward, normal -Y).
  for (let i = 0; i < N_AIRFOIL; i++) {
    const j = (i + 1) % N_AIRFOIL;
    indices[w++] = rootCapIdx;
    indices[w++] = j;
    indices[w++] = i;
  }

  // Tip cap (fan outward, normal +Y).
  const lastRing = (ringCount - 1) * N_AIRFOIL;
  for (let i = 0; i < N_AIRFOIL; i++) {
    const j = (i + 1) % N_AIRFOIL;
    indices[w++] = tipCapIdx;
    indices[w++] = lastRing + i;
    indices[w++] = lastRing + j;
  }

  let geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  // Weld coincident verts (closed-TE airfoils have upper/lower TE at the
  // same point) so smooth normals are continuous across the seam.
  geom = mergeVertices(geom, 1e-4) as THREE.BufferGeometry;
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  geom.computeBoundingBox();
  return geom;
}

// Cached at module level — same geometry shared across all 3 blades and
// all turbine instances (only transforms differ).
const BLADE_GEOM_BASE = buildLoftedBladeGeometry();

// ─── Field-mode color ramps ───────────────────────────────────────────────

function sampleFieldColor(mode: Exclude<FieldMode, "off">, r: number, out: THREE.Color): THREE.Color {
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
    out.setRGB(
      THREE.MathUtils.lerp(0.95, 0.10, t),
      THREE.MathUtils.lerp(0.12, 0.85, t),
      THREE.MathUtils.lerp(0.10, 0.25, t),
    );
  }
  return out;
}

function buildFieldGeometry(mode: Exclude<FieldMode, "off">, base = BLADE_GEOM_BASE): THREE.BufferGeometry {
  const geom = base.clone();
  const uv = geom.attributes.uv;
  const colors = new Float32Array(uv.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < uv.count; i++) {
    const v = uv.getY(i); // span fraction baked at loft time
    sampleFieldColor(mode, v, c);
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geom;
}

// Pre-build field geometries once at module load (3 small allocations).
const BLADE_GEOM_THERMAL  = buildFieldGeometry("thermal");
const BLADE_GEOM_PRESSURE = buildFieldGeometry("pressure");
const BLADE_GEOM_STRAIN   = buildFieldGeometry("strain");

// ─── Component ────────────────────────────────────────────────────────────

export const Blade = memo(
  forwardRef<Group, BladeProps>(function Blade(
    { isSelected, statusColor, fieldMode = "off" },
    ref,
  ) {
    const setSelectedPart = useLandingStore((s) => s.setSelectedTurbinePart);
    // Blender blade (96-point DU/NACA-type sections, 72 stations, flatback root)
    const model = useV236Model();
    const baseGeom = model?.blade ?? BLADE_GEOM_BASE;

    const fieldGeom = useMemo(() => {
      if (fieldMode === "off") return null;
      if (model?.blade) return buildFieldGeometry(fieldMode, model.blade);
      switch (fieldMode) {
        case "thermal":  return BLADE_GEOM_THERMAL;
        case "pressure": return BLADE_GEOM_PRESSURE;
        default:         return BLADE_GEOM_STRAIN;
      }
    }, [fieldMode, model]);

    const renderField = !!fieldGeom;
    const baseColor = isSelected ? "#60a5fa" : metalPaintedShell.color;
    const baseEmissive = isSelected ? "#1d4ed8" : statusColor;
    const baseEmissiveIntensity = isSelected ? 0.3 : 0.03;

    return (
      <group ref={ref}>
        <mesh
          name="blades"
          castShadow={!renderField}
          onClick={(e) => { e.stopPropagation(); setSelectedPart("blades"); }}
          geometry={renderField ? fieldGeom : baseGeom}
        >
          {renderField ? (
            <meshBasicMaterial vertexColors toneMapped={false} onBeforeCompile={bladeMarkOnBeforeCompile} />
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
