/**
 * Typed fetch wrapper for all P2 HV Grid API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p2.py.
 * Pattern follows windResourceApi.ts — Vite dev proxy forwards /api.
 */

import type {
  ConverterComparisonResult,
  FRTSimulationResult,
  FRTType,
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

export function runFRT(
  frtType: FRTType,
  faultBus: string = "OSS_66kV",
  faultImpedancePu: number = 0.05,
  faultDurationS: number = 0.15,
  generationFraction: number = 1.0,
): Promise<FRTSimulationResult> {
  return post(`${BASE}/frt/${frtType}`, {
    fault_bus: faultBus,
    fault_impedance_pu: faultImpedancePu,
    fault_duration_s: faultDurationS,
    generation_fraction: generationFraction,
  });
}

// ── Converter Comparison ──────────────────────────────────────

export function getConverterComparison(
  scenario: "strong_grid" | "weak_grid",
): Promise<ConverterComparisonResult> {
  return request(`${BASE}/converter-comparison/${scenario}`);
}
