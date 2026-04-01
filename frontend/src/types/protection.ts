/**
 * TypeScript interfaces for Protection Relay Coordination API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/protection.py Pydantic schemas.
 * Standards: IEC 60255 (relay characteristics), IEC 60909 (fault currents).
 */

// ── Relay Definition ──────────────────────────────────────────────

export interface ProtectionRelaySchema {
  id: string;
  setting_id: string;
  relay_type: string;
  location: string;
  manufacturer: string;
  model: string;
  pickup_value: number;
  pickup_unit: string;
  time_delay_s: number;
  tms: number;
  curve_type: string;
  enabled: boolean;
  standard_ref: string;
  description: string;
}

export interface RelaySettingsUpdate {
  pickup_value?: number | null;
  time_delay_s?: number | null;
  tms?: number | null;
  curve_type?: string | null;
  enabled?: boolean | null;
}

// ── TCC Curves ────────────────────────────────────────────────────

export interface TCCCurvePoint {
  current_multiple: number;
  operating_time_s: number;
}

export interface TCCCurveSeries {
  relay_id: string;
  relay_location: string;
  curve_type: string;
  pickup_value: number;
  pickup_unit: string;
  tms: number;
  time_delay_s: number;
  points: TCCCurvePoint[];
  color_hint: string;
}

export interface FaultMarker {
  current_ka: number;
  fault_label: string;
}

export interface TCCPlotData {
  study_id: string;
  curves: TCCCurveSeries[];
  fault_markers: FaultMarker[];
}

// ── Relay Sequence (per fault) ────────────────────────────────────

export interface RelaySequenceEntry {
  relay_id: string;
  relay_location: string;
  trip_time_ms: number;
  fault_current_multiple: number;
  operated: boolean;
}

// ── Grading Results ───────────────────────────────────────────────

export interface GradingResult {
  pair_id: string;
  downstream_id: string;
  upstream_id: string;
  downstream_delay_s: number;
  upstream_delay_s: number;
  actual_margin_ms: number;
  required_margin_ms: number;
  selective: boolean;
}

// ── Coordination Study Request ────────────────────────────────────

export interface CoordinationStudyRequest {
  fault_location: string;
  fault_current_ka: number;
  include_tcc_data: boolean;
}

// ── Coordination Study Response ───────────────────────────────────

export interface CoordinationStudyResponse {
  study_id: string;
  fault_location: string;
  fault_current_ka: number;
  fault_current_description: string;
  relay_sequence: RelaySequenceEntry[];
  first_relay: string;
  first_relay_time_ms: number;
  fully_graded: boolean;
  grading_results: GradingResult[];
  grading_violations: number;
  tcc_data: TCCPlotData | null;
  assessment: string;
  created_at: string;
}

// ── Fault Clearance ───────────────────────────────────────────────

export interface FaultClearanceRequest {
  fault_type: string;
  fault_location: string;
  fault_impedance_ohm: number;
}

export interface FaultClearanceResponse {
  fault_type: string;
  fault_location: string;
  fault_impedance_ohm: number;
  fault_current_ka: number;
  first_relay_time_ms: number;
  cb_open_time_ms: number;
  arc_extinction_time_ms: number;
  total_clearance_time_ms: number;
  compliant: boolean;
  requirement_ms: number;
  relay_sequence: RelaySequenceEntry[];
  assessment: string;
}
