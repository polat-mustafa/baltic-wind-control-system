/**
 * Alarm Rationalization API — M09 (EEMUA 191 / ISA-18.2).
 * Maps to backend routers/p3/alarms.py.
 * Endpoints: /api/v1/scada/alarms/*
 *
 * Distinct from scadaApi — covers rationalization metadata, EEMUA 191 KPIs,
 * alarm shelving, chattering analysis, and flood detection.
 */

import type {
  AlarmKPIResponse,
  AlarmResponse,
  AlarmShelveRequest,
  AlarmUnshelveRequest,
  AlarmRationalizationDetail,
  RationalizationUpdateRequest,
  AlarmFloodEventResponse,
  ChatteringResponse,
} from "../types/alarm";

import { post, request } from "./apiClient";

const BASE = "/api/v1/scada/alarms";

/**
 * Fetch EEMUA 191 real-time KPIs.
 * Benchmark: ≤1 alarm/10 min, ≤10 alarm/10 min during upsets.
 */
export function getAlarmKPI(windowHours = 24): Promise<AlarmKPIResponse> {
  return request(`${BASE}/kpi?window_hours=${windowHours}`);
}

/** Fetch current alarm list (optional priority/state filter). */
export function getAlarms(priority?: string, state?: string): Promise<AlarmResponse[]> {
  const qs = new URLSearchParams();
  if (priority) qs.set("priority", priority);
  if (state) qs.set("state", state);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`${BASE}${suffix}`);
}

/** Shelve an alarm for a specified duration. */
export function shelveAlarm(
  alarmId: string,
  req: AlarmShelveRequest,
): Promise<AlarmResponse> {
  return post(`${BASE}/${alarmId}/shelve`, req);
}

/** Manually unshelve an alarm before its scheduled time. */
export function unshelveAlarm(
  alarmId: string,
  req: AlarmUnshelveRequest,
): Promise<AlarmResponse> {
  return post(`${BASE}/${alarmId}/unshelve`, req);
}

/** Fetch alarm rationalization database (EEMUA 191 cause/consequence/action). */
export function getRationalization(): Promise<AlarmRationalizationDetail[]> {
  return request(`${BASE}/rationalization`);
}

/** Update rationalization data for a specific alarm. */
export function updateRationalization(
  alarmId: string,
  update: RationalizationUpdateRequest,
): Promise<AlarmRationalizationDetail> {
  return post(`${BASE}/${alarmId}/rationalize`, update);
}

/** Fetch historical alarm flood events. */
export function getFloodEvents(): Promise<AlarmFloodEventResponse[]> {
  return request(`${BASE}/flood-events`);
}

/**
 * Fetch chattering alarm analysis.
 * Chattering: alarm ON/OFF ≥3 times in a rolling window (default 10 min).
 */
export function getChatterers(windowMinutes = 10): Promise<ChatteringResponse> {
  return request(`${BASE}/chatterers?window_minutes=${windowMinutes}`);
}
