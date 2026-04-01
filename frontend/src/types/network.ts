/**
 * TypeScript types for M15 — Communication Network Architecture.
 *
 * Covers OT network topology (IEC 62351, IEC 61850-90-2),
 * latency budgets per IEC 61850 performance classes,
 * and OPC-UA namespace structure.
 */

export type NetworkLayer = "FIELD" | "STATION" | "WAN" | "CORPORATE";
export type LinkType = "FIBRE_OPTIC" | "MPLS" | "MICROWAVE" | "ETHERNET";

export interface NetworkNode {
  node_id: string;
  name: string;
  layer: NetworkLayer;
  protocol: string;
  redundant: boolean;
  ip_subnet: string;
}

export interface NetworkLink {
  link_id: string;
  from_node: string;
  to_node: string;
  link_type: LinkType;
  bandwidth_mbps: number;
  latency_ms: number;
  redundant: boolean;
  encryption: boolean;
}

export interface NetworkTopologyResponse {
  nodes: NetworkNode[];
  links: NetworkLink[];
  node_count: number;
  link_count: number;
  assessment: string;
}

export interface OPCUANodeDetail {
  node_id: string;
  browse_name: string;
  data_type: string;
  description: string;
  update_interval_ms: number;
  turbine_id: string | null;
}

export interface OPCUANamespaceResponse {
  server_url: string;
  security_policy: string;
  namespace_uri: string;
  node_count: number;
  nodes: OPCUANodeDetail[];
  performance_class: string;
}

export interface LatencyBudgetResponse {
  path_description: string;
  performance_class: string;
  required_latency_ms: number;
  budget_breakdown: Record<string, number>;
  total_latency_ms: number;
  margin_ms: number;
  compliant: boolean;
}
