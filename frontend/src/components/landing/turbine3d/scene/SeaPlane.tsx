/**
 * Baltic Sea water surface — multi-octave Gerstner waves with foam + Fresnel.
 *
 * Implementation:
 *   - ShaderMaterial with 4 summed Gerstner waves (different directions, wavelengths, steepnesses).
 *   - Vertex shader displaces positions AND recomputes per-vertex normals analytically
 *     (no finite-difference approximation) → correct lighting.
 *   - Fragment shader blends deep-water colour (#041424) with crest colour (#3a5872),
 *     adds Fresnel rim brightness and foam near steep crests.
 *   - Sea state from landingStore: Hs sets amplitudes (Σa² = Hs²/8), Tp sets the
 *     peak wavelength (deep water λp = g·Tp²/2π ≈ 56 m at Tp 6 s), waves travel downwind.
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

import { selectSkyPreset, useLandingStore } from "../../../../store/landingStore";
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
  uniform float uHs;       // significant wave height [m]
  uniform float uLambdaP;  // peak wavelength [m], deep water: g·Tp²/2π
  uniform vec2 uDir;       // mean travel direction (downwind), plane-local xy

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vFoam;
  #include <fog_pars_vertex>

  // Four Gerstner components around the spectral peak: (angle off mean
  // direction [rad], wavelength / λp, amplitude weight). Σ a_i² = Hs²/8
  // (Hs = 4·σ_η). λ is floored at 22 m: the mesh spacing is 7.5 m, shorter
  // waves alias into noise (short chop is added as fragment normal detail).
  const vec3 C0 = vec3( 0.00, 1.00, 0.62);
  const vec3 C1 = vec3( 0.45, 0.72, 0.48);
  const vec3 C2 = vec3(-0.55, 0.48, 0.45);
  const vec3 C3 = vec3( 0.95, 0.30, 0.42);

  vec3 gerstner(vec2 xz, vec3 c, float aScale, inout vec3 nrm) {
    float ang = c.x;
    vec2 dir = vec2(uDir.x * cos(ang) - uDir.y * sin(ang), uDir.x * sin(ang) + uDir.y * cos(ang));
    float wavelen = max(uLambdaP * c.y, 34.0);
    float k = 6.2831853 / wavelen;
    float omega = sqrt(9.81 * k);                 // deep-water dispersion
    float a = aScale * c.z;
    float q = min(0.55 / (k * a * 4.0 + 1e-4), 1.0); // Gerstner steepness, no loops
    float f = k * dot(dir, xz) - omega * uTime;
    float cosF = cos(f);
    float sinF = sin(f);
    float wa = k * a;
    nrm.x -= dir.x * wa * cosF;
    nrm.z -= dir.y * wa * cosF;
    nrm.y -= q * wa * sinF;
    return vec3(q * a * dir.x * cosF, a * sinF, q * a * dir.y * cosF);
  }

  void main() {
    vec3 pos = position;
    // Plane is rotated -π/2 around X: local xy is horizontal, local z is up.
    vec2 xz = pos.xy;
    // Normalise weights so that Σ a_i² = Hs²/8
    float aScale = uHs / sqrt(8.0 * (C0.z*C0.z + C1.z*C1.z + C2.z*C2.z + C3.z*C3.z));

    vec3 n = vec3(0.0, 1.0, 0.0);   // (local x, up, local y)
    vec3 disp = vec3(0.0);
    disp += gerstner(xz, C0, aScale, n);
    disp += gerstner(xz, C1, aScale, n);
    disp += gerstner(xz, C2, aScale, n);
    disp += gerstner(xz, C3, aScale, n);

    pos.x += disp.x;
    pos.y += disp.z;
    pos.z += disp.y;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;
    // local y maps to world -z under the plane rotation
    vNormal = normalize(vec3(n.x, n.y, -n.z));

    // Foam near crests: elevation above ~0.35 Hs
    vFoam = smoothstep(0.25, 0.6, disp.y / max(uHs, 0.1));

    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
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
  #include <fog_pars_fragment>

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
    // Short wind-sea chop (~2–8 m) as normal detail only: geometry can't
    // resolve it; fades out with distance to avoid shimmering.
    vec2 p = vWorldPos.xz;
    float e = 0.6;
    vec2 q1 = p * 0.18 + uTime * vec2(0.20, 0.13);
    vec2 q2 = p * 0.47 - uTime * vec2(0.11, 0.27);
    float h0 = noise(q1) + 0.5 * noise(q2);
    float hx = noise(q1 + vec2(e * 0.18, 0.0)) + 0.5 * noise(q2 + vec2(e * 0.47, 0.0));
    float hz = noise(q1 + vec2(0.0, e * 0.18)) + 0.5 * noise(q2 + vec2(0.0, e * 0.47));
    float fade = 1.0 - smoothstep(150.0, 700.0, length(uCameraPos - vWorldPos));
    vec3 n = normalize(vNormal + vec3(h0 - hx, 0.0, h0 - hz) * 0.9 * fade);
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
    float foamPattern = noise(vWorldPos.xz * 0.9 + uTime * 0.15) * noise(vWorldPos.xz * 0.23 - uTime * 0.05) * 1.6;
    float foam = clamp(vFoam * 1.0 - 0.45, 0.0, 1.0) * smoothstep(0.45, 0.90, foamPattern);
    col = mix(col, vec3(0.82, 0.86, 0.92), foam * 0.3);

    gl_FragColor = vec4(col, 0.95);
    #include <fog_fragment>
  }
`;

export function SeaPlane() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const skyPreset = useLandingStore(selectSkyPreset);

  const geometry = useMemo(
    () => new THREE.PlaneGeometry(7000, 7000, 520, 520),
    [],
  );

  const material = useMemo(() => {
    const initial = SEA_COLORS_BY_PRESET.overcast;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime:          { value: 0 },
        uHs:            { value: 1.2 },
        uLambdaP:       { value: 56 },
        uDir:           { value: new THREE.Vector2(0.7, 0.7) },
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

    // Sea state from the environment: Hs, Tp → λp = g·Tp²/2π, and waves
    // travel downwind. Scene yaw convention puts bearing θ at world
    // (−sin θ, cos θ) in xz; downwind is the opposite, and the plane's
    // local y is world −z, so local travel direction = (sin θ, cos θ).
    const { environment: env, kpis } = useLandingStore.getState();
    const u = matRef.current.uniforms;
    u.uHs.value = Math.max(env.significantWaveHeightM, 0.1);
    u.uLambdaP.value = (9.81 * env.wavePeriodS ** 2) / (2 * Math.PI);
    const th = (kpis.windDirectionDeg * Math.PI) / 180;
    u.uDir.value.set(Math.sin(th), Math.cos(th));
  });

  return (
    <>
    {/* Far sea to the horizon: flat, fogged — the wave patch ends at 1.5 km */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]} renderOrder={-2}>
      <circleGeometry args={[14000, 96]} />
      <meshStandardMaterial color="#0d2c3d" roughness={0.35} metalness={0.1} />
    </mesh>
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      renderOrder={-1}
    >
      <primitive ref={matRef} object={material} attach="material" />
    </mesh>
    </>
  );
}
