/**
 * Turbine failures in the control-room simulation, from published offshore data.
 *
 * Source: Carroll, McDonald & McMillan (2016), "Failure rate, repair time and
 * unscheduled O&M cost analysis of offshore wind turbines", Wind Energy 19:1107–1119,
 * doi:10.1002/we.1887 — ~350 offshore turbines (3–4 MW class, geared) over five years,
 * 8.3 failures per turbine per year (6.2 minor repairs, 1.1 major repairs, 0.3 major
 * replacements, 0.7 without cost data). A failure there is a visit that uses material,
 * outside scheduled service; remote resets are not counted.
 *
 * Rates per sub-assembly [failures/turbine/year] are Fig. 3 of the paper (minor + major
 * repair + major replacement + no cost data). Each alarm the control room shows is mapped
 * to the sub-assemblies whose failures raise it; sub-assemblies with no stop alarm here
 * (lifts/ladders "other components", sensors, safety, tower, service items, transformer,
 * electrical components) and the gearbox (the IEA-15 is direct drive) are left out, so
 * the modelled rate is 5.1 of the 8.3. Repair time [h] is technician time on the turbine
 * (Fig. 13): minor repair per sub-assembly, major repair 19 h (median of the figure, 18.5 h);
 * real downtime adds travel and weather waiting.
 *
 * Each turbine fails as a Poisson process per alarm type: P(fault in a tick) =
 * 1 − exp(−λ·Δt). Time is compressed so the room shows events: one 5 s tick is one hour
 * of plant time (×720), labelled wherever the rate is shown.
 */

import type { TurbineFaultType } from "../../types/scada";

/** Plant hours per simulation tick (5 s real time → 1 h: ×720). */
export const PLANT_HOURS_PER_TICK = 1;
export const TIME_COMPRESSION = (PLANT_HOURS_PER_TICK * 3600) / 5;

interface FailureMode {
  /** Failures per turbine per year (Carroll et al. 2016, Fig. 3). */
  rate: number;
  /** Share of those failures that are minor repairs [-]. */
  minorShare: number;
  /** Technician hours of a minor repair (Fig. 13). */
  minorHours: number;
  /** Sub-assemblies of the paper behind it. */
  from: string;
}

const MAJOR_REPAIR_HOURS = 19;

/** Pitch/hydraulic is one sub-assembly in the paper (1.076); split evenly between its two alarms. */
export const FAILURE_MODES: Record<TurbineFaultType, FailureMode> = {
  PITCH_CONTROL_FAULT: { rate: 0.538, minorShare: 0.824 / 1.076, minorHours: 9, from: "pitch/hydraulic (half)" },
  HYDRAULIC_PRESSURE_LOW: { rate: 0.538, minorShare: 0.824 / 1.076, minorHours: 9, from: "pitch/hydraulic (half)" },
  GENERATOR_WINDING_TEMP: { rate: 0.999, minorShare: 0.485 / 0.999, minorHours: 7, from: "generator" },
  VIBRATION_ALARM: { rate: 0.755, minorShare: (0.456 + 0.182) / 0.755, minorHours: 9, from: "blades + hub" },
  COOLANT_FLOW_LOW: { rate: 0.559, minorShare: (0.278 + 0.19) / 0.559, minorHours: 5, from: "pumps/motors + heaters/coolers" },
  BEARING_OVERTEMP: { rate: 0.471, minorShare: 0.407 / 0.471, minorHours: 4, from: "grease/oil/cooling liquid" },
  GRID_FREQUENCY_FAULT: { rate: 0.43, minorShare: 0.326 / 0.43, minorHours: 4, from: "contactor/circuit breaker/relay" },
  COMMUNICATION_LOSS: { rate: 0.428, minorShare: 0.355 / 0.428, minorHours: 8, from: "controls" },
  YAW_ERROR: { rate: 0.189, minorShare: 0.162 / 0.189, minorHours: 5, from: "yaw system" },
  CONVERTER_OVERTEMP: { rate: 0.18, minorShare: 0.076 / 0.18, minorHours: 7, from: "power supply/converter" },
};

export const MODELLED_RATE = Object.values(FAILURE_MODES).reduce((s, m) => s + m.rate, 0);

/** Probability that one turbine raises this alarm within one tick. */
export const faultProbability = (type: TurbineFaultType, hours = PLANT_HOURS_PER_TICK): number =>
  1 - Math.exp(-(FAILURE_MODES[type].rate * hours) / 8760);

/** The alarm a turbine raises this tick, or null (`rnd` ∈ [0, 1), one draw per type). */
export function drawFault(rnd: () => number = Math.random): TurbineFaultType | null {
  for (const type of Object.keys(FAILURE_MODES) as TurbineFaultType[]) {
    if (rnd() < faultProbability(type)) return type;
  }
  return null;
}

/** Repair time [plant hours]: minor or major by the paper's share for this alarm. */
export const repairHours = (type: TurbineFaultType, rnd: () => number = Math.random): number =>
  rnd() < FAILURE_MODES[type].minorShare ? FAILURE_MODES[type].minorHours : MAJOR_REPAIR_HOURS;

/** Repair time in simulation ticks (at least one). */
export const repairTicks = (type: TurbineFaultType, rnd: () => number = Math.random): number =>
  Math.max(1, Math.round(repairHours(type, rnd) / PLANT_HOURS_PER_TICK));
