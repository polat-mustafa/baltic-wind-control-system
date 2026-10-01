/**
 * Wind-farm geometry for the 3D viewer: the other turbines' real positions
 * relative to the one being viewed, in the scene's world frame
 * (x = −east, z = north, metres — same convention as the nacelle yaw, where a
 * compass bearing θ points along (−sin θ, 0, cos θ)).
 *
 * Equirectangular projection around the viewed turbine: at 54.8° N and a
 * farm extent of ~10 km the error is < 1 m.
 */

import { TURBINE_POSITIONS } from "../../../../constants/windFarmLayout";

const M_PER_DEG_LAT = 110_540;

export interface FarmNeighbour {
  id: string;
  stringNumber: number;
  /** World-frame position of the tower axis [m]. */
  x: number;
  z: number;
}

export function farmAround(turbineId: string): FarmNeighbour[] {
  const me = TURBINE_POSITIONS.find((t) => t.id === turbineId) ?? TURBINE_POSITIONS[0];
  const mPerDegLon = 111_320 * Math.cos((me.lat * Math.PI) / 180);
  return TURBINE_POSITIONS.map((t) => ({
    id: t.id,
    stringNumber: t.stringNumber,
    x: -(t.lon - me.lon) * mPerDegLon,
    z: (t.lat - me.lat) * M_PER_DEG_LAT,
  }));
}

/** World vector of a compass bearing (FROM direction for wind) on the sea plane. */
export function bearingDir(deg: number): [number, number] {
  const b = (deg * Math.PI) / 180;
  return [-Math.sin(b), Math.cos(b)];
}
