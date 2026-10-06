/**
 * Procedural V236 blade loft (fallback while / if the Blender model is not
 * loaded) — see Blade.tsx for the frame and station conventions.
 */

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { BLADE_LENGTH_M as BLADE_LENGTH, STATIONS } from "./bladeConstants";

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
export const BLADE_GEOM_BASE = buildLoftedBladeGeometry();
