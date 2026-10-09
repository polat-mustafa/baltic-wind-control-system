/**
 * Detailed V236 geometry authored in Blender (scripts/blender/build_v236.py →
 * public/models/v236.glb). Every mesh is exported in the frame its React
 * component uses, so a component just swaps its procedural geometry for
 * `model.<name>` once the file has loaded — and keeps the procedural one as
 * the fallback while loading or if the file is missing.
 *
 * Parts exported with their own origin (node position): `nodePos(name)`
 * returns it so the viewer can spin them about their own axes.
 */

import { useEffect, useState } from "react";
import type { BufferGeometry, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { faceOutward } from "./faceOutward";

/** Lofted blade shells that must face outward (see faceOutward). */
const BLADE_SHELLS = new Set(["blade", "blade_marks"]);

export type V236Model = Record<string, BufferGeometry>;

/** Bump when public/models/v236.glb is rebuilt so browsers never mix an old
 *  cached model with new code (rev 5: direct drive, no gearbox). */
export const MODEL_REV = 6; // 6: jacket foundation, nacelle front square to the 6° shaft, preconed root collars
const URL = `${import.meta.env.BASE_URL}models/v236.glb?rev=${MODEL_REV}`;
let cache: Promise<V236Model | null> | null = null;
const positions: Record<string, [number, number, number]> = {};

function load(): Promise<V236Model | null> {
  cache ??= new GLTFLoader()
    .loadAsync(URL)
    .then((gltf) => {
      const out: V236Model = {};
      gltf.scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        if (BLADE_SHELLS.has(m.name)) faceOutward(m.geometry);
        out[m.name] = m.geometry;
        positions[m.name] = [m.position.x, m.position.y, m.position.z];
      });
      return out;
    })
    .catch(() => null); // procedural fallback
  return cache;
}

/** Node origin of a mesh in its export frame (zero for most parts). */
export function nodePos(name: string): [number, number, number] {
  return positions[name] ?? [0, 0, 0];
}

export function useV236Model(): V236Model | null {
  const [model, setModel] = useState<V236Model | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((m) => alive && setModel(m));
    return () => {
      alive = false;
    };
  }, []);
  return model;
}
