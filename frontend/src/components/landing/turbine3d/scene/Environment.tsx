/**
 * Scene environment — sky, IBL reflections, fog, ambient lighting.
 *
 * Driven by two store fields:
 *   timeOfDay   — 0..24, sets sun altitude / azimuth in drei <Sky>
 *   skyPreset   — "overcast" | "golden" | "night"; switches IBL preset + fog + key-light colour
 *
 * Sky/IBL strategy:
 *   - SkyDome: gradient + sun + data-driven clouds (cloud cover %) → no HDRI file required
 *   - drei <Environment preset> provides IBL for PBR materials
 *   - If /hdri/baltic_{preset}_1k.hdr is added to public/ later, swap the Environment
 *     preset prop for `files` in one place (line marked HDRI-SWAP below).
 */

import { memo, Suspense, useMemo } from "react";
import { Environment as DreiEnvironment } from "@react-three/drei";

import { SceneErrorBoundary } from "../SceneErrorBoundary";
import { SkyDome, type SkyLook } from "./SkyDome";

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
    // Baltic day under broken cloud; fog = sky horizon colour.
    fogColor: "#9aa9b8",
    fogDensity: 0.00022,
    ambient: 0.3,
    hemiTop: "#9fb4c8",
    hemiBottom: "#1f3140",
    keyIntensity: 1.05,
    keyColor: "#fff1dc",
    rimIntensity: 0.25,
    iblIntensity: 0.5,
    iblPreset: "city",
  },
  golden: {
    fogColor: "#e6b88a",
    fogDensity: 0.00025,
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
    fogColor: "#1b2740",
    fogDensity: 0.0004,
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

/** Sky dome palette per preset; horizon = fog colour so sea meets sky. */
const SKY_LOOK: Record<SkyPreset, SkyLook> = {
  overcast: { zenith: "#4f6f93", horizon: "#9aa9b8", sun: "#fff4dc", cloudLit: "#e8ecef", cloudShade: "#7d8894", stars: 0 },
  golden: { zenith: "#35507e", horizon: "#e6b88a", sun: "#ffd29a", cloudLit: "#ffd6b0", cloudShade: "#8a6a74", stars: 0 },
  night: { zenith: "#050a18", horizon: "#1b2740", sun: "#9fb3ff", cloudLit: "#3a4660", cloudShade: "#141b2c", stars: 1 },
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

      <SkyDome sunDir={sunPos} look={SKY_LOOK[skyPreset]} />

      {/* HDRI-SWAP: when /public/hdri/baltic_{preset}_1k.hdr exists, change
          preset={params.iblPreset} → files={`/hdri/baltic_${skyPreset}_1k.hdr`} */}
      {/* The preset HDR is fetched from a CDN: offline (classroom, firewall)
          the scene keeps its analytic lights instead of failing as a whole. */}
      <SceneErrorBoundary area="ibl" optional>
        <Suspense fallback={null}>
          <DreiEnvironment
            preset={params.iblPreset}
            background={false}
            environmentIntensity={params.iblIntensity}
          />
        </Suspense>
      </SceneErrorBoundary>

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
