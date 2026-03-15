/**
 * TypeScript interfaces for Power Plant Controller (PPC) API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/ppc.py Pydantic schemas.
 */

// ── Enums (string literals matching backend StrEnum) ─────────────

export type PPCState =
  | "stopped"
  | "starting"
  | "available"
  | "running"
  | "derated"
  | "fault"
  | "emergency_stop";

export type ActivePowerMode =
  | "power_reference"
  | "delta_control"
  | "absolute_limitation"
  | "ramp_rate_control";

export type ReactivePowerMode =
  | "voltage_control"
  | "reactive_power"
  | "power_factor"
  | "q_v_droop";

// ── TSO Setpoint Command ─────────────────────────────────────────

export interface TSOSetpoint {
  active_power_mw?: number | null;
  reactive_power_mvar?: number | null;
  voltage_setpoint_pu?: number | null;
  power_factor?: number | null;
  delta_reserve_mw?: number | null;
  absolute_limit_mw?: number | null;
  ramp_rate_mw_per_min?: number | null;
  emergency_stop?: boolean;
}

// ── Per-Turbine Dispatch ─────────────────────────────────────────

export interface WTGDispatch {
  wtg_id: string;
  available_power_mw: number;
  dispatched_power_mw: number;
  dispatched_q_mvar: number;
  curtailment_mw: number;
  is_online: boolean;
}

// ── PPC Configuration ────────────────────────────────────────────

export interface PPCConfig {
  ramp_up_pct_per_min: number;
  ramp_down_pct_per_min: number;
  emergency_ramp_pct_per_s: number;
  setpoint_accuracy_pct: number;
  setpoint_deadband_mw: number;
  voltage_deadband_pu: number;
  voltage_kp: number;
  voltage_ki: number;
  q_v_droop_slope_mvar_per_pu: number;
  q_v_droop_deadband_pu: number;
  frequency_deadband_hz: number;
  droop_pct: number;
  heartbeat_interval_s: number;
  tso_timeout_s: number;
}

// ── PPC Simulation Request ───────────────────────────────────────

export interface PPCSimulationRequest {
  tso_setpoint: TSOSetpoint;
  active_power_mode: ActivePowerMode;
  reactive_power_mode: ReactivePowerMode;
  wind_speed_ms: number;
  available_turbines: number;
  initial_power_mw: number;
  simulation_duration_s: number;
  time_step_s: number;
  config?: PPCConfig;
}

// ── PPC Time-Series Output ───────────────────────────────────────

export interface PPCTimePoint {
  time_s: number;
  power_setpoint_mw: number;
  power_actual_mw: number;
  available_power_mw: number;
  curtailment_mw: number;
  ramp_rate_mw_per_min: number;
  q_setpoint_mvar: number;
  q_actual_mvar: number;
  voltage_pcc_pu: number;
  frequency_hz: number;
  ppc_state: PPCState;
}

// ── PPC Simulation Response ──────────────────────────────────────

export interface PPCSimulationResponse {
  active_power_mode: ActivePowerMode;
  reactive_power_mode: ReactivePowerMode;
  ppc_state: PPCState;
  tso_power_setpoint_mw: number;
  tso_q_or_v_setpoint: number;
  final_power_mw: number;
  final_q_mvar: number;
  final_voltage_pu: number;
  total_available_mw: number;
  total_curtailment_mw: number;
  ramp_time_s: number;
  setpoint_accuracy_compliant: boolean;
  ramp_rate_compliant: boolean;
  voltage_compliant: boolean;
  overall_compliant: boolean;
  wtg_dispatch: WTGDispatch[];
  time_series: PPCTimePoint[];
}

// ── PPC Status (real-time snapshot) ──────────────────────────────

export interface PPCStatusResponse {
  ppc_state: PPCState;
  active_power_mode: ActivePowerMode;
  reactive_power_mode: ReactivePowerMode;
  power_setpoint_mw: number;
  power_actual_mw: number;
  available_power_mw: number;
  curtailment_mw: number;
  ramp_rate_mw_per_min: number;
  q_setpoint_mvar: number;
  q_actual_mvar: number;
  voltage_setpoint_pu: number;
  voltage_actual_pu: number;
  frequency_hz: number;
  frequency_response_active: boolean;
  frequency_delta_p_mw: number;
  turbines_online: number;
  turbines_total: number;
  statcom_q_mvar: number;
  tso_comm_ok: boolean;
  wtg_comm_ok: boolean;
  last_tso_command_age_s: number;
}
