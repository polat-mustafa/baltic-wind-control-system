/**
 * SCADA color palette — ISA-101 / IEC 61131 compliant, Baltic Night values
 * (mirrors the CSS tokens in index.css; hex because SVG, canvas and Leaflet
 * HTML strings consume it).
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
  ENERGIZED: "#4CC38A",      // Muted green — energized, normal operation
  DE_ENERGIZED: "#56708A",   // Slate — de-energized, isolated
  EARTHED: "#C98BD3",        // Muted magenta — earthed (safety earth applied)
  FAULT: "#F25C54",          // Red — fault condition (Priority 1)
  WARNING: "#F0B13E",        // Amber — warning, operator attention

  // Alarm priorities (EEMUA-191) — saturation INTENTIONALLY kept here;
  // alarm chips are the one place vivid color carries meaning.
  ALARM_CRITICAL: "#F25C54", // P1 red — immediate action required
  ALARM_HIGH: "#F0B13E",     // P2 amber — prompt action required
  ALARM_MEDIUM: "#8FB4F5",   // P3 periwinkle — awareness
  ALARM_LOW: "#56708A",      // Journal slate — informational

  // IEC voltage levels — desaturated; SLD also uses stroke width to differentiate
  VOLTAGE_400KV: "#E8837A",  // Muted red
  VOLTAGE_220KV: "#8FB4F5",  // Muted blue
  VOLTAGE_66KV: "#E5B567",   // Muted amber
  VOLTAGE_NEUTRAL: "#2C4760",// Dead line (line-strong)

  // Normal-band marker for InfoTile sparklines — neutral grey
  NORMAL_BAND: "#7189A0",
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
