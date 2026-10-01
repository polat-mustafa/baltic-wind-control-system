/**
 * V236 nacelle layout — single source for where things are, shared by the
 * Blender model (scripts/blender/build_v236.py, same numbers) and every
 * overlay (thermal, sensors, health badges, power flow, labels).
 *
 * Frames:
 *   yaw frame   world axes rotated with the nacelle yaw; origin at the tower
 *               axis at sea level; +z toward the rotor (upwind).
 *   shaft frame origin at the hub centre, +z along the main shaft toward the
 *               rotor; tilted SHAFT_TILT nose-up in the yaw frame.
 */

/** Hub centre in the yaw frame [m]. */
export const HUB: [number, number, number] = [0, 150, 6];
/** Main-shaft tilt (nose up) [rad] — 6°, typical for large offshore rotors. */
export const SHAFT_TILT = (6 * Math.PI) / 180;
/** Blade precone (tips upwind) [rad] — 4°. */
export const PRECONE = (4 * Math.PI) / 180;
export const ROTOR_RADIUS = 118;

/** Point on the shaft axis at shaft-frame z → yaw frame [m]. */
export function onShaft(z: number, x = 0, y = 0): [number, number, number] {
  const s = Math.sin(SHAFT_TILT);
  const c = Math.cos(SHAFT_TILT);
  return [HUB[0] + x, HUB[1] + y * c + z * s, HUB[2] - y * s + z * c];
}

/** Shaft-frame axial stations of the drivetrain (Blender script, same values). */
export const SHAFT_Z = {
  frontBearing: -4.2,
  rearBearing: -7.4,
  bearingUnit: -5.75,
  gearboxStage: [-9.0, -10.1, -11.1] as const,
  gearbox: -10.1,
  brakeDisc: -12.2,
  coupling: -12.7,
  generator: -13.9,
};

/** Planetary stages: fixed ring, i = 1 + Z_ring/Z_sun → 4 · 4 · 3 = 48. */
export const GEAR_STAGES = [
  { z: -9.0, orbit: 1.0, zRing: 63, zPlanet: 21, ratio: 4 },
  { z: -10.1, orbit: 0.7, zRing: 54, zPlanet: 18, ratio: 4 },
  { z: -11.1, orbit: 0.525, zRing: 48, zPlanet: 12, ratio: 3 },
] as const;

/** Component anchor points in the yaw frame [m]. */
export const PARTS = {
  mainBearing: onShaft(SHAFT_Z.frontBearing, 0, 1.5),
  bearingUnit: onShaft(SHAFT_Z.bearingUnit),
  gearbox: onShaft(SHAFT_Z.gearbox),
  gearboxTop: onShaft(SHAFT_Z.gearbox, 0, 1.9),
  brake: onShaft(SHAFT_Z.brakeDisc),
  generator: onShaft(SHAFT_Z.generator),
  generatorTop: onShaft(SHAFT_Z.generator, 0, 2.0),
  converter: [-3.35, 148.5, -4.4] as [number, number, number],
  transformer: [0, 148, -11] as [number, number, number],
  hpu: [3.35, 147.8, 2.2] as [number, number, number],
  oilCooler: [4.85, 151, -3] as [number, number, number],
  towerAxisFloor: [0, 147.3, 0] as [number, number, number],
};
