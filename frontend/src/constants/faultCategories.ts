/**
 * Shared fault category definitions used by both the landing page
 * simulation (landingStore) and the SCADA alarm system (scadaStore).
 *
 * 10 realistic wind turbine fault types matching IEC 61400 alarm lists,
 * each with ISA-18.2 priority, probable cause, and recommended action.
 */

import type { AlarmPriority, TurbineFaultType } from "../types/scada";

export interface FaultCategoryDef {
  type: TurbineFaultType;
  label: string;
  priority: AlarmPriority;
  probableCause: string;
  recommendedAction: string;
  valueTemplate: () => string;
  setpoint: string;
}

export const FAULT_CATEGORIES: FaultCategoryDef[] = [
  {
    type: "PITCH_CONTROL_FAULT",
    label: "Pitch Control Fault",
    priority: "CRITICAL",
    probableCause: "Blade pitch actuator malfunction or sensor failure",
    recommendedAction: "Initiate controlled shutdown, dispatch maintenance crew",
    valueTemplate: () => `${(Math.random() * 20 + 70).toFixed(1)}\u00B0`,
    setpoint: "< 30\u00B0",
  },
  {
    type: "CONVERTER_OVERTEMP",
    label: "Converter Overtemperature",
    priority: "HIGH",
    probableCause: "Power electronics cooling system degradation",
    recommendedAction: "Reduce power output, check coolant flow and filters",
    valueTemplate: () => `${(Math.random() * 15 + 85).toFixed(0)}\u00B0C`,
    setpoint: "< 80\u00B0C",
  },
  {
    type: "YAW_ERROR",
    label: "Yaw Position Error",
    priority: "MEDIUM",
    probableCause: "Nacelle yaw position deviation exceeds threshold",
    recommendedAction: "Check yaw motor and wind vane alignment",
    valueTemplate: () => `${(Math.random() * 20 + 15).toFixed(1)}\u00B0 deviation`,
    setpoint: "< 10\u00B0",
  },
  {
    type: "BEARING_OVERTEMP",
    label: "Main Bearing Overtemperature",
    priority: "HIGH",
    probableCause: "Bearing lubrication degradation or excessive load",
    recommendedAction: "Reduce load, schedule bearing inspection",
    valueTemplate: () => `${(Math.random() * 20 + 75).toFixed(0)}\u00B0C`,
    setpoint: "< 70\u00B0C",
  },
  {
    type: "GEARBOX_OIL_TEMP",
    label: "Gearbox Oil Temperature",
    priority: "MEDIUM",
    probableCause: "Gearbox lubrication system alarm \u2014 oil temp elevated",
    recommendedAction: "Check oil level, filters, and cooling circuit",
    valueTemplate: () => `${(Math.random() * 10 + 80).toFixed(0)}\u00B0C`,
    setpoint: "< 75\u00B0C",
  },
  {
    type: "GRID_FREQUENCY_FAULT",
    label: "Grid Frequency Out of Range",
    priority: "CRITICAL",
    probableCause: "Grid frequency deviation exceeds PSE IRiESP limits",
    recommendedAction: "Activate FRT mode, reduce active power per grid code",
    valueTemplate: () => `${(49 + Math.random() * 2).toFixed(2)} Hz`,
    setpoint: "49.5\u201350.5 Hz",
  },
  {
    type: "GENERATOR_WINDING_TEMP",
    label: "Generator Winding Temperature",
    priority: "HIGH",
    probableCause: "Generator thermal alarm \u2014 winding insulation at risk",
    recommendedAction: "Derate output, inspect cooling system",
    valueTemplate: () => `${(Math.random() * 20 + 140).toFixed(0)}\u00B0C`,
    setpoint: "< 130\u00B0C",
  },
  {
    type: "COMMUNICATION_LOSS",
    label: "IED Communication Timeout",
    priority: "MEDIUM",
    probableCause: "Network disruption or IED failure",
    recommendedAction: "Check fiber optic links and switch ports",
    valueTemplate: () => "TIMEOUT",
    setpoint: "< 100 ms",
  },
  {
    type: "HYDRAULIC_PRESSURE_LOW",
    label: "Hydraulic Pressure Low",
    priority: "HIGH",
    probableCause: "Blade pitch hydraulic system leak or pump failure",
    recommendedAction: "Check hydraulic fluid level, inspect for leaks",
    valueTemplate: () => `${(Math.random() * 50 + 80).toFixed(0)} bar`,
    setpoint: "> 160 bar",
  },
  {
    type: "VIBRATION_ALARM",
    label: "Excessive Vibration",
    priority: "CRITICAL",
    probableCause: "Nacelle/tower vibration exceeds ISO 10816 limits",
    recommendedAction: "Emergency shutdown, structural inspection required",
    valueTemplate: () => `${(Math.random() * 5 + 6).toFixed(1)} mm/s`,
    setpoint: "< 4.5 mm/s",
  },
];

/** Just the fault type strings — for random selection in landing simulation. */
export const FAULT_TYPES: TurbineFaultType[] = FAULT_CATEGORIES.map((c) => c.type);
