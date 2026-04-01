/**
 * Sequence of Events (SOE) Recorder types — M02.
 *
 * Maps to backend schemas/soe.py and routers/p3/soe.py.
 * TimescaleDB hypertable — ms-precision timestamping per IEC 61850.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type SOESeverity = "INFO" | "WARNING" | "ALARM" | "CRITICAL";

export type SOEEventType =
  | "BREAKER_OPERATION"
  | "DISCONNECTOR_OPERATION"
  | "EARTH_SWITCH_OPERATION"
  | "RELAY_TRIP"
  | "RELAY_PICKUP"
  | "RELAY_RESET"
  | "ALARM_RAISED"
  | "ALARM_ACKNOWLEDGED"
  | "ALARM_CLEARED"
  | "SETPOINT_CHANGE"
  | "MODE_CHANGE"
  | "OPERATOR_ACTION"
  | "AUTO_RECLOSE"
  | "INTERLOCK_BLOCK"
  | "SYSTEM_EVENT";

// ── Event ─────────────────────────────────────────────────────────────────────

export interface SOEEventResponse {
  id: number;
  timestamp_utc: string;          // ISO-8601 with ms precision
  event_type: SOEEventType;
  source_device: string;
  description: string;
  value_before: string | null;
  value_after: string | null;
  operator_id: string | null;
  severity: SOESeverity;
  acknowledged: boolean;
  ack_by: string | null;
  ack_at: string | null;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export interface SOEQueryParams {
  start_utc?: string;
  end_utc?: string;
  event_types?: SOEEventType[];
  source_devices?: string[];
  severities?: SOESeverity[];
  unacknowledged_only?: boolean;
  limit?: number;
}

export interface SOEQueryResponse {
  events: SOEEventResponse[];
  total_returned: number;
  has_more: boolean;
  oldest_timestamp: string | null;
  newest_timestamp: string | null;
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export interface SOEEventTypeCount {
  label: string;
  count: number;
}

export interface SOEStatsResponse {
  window_hours: number;
  total_events: number;
  by_type: SOEEventTypeCount[];
  by_severity: SOEEventTypeCount[];
  unacknowledged_count: number;
  events_per_hour: number;
  most_active_device: string | null;
}

// ── Acknowledge ───────────────────────────────────────────────────────────────

export interface SOEAckRequest {
  operator_id: string;
}
