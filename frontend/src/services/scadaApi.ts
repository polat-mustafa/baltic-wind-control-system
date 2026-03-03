/**
 * Typed fetch wrapper for all P3 SCADA & IEC 61850 API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p3.py.
 * Pattern follows gridApi.ts — Vite dev proxy forwards /api.
 */

import type {
  FaultScenarioSummary,
  FaultSimulationResult,
  IEC62443Zone,
  PermitDetail,
  PermitList,
  PermissionCheckResult,
  RetransmissionResult,
  RoleDefinition,
  SubstationSummary,
  TransitionResult,
} from "../types/scada";

import { post, request } from "./apiClient";

const BASE = "/api/v1/scada";

// ── GOOSE Fault Simulation ────────────────────────────────────

export function listFaultScenarios(): Promise<FaultScenarioSummary[]> {
  return request(`${BASE}/goose/scenarios`);
}

export function runFaultSimulation(
  faultType: string,
): Promise<FaultSimulationResult> {
  return post(`${BASE}/goose/simulate`, { fault_type: faultType });
}

export function calculateRetransmission(
  minTimeMs: number = 2,
  maxTimeMs: number = 1000,
  numRetransmissions: number = 10,
): Promise<RetransmissionResult> {
  return post(`${BASE}/goose/retransmission`, {
    min_time_ms: minTimeMs,
    max_time_ms: maxTimeMs,
    num_retransmissions: numRetransmissions,
  });
}

// ── Device Registry ───────────────────────────────────────────

export function getSubstationSummary(): Promise<SubstationSummary> {
  return request(`${BASE}/devices`);
}

export function getDeviceDetail(
  deviceName: string,
): Promise<SubstationSummary["devices"][number]> {
  return request(`${BASE}/devices/${encodeURIComponent(deviceName)}`);
}

// ── RBAC — IEC 62443 ─────────────────────────────────────────

export function listRoles(): Promise<RoleDefinition[]> {
  return request(`${BASE}/rbac/roles`);
}

export function checkPermission(
  roleLevel: number,
  permission: string,
): Promise<PermissionCheckResult> {
  return post(`${BASE}/rbac/check`, {
    role_level: roleLevel,
    permission,
  });
}

export function listZones(): Promise<IEC62443Zone[]> {
  return request(`${BASE}/rbac/zones`);
}

// ── Permit-to-Work ────────────────────────────────────────────

export function createPermit(params: {
  work_description: string;
  equipment_id: string;
  requested_by: string;
  person_in_charge?: string;
}): Promise<PermitDetail> {
  return post(`${BASE}/permits/`, params);
}

export function listPermits(filters?: {
  status?: string;
  equipment_id?: string;
}): Promise<PermitList> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.equipment_id)
    params.set("equipment_id", filters.equipment_id);
  const qs = params.toString();
  return request(`${BASE}/permits/${qs ? `?${qs}` : ""}`);
}

export function getPermitDetail(ptwNumber: string): Promise<PermitDetail> {
  return request(`${BASE}/permits/${encodeURIComponent(ptwNumber)}`);
}

export function transitionPermit(
  ptwNumber: string,
  params: {
    target_status: string;
    performed_by: string;
    user_level: number;
    notes?: string;
  },
): Promise<TransitionResult> {
  return post(
    `${BASE}/permits/${encodeURIComponent(ptwNumber)}/transition`,
    params,
  );
}

export function extendPermit(
  ptwNumber: string,
  params: {
    performed_by: string;
    user_level: number;
    extension_hours?: number;
    notes?: string;
  },
): Promise<TransitionResult> {
  return post(
    `${BASE}/permits/${encodeURIComponent(ptwNumber)}/extend`,
    params,
  );
}
