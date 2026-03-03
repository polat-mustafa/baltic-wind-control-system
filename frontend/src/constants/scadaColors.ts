/**
 * SCADA color palette — ISA-101 / IEC 61131 compliant.
 *
 * These colors follow ISA-101 High Performance HMI guidelines with
 * muted tones suitable for dark control room environments.
 * Pure RGB values (#FF0000, #00FF00) are avoided — they cause eye strain
 * during 12-hour operator shifts.
 *
 * Standards: ISA-101 (HMI), ISA-18.2 / EEMUA 191 (alarm management),
 *            IEC 61131-3 (PLC color coding)
 */
export const SCADA_COLORS = {
  // Equipment states (ISA-101 muted palette)
  ENERGIZED: "#3ecf6e", // Muted green — energized, normal operation
  DE_ENERGIZED: "#6b7280", // Gray — de-energized, isolated
  EARTHED: "#22d3ee", // Muted cyan — earthed (safety earth applied)
  FAULT: "#ef4444", // Muted red — fault condition
  WARNING: "#f5a623", // Amber — warning, attention needed

  // Alarm priorities (per ISA-18.2 / EEMUA 191)
  ALARM_CRITICAL: "#ef4444", // Red — immediate action required
  ALARM_HIGH: "#f97316", // Orange — prompt action required
  ALARM_MEDIUM: "#eab308", // Yellow — awareness
  ALARM_LOW: "#38bdf8", // Light blue — information

  // Voltage levels (IEC standard power system colors)
  VOLTAGE_400KV: "#ef4444", // Red
  VOLTAGE_220KV: "#3b82f6", // Blue
  VOLTAGE_66KV: "#f97316", // Orange
  VOLTAGE_NEUTRAL: "#6b7280", // Gray
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
