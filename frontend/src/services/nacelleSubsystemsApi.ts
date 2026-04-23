/**
 * Nacelle Subsystems API — V236-15.0 MW live physics endpoints.
 *
 * Wraps GET /api/v1/turbine-sim/nacelle/{subsystems,hpu,cooling,safety}.
 * Backend computes deterministic physics from operating conditions, so
 * the frontend feeds live turbine state (power, RPM, pitch, ambient) and
 * receives subsystem-level temperature/pressure/alarm data.
 */

import { request } from "./apiClient";

export interface HPUState {
  line_pressure_bar: number;
  accumulator_pressure_bar: number;
  accumulator_charge_pct: number;
  pitch_cylinder_extension_pct: number;
  brake_caliper_pressure_bar: number;
  pump_running: boolean;
  iso_cleanliness_code: string;
  alarm: boolean;
}

export interface CoolingState {
  oil_temp_c: number;
  oil_temp_alarm: boolean;
  oil_temp_trip: boolean;
  cooler_heat_rejection_kw: number;
  fan_speed_pct: number;
  ambient_temp_c: number;
  viscosity_cst: number;
}

export interface SafetyState {
  rotor_speed_rpm: number;
  overspeed_warning: boolean;
  overspeed_hardware: boolean;
  vibration_mm_s: number;
  vibration_zone: "A" | "B" | "C" | "D";
  vibration_alarm: boolean;
  vibration_trip: boolean;
  ice_detection_active: boolean;
  fire_alarm: boolean;
  lightning_strike_count: number;
}

export interface CableTwistState {
  accumulated_yaw_deg: number;
  twist_turns: number;
  soft_limit_reached: boolean;
  hard_limit_reached: boolean;
  untwist_in_progress: boolean;
}

export interface UPSState {
  battery_soc_pct: number;
  backup_time_min: number;
  charging: boolean;
  on_battery: boolean;
  load_kw: number;
  battery_voltage_v: number;
  alarm: boolean;
}

export interface NacelleSubsystemsResponse {
  hpu: HPUState;
  cooling: CoolingState;
  safety: SafetyState;
  cable_twist: CableTwistState;
  ups: UPSState;
  any_alarm: boolean;
}

export interface NacelleQuery {
  power_mw: number;
  ambient_temp_c?: number;
  rotor_speed_rpm: number;
  pitch_deg: number;
  accumulated_yaw_deg?: number;
  is_operating?: boolean;
  grid_available?: boolean;
  battery_soc_pct?: number;
  vibration_mm_s?: number;
  ice_detection?: boolean;
  fire_alarm?: boolean;
  lightning_count?: number;
}

const BASE = "/api/v1/turbine-sim/nacelle";

function toQuery(q: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export function getNacelleSubsystems(q: NacelleQuery): Promise<NacelleSubsystemsResponse> {
  return request<NacelleSubsystemsResponse>(`${BASE}/subsystems${toQuery(q as unknown as Record<string, unknown>)}`);
}

export function getHPU(q: Pick<NacelleQuery, "power_mw" | "is_operating" | "pitch_deg">): Promise<HPUState> {
  return request<HPUState>(`${BASE}/hpu${toQuery(q as unknown as Record<string, unknown>)}`);
}

export function getCooling(q: Pick<NacelleQuery, "power_mw" | "ambient_temp_c">): Promise<CoolingState> {
  return request<CoolingState>(`${BASE}/cooling${toQuery(q as unknown as Record<string, unknown>)}`);
}

export function getSafety(
  q: Pick<NacelleQuery, "rotor_speed_rpm" | "power_mw" | "vibration_mm_s" | "ice_detection" | "fire_alarm" | "lightning_count">,
): Promise<SafetyState> {
  return request<SafetyState>(`${BASE}/safety${toQuery(q as unknown as Record<string, unknown>)}`);
}
