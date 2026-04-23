/**
 * Baltic Sea water surface — multi-octave Gerstner waves with foam + Fresnel.
 *
 * Implementation:
 *   - ShaderMaterial with 4 summed Gerstner waves (different directions, wavelengths, steepnesses).
 *   - Vertex shader displaces positions AND recomputes per-vertex normals analytically
 *     (no finite-difference approximation) → correct lighting.
 *   - Fragment shader blends deep-water colour (#041424) with crest colour (#3a5872),
 *     adds Fresnel rim brightness and foam near steep crests.
 *   - Wave amplitude scales with `windSpeed` uniform (live from landingStore).
 *
 * Performance:
 *   - Plane is 300×300 segments on a 600×600 m patch (~90k verts). With analytic normals
 *     there is no CPU per-frame work; everything is GPU-side. Cheaper than the prior
 *     CPU-vertex-mutation sine approach despite 5× more vertices.
 *   - If perf monitor drops dpr, we keep geometry — the cost is fill, not vertex.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { selectEnvironment, selectSkyPreset, useLandingStore } from "../../../../store/landingStore";
import type { SkyPreset } from "./Environment";

// Sea palette per sky preset — keeps water in visual harmony with the sky.
const SEA_COLORS_BY_PRESET: Record<SkyPreset, { deep: string; shallow: string; crest: string }> = {
  // Deeper, less luminous palette so the water reads as Baltic-dark instead
  // of a foamy near-white expanse that dominates the frame.
  overcast: { deep: "#02101c", shallow: "#0a2634", crest: "#3a6578" },
  golden:   { deep: "#1a1408", shallow: "#3a2614", crest: "#d4a574" },
  night:    { deep: "#02060f", shallow: "#0a1428", crest: "#2a3a5a" },
};

const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uWindSpeed;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vFoam;

  // Four Gerstner waves. Each is (directionX, directionY, wavelength, steepness, speed).
  // Directions sum to a mix of perpendicular chop, giving irregular sea.
  const vec4 W0 = vec4( 0.85,  0.52, 18.0, 0.45);   // long swell from NE
  const vec4 W1 = vec4(-0.62,  0.78, 10.0, 0.40);   // cross chop
  const vec4 W2 = vec4( 0.30, -0.95,  5.0, 0.35);   // short wind-wave
  const vec4 W3 = vec4(-0.95, -0.30,  2.8, 0.32);   // ripple

  vec3 gerstner(vec2 xz, vec4 wave, float amp, float t, inout vec3 nrm) {
    vec2 dir = normalize(wave.xy);
    float wavelen = wave.z;
    float steep = wave.w;
    float speed = sqrt(9.81 * (6.2831853 / wavelen)); // deep-water dispersion
    float k = 6.2831853 / wavelen;
    float a = amp * steep / k;
    float f = k * dot(dir, xz) - speed * t;
    float cosF = cos(f);
    float sinF = sin(f);

    vec3 disp = vec3(dir.x * a * cosF, a * sinF, dir.y * a * cosF);

    // Analytic derivative — accumulate into normal
    nrm.x -= dir.x * k * a * cosF;
    nrm.z -= dir.y * k * a * cosF;
    nrm.y -= steep * sinF;
    return disp;
  }

  void main() {
    vec3 pos = position;
    // Plane is rotated -π/2 around X so local Z becomes world Y (up).
    // Before rotation, XY are horizontal. We do wave math in horizontal xz plane.
    vec2 xz = pos.xy;

    // Wave amplitude scales with wind: 0.3 m at 5 m/s → 2.0 m at 20 m/s.
    float amp = clamp(uWindSpeed * 0.1, 0.3, 2.0);

    vec3 n = vec3(0.0, 1.0, 0.0);
    vec3 disp = vec3(0.0);
    disp += gerstner(xz, W0, amp,       uTime, n);
    disp += gerstner(xz, W1, amp * 0.7, uTime, n);
    disp += gerstner(xz, W2, amp * 0.5, uTime, n);
    disp += gerstner(xz, W3, amp * 0.3, uTime, n);

    // Apply displacement. Local Z is vertical in plane-local space, X/Y are horizontal.
    pos.x += disp.x;
    pos.y += disp.z;        // horizontal shift along the other axis
    pos.z += disp.y;        // local Z ← vertical displacement

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;

    // Rotate analytic normal back to world (the mesh is rotated -π/2 around X).
    vNormal = normalize(vec3(n.x, n.y, n.z));
    vNormal = (modelMatrix * vec4(vNormal, 0.0)).xyz;

    // Foam factor — strong when horizontal displacement is high (wave crest)
    vFoam = smoothstep(0.35, 0.80, length(disp.xz) / max(amp, 0.1));

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uCrestColor;
  uniform vec3 uSunDirection;
  uniform vec3 uCameraPos;
  uniform float uTime;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vFoam;

  // Cheap 2D hash for foam texture noise
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    vec3 lightDir = normalize(uSunDirection);

    // Base colour gradient: deep where facing up, shallow/crest where facing camera
    float upFacing = clamp(dot(n, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
    vec3 base = mix(uShallowColor, uDeepColor, upFacing * 0.6);

    // Diffuse
    float diff = clamp(dot(n, lightDir), 0.0, 1.0);
    vec3 col = base * (0.35 + 0.65 * diff);

    // Specular sun glitter — Blinn-Phong, very tight
    vec3 h = normalize(lightDir + viewDir);
    float spec = pow(clamp(dot(n, h), 0.0, 1.0), 180.0);
    col += spec * 0.7 * vec3(1.0, 0.95, 0.85);

    // Fresnel rim — ocean gets lighter at grazing angles
    float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);
    col = mix(col, uCrestColor * 1.1, fres * 0.28);

    // Foam at wave crests — animated noise. Kept subtle so the whole surface
    // does not glow white under strong wind.
    float foamPattern = noise(vWorldPos.xz * 0.4 + uTime * 0.15);
    float foam = clamp(vFoam * 1.0 - 0.45, 0.0, 1.0) * smoothstep(0.45, 0.90, foamPattern);
    col = mix(col, vec3(0.82, 0.86, 0.92), foam * 0.7);

    gl_FragColor = vec4(col, 0.95);
  }
`;

export function SeaPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const skyPreset = useLandingStore(selectSkyPreset);

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(900, 900, 220, 220),
    [],
  );

  const material = useMemo(() => {
    const initial = SEA_COLORS_BY_PRESET.overcast;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime:          { value: 0 },
        uWindSpeed:     { value: 11 },
        uDeepColor:     { value: new THREE.Color(initial.deep) },
        uShallowColor:  { value: new THREE.Color(initial.shallow) },
        uCrestColor:    { value: new THREE.Color(initial.crest) },
        uSunDirection:  { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uCameraPos:     { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: true,
    });
  }, []);

  // Re-tint sea uniforms whenever sky preset changes — done outside useFrame.
  useEffect(() => {
    const palette = SEA_COLORS_BY_PRESET[skyPreset];
    if (!palette) return;
    material.uniforms.uDeepColor.value.set(palette.deep);
    material.uniforms.uShallowColor.value.set(palette.shallow);
    material.uniforms.uCrestColor.value.set(palette.crest);
  }, [skyPreset, material]);

  useFrame(({ clock, camera }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    matRef.current.uniforms.uCameraPos.value.copy(camera.position);

    // Pull wind speed from env for responsive wave amplitude
    const env = useLandingStore.getState().environment;
    matRef.current.uniforms.uWindSpeed.value =
      (env.significantWaveHeightM * 8.0) || 11.0; // derive from Hs
  });

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      renderOrder={-1}
    >
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
  );
}

// Keep selector import to avoid tree-shaker warning when feature toggled later.
export const _seaSelectorRef = selectEnvironment;
