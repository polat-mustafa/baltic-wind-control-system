/**
 * Nacelle component temperatures — one model shared by the thermal overlay,
 * the health badges and the sensor read-outs.
 *
 * Direct drive (IEA 15 MW): no gearbox, so no gear oil. The heat sources are
 * the generator (96.55 % → ≈ 540 kW at rated), the converter (≈ 124 kW), the
 * nacelle transformer and the two main bearings.
 *
 * Generator stator winding — the backend's model (services/turbine_physics/
 * nacelle_subsystems.py, same as the digital twin):
 *   T = T_air + 10 K + 0.125 K/kW · Q_gen,  Q_gen = P/(η_gen·η_conv)·(1 − η_gen)
 *   → 92.6 °C at rated on a 15 °C day; alarm 130 °C (class B), trip 155 °C
 *   (class F, IEC 60085).
 *
 * Other parts (illustrative rises, typical OEM limits), p = P / P_rated:
 *   rise = ΔT_rated · (k₀ + (1 − k₀) · pⁿ)
 *     n = 2  copper / load losses ∝ I² (transformer windings)
 *     n = 1  conduction + switching ∝ I (converter), friction ∝ load (bearings,
 *            hydraulic pump duty)
 *     k₀     no-load share: iron / core loss, windage, auxiliaries
 *
 * Live values win where the simulation has them: main-bearing temperature
 * (farm simulation) and the generator winding (backend cooling model, mirrored
 * below as the fallback).
 */

import { V236, V236_ETA } from "../../../../utils/landingPhysics";

export type ThermalId = "mainBearing" | "rearBearing" | "generator" | "converter" | "transformer" | "hydraulicOil";

export interface ThermalSpec {
  id: ThermalId;
  label: string;
  /** Rise above outside air at rated load [K]. */
  ratedRiseK: number;
  /** No-load share of the rated loss. */
  k0: number;
  /** Load exponent of the loss. */
  n: 1 | 2;
  alarmC: number;
  tripC: number;
}

export const THERMAL_SPECS: Record<ThermalId, ThermalSpec> = {
  mainBearing: { id: "mainBearing", label: "Main bearing (upwind)", ratedRiseK: 40, k0: 0.4, n: 1, alarmC: 70, tripC: 80 },
  rearBearing: { id: "rearBearing", label: "Main bearing (downwind)", ratedRiseK: 38, k0: 0.4, n: 1, alarmC: 70, tripC: 80 },
  generator: { id: "generator", label: "Generator winding", ratedRiseK: 77.6, k0: 0, n: 1, alarmC: 130, tripC: 155 },
  converter: { id: "converter", label: "Converter heatsink", ratedRiseK: 38, k0: 0.1, n: 1, alarmC: 70, tripC: 80 },
  transformer: { id: "transformer", label: "Transformer winding", ratedRiseK: 80, k0: 0.12, n: 2, alarmC: 130, tripC: 150 },
  hydraulicOil: { id: "hydraulicOil", label: "Hydraulic oil (pitch HPU)", ratedRiseK: 25, k0: 0.5, n: 1, alarmC: 60, tripC: 70 },
};

/** Model temperature of a component [°C] at load fraction p and outside air [°C]. */
export function modelTempC(id: ThermalId, p: number, airC: number): number {
  if (id === "generator") return generatorWindingC(p * V236.ratedMW, airC);
  const s = THERMAL_SPECS[id];
  const load = Math.min(1.1, Math.max(0, p));
  return airC + s.ratedRiseK * (s.k0 + (1 - s.k0) * load ** s.n);
}

/** Generator stator winding [°C] — the backend nacelle cooling model. */
export function generatorWindingC(powerMW: number, airC: number): number {
  if (powerMW <= 0) return airC;
  const pMechW = (powerMW * 1e6) / (V236_ETA.generator * V236_ETA.converter);
  const qGenKw = (pMechW * (1 - V236_ETA.generator)) / 1e3;
  return airC + 10 + 0.125 * qGenKw;
}

