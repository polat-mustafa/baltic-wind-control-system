/**
 * Protection Relay Coordination API — M05.
 * Maps to backend routers/p2_protection.py.
 * Endpoints: /api/v1/grid/protection/*
 * Standards: IEC 60255, IEC 60909.
 */

import type {
  ProtectionRelaySchema,
  RelaySettingsUpdate,
  CoordinationStudyRequest,
  CoordinationStudyResponse,
  FaultClearanceRequest,
  FaultClearanceResponse,
  TCCPlotData,
} from "../types/protection";

import { post, request } from "./apiClient";

const BASE = "/api/v1/grid/protection";

/** Fetch all protection relay configurations. */
export function getRelays(): Promise<ProtectionRelaySchema[]> {
  return request(`${BASE}/relays`);
}

/** Update settings for a specific relay (by setting_id). */
export function updateRelaySettings(
  settingId: string,
  update: RelaySettingsUpdate,
): Promise<ProtectionRelaySchema> {
  return post(`${BASE}/relays/${settingId}/settings`, update);
}

/**
 * Run a TCC coordination study at a given fault location and current.
 * Returns relay trip sequence, grading pairs, and optional TCC curve data.
 */
export function runCoordinationStudy(
  req: CoordinationStudyRequest,
): Promise<CoordinationStudyResponse> {
  return post(`${BASE}/coordination-study`, req);
}

/**
 * Simulate fault clearance timing for a specific fault type.
 * Returns relay sequence, CB open time, total clearance time.
 */
export function runFaultClearance(
  req: FaultClearanceRequest,
): Promise<FaultClearanceResponse> {
  return post(`${BASE}/fault-clearance`, req);
}

/** Fetch TCC curve data for all relays (for overlay plot). */
export function getTCCData(): Promise<TCCPlotData> {
  return request(`${BASE}/tcc`);
}
