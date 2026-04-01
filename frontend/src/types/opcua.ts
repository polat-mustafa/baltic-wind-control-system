/**
 * OPC-UA Server types — M03.
 *
 * Maps to backend schemas/opcua.py.
 * OPC-UA binary on port 4840 (opc.tcp://10.0.2.10:4840).
 * REST endpoints supplement the binary protocol for status/control.
 * Security: Basic256Sha256 / SignAndEncrypt.
 */

// ── Address Space ─────────────────────────────────────────────────────────────

/** Recursive OPC-UA node in the address space tree. */
export interface OPCUANodeInfo {
  node_id: string;                // e.g. "ns=2;s=WTG-01.ActivePower"
  browse_name: string;
  node_class: "Variable" | "Object" | "Method" | "DataType";
  data_type: string | null;       // e.g. "Double", "Boolean", "String"
  value: unknown | null;          // Current value for Variable nodes
  children: OPCUANodeInfo[];
}

// ── Status ────────────────────────────────────────────────────────────────────

export interface OPCUAStatusResponse {
  running: boolean;
  endpoint: string;               // e.g. "opc.tcp://10.0.2.10:4840"
  connected_clients: number;
  node_count: number;
  started_at: string | null;      // ISO-8601 UTC
  last_update: string | null;
}

// ── Address Space (top-level) ─────────────────────────────────────────────────

export interface OPCUAAddressSpaceResponse {
  endpoint: string;
  root_nodes: OPCUANodeInfo[];
  total_nodes: number;
}

// ── Subscription ──────────────────────────────────────────────────────────────

export interface OPCUASubscriptionRequest {
  node_ids: string[];
  publishing_interval_ms: number;
  queue_size: number;
}

export interface OPCUASubscriptionResponse {
  subscription_id: string;
}
