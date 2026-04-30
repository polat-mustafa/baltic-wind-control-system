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
  // Equipment states — desaturated per ISA-101 (color only when abnormal)
  ENERGIZED: "#2E7D5B",      // Desat green — energized, normal operation
  DE_ENERGIZED: "#8B8B8B",   // Mid-grey — de-energized, isolated
  EARTHED: "#7A4FB0",        // Desat magenta — earthed (safety earth applied)
  FAULT: "#C8362D",          // Dark red — fault condition (Priority 1)
  WARNING: "#C9A227",        // Mustard — warning, operator attention

  // Alarm priorities (EEMUA-191) — saturation INTENTIONALLY kept here;
  // alarm chips are the one place vivid color carries meaning.
  ALARM_CRITICAL: "#C8362D", // P1 red — immediate action required
  ALARM_HIGH: "#E5C100",     // P2 mustard yellow — prompt action required
  ALARM_MEDIUM: "#4FC3D8",   // P3 cyan — awareness
  ALARM_LOW: "#5C7CB1",      // Journal slate blue — informational

  // IEC voltage levels — desaturated; SLD also uses stroke width to differentiate
  VOLTAGE_400KV: "#B0413E",  // Desat red
  VOLTAGE_220KV: "#4A6FA5",  // Desat blue
  VOLTAGE_66KV: "#B07B3E",   // Desat amber
  VOLTAGE_NEUTRAL: "#5A5F66",// Matches canvas

  // Normal-band marker for InfoTile sparklines — neutral grey
  NORMAL_BAND: "#A8AAAD",
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
