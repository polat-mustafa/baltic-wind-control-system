/**
 * SCADA color palette — ISA-101 / IEC 61131 compliant.
 *
 * These colors are mandated by the SKILL.md engineering standards and must
 * NEVER be changed. Every equipment state, alarm priority, and voltage level
 * maps to exactly one color to prevent operator confusion on the HMI.
 *
 * Standards: ISA-101 (HMI), ISA-18.2 / EEMUA 191 (alarm management),
 *            IEC 61131-3 (PLC color coding)
 */
export const SCADA_COLORS = {
  // Equipment states
  ENERGIZED: "#00FF00", // Green — energized, normal operation
  DE_ENERGIZED: "#808080", // Gray — de-energized, isolated
  EARTHED: "#00FFFF", // Cyan — earthed (safety earth applied)
  FAULT: "#FF0000", // Red — fault condition
  WARNING: "#FFAA00", // Amber — warning, attention needed

  // Alarm priorities (per ISA-18.2 / EEMUA 191)
  ALARM_CRITICAL: "#FF0000", // Red — immediate action required
  ALARM_HIGH: "#FF6600", // Orange — prompt action required
  ALARM_MEDIUM: "#FFCC00", // Yellow — awareness
  ALARM_LOW: "#00CCFF", // Light blue — information

  // Voltage levels (standard power system colors)
  VOLTAGE_400KV: "#FF0000", // Red
  VOLTAGE_220KV: "#0000FF", // Blue
  VOLTAGE_66KV: "#008000", // Green
  VOLTAGE_NEUTRAL: "#000000", // Black
} as const;

/** Map equipment state strings from the API to SCADA colors. */
export const EQUIPMENT_STATE_COLOR: Record<string, string> = {
  open: SCADA_COLORS.DE_ENERGIZED,
  closed: SCADA_COLORS.ENERGIZED,
  earthed: SCADA_COLORS.EARTHED,
  racked_in: SCADA_COLORS.DE_ENERGIZED,
  racked_out: SCADA_COLORS.DE_ENERGIZED,
};

/** Map voltage levels to colors for SLD edges. */
export const VOLTAGE_COLOR: Record<number, string> = {
  400: SCADA_COLORS.VOLTAGE_400KV,
  220: SCADA_COLORS.VOLTAGE_220KV,
  66: SCADA_COLORS.VOLTAGE_66KV,
};
