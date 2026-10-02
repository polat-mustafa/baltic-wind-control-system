/**
 * Protection scheme & coordination — API types.
 *
 * Source of truth: backend/app/schemas/protection.py.
 * Standards: IEC 60255 (relays), IEC 60909 (fault currents), IEC 62271-100 (breakers).
 */

export interface ProtectionRelaySchema {
  id: string;
  setting_id: string;
  /** IEC 61850 LN class: PTOC / PDIS / PDIF / PTOV / PTUV / PTOF / PTUF. */
  relay_type: string;
  location: string;
  manufacturer: string;
  model: string;
  pickup_value: number;
  pickup_unit: string;
  /** Definite time [s]; 0 for IDMT stages. */
  time_delay_s: number;
  /** CT primary [A] for × In pickups (0 if not current-based). */
  ct_primary_a: number;
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

export interface TCCCurvePoint {
  /** Primary current at 66 kV [kA]. */
  current_ka: number;
  current_multiple: number;
  operating_time_s: number;
}

export interface TCCCurveSeries {
  relay_id: string;
  relay_location: string;
  curve_type: string;
  pickup_value: number;
  pickup_unit: string;
  pickup_ka: number;
  tms: number;
  time_delay_s: number;
  points: TCCCurvePoint[];
}

export interface FaultMarker {
  current_ka: number;
  label: string;
}

export interface TCCPlotData {
  study_id: string;
  curves: TCCCurveSeries[];
  fault_markers: FaultMarker[];
}

export interface RelaySequenceEntry {
  relay_id: string;
  relay_location: string;
  /** "main" | "main 2" | "backup" for this fault. */
  role: string;
  trip_time_ms: number;
  /** Trip + 60 ms CB break time. */
  clearance_time_ms: number;
  fault_current_multiple: number;
  operated: boolean;
}

export interface GradingResult {
  pair_id: string;
  downstream_id: string;
  upstream_id: string;
  /** Operating time at the worst-case fault current [s]. */
  downstream_delay_s: number;
  upstream_delay_s: number;
  actual_margin_ms: number;
  required_margin_ms: number;
  selective: boolean;
}

export type FaultLocation = "string_feeder" | "oss_busbar_66kv" | "export_cable" | "oss_busbar_220kv";

export interface CoordinationStudyRequest {
  fault_location: FaultLocation;
  /** Override; null = IEC 60909 / impedance chain. */
  fault_current_ka?: number | null;
  /** Export cable: % from the onshore end. */
  position_pct?: number | null;
  fault_type?: "3ph" | "ph_ph";
  include_tcc_data: boolean;
}

export interface CoordinationStudyResponse {
  study_id: string;
  fault_location: FaultLocation;
  fault_current_ka: number;
  fault_current_description: string;
  relay_sequence: RelaySequenceEntry[];
  first_relay: string;
  first_relay_time_ms: number;
  main_relay: string;
  main_clearance_ms: number;
  backup_margin_ms: number | null;
  position_pct: number | null;
  fault_type: string;
  voltage_kv: number;
  selective: boolean;
  fast_enough: boolean;
  time_limit_s: number;
  time_criterion: string;
  fully_graded: boolean;
  grading_results: GradingResult[];
  grading_violations: number;
  tcc_data: TCCPlotData | null;
  assessment: string;
  created_at: string;
}

export interface FaultClearanceRequest {
  fault_type: "3ph" | "ph_ph";
  fault_location: FaultLocation;
  fault_impedance_ohm: number;
  position_pct?: number | null;
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
