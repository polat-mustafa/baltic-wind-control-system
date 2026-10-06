/**
 * Power and thrust curves of a reference turbine (constants/turbineModels.ts,
 * official IEA Wind Task 37 tables) — the same interpolation as the backend
 * (services/p1/turbine_models.py): linear between table rows, Rule 1 enforced
 * (0 ≤ P ≤ P_rated, zero below cut-in and above cut-out).
 */

import { DEFAULT_TURBINE_ID, TURBINE_MODELS, type TurbineModel } from "../constants/turbineModels";

/** SB-510's turbine: V236 class, modelled with the IEA 15 MW reference turbine. */
export const REFERENCE_TURBINE: TurbineModel = TURBINE_MODELS[DEFAULT_TURBINE_ID];

export function turbineById(id: string | undefined): TurbineModel {
  return (id && TURBINE_MODELS[id]) || REFERENCE_TURBINE;
}

function interp(m: TurbineModel, v: number, col: 1 | 2): number {
  const t = m.table;
  if (v <= t[0][0]) return t[0][col];
  for (let i = 1; i < t.length; i++) {
    if (v <= t[i][0]) {
      const [v0, v1] = [t[i - 1][0], t[i][0]];
      return t[i - 1][col] + ((t[i][col] - t[i - 1][col]) * (v - v0)) / (v1 - v0);
    }
  }
  return t[t.length - 1][col];
}

const operating = (m: TurbineModel, v: number) => v >= m.cutInMs && v <= m.cutOutMs;

/** Electrical power [kW] at hub-height wind speed v [m/s]. */
export function powerKw(m: TurbineModel, v: number): number {
  if (!operating(m, v)) return 0;
  return Math.min(m.ratedKw, Math.max(0, interp(m, v, 1)));
}

/** Thrust coefficient [-] at v [m/s]; 0 outside the operating range (parked). */
export function thrustCoefficient(m: TurbineModel, v: number): number {
  if (!operating(m, v)) return 0;
  return Math.min(1, Math.max(0, interp(m, v, 2)));
}
