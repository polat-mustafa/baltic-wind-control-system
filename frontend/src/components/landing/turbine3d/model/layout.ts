import { REFERENCE_TURBINE } from "../../../../utils/turbineCurves";

/**
 * Nacelle layout of the SB-510 turbine — single source for where things are,
 * shared by the Blender model (scripts/blender/build_v236.py, same numbers) and
 * every overlay (thermal, sensors, health badges, power flow, labels).
 *
 * IEA 15 MW low-speed direct drive (Gaertner et al. 2020): overhang 11.35 m,
 * shaft tilt 6°, precone 4°; the hub drives a short hollow main shaft on two
 * main bearings around a stationary turret and the outer rotor of the 200-pole
 * PMSG, which sits between the hub and the nacelle front (no gearbox).
 *
 * Frames:
 *   yaw frame   world axes rotated with the nacelle yaw; origin at the tower
 *               axis at sea level; +z toward the rotor (upwind).
 *   shaft frame origin at the hub centre, +z along the main shaft toward the
 *               rotor; tilted SHAFT_TILT nose-up in the yaw frame.
 */

/** Hub centre in the yaw frame [m]: hub height 150 m, overhang 11.35 m (IEA 15 MW). */
export const HUB: [number, number, number] = [0, 150, 11.35];
/** Main-shaft tilt (nose up) [rad] — 6° (IEA 15 MW). */
export const SHAFT_TILT = (6 * Math.PI) / 180;
/** Blade precone (tips upwind) [rad] — 4° (IEA 15 MW). */
export const PRECONE = (4 * Math.PI) / 180;
/** Rotor radius of the modelled turbine [m] — IEA 15 MW, Ø 241.35 m. */
export const ROTOR_RADIUS = REFERENCE_TURBINE.rotorDiameterM / 2;
/** Radius of the Blender blade geometry (V236-class shape: 2.5 m root + 115.5 m blade, scaled ×1.023). */
export const DRAWN_ROTOR_RADIUS = 118;
/** Uniform scale that stretches the drawn blades to the modelled rotor (≈ 1.023). */
export const BLADE_DRAW_SCALE = ROTOR_RADIUS / DRAWN_ROTOR_RADIUS;

/** Point on the shaft axis at shaft-frame z → yaw frame [m]. */
export function onShaft(z: number, x = 0, y = 0): [number, number, number] {
  const s = Math.sin(SHAFT_TILT);
  const c = Math.cos(SHAFT_TILT);
  return [HUB[0] + x, HUB[1] + y * c + z * s, HUB[2] - y * s + z * c];
}

/** Shaft-frame axial stations of the drivetrain (Blender script, same values). */
export const SHAFT_Z = {
  /** Upwind main bearing (tapered double outer-ring, locating). */
  frontBearing: -2.9,
  /** Downwind main bearing (spherical roller, non-locating), 1.2 m aft. */
  rearBearing: -4.1,
  bearingUnit: -3.5,
  /** Generator rotor disc behind the hub; rotor brake / lock calipers. */
  rotorDisc: -2.59,
  /** Generator active part (core 2.17 m, around the bearings), centre. */
  generator: -3.865,
  /** Stator support disc / rear end shield. */
  statorDisc: -5.2,
  /** Turret flange on the bedplate — 5 m upwind of the tower axis (report Table 5-3). */
  nacelleFront: -6.38,
  /** Turret centre just inside the nacelle front, for interior anchors. */
  turretInside: -7.4,
};

/** Generator outer radius (rotor yoke) [m]; air gap at r = 5.08 m. */
export const GENERATOR_RADIUS = 5.33;

/** Component anchor points in the yaw frame [m]. */
export const PARTS = {
  mainBearing: onShaft(SHAFT_Z.frontBearing, 0, 2.3),
  bearingUnit: onShaft(SHAFT_Z.bearingUnit),
  brake: onShaft(SHAFT_Z.rotorDisc, -3.7, 3.7),
  generator: onShaft(SHAFT_Z.generator),
  generatorTop: onShaft(SHAFT_Z.generator, 0, GENERATOR_RADIUS),
  converter: [-3.35, 148.5, -4.4] as [number, number, number],
  transformer: [0, 148, -11] as [number, number, number],
  hpu: [3.35, 147.8, 2.2] as [number, number, number],
  /** Coolant pump skid of the generator / converter cooling circuit. */
  coolantSkid: [4.85, 151, -3] as [number, number, number],
  towerAxisFloor: [0, 147.3, 0] as [number, number, number],
};
