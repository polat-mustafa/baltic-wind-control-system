/**
 * Engineering wake model shared by the 3D flow streaks and the hub-height
 * wake slice:
 *
 *   near field  actuator-disc momentum theory, u = U[1 − a(1 + s/√(s²+R²))]
 *   far field   Bastankhah & Porté-Agel (2014) Gaussian deficit
 *               σ/D = k*·s/D + ε, ε = 0.2√β, β = ½(1+√(1−Ct))/√(1−Ct),
 *               C(s) = 1 − √(1 − Ct / (8(σ/D)²)), capped at 2a
 *   superposition   Katic et al. (1986): δ_total = √Σ δ_i²
 *   added TI    Crespo & Hernández (1996): ΔI = 0.73 a^0.8325 I0^0.0325 (s/D)^−0.32
 *
 * Distances in metres, s = downstream distance from the rotor plane, r =
 * radial distance from that rotor's axis.
 */

import { inductionFromCt, v236ThrustCoefficient } from "../../../../utils/landingPhysics";
import { K_STAR as FARM_K_STAR, velocityDeficit as farDeficit } from "../../../../utils/wakeModel";
import type { FarmNeighbour } from "./farm";
import { HUB, ROTOR_RADIUS } from "./layout";

export const R = ROTOR_RADIUS;
export const D = 2 * R;
/** Wake expansion rate k* — single source in utils/wakeModel. */
export const K_STAR = FARM_K_STAR;
export const TI_AMB = 0.06;

/** Velocity deficit 1 − u/U of one rotor at (s, r). */
export function deficit(s: number, r: number, a: number, ct: number, withInduction = false): number {
  if (ct <= 0) return 0;
  if (s <= 0) {
    if (!withInduction) return 0;
    const tube = Math.exp(-((r / (R * 1.05)) ** 8));
    return a * (1 + s / Math.hypot(s, R)) * tube;
  }
  const near = a * (1 + s / Math.hypot(s, R)) * (r < R * 1.1 ? 1 : Math.exp(-(((r - R * 1.1) / 25) ** 2)));
  // far wake: the farm's single Bastankhah formula (utils/wakeModel), capped at 2a
  const far = Math.min(2 * a, farDeficit(s, r, ct));
  // near wake inside ~2 D, Gaussian beyond, smooth hand-over
  const w = Math.min(1, Math.max(0, (s - 2 * D) / D));
  return (1 - w) * near + w * far;
}

export function addedTI(s: number, r: number, a: number): number {
  if (s < 0.5 * D || r > 1.5 * R || a <= 0) return 0;
  return 0.73 * a ** 0.8325 * TI_AMB ** 0.0325 * (s / D) ** -0.32;
}

export interface WakeSource {
  id: string;
  /** Rotor centre in the wind frame (+z = upwind) [m]. */
  x: number;
  z: number;
  a: number;
  ct: number;
}

interface TurbineLike {
  status: string;
  rotorSpeedRpm: number;
  windSpeedMs: number;
  nacellePositionDeg?: number;
}

/**
 * Turbines as wake sources in the wind frame: local = R_y(ψ)·world, where the
 * wind blows FROM bearing ψ; Ct from each turbine's own (waked) wind speed.
 * A yawed rotor only thrusts on the normal component: Ct·cos²γ; beyond the
 * 45° yaw-error stop it is paused (feathered) and sheds no wake.
 */
export function wakeSources(
  farm: FarmNeighbour[],
  map: Record<string, TurbineLike | undefined>,
  windFromDeg: number,
): WakeSource[] {
  const psi = (windFromDeg * Math.PI) / 180;
  const cp = Math.cos(psi);
  const sp = Math.sin(psi);
  return farm.map((t) => {
    const st = map[t.id];
    const running = !!st && st.status !== "fault" && st.status !== "offline" && st.rotorSpeedRpm > 0.1;
    const gamma = st?.nacellePositionDeg === undefined ? 0 : (((st.nacellePositionDeg - windFromDeg + 540) % 360) - 180);
    const cg = Math.cos((gamma * Math.PI) / 180);
    const ct = running && Math.abs(gamma) <= 45 ? v236ThrustCoefficient(st.windSpeedMs) * cg * cg : 0;
    return { id: t.id, x: t.x * cp + t.z * sp, z: -t.x * sp + t.z * cp + HUB[2], a: inductionFromCt(ct), ct };
  });
}

/** Combined (Katic) deficit of all sources at wind-frame point (x, z) at hub height. */
export function farmDeficit(sources: WakeSource[], x: number, z: number, y = 0): number {
  let d2 = 0;
  for (const w of sources) {
    const s = w.z - z;
    if (s <= 0 || w.ct <= 0) continue;
    const r = Math.hypot(x - w.x, y);
    if (r > 4 * R) continue;
    d2 += deficit(s, r, w.a, w.ct) ** 2;
  }
  return Math.sqrt(d2);
}
