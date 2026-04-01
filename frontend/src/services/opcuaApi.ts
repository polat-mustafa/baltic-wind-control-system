/**
 * OPC-UA Server API — M03.
 * Maps to backend routers (opcua endpoints in main.py / p3/opcua.py).
 * Endpoints: /api/v1/opcua/*
 *
 * Binary OPC-UA on opc.tcp://10.0.2.10:4840 — REST is supplementary.
 */

import type {
  OPCUAStatusResponse,
  OPCUAAddressSpaceResponse,
  OPCUASubscriptionRequest,
  OPCUASubscriptionResponse,
} from "../types/opcua";

import { post, request } from "./apiClient";

const BASE = "/api/v1/opcua";

/** Get OPC-UA server runtime status. */
export function getOPCUAStatus(): Promise<OPCUAStatusResponse> {
  return request(`${BASE}/status`);
}

/**
 * Get the full address space as a JSON tree.
 * Returns ~185 nodes for the Baltic Wind farm namespace.
 */
export function getAddressSpace(): Promise<OPCUAAddressSpaceResponse> {
  return request(`${BASE}/address-space`);
}

/**
 * Create a monitored item subscription for a list of node IDs.
 * Returns a subscription_id for client tracking.
 */
export function subscribe(
  req: OPCUASubscriptionRequest,
): Promise<OPCUASubscriptionResponse> {
  return post(`${BASE}/subscribe`, req);
}
