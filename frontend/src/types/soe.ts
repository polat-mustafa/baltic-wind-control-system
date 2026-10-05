/**
 * Sequence of Events (SOE) Recorder types — M02.
 *
 * Maps to backend schemas/soe.py and routers/p3/soe.py.
 * TimescaleDB hypertable — ms-precision timestamping per IEC 61850.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

/** Backend VALID_SEVERITIES (services/p3/soe_recorder.py). */
export type SOESeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

/** Backend VALID_EVENT_TYPES (services/p3/soe_recorder.py). */
export type SOEEventType =
  | "PROTECTION_TRIP"
  | "CB_OPERATION"
  | "ALARM_RAISED"
  | "ALARM_CLEARED"
  | "ALARM_ACKED"
  | "OPERATOR_COMMAND"
  | "INTERLOCK_BLOCK"
  | "STATE_CHANGE"
  | "COMMS_LOSS"
  | "COMMS_RESTORE";

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
