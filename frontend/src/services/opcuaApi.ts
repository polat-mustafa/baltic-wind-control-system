/**
 * OPC-UA Server API — M03.
 * Maps to backend routers (opcua endpoints in main.py / p3/opcua.py).
 * Endpoints: /api/v1/scada/opcua/*
 *
 * Binary OPC-UA on opc.tcp://10.0.2.10:4840 — REST is supplementary.
 */

import type {
  OPCUAStatusResponse,
  OPCUAAddressSpaceResponse,
} from "../types/opcua";

import { request } from "./apiClient";

const BASE = "/api/v1/scada/opcua";

/** Get OPC-UA server runtime status. */
export function getOPCUAStatus(): Promise<OPCUAStatusResponse> {
  return request(`${BASE}/status`);
}

/**
 * Get the full address space as a JSON tree.
 */
export function getAddressSpace(): Promise<OPCUAAddressSpaceResponse> {
  return request(`${BASE}/address-space`);
}

