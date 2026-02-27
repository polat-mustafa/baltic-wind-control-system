/**
 * TypeScript interfaces for P3 SCADA & IEC 61850 API responses.
 *
 * All field names use snake_case to match the API JSON directly.
 * Source of truth: backend/app/schemas/scada.py + ptw.py Pydantic schemas.
 */

// ── IEC 61850 Data Hierarchy ─────────────────────────────────────

export interface DataAttribute {
  name: string;
  data_type: string;
  fc: string;
  description: string;
  unit: string;
}

export interface DataObject {
  name: string;
  cdc: string;
  attributes: DataAttribute[];
  description: string;
}

export interface LogicalNode {
  class_name: string;
  instance: number;
  full_name: string;
  category: string;
  data_objects: DataObject[];
  description: string;
}

export interface LogicalDevice {
  inst: string;
  logical_nodes: LogicalNode[];
  description: string;
}

export interface PhysicalDevice {
  name: string;
  equipment_type: string;
  manufacturer: string;
  model: string;
  logical_devices: LogicalDevice[];
  ip_address: string;
  description: string;
}

// ── Substation Summary ───────────────────────────────────────────

export interface SubstationSummary {
  total_devices: number;
  total_logical_nodes: number;
  protection_ieds: number;
  measurement_ieds: number;
  bay_controllers: number;
  wtg_controllers: number;
  goose_control_blocks: number;
  devices: PhysicalDevice[];
}

// ── GOOSE Schemas ────────────────────────────────────────────────

export interface GOOSEControlBlock {
  name: string;
  app_id: string;
  go_id: string;
  dataset_name: string;
  mac_address: string;
  vlan_id: number;
  min_time_ms: number;
  max_time_ms: number;
  description: string;
}

export interface ProtectionEvent {
  event_type: string;
  timestamp_ms: number;
  description: string;
  ied_name: string;
}

export interface GOOSEMessage {
  gocb_ref: string;
  dat_set: string;
  go_id: string;
  st_num: number;
  sq_num: number;
  all_data: Record<string, boolean>;
  timestamp: string;
  app_id: string;
  mac_address: string;
  vlan_id: number;
}

export interface ComplianceCheck {
  goose_latency_ms: number;
  goose_max_allowed_ms: number;
  goose_compliant: boolean;
  total_clearance_ms: number;
  clearance_max_allowed_ms: number;
  clearance_compliant: boolean;
}

export interface FaultSimulationResult {
  fault_type: string;
  location: string;
  fault_current_pu: number;
  protection_function: string;
  description: string;
  events: ProtectionEvent[];
  goose_messages: GOOSEMessage[];
  compliance: ComplianceCheck;
  retransmission_schedule_ms: number[];
}

export interface RetransmissionResult {
  min_time_ms: number;
  max_time_ms: number;
  num_retransmissions: number;
  schedule_ms: number[];
  intervals_ms: number[];
}

export interface FaultScenarioSummary {
  fault_type: string;
  description: string;
}

// ── RBAC — IEC 62443 ────────────────────────────────────────────

export interface RoleDefinition {
  level: number;
  name: string;
  description: string;
  permissions: string[];
  mfa_required: boolean;
  security_level: number;
}

export interface PermissionCheckResult {
  granted: boolean;
  role_level: number;
  permission: string;
  reason: string;
  mfa_required: boolean;
}

export interface IEC62443Zone {
  zone: string;
  min_access_level: number;
  description: string;
}

// ── Permit-to-Work ──────────────────────────────────────────────

export interface TransitionLog {
  id: string;
  from_status: string;
  to_status: string;
  performed_by: string;
  user_level: number;
  notes: string;
  created_at: string;
}

export interface NextTransition {
  target_status: string;
  required_permission: string;
}

export interface PermitDetail {
  id: string;
  ptw_number: string;
  status: string;
  work_description: string;
  equipment_id: string;
  requested_by: string;
  person_in_charge: string;
  risk_level: string | null;
  risk_categories: string | null;
  control_measures: string | null;
  approved_by: string | null;
  valid_from: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  current_step_number: number;
  next_allowed_transitions: NextTransition[];
  transition_log: TransitionLog[];
}

export interface PermitSummary {
  id: string;
  ptw_number: string;
  status: string;
  work_description: string;
  equipment_id: string;
  requested_by: string;
  created_at: string;
}

export interface PermitList {
  total: number;
  permits: PermitSummary[];
}

export interface TransitionResult {
  success: boolean;
  ptw_number: string;
  from_status: string;
  to_status: string;
  message: string;
  step_number: number;
}
