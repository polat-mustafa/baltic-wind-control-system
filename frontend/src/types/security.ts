/**
 * Cybersecurity (IEC 62443) types — M07.
 *
 * Maps to backend schemas/security.py and routers/p3/security.py.
 * IEC 62443-3-3 SL-2 target for OT zones (Purdue Model levels 0-4).
 * 5 attack scenarios, compliance checklist.
 */

// ── Zone & Conduit ────────────────────────────────────────────────────────────

export interface SecurityZoneResponse {
  id: string;                       // UUID
  name: string;                     // e.g. "Field Device Zone"
  level: number;                    // Purdue level 0-4
  description: string;
  security_level_target: string;    // e.g. "SL-2"
  color: string;                    // Hex color for visualization
  device_count: number;
}

export interface ZonesResponse {
  zones: SecurityZoneResponse[];
  ot_it_boundary: string;           // Description of OT/IT demarcation
  total_zones: number;
}

export interface FirewallRule {
  rule_id: string;
  action: "ALLOW" | "DENY";
  protocol: string;                 // e.g. "IEC61850-GOOSE", "OPC-UA"
  source_port: string | null;
  dest_port: string | null;
  description: string;
}

export interface SecurityConduitResponse {
  id: string;                       // UUID
  name: string;
  source_zone: string;
  dest_zone: string;
  allowed_protocols: string[];
  encryption: boolean;
  bidirectional: boolean;
  criticality: "HIGH" | "MEDIUM" | "LOW";
  firewall_rules: FirewallRule[];
}

export interface ConduitsResponse {
  conduits: SecurityConduitResponse[];
  total_conduits: number;
  unencrypted_count: number;
}

// ── Attack Simulation ─────────────────────────────────────────────────────────

export type AttackScenarioId =
  | "REPLAY_ATTACK"
  | "MITM_GOOSE"
  | "CREDENTIAL_BRUTE_FORCE"
  | "ROGUE_DEVICE"
  | "RANSOMWARE_IT_LATERAL";

export interface AttackScenarioRequest {
  scenario_id: AttackScenarioId;
  target_zone: string;
}

export interface AttackStepResult {
  step: number;
  action: string;
  result: string;
  detected: boolean;
  mitigating_control: string;
}

export interface AttackSimulationResponse {
  scenario_id: AttackScenarioId;
  scenario_name: string;
  attack_vector: string;
  targeted_zone: string;
  steps: AttackStepResult[];
  overall_blocked: boolean;
  lessons_learned: string[];
  iec62443_references: string[];
  events_generated: number;
}

// ── Security Events ────────────────────────────────────────────────────────────

export interface SecurityEventResponse {
  id: number;
  timestamp_utc: string;
  event_type: string;
  source_zone: string;
  source_ip: string;
  target_zone: string | null;
  description: string;
  blocked: boolean;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  scenario_id: string | null;
}

export interface SecurityEventsResponse {
  events: SecurityEventResponse[];
  total: number;
  critical_count: number;
  unblocked_count: number;
}

// ── Compliance ─────────────────────────────────────────────────────────────────

export interface ComplianceCheckResponse {
  requirement_id: string;           // e.g. "SR-1.7"
  security_level: string;           // "SL-1" | "SL-2" | "SL-3"
  category: string;
  description: string;
  compliant: boolean;
  evidence: string | null;
  risk_score: number;               // 0-10
}

export interface ComplianceSummaryResponse {
  standard: string;                 // "IEC 62443-3-3"
  sl1_score_pct: number;
  sl2_score_pct: number;
  sl3_score_pct: number;
  target_sl: string;
  checks: ComplianceCheckResponse[];
  open_gaps: number;
  critical_gaps: string[];
  overall_assessment: string;
}