export interface LiveThermalInputs {
  powerMW: number;
  airC: number;
  /** Simulated main-bearing temperature [°C] (farm simulation). */
  bearingC?: number;
  /** Backend generator stator-winding temperature [°C]. */
  windingC?: number;
}

export type ThermalState = "ok" | "alarm" | "trip";

export interface ThermalReading {
  spec: ThermalSpec;
  tempC: number;
  state: ThermalState;
  /** True when the value comes from live telemetry rather than the model. */
  live: boolean;
}

export function thermalState(id: ThermalId, tempC: number): ThermalState {
  const s = THERMAL_SPECS[id];
  return tempC >= s.tripC ? "trip" : tempC >= s.alarmC ? "alarm" : "ok";
}

/** All component readings for the current operating point. */
export function nacelleTemperatures(inp: LiveThermalInputs): Record<ThermalId, ThermalReading> {
  const p = Math.max(0, inp.powerMW) / V236.ratedMW;
  const values: Record<ThermalId, [number, boolean]> = {
    mainBearing: inp.bearingC !== undefined ? [inp.bearingC, true] : [modelTempC("mainBearing", p, inp.airC), false],
    rearBearing: [modelTempC("rearBearing", p, inp.airC), false],
    generator: inp.windingC !== undefined ? [inp.windingC, true] : [generatorWindingC(inp.powerMW, inp.airC), false],
    converter: [modelTempC("converter", p, inp.airC), false],
    transformer: [modelTempC("transformer", p, inp.airC), false],
    hydraulicOil: [modelTempC("hydraulicOil", p, inp.airC), false],
  };
  const out = {} as Record<ThermalId, ThermalReading>;
  for (const id of Object.keys(values) as ThermalId[]) {
    const [tempC, live] = values[id];
    out[id] = { spec: THERMAL_SPECS[id], tempC, state: thermalState(id, tempC), live };
  }
  return out;
}

/**
 * Health index 0–100 from the thermal margin: 100 at or below the rated
 * temperature at a 15 °C day, 0 at the trip limit, linear in between.
 */
export function thermalHealthIndex(id: ThermalId, tempC: number): number {
  const s = THERMAL_SPECS[id];
  const nominal = modelTempC(id, 1, 15);
  const hi = (100 * (s.tripC - tempC)) / (s.tripC - nominal);
  return Math.max(0, Math.min(100, hi));
}

// ─── IR (ironbow) palette, °C ─────────────────────────────────────────────

const IRONBOW: [number, number, number, number][] = [
  [10, 20, 16, 80],
  [35, 120, 30, 140],
  [60, 220, 60, 70],
  [85, 250, 150, 20],
  [110, 255, 225, 70],
  [140, 255, 255, 220],
];

export const IR_RANGE_C = { min: IRONBOW[0][0], max: IRONBOW[IRONBOW.length - 1][0] };

export function irColour(tempC: number): string {
  const t = Math.max(IR_RANGE_C.min, Math.min(IR_RANGE_C.max, tempC));
  for (let i = 1; i < IRONBOW.length; i++) {
    const [t1, r1, g1, b1] = IRONBOW[i];
    if (t <= t1) {
      const [t0, r0, g0, b0] = IRONBOW[i - 1];
      const f = (t - t0) / (t1 - t0);
      const ch = (a: number, b: number) => Math.round(a + (b - a) * f).toString(16).padStart(2, "0");
      return `#${ch(r0, r1)}${ch(g0, g1)}${ch(b0, b1)}`;
    }
  }
  return "#ffffdc";
}

export function irGradientCss(): string {
  const span = IR_RANGE_C.max - IR_RANGE_C.min;
  return `linear-gradient(90deg,${IRONBOW.map(([t, r, g, b]) => `rgb(${r},${g},${b}) ${((t - IR_RANGE_C.min) / span) * 100}%`).join(",")})`;
}
