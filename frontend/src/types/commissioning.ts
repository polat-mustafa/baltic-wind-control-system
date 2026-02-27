/**
 * TypeScript interfaces mirroring backend Pydantic schemas.
 *
 * All field names use snake_case to match the API JSON directly — no
 * transform layer needed. This simplifies debugging: the shape you see
 * in DevTools is the shape you use in code.
 *
 * Source of truth: backend/app/schemas/commissioning.py
 */

// ── Enums (string unions matching backend StrEnum values) ──────

export type EquipmentType =
  | "circuit_breaker"
  | "disconnector"
  | "earth_switch"
  | "transformer";

export type EquipmentStateValue =
  | "open"
  | "closed"
  | "earthed"
  | "racked_in"
  | "racked_out";

export type ProgrammeStatus =
  | "created"
  | "approved"
  | "in_progress"
  | "hold"
  | "completed"
  | "aborted";

export type StepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "hold_point";

export type StepType =
  | "check"
  | "switching"
  | "verification"
  | "hold_point"
  | "communication";

export type LOTOStatus = "not_applied" | "applied" | "removed";

export type TestVerdict = "pass" | "fail" | "not_tested" | "conditional_pass";

export type CampaignStatus = "in_progress" | "completed" | "approved";

export type PiCDecision = "go" | "nogo";

// ── Equipment Schemas ──────────────────────────────────────────

export interface EquipmentState {
  equipment_id: string;
  equipment_type: EquipmentType;
  voltage_kv: number;
  location: string;
  state: EquipmentStateValue;
}

export interface InterlockViolation {
  interlock_id: string;
  description: string;
  blocking_equipment: string;
  blocking_state: string;
}

// ── Programme Schemas ──────────────────────────────────────────

export interface Step {
  step_id: string;
  step_number: number;
  phase: number;
  step_type: StepType;
  action: string;
  equipment_id: string;
  responsible: string;
  pic_confirmation: boolean;
  verification: string;
  notes: string;
  status: StepStatus;
  executed_at: string | null;
  executed_by: string;
}

export interface ProgrammeSummary {
  programme_id: string;
  title: string;
  pic_name: string;
  status: ProgrammeStatus;
  total_steps: number;
  completed_steps: number;
  current_step_index: number;
  created_at: string;
}

export interface ProgrammeDetail {
  programme_id: string;
  title: string;
  pic_name: string;
  status: ProgrammeStatus;
  steps: Step[];
  current_step_index: number;
  equipment_states: EquipmentState[];
  created_at: string;
}

// ── Execution Schemas ──────────────────────────────────────────

export interface ExecuteStepRequest {
  executed_by: string;
  pic_confirmed: boolean;
}

export interface ExecuteStepResponse {
  success: boolean;
  step_id: string;
  status: string;
  message: string;
  programme_status: ProgrammeStatus;
}

export interface PiCDecisionRequest {
  pic_name: string;
  decision: PiCDecision;
  reason: string;
}

export interface PiCDecisionResponse {
  decision: PiCDecision;
  programme_status: ProgrammeStatus;
  message: string;
}

export interface EmergencyStopRequest {
  initiated_by: string;
  reason: string;
}

export interface EmergencyStopResponse {
  success: boolean;
  programme_status: ProgrammeStatus;
  message: string;
}

// ── LOTO Schemas ───────────────────────────────────────────────

export interface LOTOPoint {
  point_id: string;
  equipment_id: string;
  status: LOTOStatus;
  locked_by: string;
  tag_number: string;
  applied_at: string | null;
  removed_at: string | null;
  removed_by: string;
}

export interface LOTOSet {
  programme_id: string;
  points: LOTOPoint[];
  all_applied: boolean;
  all_removed: boolean;
}

export interface LOTOActionRequest {
  performed_by: string;
}

export interface LOTOActionResponse {
  success: boolean;
  point_id: string;
  status: LOTOStatus;
  message: string;
}

// ── Audit Trail ────────────────────────────────────────────────

export interface AuditRecord {
  record_id: string;
  timestamp: string;
  action: string;
  performed_by: string;
  step_id: string;
  details: string;
}

