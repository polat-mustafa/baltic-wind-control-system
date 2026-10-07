/**
 * Typed fetch wrapper for all P2 HV Grid API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p2.py.
 * Pattern follows windResourceApi.ts — Vite dev proxy forwards /api.
 */

import type {
  ConverterComparisonResult,
  FRTParams,
  FRTSimulationResult,
  FRTType,
  GridStrength,
  LoadFlowResult,
  LoadFlowScenario,
  NetworkSpec,
  ShortCircuitResult,
  STATCOMSizingResult,
} from "../types/grid";

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid";

// ── Network Spec ──────────────────────────────────────────────

export function getNetworkSpec(): Promise<NetworkSpec> {
  return request(`${BASE}/network-spec`);
}

// ── Load Flow ─────────────────────────────────────────────────

export function runLoadFlow(
  scenario: LoadFlowScenario,
): Promise<LoadFlowResult> {
  return request(`${BASE}/load-flow/${scenario}`);
}

export function runLoadFlowAll(): Promise<LoadFlowResult[]> {
  return request(`${BASE}/load-flow-all`);
}

/** Grid solution for the live farm operating point (34 WTG powers, MW). */
export interface LiveLoadFlow {
  converged: boolean;
  total_generation_mw: number;
  poc_p_mw: number;
  poc_q_mvar: number;
  total_loss_mw: number;
  statcom_q_mvar: number;
  /** Shunt reactors in service after the backend's reactor switching. */
  reactors_in_service: number;
  v_poc_pu: number;
  v_onshore_220_pu: number;
  v_oss_220_pu: number;
  v_oss_66_pu: number;
  export_cable_loading_pct: number;
  max_array_cable_loading_pct: number;
  oss_trafo_loading_pct: number;
  onshore_trafo_loading_pct: number;
  voltage_compliant: boolean;
}

export function runLiveLoadFlow(wtgPowerMW: number[]): Promise<LiveLoadFlow> {
  return post(`${BASE}/live-load-flow`, { wtg_p_mw: wtgPowerMW });
}

// ── Short-Circuit ─────────────────────────────────────────────

export function calcShortCircuit(
  scCase: "max" | "min",
): Promise<ShortCircuitResult> {
  return request(`${BASE}/short-circuit/${scCase}`);
}

// ── STATCOM Sizing ────────────────────────────────────────────

export function getSTATCOMSizing(): Promise<STATCOMSizingResult> {
  return request(`${BASE}/statcom-sizing`);
}

// ── FRT Simulation ────────────────────────────────────────────

export function runFRT(frtType: FRTType, params: FRTParams): Promise<FRTSimulationResult> {
  return post(`${BASE}/frt/${frtType}`, {
    fault_bus: params.faultBus,
    fault_impedance_pu: params.faultImpedancePu,
    fault_duration_s: params.faultDurationS,
    k_factor: params.kFactor,
  });
}

// ── Converter Comparison ──────────────────────────────────────

export function getConverterComparison(
  scenario: GridStrength,
  phaseJumpDeg = 20,
): Promise<ConverterComparisonResult> {
  return request(`${BASE}/converter-comparison/${scenario}?phase_jump_deg=${phaseJumpDeg}`);
}
