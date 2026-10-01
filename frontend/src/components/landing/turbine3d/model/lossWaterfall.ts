/**
 * Live energy-conversion waterfall for one turbine, in MW:
 *
 *   ½ρA·U∞³   kinetic power of the FREE wind through the rotor disc
 *   − wake     the same disc in the turbine's own (waked) wind u: ½ρA(U∞³ − u³)
 *   − yaw      rotor axis γ off the wind: only cos^1.88 γ is usable
 *              (all of it during the > 45° yaw-error stop)
 *   − aero     what the blades do not extract: Betz (≤ 59.3 %), profile /
 *              tip losses and, above rated, pitch shedding the excess
 *   − gearbox / generator / converter / transformer  (V236_ETA chain)
 *   = P_el     at the 66 kV terminals (the SCADA value)
 *
 * The steps are built from the same helpers as the rest of the app
 * (utils/landingPhysics), so the waterfall closes exactly on the reported MW.
 */

import { v236PowerChain } from "../../../../utils/landingPhysics";
import { yawPowerFactor } from "../../../../store/landingStore";

const RHO = 1.225;
const AREA = Math.PI * 118 ** 2;
export const discPowerMW = (u: number) => (0.5 * RHO * AREA * Math.max(0, u) ** 3) / 1e6;

export interface LossStep {
  key: "free" | "wake" | "yaw" | "aero" | "gearbox" | "generator" | "converter" | "transformer" | "grid";
  label: string;
  /** MW removed by this step (0 for the first/last bar). */
  lossMW: number;
  /** Level after this step [MW]. */
  levelMW: number;
}

export function lossWaterfall(opts: {
  freeWindMs: number;
  windMs: number;
  yawErrDeg: number;
  yawPaused: boolean;
  powerMW: number;
  rotorRpm: number;
}): LossStep[] {
  const { freeWindMs, windMs, yawErrDeg, yawPaused, powerMW, rotorRpm } = opts;
  const free = discPowerMW(Math.max(freeWindMs, windMs));
  const local = discPowerMW(windMs);
  const usable = local * (yawPaused ? 0 : yawPowerFactor(yawErrDeg));
  const c = v236PowerChain(powerMW, windMs, rotorRpm);
  const rotor = Math.min(c.rotorMW, usable);
  const steps: LossStep[] = [{ key: "free", label: "Free wind ½ρAU∞³", lossMW: 0, levelMW: free }];
  let level = free;
  const push = (key: LossStep["key"], label: string, next: number) => {
    steps.push({ key, label, lossMW: Math.max(0, level - next), levelMW: next });
    level = next;
  };
  push("wake", "Wake deficit", local);
  push("yaw", yawPaused ? "Yaw-error stop" : "Yaw misalignment", usable);
  push("aero", "Aerodynamic (Cp, pitch)", rotor);
  push("gearbox", "Gearbox", c.gearbox.outMW);
  push("generator", "Generator", c.generator.outMW);
  push("converter", "Converter", c.converter.outMW);
  push("transformer", "Transformer", c.transformer.outMW);
  steps.push({ key: "grid", label: "P at 66 kV", lossMW: 0, levelMW: level });
  return steps;
}
