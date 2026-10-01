/**
 * Illustrated render style (demo) — swaps PBR materials for 3-band toon
 * shading and adds inked feature edges, matching the storybook map theme.
 *
 * Fully reversible: originals are kept in userData and restored on disable.
 * Parts that mount later (cutaway, overlays) are picked up by a 1 s sweep.
 * Custom ShaderMaterials (sea, overlays) are left untouched.
 */

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const INK = new THREE.LineBasicMaterial({ color: "#2b2118" });
const EDGE_ANGLE_DEG = 28;
// ponytail: skip ink on dense meshes (edge extraction is O(tris)); per-LOD edges if needed
const MAX_INK_VERTS = 20_000;

/**
 * Silhouette ink: inverted hull (back faces pushed out along the normal by a
 * distance-proportional amount, so the line stays ~1.5 px wide at any zoom).
 */
function hullMaterial(clip: THREE.Plane[] | null): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: "#2b2118", side: THREE.BackSide, clippingPlanes: clip });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      "#include <begin_vertex>",
      "float inkD = -(modelViewMatrix * vec4(position, 1.0)).z;\n" +
        "vec3 transformed = position + normalize(normal) * inkD * 0.0022;",
    );
  };
  return m;
}

const GRADIENT = (() => {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

type Pbr = THREE.MeshStandardMaterial;
const isPbr = (m: THREE.Material): m is Pbr => (m as Pbr).isMeshStandardMaterial === true;

function toToon(m: Pbr): THREE.MeshToonMaterial {
  const toon = new THREE.MeshToonMaterial({
    color: m.color.clone().offsetHSL(0, -0.05, 0.04),
    map: m.map,
    gradientMap: GRADIENT,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
    depthWrite: m.depthWrite,
    clippingPlanes: m.clippingPlanes,
  });
  toon.userData.isToon = true;
  return toon;
}

function apply(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.pbr) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.every(isPbr)) return;
    mesh.userData.pbr = mesh.material;
    mesh.material = Array.isArray(mesh.material) ? mats.map((m) => toToon(m as Pbr)) : toToon(mats[0] as Pbr);
    if (mats[0].transparent || !mesh.geometry.getAttribute("normal")) return;
    const hull = new THREE.Mesh(mesh.geometry, hullMaterial(mats[0].clippingPlanes));
    hull.userData.isInk = true;
    hull.raycast = () => {};
    mesh.add(hull);
    const pos = mesh.geometry.getAttribute("position");
    if (pos && pos.count <= MAX_INK_VERTS) {
      const ink = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, EDGE_ANGLE_DEG), INK);
      ink.userData.isInk = true;
      ink.raycast = () => {};
      mesh.add(ink);
    }
  });
}

function restore(root: THREE.Object3D) {
  const inks: (THREE.LineSegments | THREE.Mesh)[] = [];
  root.traverse((o) => {
    if (o.userData.isInk) inks.push(o as THREE.Mesh);
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.userData.pbr) return;
    const toon = mesh.material;
    (Array.isArray(toon) ? toon : [toon]).forEach((m) => m.dispose());
    mesh.material = mesh.userData.pbr;
    delete mesh.userData.pbr;
  });
  inks.forEach((l) => {
    l.removeFromParent();
    // hulls share the parent geometry; only the edge lines own theirs
    if (l instanceof THREE.LineSegments) l.geometry.dispose();
    else (l.material as THREE.Material).dispose();
  });
}

export function IllustratedStyle({ enabled }: { enabled: boolean }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!enabled) return;
    apply(scene);
    const id = setInterval(() => apply(scene), 1000);
    return () => {
      clearInterval(id);
      restore(scene);
    };
  }, [enabled, scene]);
  return null;
}
