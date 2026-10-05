/**
 * Blade material patch (onBeforeCompile), shared by all three blades:
 *
 *  1. Flapwise deflection under thrust — every vertex moves by
 *     uDefl · w(ξ), ξ = span / L, with the uniformly-loaded cantilever shape
 *     w(ξ) = ξ²(6 − 4ξ + ξ²)/3 (w(1) = 1). uDefl is the tip displacement
 *     vector in the blade frame, set each frame by the rotor from thrust.
 *  2. Leading-edge erosion — rain erosion wears the outer-span leading edge
 *     (tip speed ~100 m/s); drawn as a darker, speckled strip around the LE
 *     (uv.x ≈ 0.5) from ~55 % span outward.
 *
 *  3. Field overlay (Blade Analysis) — the vertex-colour field also feeds the
 *     emissive term, so the colour scale stays readable on the shadowed side
 *     while the lit side still shows the blade's shape.
 *
 * Requires the loft UVs: u around the section (LE at 0.5), v = span / L.
 */

import * as THREE from "three";

import { BLADE_LENGTH_M } from "./bladeConstants";

export const bladeDeflection = { value: new THREE.Vector3() };

export function patchBlade(shader: THREE.WebGLProgramParametersWithUniforms, erosion: boolean) {
  shader.uniforms.uDefl = bladeDeflection;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform vec3 uDefl;
       varying vec2 vBladeUv;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float xi = clamp(position.y / ${BLADE_LENGTH_M.toFixed(1)}, 0.0, 1.0);
       transformed += uDefl * (xi * xi * (6.0 - 4.0 * xi + xi * xi) / 3.0);
       vBladeUv = uv;`,
    );
  if (!erosion) return;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
       varying vec2 vBladeUv;`,
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       float le = 1.0 - smoothstep(0.004, 0.03, abs(vBladeUv.x - 0.5));
       float spanW = smoothstep(0.55, 0.92, vBladeUv.y);
       float speck = fract(sin(dot(floor(vBladeUv * vec2(1400.0, 520.0)), vec2(12.9898, 78.233))) * 43758.5453);
       float wear = le * spanW * (0.45 + 0.55 * speck);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.46, 0.44, 0.40), clamp(wear, 0.0, 0.8));`,
    );
}

export const bladeFieldOnBeforeCompile = (s: THREE.WebGLProgramParametersWithUniforms) => {
  patchBlade(s, false);
  s.fragmentShader = s.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
     totalEmissiveRadiance += diffuseColor.rgb * 0.35;`,
  );
};
export const bladeOnBeforeCompile = (s: THREE.WebGLProgramParametersWithUniforms) => patchBlade(s, true);
export const bladeMarkOnBeforeCompile = (s: THREE.WebGLProgramParametersWithUniforms) => patchBlade(s, false);
