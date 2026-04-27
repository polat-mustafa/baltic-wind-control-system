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
 *   Leading edge = -X, trailing edge = +X.
 *   Suction (upper) side = +Z, pressure (lower) side = -Z.
 *   Prebend translates the blade along +Z (toward incoming wind, away from tower).
 *   Sweep translates along +X (toward trailing edge — "aft sweep").
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

type FieldMode = "off" | "thermal" | "pressure" | "strain";

interface BladeProps {
  isSelected: boolean;
  statusColor: string;
  fieldMode?: FieldMode;
}

const BLADE_LENGTH = 115.5;
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

interface Station {
  span: number;       // metres along blade axis (0 = root flange, 115.5 = tip)
  chord: number;      // metres
  twistDeg: number;   // nose-down rotation about span axis
  prebend: number;    // forward (+Z) offset
  sweep: number;      // aft (+X) offset
  airfoil: AirfoilFamilyName;
}

const STATIONS: Station[] = [
  { span:   0.0, chord: 5.4, twistDeg: 13.0, prebend: 0.00, sweep: 0.00, airfoil: "cylinder"   },
  { span:   3.5, chord: 5.6, twistDeg: 13.0, prebend: 0.02, sweep: 0.00, airfoil: "cylinder"   },
  { span:  10.0, chord: 6.2, twistDeg: 16.5, prebend: 0.10, sweep: 0.00, airfoil: "transition" },
  { span:  20.0, chord: 6.4, twistDeg: 22.0, prebend: 0.30, sweep: 0.00, airfoil: "du-thick"   },
  { span:  35.0, chord: 5.7, twistDeg: 17.0, prebend: 0.65, sweep: 0.00, airfoil: "du-thick"   },
  { span:  50.0, chord: 4.7, twistDeg: 11.0, prebend: 1.10, sweep: 0.05, airfoil: "du-mid"     },
  { span:  65.0, chord: 3.8, twistDeg:  7.0, prebend: 1.75, sweep: 0.12, airfoil: "du-mid"     },
  { span:  80.0, chord: 3.0, twistDeg:  4.5, prebend: 2.55, sweep: 0.30, airfoil: "du-thin"    },
  { span:  92.0, chord: 2.3, twistDeg:  3.0, prebend: 3.40, sweep: 0.55, airfoil: "du-thin"    },
  { span: 102.0, chord: 1.7, twistDeg:  2.2, prebend: 4.20, sweep: 0.85, airfoil: "naca64"     },
  { span: 110.0, chord: 1.1, twistDeg:  1.5, prebend: 4.75, sweep: 1.10, airfoil: "naca64"     },
  { span: 115.5, chord: 0.4, twistDeg:  1.0, prebend: 5.00, sweep: 1.20, airfoil: "naca64"     },
];

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
      positions[idx * 3]     = xT + st.sweep;
      positions[idx * 3 + 1] = st.span;
      positions[idx * 3 + 2] = zT + st.prebend;
      uvs[idx * 2]     = i / (N_AIRFOIL - 1);
      uvs[idx * 2 + 1] = v;
    }
  }

  // Cap centres (root + tip), placed on each section's centroid.
  const rootCapIdx = ringCount * N_AIRFOIL;
  const tipCapIdx = rootCapIdx + 1;
  positions[rootCapIdx * 3]     = STATIONS[0].sweep;
  positions[rootCapIdx * 3 + 1] = STATIONS[0].span;
  positions[rootCapIdx * 3 + 2] = STATIONS[0].prebend;
  uvs[rootCapIdx * 2]     = 0.5;
  uvs[rootCapIdx * 2 + 1] = 0;

  positions[tipCapIdx * 3]     = STATIONS[ringCount - 1].sweep;
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

function buildFieldGeometry(mode: Exclude<FieldMode, "off">): THREE.BufferGeometry {
  const geom = BLADE_GEOM_BASE.clone();
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

    const fieldGeom = useMemo(() => {
      switch (fieldMode) {
        case "thermal":  return BLADE_GEOM_THERMAL;
        case "pressure": return BLADE_GEOM_PRESSURE;
        case "strain":   return BLADE_GEOM_STRAIN;
        default:         return null;
      }
    }, [fieldMode]);

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
          geometry={renderField ? fieldGeom : BLADE_GEOM_BASE}
        >
          {renderField ? (
            <meshBasicMaterial vertexColors toneMapped={false} />
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
            />
          )}
        </mesh>
      </group>
    );
  }),
);
