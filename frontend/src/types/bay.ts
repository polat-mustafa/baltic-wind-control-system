/**
 * Bay Controller types — M01 Interlock Engine & Bay Controller.
 *
 * Maps to backend schemas/bay.py and routers/p3/bays.py.
 * IEC 61850 bay control: circuit breaker, disconnectors, earth switch.
 * 7 interlock rules (ILK-001..ILK-007) enforced server-side.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type BayType =
  | "FEEDER"
  | "BUSBAR"
  | "TIE"
  | "TRANSFORMER"
  | "MEASUREMENT"
  | "AUXILIARY";

export type BayMode = "NORMAL" | "LOCAL" | "REMOTE" | "ISOLATED" | "TEST";

export type SwitchPosition =
  | "OPEN"
  | "CLOSED"
  | "INTERMEDIATE"
  | "UNKNOWN";

export type SwitchCommand = "OPEN" | "CLOSE";

export type RelayState = "NORMAL" | "PICKUP" | "TRIP" | "LOCKOUT" | "ALARM";

// ── Synchrocheck ──────────────────────────────────────────────────────────────

export interface SynchroCheck {
  delta_voltage_percent: number;
  delta_frequency_hz: number;
  delta_phase_deg: number;
  is_in_sync: boolean;
}

// ── Bay State ─────────────────────────────────────────────────────────────────

export interface BayStateResponse {
  bay_id: string;              // UUID
  name: string;                // e.g. "BAY-01"
  display_name: string;        // e.g. "WTG Array Feeder 1"
  voltage_kv: number;          // Nominal voltage level (66 or 220 kV)
  bay_type: BayType;
  bay_mode: BayMode;
  circuit_breaker: SwitchPosition;
  disconnector_bus: SwitchPosition;
  disconnector_line: SwitchPosition;
  earth_switch: SwitchPosition;
  protection_relay: RelayState;
  manual_isolation_active: boolean;
  is_tie_cb: boolean;
  synchrocheck: SynchroCheck | null;
  last_updated: string;        // ISO-8601 UTC
}

export interface AllBaysResponse {
  bays: BayStateResponse[];
  total: number;
  energised_count: number;
  earthed_count: number;
  alarm_count: number;
}

// ── Commands ──────────────────────────────────────────────────────────────────

export interface SwitchCommandRequest {
  equipment_id: string;
  action: SwitchCommand;
  operator_id: string;
  is_auto_reclose: boolean;
  synchrocheck: SynchroCheck | null;
}

export interface CommandExecutionResponse {
  success: boolean;
  equipment_id: string;
  action: SwitchCommand;
  previous_state: SwitchPosition;
  new_state: SwitchPosition;
  message: string;
  timestamp: string;           // ISO-8601 UTC
  soe_event_id: number | null;
}

// ── Interlocks ────────────────────────────────────────────────────────────────

export interface InterlockRuleStatus {
  interlock_id: string;        // e.g. "ILK-001"
  description: string;
  currently_active: boolean;   // true = this rule is blocking
  blocking_equipment: string | null;
  blocking_state: string | null;
}

export interface InterlockStatusResponse {
  bay_id: string;
  bay_name: string;
  rules: InterlockRuleStatus[];
  all_clear: boolean;
}

// ── Validation (dry-run) ──────────────────────────────────────────────────────

export interface ValidateCommandRequest {
  bay_id: string;
  equipment_id: string;
  action: SwitchCommand;
  operator_id: string;
  is_auto_reclose: boolean;
  synchrocheck: SynchroCheck | null;
}

export interface CommandValidationResponse {
  allowed: boolean;
  blocked_by: string[];        // interlock IDs blocking the command
  reasons: string[];           // human-readable reasons
  equipment_id: string;
  action: SwitchCommand;
}