export interface AuditTrailResponse {
  programme_id: string;
  total_records: number;
  records: AuditRecord[];
}

// ── FAT / SAT Schemas ──────────────────────────────────────────

export interface TestSpecification {
  test_id: string;
  name: string;
  standard: string;
  description: string;
  unit: string;
  min_value: number;
  max_value: number;
}

export interface TestResult {
  test_id: string;
  measured_value: number;
  verdict: TestVerdict;
  recorded_by: string;
  recorded_at: string;
  notes: string;
}

export interface FATCampaign {
  campaign_id: string;
  equipment_tag: string;
  status: CampaignStatus;
  specs: TestSpecification[];
  results: TestResult[];
  all_passed: boolean;
  created_at: string;
  approved_by: string;
  approved_at: string | null;
}

export interface SATCampaign {
  campaign_id: string;
  programme_id: string;
  status: CampaignStatus;
  fat_campaign_id: string;
  specs: TestSpecification[];
  results: TestResult[];
  all_passed: boolean;
  created_at: string;
  approved_by: string;
  approved_at: string | null;
}

// ── Protection Relay Schemas ───────────────────────────────────

export interface RelaySetting {
  setting_id: string;
  function: string;
  description: string;
  pickup_value: number;
  pickup_unit: string;
  time_delay: number;
  location: string;
  standard: string;
}

export interface GradingPair {
  pair_id: string;
  downstream_id: string;
  upstream_id: string;
  required_margin_ms: number;
  description: string;
}

export interface GradingResult {
  pair_id: string;
  downstream_id: string;
  upstream_id: string;
  downstream_delay_s: number;
  upstream_delay_s: number;
  actual_margin_ms: number;
  required_margin_ms: number;
  verdict: "selective" | "non_selective";
}

export interface ProtectionCoordination {
  settings: RelaySetting[];
  grading_pairs: GradingPair[];
  results: GradingResult[];
  all_selective: boolean;
}

// ── Emergency Response Schemas ─────────────────────────────────

export type EmergencyType =
  | "arc_flash"
  | "sf6_leak"
  | "medical"
  | "man_overboard"
  | "comms_failure"
  | "unexpected_voltage";

export type SeverityLevel = "critical" | "high" | "medium";

export interface EmergencyProcedure {
  emergency_type: EmergencyType;
  severity: SeverityLevel;
  immediate_actions: string[];
  responsible: string;
  reference_document: string;
  automated_scada_actions: string[];
  communication_protocol: string[];
}

export interface EmergencyEvent {
  event_id: string;
  programme_id: string;
  emergency_type: EmergencyType;
  severity: SeverityLevel;
  triggered_by: string;
  triggered_at: string;
  actions_taken: string[];
  scada_actions_executed: string[];
  resolved: boolean;
  resolved_at: string | null;
}

export interface EmergencyLogResponse {
  programme_id: string;
  total_events: number;
  events: EmergencyEvent[];
}

// ── Grid Code Compliance Schemas ───────────────────────────────

export type NotificationStage = "eon" | "ion" | "fon";

export type ComplianceVerdict =
  | "compliant"
  | "non_compliant"
  | "pending"
  | "conditional";

export interface GridCodeTest {
  test_id: string;
  stage: NotificationStage;
  name: string;
  description: string;
  standard: string;
  acceptance_criteria: string;
  verdict: ComplianceVerdict;
  evidence: string;
  tested_by: string;
  tested_at: string | null;
}

export interface NotificationApplication {
  stage: NotificationStage;
  status: ComplianceVerdict;
  tests: GridCodeTest[];
  submitted_to: string;
  submitted_at: string | null;
  approved_at: string | null;
}

export interface ComplianceCampaign {
  campaign_id: string;
  programme_id: string;
  stages: Record<NotificationStage, NotificationApplication>;
  created_at: string;
  cod_achieved: boolean;
  cod_date: string | null;
}

export interface StageSummary {
  stage: NotificationStage;
  total_tests: number;
  compliant: number;
  non_compliant: number;
  pending: number;
  conditional: number;
  submitted_at: string | null;
  approved_at: string | null;
  overall_status: string;
}
