/**
 * Alarm Rationalization types — M09 (EEMUA 191 / ISA-18.2).
 *
 * Maps to backend schemas/alarm.py and routers/p3/alarms.py.
 * Distinct from the SCADA alarm lifecycle in scada.ts — these types cover
 * alarm rationalization metadata, EEMUA 191 KPIs, chattering, and flood events.
 */

// ── Alarm Entry ───────────────────────────────────────────────────────────────

export type AlarmPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlarmState = "ACTIVE" | "ACKNOWLEDGED" | "CLEARED" | "RETURN_TO_NORMAL";
export type RationalizationStatus = "RATIONALIZED" | "PENDING" | "SUPPRESSED" | "DELETED";

export interface AlarmResponse {
  id: string;                           // UUID
  tag: string;                          // e.g. "WTG-01.GGIO1.Alm.stVal"
  display_name: string;
  priority: AlarmPriority;
  source_device: string;
  state: AlarmState;
  shelved: boolean;
  shelved_until: string | null;         // ISO-8601 UTC
  shelve_reason: string;
  rationalization_status: RationalizationStatus;
  chattering_count: number;
  flood_suppressed: boolean;
  ack_by: string | null;
  ack_at: string | null;
  activated_at: string | null;
  cleared_at: string | null;
}

// ── Rationalization Detail ─────────────────────────────────────────────────────

export interface AlarmRationalizationDetail {
  id: string;
  tag: string;
  display_name: string;
  priority: AlarmPriority;
  cause: string;
  consequence: string;
  operator_action: string;
  rationalization_status: RationalizationStatus;
}

export interface RationalizationUpdateRequest {
  cause?: string;
  consequence?: string;
  operator_action?: string;
  priority?: AlarmPriority;
  rationalization_status?: RationalizationStatus;
}

// ── Shelving ──────────────────────────────────────────────────────────────────

export interface AlarmShelveRequest {
  operator_id: string;
  reason: string;
  duration_hours: number;
}

export interface AlarmUnshelveRequest {
  operator_id: string;
}

// ── EEMUA 191 KPIs ───────────────────────────────────────────────────────────

export interface AlarmRateDataPoint {
  interval_start_utc: string;
  alarm_count: number;
  rate_per_10_min: number;
  above_benchmark: boolean;          // EEMUA 191 benchmark: ≤1 alarm/10 min
}

export interface AlarmKPIResponse {
  window_hours: number;
  total_alarms_in_window: number;
  average_rate_per_10_min: number;
  peak_rate_per_10_min: number;
  standing_alarms: number;
  shelved_alarms: number;
  unacknowledged_alarms: number;
  pct_acknowledged_within_10min: number;
  chattering_alarm_count: number;
  flood_events_in_window: number;
  rationalized_pct: number;
  rate_benchmark_met: boolean;
  peak_benchmark_met: boolean;
  ack_benchmark_met: boolean;
  overall_grade: "GOOD" | "ACCEPTABLE" | "POOR" | "UNACCEPTABLE";
  alarm_rate_history: AlarmRateDataPoint[];
}

// ── Chattering ────────────────────────────────────────────────────────────────

export interface ChatteringAlarm {
  tag: string;
  display_name: string;
  source_device: string;
  priority: AlarmPriority;
  transition_count: number;
  window_minutes: number;
  recommendation: string;
}

export interface ChatteringResponse {
  window_minutes: number;
  chattering_alarms: ChatteringAlarm[];
  total_chattering_tags: number;
  threshold_transitions: number;    // Threshold used (e.g. 3 per minute)
}

// ── Flood Events ───────────────────────────────────────────────────────────────

export interface AlarmFloodEventResponse {
  id: string;                         // UUID
  start_utc: string;
  end_utc: string | null;
  duration_minutes: number | null;
  alarm_count: number;
  peak_rate_per_minute: number;
  suppressed_alarms: number;
  resolved: boolean;
}
