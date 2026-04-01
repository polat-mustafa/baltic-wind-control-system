/**
 * Communication Network Architecture API — M15.
 * Maps to backend routers/p3/network.py.
 * Endpoints: /api/v1/scada/network/*
 * Standards: IEC 61850 performance classes P1/P2/P3, IEC 62351, IEC 61850-90-2.
 */

import type {
  NetworkTopologyResponse,
  OPCUANamespaceResponse,
  LatencyBudgetResponse,
} from "../types/network";

import { request } from "./apiClient";

const BASE = "/api/v1/scada/network";

/**
 * Fetch complete network topology.
 * 12 nodes (FIELD/STATION/WAN/CORPORATE layers) + 11 links.
 */
export function getTopology(): Promise<NetworkTopologyResponse> {
  return request(`${BASE}/topology`);
}

/**
 * Fetch OPC-UA namespace summary.
 * Server: urn:baltic-wind:scada, 185 nodes, Basic256Sha256/SignAndEncrypt.
 */
export function getOPCUANamespace(): Promise<OPCUANamespaceResponse> {
  return request(`${BASE}/opcua`);
}

/**
 * Fetch latency budget for a specific message path.
 * path: 0 = GOOSE (P3, 4 ms), 1 = measurement (P2, 100 ms), 2 = SCADA poll (P1, 1 s).
 */
export function getLatencyBudget(path: 0 | 1 | 2): Promise<LatencyBudgetResponse> {
  return request(`${BASE}/latency?path=${path}`);
}
