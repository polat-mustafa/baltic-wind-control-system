/**
 * Infer curtailment reason from operational data.
 *
 * Pure function — no backend changes needed. Uses existing TurbineData
 * fields (windSpeed, pitchAngle, powerOutput) to determine WHY a turbine
 * is curtailed, and which cross-section part is most relevant.
 *
 * Three heuristics (checked in order):
 * 1. High-wind curtailment: windSpeed > 20 m/s AND pitch > 15°
 *    → blades are pitched to feather to shed load
 * 2. Grid dispatch curtailment: power << expected at moderate wind
 *    → TSO/DSO has ordered power reduction via converter setpoint
 * 3. Unknown: generic curtailment (default fallback)
 */

import type { TurbinePartId } from "../constants/turbinePartEducation";
import type { TurbineData } from "../types/landing";

export interface CurtailmentInfo {
  reason: "high_wind" | "grid_dispatch" | "unknown";
  label: string;
  explanation: string;
  affectedPart: TurbinePartId;
  educationalNote: string;
}

/** Simple power curve approximation for expected output at a given wind speed */
function expectedPowerMW(windSpeedMs: number): number {
  if (windSpeedMs < 3) return 0;        // below cut-in
  if (windSpeedMs > 31) return 0;        // above cut-out
  if (windSpeedMs >= 12.5) return 15.0;  // rated
  // Cubic interpolation between cut-in and rated
  const fraction = (windSpeedMs - 3) / (12.5 - 3);
  return 15.0 * Math.pow(fraction, 3);
}

export function inferCurtailment(turbine: TurbineData): CurtailmentInfo | null {
  if (turbine.status !== "curtailed") return null;

  // 1. High-wind curtailment: wind > 20 m/s with significant pitch
  if (turbine.windSpeedMs > 20 && turbine.pitchAngleDeg > 15) {
    return {
      reason: "high_wind",
      label: "High-Wind Curtailment",
      explanation: `Wind speed is ${turbine.windSpeedMs.toFixed(1)} m/s (above 20 m/s threshold). Blades pitched to ${turbine.pitchAngleDeg.toFixed(1)}° to reduce aerodynamic loads and protect the drivetrain.`,
      affectedPart: "blades",
      educationalNote:
        "Above rated wind speed, the pitch system feathers the blades to limit power and structural loads. This is normal protective behavior per IEC 61400-1. The V236's advanced storm control allows operation up to 31 m/s cut-out, but at reduced output.",
    };
  }

  // 2. Grid dispatch curtailment: power well below expected at moderate wind
  const expected = expectedPowerMW(turbine.windSpeedMs);
  if (
    turbine.windSpeedMs >= 5 &&
    turbine.windSpeedMs <= 20 &&
    expected > 1 &&
    turbine.powerOutputMW < expected * 0.6
  ) {
    return {
      reason: "grid_dispatch",
      label: "Grid Dispatch Curtailment",
      explanation: `Power output is ${turbine.powerOutputMW.toFixed(1)} MW but expected ~${expected.toFixed(1)} MW at ${turbine.windSpeedMs.toFixed(1)} m/s. The grid operator (PSE) has likely issued a dispatch reduction order.`,
      affectedPart: "converter",
      educationalNote:
        "Grid operators (TSOs like PSE) can curtail wind farms when grid congestion, low demand, or frequency stability requires generation reduction. Under ENTSO-E NC RfG, Type D generators must comply with active power setpoints. Curtailment compensation depends on market rules — in Poland, constraint payments may apply under the CfD or auction regime.",
    };
  }

  // 3. Unknown/default curtailment
  return {
    reason: "unknown",
    label: "Curtailed",
    explanation: `Turbine output reduced to ${turbine.powerOutputMW.toFixed(1)} MW. Curtailment reason not determinable from current sensor data.`,
    affectedPart: "nacelle",
    educationalNote:
      "Curtailment can result from multiple causes: grid operator dispatch, noise restrictions, shadow flicker limits, bat/bird protection protocols, or manual operator intervention. The SCADA system logs the specific curtailment source code for post-event analysis.",
  };
}
