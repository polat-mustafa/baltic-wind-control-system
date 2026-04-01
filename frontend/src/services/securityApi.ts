/**
 * Cybersecurity (IEC 62443) API — M07.
 * Maps to backend routers/p3/security.py.
 * Endpoints: /api/v1/scada/security/*
 * Target: IEC 62443-3-3 SL-2 for OT zones.
 */

import type {
  ZonesResponse,
  ConduitsResponse,
  AttackScenarioRequest,
  AttackSimulationResponse,
  SecurityEventsResponse,
  ComplianceSummaryResponse,
} from "../types/security";

import { post, request } from "./apiClient";

const BASE = "/api/v1/scada/security";

/** Fetch all Purdue Model security zones (levels 0-4). */
export function getZones(): Promise<ZonesResponse> {
  return request(`${BASE}/zones`);
}

/** Fetch all security conduits with firewall rules. */
export function getConduits(): Promise<ConduitsResponse> {
  return request(`${BASE}/conduits`);
}

/**
 * Simulate one of 5 attack scenarios (educational, no real effect).
 * Returns step-by-step narrative with detection and mitigating controls.
 */
export function simulateAttack(
  req: AttackScenarioRequest,
): Promise<AttackSimulationResponse> {
  return post(`${BASE}/simulate-attack`, req);
}

/** Fetch recent security events (replay attacks, brute force, etc.). */
export function getSecurityEvents(limit = 50): Promise<SecurityEventsResponse> {
  return request(`${BASE}/events?limit=${limit}`);
}

/** Fetch IEC 62443 compliance posture summary. */
export function getCompliance(): Promise<ComplianceSummaryResponse> {
  return request(`${BASE}/compliance`);
}
