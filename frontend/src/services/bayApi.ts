/**
 * Bay Controller API — M01.
 * Maps to backend routers/p3/bays.py.
 * Endpoints: /api/v1/scada/bays/* and /api/v1/scada/interlocks/*
 */

import type {
  AllBaysResponse,
  BayStateResponse,
  InterlockStatusResponse,
  SwitchCommandRequest,
  CommandExecutionResponse,
  ValidateCommandRequest,
  CommandValidationResponse,
} from "../types/bay";

import { post, request } from "./apiClient";

const BASE = "/api/v1/scada";

/** Fetch all 8 OSS bays with current state. */
export function getAllBays(): Promise<AllBaysResponse> {
  return request(`${BASE}/bays`);
}

/** Fetch current state of a single bay by UUID. */
export function getBayState(bayId: string): Promise<BayStateResponse> {
  return request(`${BASE}/bays/${bayId}/state`);
}

/** Fetch interlock rule status for a bay. */
export function getBayInterlocks(bayId: string): Promise<InterlockStatusResponse> {
  return request(`${BASE}/bays/${bayId}/interlocks`);
}

/** Execute a switching command on a bay device (CB, DS, ES). */
export function executeBayCommand(
  bayId: string,
  cmd: SwitchCommandRequest,
): Promise<CommandExecutionResponse> {
  return post(`${BASE}/bays/${bayId}/command`, cmd);
}

/** Dry-run validation of a command without executing it. */
export function validateCommand(
  req: ValidateCommandRequest,
): Promise<CommandValidationResponse> {
  return post(`${BASE}/interlocks/validate`, req);
}
