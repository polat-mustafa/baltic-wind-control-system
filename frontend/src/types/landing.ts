/**
 * TypeScript interfaces for the interactive wind farm map landing page.
 *
 * Models 34 turbines across 6 strings, the offshore substation (OSS),
 * export cable route, and real-time KPI aggregation.
 */

// ── Turbine Status ──────────────────────────────────────────────

export type TurbineStatus = "operating" | "curtailed" | "fault" | "offline";

// ── Turbine Data ────────────────────────────────────────────────

export interface TurbineData {
  /** Turbine identifier, e.g. "WTG-01" to "WTG-34" */
  id: string;
  /** Array string number (1-6), each string connects to the OSS */
  stringNumber: number;
  /** SVG coordinate position on the map canvas */
  position: { x: number; y: number };
  /** Current operational status */
  status: TurbineStatus;
  /** Real-time power output in MW (0-15.0) */
  powerOutputMW: number;
  /** Hub-height wind speed in m/s */
  windSpeedMs: number;
}

// ── Farm-Level KPIs ─────────────────────────────────────────────

export interface FarmKPI {
  /** Total farm output in MW (0-510) */
  totalOutputMW: number;
  /** Farm-average hub-height wind speed in m/s */
  averageWindSpeedMs: number;
  /** Turbine availability as percentage (0-100) */
  availabilityPercent: number;
  /** Number of active alarms (fault + curtailed turbines) */
  activeAlerts: number;
}

// ── Offshore Substation ─────────────────────────────────────────

export interface OSSData {
  /** SVG coordinate position */
  position: { x: number; y: number };
  /** Total power flowing through OSS in MW */
  powerThroughMW: number;
  /** Collection voltage level */
  collectVoltageKV: 66;
  /** Export voltage level */
  exportVoltageKV: 220;
}

// ── Map Layout Constants ────────────────────────────────────────

export interface CablePathPoint {
  x: number;
  y: number;
}
