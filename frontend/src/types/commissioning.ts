/**
 * P5 commissioning API types — mirror backend/app/schemas/commissioning.py.
 */

export type ProgrammeStatus =
  | "created"
  | "approved"
  | "in_progress"
  | "hold"
  | "suspended"
  | "completed"
  | "aborted";

export type StepType =
  | "check"
  | "gate"
  | "isolation"
  | "switching"
  | "verification"
  | "hold_point"
  | "declaration";

export type StepStatus = "pending" | "in_progress" | "completed" | "failed";
export type ZoneStatus = "live" | "earthed" | "dead";
export type EquipmentType = "circuit_breaker" | "disconnector" | "earth_switch" | "wtg_group";

export interface EquipmentState {
  equipment_id: string;
  equipment_type: EquipmentType;
  voltage_kv: number;
  location: string;
  state: "open" | "closed";
  zones: string[];
  locked: boolean;
}

export interface BusReading {
  name: string;
  zone: string;
  vn_kv: number;
  vm_pu: number;
  kv: number;
}

/** Load flow of the live network; reactive power in generator convention (+ = generating). */
export interface NetworkSnapshot {
  zones: Record<string, ZoneStatus>;
  buses: BusReading[];
  poc_p_mw: number;
  poc_q_mvar: number;
  generation_mw: number;
  cable_i_send_a: number | null;
  cable_i_recv_a: number | null;
  cable_loading_pct: number | null;
  /** OSS reactor 1 [Mvar]. */
  reactor_q_mvar: number | null;
  /** Onshore line reactor 1 [Mvar]. */
  reactor_on_q_mvar: number | null;
  statcom_q_mvar: number | null;
  tx1_i_hv_a: number | null;
  tx1_loading_pct: number | null;
}

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
  reading: string;
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

export interface AuditRecord {
  record_id: string;
  timestamp: string;
  action: string;
  performed_by: string;
  step_id: string;
  details: string;
}

export interface EmergencyEvent {
  event_id: string;
  emergency_type: string;
  severity: "critical" | "high" | "medium";
  effect: "trip" | "suspend";
  triggered_by: string;
  triggered_at: string;
  breakers_opened: string[];
  programme_status: ProgrammeStatus;
}

/** The farm a programme energises (backend FarmSpec). */
export interface ProgrammeFarm {
  name: string;
  string_layout: number[];
  section_a_strings: number;
  export_length_km: number;
  oss_trafo_mva: number;
  statcom_mvar: number;
  /** Reactor 1 [Mvar]; null: the design has no shunt reactors. */
  reactor_unit_mvar: number | null;
  /** Output with circuit 1 only [MW] (PPC limit on 3–4 circuit farms). */
  output_limit_mw: number;
  onshore_tap: number;
}

export interface ProgrammeDetail extends ProgrammeSummary {
  farm: ProgrammeFarm;
  phases: Record<string, string>;
  steps: Step[];
  equipment_states: EquipmentState[];
  network: NetworkSnapshot;
  audit_trail: AuditRecord[];
  emergency_log: EmergencyEvent[];
}

/** The plant after one switching step of circuit 1 (step "0": as built). */
export interface TraceFrame {
  step_id: string;
  step_number: number;
  phase: number;
  action: string;
  equipment_id: string;
  /** Device → open | closed after this step. */
  states: Record<string, "open" | "closed">;
  network: NetworkSnapshot;
}

/** First energisation replayed: one load-flow frame per switching step (GET /energisation-trace). */
export interface EnergisationTrace {
  farm: ProgrammeFarm;
  equipment: EquipmentState[];
  cable_rating_a: number;
  frames: TraceFrame[];
}

export interface ExecuteStepResponse {
  success: boolean;
  step_id: string;
  status: string;
  message: string;
  programme_status: ProgrammeStatus;
  reading: string;
}

// ── Isolation locks ──

export interface LOTOPoint {
  point_id: string;
  equipment_id: string;
  secured_state: "open" | "closed";
  status: "applied" | "removed";
  tag_number: string;
  locked_by: string;
  applied_at: string | null;
  removed_by: string;
  removed_at: string | null;
}

export interface LOTOSet {
  programme_id: string;
  points: LOTOPoint[];
  applied_count: number;
}

// ── FAT / SAT ──

export type EquipmentClass = "power_transformer" | "gis_220kv" | "protection_panel";
export type CampaignStatus = "created" | "in_progress" | "completed" | "approved";

export interface TestSpecification {
  test_id: string;
  name: string;
  standard: string;
  description: string;
  /** Measurement unit, or "pass/fail" (recorded as 1 / 0). */
  unit: string;
  min_value: number | null;
  max_value: number | null;
  typical_value: number;
}

export interface TestResult {
  test_id: string;
  measured_value: number;
  verdict: "pass" | "fail";
  recorded_by: string;
  recorded_at: string;
  notes: string;
}

interface CampaignBase {
  campaign_id: string;
  status: CampaignStatus;
  specs: TestSpecification[];
  results: TestResult[];
  all_passed: boolean;
  created_at: string;
  approved_by: string;
  approved_at: string | null;
}

export interface FATCampaign extends CampaignBase {
  equipment_tag: string;
  equipment_class: EquipmentClass;
}

export interface SATCampaign extends CampaignBase {
  programme_id: string;
  fat_campaign_id: string;
}

// ── Grid code ──

export type NotificationStage = "eon" | "ion" | "fon";
export type ComplianceVerdict = "pending" | "compliant" | "non_compliant";

export interface GridCodeTest {
  test_id: string;
  stage: NotificationStage;
  kind: "document" | "test" | "simulation";
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
  status: "open" | "submitted" | "issued";
  tests: GridCodeTest[];
  submitted_to: string;
  submitted_at: string | null;
  approved_at: string | null;
  valid_until: string | null;
}

export interface ComplianceCampaign {
  campaign_id: string;
  programme_id: string;
  stages: Record<NotificationStage, NotificationApplication>;
  created_at: string;
  cod_achieved: boolean;
  cod_date: string | null;
}

// ── Emergencies ──

export interface EmergencyProcedure {
  emergency_type: string;
  title: string;
  severity: "critical" | "high" | "medium";
  effect: "trip" | "suspend";
  immediate_actions: string[];
  responsible: string;
  reference_document: string;
  communication_protocol: string[];
}
