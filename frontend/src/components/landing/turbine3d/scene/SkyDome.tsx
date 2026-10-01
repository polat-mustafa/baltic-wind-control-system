/**
 * Sky dome — zenith/horizon gradient, sun disc + aureole, and drifting
 * fractal clouds whose coverage follows the environment's cloud cover
 * (simulated or Open-Meteo live, in %), moving with the wind.
 *
 * One inverted sphere with a small fragment shader: no textures, no CDN.
 * The horizon colour matches the scene fog so the sea fades into the sky.
 */

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { useLandingStore } from "../../../../store/landingStore";

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uCloudLit;
  uniform vec3 uCloudShade;
  uniform float uCover;     // 0..1
  uniform vec2 uDrift;      // cloud offset (m / cloud scale)
  uniform float uStars;     // 0..1
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float a = 0.5, s = 0.0;
    for (int k = 0; k < 5; k++) { s += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }

  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.5));

    // Sun: disc + Mie-like aureole
    float s = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(s, 900.0) * 6.0 + pow(s, 14.0) * 0.28);

    // Stars at night
    if (uStars > 0.0 && dir.y > 0.0) {
      vec2 g = floor(dir.xz / (dir.y + 0.3) * 260.0);
      float st = step(0.9975, hash(g));
      col += vec3(st * uStars * smoothstep(0.0, 0.3, dir.y));
    }

    // Clouds on a flat layer: project the ray onto a plane above the camera
    if (dir.y > 0.0) {
      vec2 uv = dir.xz / (dir.y + 0.06) * 0.9 + uDrift;
      float n = fbm(uv);
      float c = smoothstep(1.0 - uCover - 0.12, 1.0 - uCover + 0.28, n);
      float light = clamp(fbm(uv + normalize(uSunDir).xz * 0.15) - n + 0.6, 0.0, 1.0);
      vec3 cloud = mix(uCloudShade, uCloudLit, light);
      c *= smoothstep(0.0, 0.12, dir.y);
      col = mix(col, cloud, c * 0.95);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface SkyLook {
  zenith: string;
  horizon: string;
  sun: string;
  cloudLit: string;
  cloudShade: string;
  stars: number;
}

export function SkyDome({ sunDir, look }: { sunDir: [number, number, number]; look: SkyLook }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3() },
          uSunColor: { value: new THREE.Color() },
          uCloudLit: { value: new THREE.Color() },
          uCloudShade: { value: new THREE.Color() },
          uCover: { value: 0.4 },
          uDrift: { value: new THREE.Vector2() },
          uStars: { value: 0 },
        },
      }),
    [],
  );

  const u = material.uniforms;
  u.uZenith.value.set(look.zenith);
  u.uHorizon.value.set(look.horizon);
  u.uSunColor.value.set(look.sun);
  u.uCloudLit.value.set(look.cloudLit);
  u.uCloudShade.value.set(look.cloudShade);
  u.uStars.value = look.stars;
  u.uSunDir.value.set(...sunDir).normalize();

  useFrame((_, dt) => {
    const { environment, kpis } = useLandingStore.getState();
    u.uCover.value += (environment.cloudCoverPct / 100 - u.uCover.value) * Math.min(1, dt);
    // Clouds drift downwind; wind-from bearing θ is world (−sin θ, cos θ) in
    // xz, so they move along (sin θ, −cos θ). Stylised speed.
    const th = (kpis.windDirectionDeg * Math.PI) / 180;
    const v = kpis.averageWindSpeedMs * 0.0012 * dt;
    u.uDrift.value.x -= Math.sin(th) * v;
    u.uDrift.value.y += Math.cos(th) * v;
  });

  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[4200, 32, 16]} />
    </mesh>
  );
}
