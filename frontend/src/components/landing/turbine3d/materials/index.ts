/**
 * Reusable PBR material presets for turbine components.
 *
 * All presets are plain JSX prop objects you can spread onto
 * <meshPhysicalMaterial {...presets.metalPainted.primary}>.
 *
 * Why MeshPhysicalMaterial over MeshStandardMaterial?
 *   - Clearcoat for painted metal finish (automotive paint model)
 *   - Sheen for fabric-like rim highlights
 *   - IOR + transmission for glass
 *   - Anisotropy for brushed metal
 *
 * No PBR textures are shipped yet — presets are defined by scalar/colour uniforms.
 * When /public/textures/{name}/ is populated with normal/roughness/AO maps, extend the
 * preset and use the `withTexturedMap` helper below.
 */

import * as THREE from "three";

export interface PbrPreset {
  color: string;
  roughness: number;
  metalness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: string;
  sheenRoughness?: number;
  ior?: number;
  transmission?: number;
  thickness?: number;
  iridescence?: number;
  reflectivity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  anisotropy?: number;
  anisotropyRotation?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  attenuationColor?: string;
  attenuationDistance?: number;
}

/**
 * Rotor blade / nacelle shell paint — RAL 9010 warm white.
 * Clearcoat emulates automotive paint finish used on modern wind turbines.
 */
export const metalPaintedShell: PbrPreset = {
  color: "#f2f0e9",
  roughness: 0.38,
  metalness: 0.15,
  clearcoat: 0.85,
  clearcoatRoughness: 0.18,
  reflectivity: 0.55,
  envMapIntensity: 1.0,
};

/**
 * Nacelle cowling — slightly darker paint used for detail strips.
 */
export const metalPaintedDetail: PbrPreset = {
  color: "#c6c3b8",
  roughness: 0.42,
  metalness: 0.2,
  clearcoat: 0.75,
  clearcoatRoughness: 0.22,
  envMapIntensity: 1.0,
};

/**
 * Raw-cast iron / steel — gearbox housing, bedplate, bearing blocks.
 * High roughness, slight warm tone.
 */
export const metalRaw: PbrPreset = {
  color: "#4e525a",
  roughness: 0.72,
  metalness: 0.85,
  envMapIntensity: 0.8,
};

/**
 * Polished steel — main shaft, coupling, precision bearings.
 * Low roughness, high metalness → mirror-like reflections.
 */
export const metalPolished: PbrPreset = {
  color: "#b8bdc4",
  roughness: 0.12,
  metalness: 1.0,
  anisotropy: 0.3,
  envMapIntensity: 1.4,
};

/**
 * Copper windings — generator stator visible in cutaway.
 */
export const copperWinding: PbrPreset = {
  color: "#c77b4b",
  roughness: 0.48,
  metalness: 0.95,
  envMapIntensity: 1.0,
};

/**
 * Concrete — monopile splash zone / foundation.
 */
export const concreteAged: PbrPreset = {
  color: "#7d8288",
  roughness: 0.88,
  metalness: 0.05,
  envMapIntensity: 0.6,
};

/**
 * Rubber — cable sheathing, seals, bumpers.
 */
export const rubberSeal: PbrPreset = {
  color: "#1c1e22",
  roughness: 0.92,
  metalness: 0.0,
  clearcoat: 0.15,
  clearcoatRoughness: 0.75,
  envMapIntensity: 0.4,
};

/**
 * Tinted glass — control cabinet windows, human-access doors.
 */
export const glassTinted: PbrPreset = {
  color: "#c9d6e2",
  roughness: 0.05,
  metalness: 0.0,
  ior: 1.52,
  transmission: 0.88,
  thickness: 0.4,
  clearcoat: 0.95,
  clearcoatRoughness: 0.05,
  transparent: true,
  opacity: 0.85,
  envMapIntensity: 1.5,
};

/**
 * Anti-fouling paint — submerged monopile (below splash zone).
 * High-chlorinated paint on offshore monopiles is typically red-brown.
 */
export const antiFoulingPaint: PbrPreset = {
  color: "#6a1f1a",
  roughness: 0.65,
  metalness: 0.35,
  envMapIntensity: 0.7,
};

/**
 * Yellow transition-piece paint — IALA-compliant high-visibility yellow.
 */
export const transitionPieceYellow: PbrPreset = {
  color: "#f5c116",
  roughness: 0.55,
  metalness: 0.25,
  clearcoat: 0.55,
  clearcoatRoughness: 0.3,
  envMapIntensity: 0.9,
};

/**
 * Dark converter-cabinet metal (brushed aluminium finish).
 */
export const brushedAluminium: PbrPreset = {
  color: "#7c8691",
  roughness: 0.35,
  metalness: 0.9,
  anisotropy: 0.55,
  anisotropyRotation: Math.PI / 2,
  envMapIntensity: 1.1,
};

/**
 * Warm emissive — LEDs, status lights, thermal hot spots.
 */
export function emissiveGlow(color: string, intensity = 2.0): PbrPreset {
  return {
    color: "#0a0a0a",
    roughness: 0.5,
    metalness: 0.0,
    emissive: color,
    emissiveIntensity: intensity,
    envMapIntensity: 0.2,
  };
}

/**
 * Modulated emissive used for thermal visualisation — interpolates between
 * cold (blue) and hot (red) based on temperature fraction (0..1).
 */
export function thermalMaterial(tempFraction: number): PbrPreset {
  const t = Math.max(0, Math.min(1, tempFraction));
  // Cold (#041f3c) → warm (#d4521e) via HSL-ish linear blend
  const r = Math.round(4 + (212 - 4) * t);
  const g = Math.round(31 + (82 - 31) * t);
  const b = Math.round(60 + (30 - 60) * t);
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  return {
    color: "#1a1e24",
    roughness: 0.6,
    metalness: 0.3,
    emissive: hex,
    emissiveIntensity: 0.4 + 1.6 * t,
    envMapIntensity: 0.6,
  };
}

/** All presets in one object, for convenience / enumeration. */
export const materials = {
  metalPaintedShell,
  metalPaintedDetail,
  metalRaw,
  metalPolished,
  copperWinding,
  concreteAged,
  rubberSeal,
  glassTinted,
  antiFoulingPaint,
  transitionPieceYellow,
  brushedAluminium,
} as const;

export type MaterialPresetName = keyof typeof materials;
