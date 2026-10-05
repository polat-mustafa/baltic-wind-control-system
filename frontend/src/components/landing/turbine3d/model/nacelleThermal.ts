/**
 * Nacelle component temperatures — one model shared by the thermal overlay,
 * the health badges and the sensor read-outs.
 *
 * Steady state, temperature = outside air + rise; the rise follows the loss
 * that heats the part (p = P / P_rated):
 *   rise = ΔT_rated · (k₀ + (1 − k₀) · pⁿ)
 *     n = 2  copper / load losses ∝ I² (generator, transformer windings)
 *     n = 1  conduction + switching ∝ I (converter), friction ∝ load (bearing)
 *     k₀     no-load share: iron / core loss, windage, auxiliaries
 * Rated rises include the nacelle air being warmer than outside.
 *
 * Live values win where the simulation has them: main-bearing temperature
 * (farm simulation) and gearbox oil (backend cooling model, mirrored below
 * as the fallback); the HS-shaft bearing runs ≈ 8 K above the sump oil.
 *
 * Limits: gearbox oil 75 / 85 °C (backend nacelle_subsystems.py); generator
 * and dry-type transformer windings against IEC 60034-1 / IEC 60076-11
 * Class F (155 °C hot spot); bearings per typical OEM PT100 settings.
 */

import { V236, V236_ETA } from "../../../../utils/landingPhysics";

export type ThermalId = "mainBearing" | "hsBearing" | "gearboxOil" | "generator" | "converter" | "transformer";

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
  mainBearing: { id: "mainBearing", label: "Main bearing", ratedRiseK: 40, k0: 0.4, n: 1, alarmC: 70, tripC: 80 },
  hsBearing: { id: "hsBearing", label: "Gearbox HS bearing", ratedRiseK: 46, k0: 0.1, n: 1, alarmC: 85, tripC: 95 },
  gearboxOil: { id: "gearboxOil", label: "Gearbox oil", ratedRiseK: 38, k0: 0, n: 1, alarmC: 75, tripC: 85 },
  generator: { id: "generator", label: "Generator winding", ratedRiseK: 75, k0: 0.25, n: 2, alarmC: 130, tripC: 145 },
  converter: { id: "converter", label: "Converter heatsink", ratedRiseK: 38, k0: 0.1, n: 1, alarmC: 70, tripC: 80 },
  transformer: { id: "transformer", label: "Transformer winding", ratedRiseK: 80, k0: 0.12, n: 2, alarmC: 130, tripC: 150 },
};

/** Model temperature of a component [°C] at load fraction p and outside air [°C]. */
export function modelTempC(id: ThermalId, p: number, airC: number): number {
  const s = THERMAL_SPECS[id];
  const load = Math.min(1.1, Math.max(0, p));
  return airC + s.ratedRiseK * (s.k0 + (1 - s.k0) * load ** s.n);
}

const COOLER_UA_W_PER_K = 15_000;
const OIL_SETPOINT_C = 65;

/** Gearbox oil [°C] — same steady state and fan law as the backend cooling model. */
export function gearboxOilC(powerMW: number, airC: number): number {
  const pMech = powerMW > 0 ? (powerMW * 1e6) / (V236_ETA.gearbox * V236_ETA.generator) : 0;
  const q = pMech * (1 - V236_ETA.gearbox);
  const first = airC + q / COOLER_UA_W_PER_K;
  let fan = 0;
  if (first > airC + 5) fan = first < OIL_SETPOINT_C ? Math.max(20, Math.min(100, ((first - airC) / (OIL_SETPOINT_C - airC)) * 100)) : 100;
  return airC + q / (COOLER_UA_W_PER_K * (0.6 + (0.4 * fan) / 100));
}

export interface LiveThermalInputs {
  powerMW: number;
  airC: number;
  /** Simulated main-bearing temperature [°C] (farm simulation). */
  bearingC?: number;
  /** Backend gearbox oil temperature [°C]. */
  oilC?: number;
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
  const oil = inp.oilC ?? gearboxOilC(inp.powerMW, inp.airC);
  const values: Record<ThermalId, [number, boolean]> = {
    mainBearing: inp.bearingC !== undefined ? [inp.bearingC, true] : [modelTempC("mainBearing", p, inp.airC), false],
    gearboxOil: [oil, inp.oilC !== undefined],
    hsBearing: [oil + 8, inp.oilC !== undefined],
    generator: [modelTempC("generator", p, inp.airC), false],
    converter: [modelTempC("converter", p, inp.airC), false],
    transformer: [modelTempC("transformer", p, inp.airC), false],
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
  const nominal = id === "gearboxOil" || id === "hsBearing" ? gearboxOilC(V236.ratedMW, 15) + (id === "hsBearing" ? 8 : 0) : modelTempC(id, 1, 15);
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
