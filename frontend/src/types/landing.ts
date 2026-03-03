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
  /** Rotor speed in RPM (V236 rated: 9.55 rpm) */
  rotorSpeedRpm: number;
  /** Nacelle yaw position in degrees (0-360) */
  nacellePositionDeg: number;
  /** Blade pitch angle in degrees (0-90, 0=power, 90=feathered) */
  pitchAngleDeg: number;
  /** Turbine availability percentage (0-100) */
  availabilityPct: number;
  /** Energy produced today in MWh */
  energyTodayMWh: number;
  /** Main bearing vibration in mm/s (ISO 10816) */
  vibrationMmS: number;
  /** Main bearing temperature in Celsius */
  bearingTempC: number;
  /** Total operating hours since commissioning */
  operatingHours: number;
}

// ── Transformer Data ─────────────────────────────────────────────

export interface TransformerData {
  name: string;
  type: string;
  ratingMVA: number;
  hvKV: number;
  lvKV: number;
  tapPosition: number;
  totalTaps: number;
  oilTemperatureC: number;
  windingTempHVC: number;
  windingTempLVC: number;
  loadPercent: number;
  coolingStatus: "ONAN" | "ONAF-1" | "ONAF-2";
  buchholzStatus: "Normal" | "Alarm" | "Trip";
  dgaStatus: "Normal" | "Caution" | "Warning";
  operatingHours: number;
}

// ── Cable Data ───────────────────────────────────────────────────

export interface CableData {
  type: string;
  voltageRatingKV: number;
  currentRatingA: number;
  lengthKm: number;
  thermalLoadingPct: number;
  crossSectionMm2: number;
  manufacturer: string;
  insulationType: string;
  burialDepthM: number;
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
  /** Farm-level wind direction in degrees (meteorological, 0=N) */
  windDirectionDeg: number;
  /** Capacity factor as percentage */
  capacityFactorPct: number;
  /** Grid frequency in Hz */
  gridFrequencyHz: number;
  /** Estimated revenue today in EUR */
  revenueTodayEUR: number;
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
