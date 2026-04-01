/**
 * Sequence of Events (SOE) Recorder API — M02.
 * Maps to backend routers/p3/soe.py.
 * Endpoints: /api/v1/scada/soe/*
 */

import type {
  SOEQueryParams,
  SOEQueryResponse,
  SOEStatsResponse,
  SOEEventResponse,
  SOEAckRequest,
} from "../types/soe";

import { post, request } from "./apiClient";

const BASE = "/api/v1/scada/soe";

/**
 * Query the SOE log with optional filters.
 * Defaults to last 100 events if no params provided.
 */
export function querySOE(params: SOEQueryParams = {}): Promise<SOEQueryResponse> {
  const qs = new URLSearchParams();
  if (params.start_utc) qs.set("start_utc", params.start_utc);
  if (params.end_utc) qs.set("end_utc", params.end_utc);
  if (params.unacknowledged_only) qs.set("unacknowledged_only", "true");
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.event_types?.length) qs.set("event_types", params.event_types.join(","));
  if (params.source_devices?.length) qs.set("source_devices", params.source_devices.join(","));
  if (params.severities?.length) qs.set("severities", params.severities.join(","));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`${BASE}${suffix}`);
}

/** Fetch SOE statistics for the last N hours. */
export function getSOEStats(windowHours = 24): Promise<SOEStatsResponse> {
  return request(`${BASE}/stats?window_hours=${windowHours}`);
}

/** Acknowledge a single SOE event. */
export function acknowledgeSOEEvent(
  eventId: number,
  req: SOEAckRequest,
): Promise<SOEEventResponse> {
  return post(`${BASE}/${eventId}/acknowledge`, req);
}

/**
 * Returns a CSV export URL (navigate to it or use window.open).
 * Backend streams the CSV directly.
 */
export function getSOEExportUrl(startUtc: string, endUtc: string): string {
  return `${BASE}/export?start_utc=${encodeURIComponent(startUtc)}&end_utc=${encodeURIComponent(endUtc)}`;
}
