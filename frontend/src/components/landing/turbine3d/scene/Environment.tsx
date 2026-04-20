/**
 * Scene environment — sky, IBL reflections, fog, ambient lighting.
 *
 * Driven by two store fields:
 *   timeOfDay   — 0..24, sets sun altitude / azimuth in drei <Sky>
 *   skyPreset   — "overcast" | "golden" | "night"; switches IBL preset + fog + key-light colour
 *
 * Sky/IBL strategy:
 *   - drei <Sky> does atmospheric scattering (Hosek-Wilkie) → no HDRI file required
 *   - drei <Environment preset> provides IBL for PBR materials
 *   - If /hdri/baltic_{preset}_1k.hdr is added to public/ later, swap the Environment
 *     preset prop for `files` in one place (line marked HDRI-SWAP below).
 */

import { memo, useMemo } from "react";
import { Sky, Environment as DreiEnvironment } from "@react-three/drei";

export type SkyPreset = "overcast" | "golden" | "night";

interface EnvironmentProps {
  timeOfDay: number;
  skyPreset: SkyPreset;
}

/**
 * Sun direction from 0..24 h. Baltic latitude (~55° N) — sun arcs low, east → south → west.
 * Returns a unit-ish vector × 100 m (drei Sky uses position, not direction, to place the disc).
 */
function sunVector(hour: number): [number, number, number] {
  const hourAngle = ((hour - 12) / 12) * Math.PI;
  const altitude = Math.sin(((hour - 6) / 12) * Math.PI) * (Math.PI * 0.42);
  const cosAlt = Math.cos(altitude);
  return [
    Math.sin(hourAngle) * cosAlt * 100,
    Math.sin(altitude) * 100,
    -Math.cos(hourAngle) * cosAlt * 100,
  ];
}

const SKY_PARAMS: Record<SkyPreset, {
  rayleigh: number;
  turbidity: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  fogColor: string;
  fogDensity: number;
  ambient: number;
  hemiTop: string;
  hemiBottom: string;
  keyIntensity: number;
  keyColor: string;
  rimIntensity: number;
  iblIntensity: number;
  iblPreset: "dawn" | "sunset" | "night" | "city" | "park";
}> = {
  overcast: {
    rayleigh: 4,
    turbidity: 14,
    mieCoefficient: 0.01,
    mieDirectionalG: 0.85,
    fogColor: "#7d8ea0",
    fogDensity: 0.0008,
    ambient: 0.45,
    hemiTop: "#c6d1dc",
    hemiBottom: "#2a4357",
    keyIntensity: 0.9,
    keyColor: "#ffffff",
    rimIntensity: 0.35,
    iblIntensity: 0.6,
    iblPreset: "city",
  },
  golden: {
    rayleigh: 2,
    turbidity: 5,
    mieCoefficient: 0.006,
    mieDirectionalG: 0.78,
    fogColor: "#c99868",
    fogDensity: 0.0006,
    ambient: 0.40,
    hemiTop: "#ffd7a8",
    hemiBottom: "#5a3020",
    keyIntensity: 1.1,
    keyColor: "#ffd9ab",
    rimIntensity: 0.4,
    iblIntensity: 0.7,
    iblPreset: "sunset",
  },
  night: {
    rayleigh: 0.3,
    turbidity: 2,
    mieCoefficient: 0.003,
    mieDirectionalG: 0.65,
    fogColor: "#1a2540",
    fogDensity: 0.0012,
    ambient: 0.30,
    hemiTop: "#1a2844",
    hemiBottom: "#050810",
    keyIntensity: 0.30,
    keyColor: "#a8b8e0",
    rimIntensity: 0.2,
    iblIntensity: 0.45,
    iblPreset: "night",
  },
};

export const SceneEnvironment = memo(function SceneEnvironment({
  timeOfDay,
  skyPreset,
}: EnvironmentProps) {
  const params = SKY_PARAMS[skyPreset];
  const sunPos = useMemo(() => sunVector(timeOfDay), [timeOfDay]);
  const rimPos = useMemo<[number, number, number]>(
    () => [-sunPos[0] * 0.8, sunPos[1] * 0.4 + 30, -sunPos[2] * 0.8],
    [sunPos],
  );

  return (
    <>
      {/* Explicit clear colour — guarantees no WebGL-default black/white shows
          through if Sky or fog clips at the frustum edge (rear-view flicker fix). */}
      <color attach="background" args={[params.fogColor]} />

      <Sky
        distance={4500}
        sunPosition={sunPos}
        rayleigh={params.rayleigh}
        turbidity={params.turbidity}
        mieCoefficient={params.mieCoefficient}
        mieDirectionalG={params.mieDirectionalG}
      />

      {/* HDRI-SWAP: when /public/hdri/baltic_{preset}_1k.hdr exists, change
          preset={params.iblPreset} → files={`/hdri/baltic_${skyPreset}_1k.hdr`} */}
      <DreiEnvironment
        preset={params.iblPreset}
        background={false}
        environmentIntensity={params.iblIntensity}
      />

      <fogExp2 attach="fog" args={[params.fogColor, params.fogDensity]} />

      <ambientLight intensity={params.ambient} />

      <hemisphereLight args={[params.hemiTop, params.hemiBottom, 0.6]} />

      <directionalLight
        position={sunPos}
        intensity={params.keyIntensity}
        color={params.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={320}
        shadow-camera-bottom={-60}
        shadow-camera-near={10}
        shadow-camera-far={900}
      />

      <directionalLight
        position={rimPos}
        intensity={params.rimIntensity}
        color="#b0c8ff"
      />
    </>
  );
});

export const SKY_PRESETS: SkyPreset[] = ["overcast", "golden", "night"];
