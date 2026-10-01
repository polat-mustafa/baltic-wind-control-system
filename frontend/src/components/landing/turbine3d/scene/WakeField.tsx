/**
 * Hub-height wake slice — the farm's velocity-deficit field on a horizontal
 * plane at 150 m, like a CFD/LES contour cut. Every running turbine
 * contributes a Bastankhah wake (Ct from its own simulated wind), combined by
 * Katic superposition (model/wakeModel). Colour: transparent where the flow
 * is free, yellow → orange → red with increasing deficit, with iso-lines every
 * 5 % so the wakes read like an engineering plot. Recomputed only when the
 * simulation ticks (turbine states / wind direction), spread over a few
 * frames — the full 27 000-cell × 34-rotor pass in one frame was a ~100 ms
 * hitch every second.
 *
 * Extent: ±3 km across and ±3.6 km along the wind around the viewed turbine
 * — the first two rings of neighbours (6 D / 8 D spacing).
 */

import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

import { useLandingStore } from "../../../../store/landingStore";
import { farmAround } from "../model/farm";
import { HUB } from "../model/layout";
import { farmDeficit, wakeSources, type WakeSource } from "../model/wakeModel";

const W = 6000;
const H = 7200;
const NX = 150;
const NZ = 180;
const D_MAX = 0.6; // deficit mapped to texel 255
const ROWS_PER_FRAME = 20; // 180 rows → one refresh spread over 9 frames

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uDef;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    float d = texture2D(uDef, vUv).r * ${D_MAX.toFixed(2)};
    if (d < 0.012) discard;
    vec3 c = mix(vec3(0.99, 0.88, 0.45), vec3(0.97, 0.52, 0.12), smoothstep(0.02, 0.2, d));
    c = mix(c, vec3(0.78, 0.14, 0.12), smoothstep(0.2, 0.45, d));
    // iso-lines every 5 % deficit
    float k = d * 20.0;
    float line = 1.0 - smoothstep(0.0, fwidth(k) * 1.4, abs(fract(k + 0.5) - 0.5));
    // fade at the slice border
    vec2 e = min(vUv, 1.0 - vUv);
    float edge = smoothstep(0.0, 0.06, min(e.x, e.y));
    // the slice cuts through the viewer's eye height: fade it close to the
    // camera so it reads as a map below/around, not a sheet over the lens
    float near = smoothstep(120.0, 600.0, distance(vWorld, cameraPosition));
    // seen edge-on (camera near hub height) the slice collapses into a
    // coloured line across the horizon — fade it by the viewing angle
    float grazing = smoothstep(0.06, 0.22, abs(normalize(vWorld - cameraPosition).y));
    // translucent fill + crisp iso-lines, like a CFD contour cut: the sea
    // and the turbines stay readable through it
    float a = (0.26 * smoothstep(0.012, 0.35, d) + line * 0.55 * smoothstep(0.02, 0.06, d)) * edge * near * grazing * uOpacity;
    gl_FragColor = vec4(mix(c, vec3(0.55, 0.12, 0.04), line * 0.5), a);
  }
`;

export const WakeField = memo(function WakeField({
  turbineId,
  windFromDeg,
}: {
  turbineId: string;
  windFromDeg: number;
}) {
  const farm = useMemo(() => farmAround(turbineId), [turbineId]);
  const dataRef = useRef(new Uint8Array(NX * NZ));
  const data = dataRef.current;
  const texture = useMemo(() => {
    const t = new THREE.DataTexture(data, NX, NZ, THREE.RedFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [data]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { uDef: { value: texture }, uOpacity: { value: 1 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [texture],
  );
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, H, 1, 1);
    g.rotateX(-Math.PI / 2); // v grows toward −z (downwind)
    return g;
  }, []);
  useEffect(() => () => {
    texture.dispose();
    material.dispose();
    geometry.dispose();
  }, [texture, material, geometry]);

  // Progressive recompute: a new pass starts when the simulation ticked
  // (new turbine map) or the wind turned, and fills ROWS_PER_FRAME rows per
  // frame; the GPU keeps showing the previous field until the pass uploads.
  const job = useRef<{ row: number; map: unknown; dir: number; sources: WakeSource[] }>({
    row: NZ,
    map: null,
    dir: Number.NaN,
    sources: [],
  });
  useFrame(() => {
    const j = job.current;
    if (j.row >= NZ) {
      const map = useLandingStore.getState().turbineMap;
      if (map === j.map && windFromDeg === j.dir) return;
      j.map = map;
      j.dir = windFromDeg;
      j.sources = wakeSources(farm, map, windFromDeg);
      j.row = 0;
    }
    const end = Math.min(NZ, j.row + ROWS_PER_FRAME);
    for (let r = j.row; r < end; r++) {
      const z = HUB[2] - ((r + 0.5) / NZ - 0.5) * H;
      for (let i = 0; i < NX; i++) {
        const x = ((i + 0.5) / NX - 0.5) * W;
        const d = farmDeficit(j.sources, x, z);
        dataRef.current[r * NX + i] = Math.min(255, Math.round((d / D_MAX) * 255));
      }
    }
    j.row = end;
    if (end === NZ) {
      // eslint-disable-next-line react-compiler/react-compiler -- three.js texture upload flag
      texture.needsUpdate = true;
    }
  });

  return (
    <group rotation={[0, -(windFromDeg * Math.PI) / 180, 0]}>
      <mesh geometry={geometry} material={material} position={[0, HUB[1], HUB[2]]} renderOrder={2} />
    </group>
  );
});
