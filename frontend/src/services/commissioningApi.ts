/**
 * Typed fetch wrapper for all P5 commissioning API endpoints.
 *
 * Every function maps 1:1 to a backend route in backend/app/routers/p5.py.
 * The base URL is empty because Vite's dev proxy forwards /api → localhost:8000.
 *
 * Error handling: all functions throw on non-2xx responses with the server's
 * detail message. Callers (Zustand actions) catch and surface errors to the UI.
 */

import type {
  AuditTrailResponse,
  ComplianceCampaign,
  EmergencyEvent,
  EmergencyLogResponse,
  EmergencyProcedure,
  EmergencyStopRequest,
  EmergencyStopResponse,
  EquipmentState,
  ExecuteStepRequest,
  ExecuteStepResponse,
  FATCampaign,
  GridCodeTest,
  LOTOActionRequest,
  LOTOActionResponse,
  LOTOSet,
  NotificationApplication,
  NotificationStage,
  PiCDecisionRequest,
  PiCDecisionResponse,
  ProgrammeDetail,
  ProgrammeSummary,
  SATCampaign,
  StageSummary,
  TestResult,
  ProtectionCoordination,
} from "../types/commissioning";

const BASE = "/api/v1/commissioning";

// ── Helpers ────────────────────────────────────────────────────

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

// ── Programme Endpoints ────────────────────────────────────────

export function createProgramme(pic_name: string): Promise<ProgrammeSummary> {
  return post(`${BASE}/programmes`, { pic_name });
}

export function listProgrammes(): Promise<ProgrammeSummary[]> {
  return request(`${BASE}/programmes`);
}

export function getProgrammeDetail(id: string): Promise<ProgrammeDetail> {
  return request(`${BASE}/programmes/${id}`);
}

export function startProgramme(id: string): Promise<ProgrammeSummary> {
  return post(`${BASE}/programmes/${id}/start`, {});
}

// ── Step Execution ─────────────────────────────────────────────

export function executeStep(
  programmeId: string,
  stepId: string,
  body: ExecuteStepRequest,
): Promise<ExecuteStepResponse> {
  return post(
    `${BASE}/programmes/${programmeId}/steps/${stepId}/execute`,
    body,
  );
}

// ── PiC Decision ───────────────────────────────────────────────

export function picDecision(
  programmeId: string,
  body: PiCDecisionRequest,
): Promise<PiCDecisionResponse> {
  return post(`${BASE}/programmes/${programmeId}/pic-decision`, body);
}

// ── Emergency Stop ─────────────────────────────────────────────

export function emergencyStop(
  programmeId: string,
  body: EmergencyStopRequest,
): Promise<EmergencyStopResponse> {
  return post(`${BASE}/programmes/${programmeId}/emergency-stop`, body);
}

// ── Equipment State ────────────────────────────────────────────

export function getEquipmentStates(
  programmeId: string,
): Promise<EquipmentState[]> {
  return request(`${BASE}/programmes/${programmeId}/equipment`);
}

// ── LOTO ───────────────────────────────────────────────────────

export function getLOTOStatus(programmeId: string): Promise<LOTOSet> {
  return request(`${BASE}/programmes/${programmeId}/loto`);
}

export function applyLOTO(
  programmeId: string,
  pointId: string,
  body: LOTOActionRequest,
): Promise<LOTOActionResponse> {
  return post(
    `${BASE}/programmes/${programmeId}/loto/${pointId}/apply`,
    body,
  );
}

export function removeLOTO(
  programmeId: string,
  pointId: string,
  body: LOTOActionRequest,
): Promise<LOTOActionResponse> {
  return post(
    `${BASE}/programmes/${programmeId}/loto/${pointId}/remove`,
    body,
  );
}

// ── Audit Trail ────────────────────────────────────────────────

export function getAuditTrail(
  programmeId: string,
): Promise<AuditTrailResponse> {
  return request(`${BASE}/programmes/${programmeId}/audit-trail`);
}

// ── FAT ────────────────────────────────────────────────────────

export function createFATCampaign(equipment_tag: string): Promise<FATCampaign> {
  return post(`${BASE}/fat`, { equipment_tag });
}

export function listFATCampaigns(): Promise<FATCampaign[]> {
  return request(`${BASE}/fat`);
}

export function getFATCampaign(campaignId: string): Promise<FATCampaign> {
  return request(`${BASE}/fat/${campaignId}`);
}

export function recordFATResult(
  campaignId: string,
  testId: string,
  measured_value: number,
  recorded_by: string,
  notes: string = "",
): Promise<TestResult> {
  return post(`${BASE}/fat/${campaignId}/tests/${testId}/record`, {
    measured_value,
    recorded_by,
    notes,
  });
}

export function approveFATCampaign(
  campaignId: string,
  approved_by: string,
): Promise<FATCampaign> {
  return post(`${BASE}/fat/${campaignId}/approve`, { approved_by });
}

// ── SAT ────────────────────────────────────────────────────────

export function createSATCampaign(
  programmeId: string,
  require_fat: boolean = false,
): Promise<SATCampaign> {
  return post(`${BASE}/programmes/${programmeId}/sat`, { require_fat });
}

export function getSATCampaign(programmeId: string): Promise<SATCampaign> {
  return request(`${BASE}/programmes/${programmeId}/sat`);
}

export function recordSATResult(
  programmeId: string,
  testId: string,
  measured_value: number,
  recorded_by: string,
  notes: string = "",
): Promise<TestResult> {
  return post(
    `${BASE}/programmes/${programmeId}/sat/tests/${testId}/record`,
    { measured_value, recorded_by, notes },
  );
}

export function approveSATCampaign(
  programmeId: string,
  approved_by: string,
): Promise<SATCampaign> {
  return post(`${BASE}/programmes/${programmeId}/sat/approve`, {
    approved_by,
  });
}

// ── Protection Relay ───────────────────────────────────────────

export function getProtectionSettings(): Promise<ProtectionCoordination["settings"]> {
  return request(`${BASE}/protection/settings`);
}

export function verifySelectivity(): Promise<ProtectionCoordination> {
  return post(`${BASE}/protection/verify-selectivity`, {});
}

// ── Emergency Response ─────────────────────────────────────────

export function listEmergencyProcedures(): Promise<EmergencyProcedure[]> {
  return request(`${BASE}/emergency-procedures`);
}

export function getEmergencyProcedure(
  emergencyType: string,
): Promise<EmergencyProcedure> {
  return request(`${BASE}/emergency-procedures/${emergencyType}`);
}

export function triggerEmergency(
  programmeId: string,
  emergency_type: string,
  triggered_by: string,
): Promise<EmergencyEvent> {
  return post(`${BASE}/programmes/${programmeId}/emergency`, {
    emergency_type,
    triggered_by,
  });
}

export function getEmergencyLog(
  programmeId: string,
): Promise<EmergencyLogResponse> {
  return request(`${BASE}/programmes/${programmeId}/emergency-log`);
}

// ── Grid Code Compliance ───────────────────────────────────────

export function createComplianceCampaign(
  programmeId: string,
): Promise<ComplianceCampaign> {
  return post(`${BASE}/programmes/${programmeId}/compliance`, {});
}

export function getComplianceCampaign(
  programmeId: string,
): Promise<ComplianceCampaign> {
  return request(`${BASE}/programmes/${programmeId}/compliance`);
}

export function recordComplianceResult(
  programmeId: string,
  testId: string,
  verdict: string,
  evidence: string,
  tested_by: string,
): Promise<GridCodeTest> {
  return post(
    `${BASE}/programmes/${programmeId}/compliance/tests/${testId}`,
    { verdict, evidence, tested_by },
  );
}

export function submitNotification(
  programmeId: string,
  stage: NotificationStage,
  submitted_by: string,
): Promise<NotificationApplication> {
  return post(
    `${BASE}/programmes/${programmeId}/compliance/${stage}/submit`,
    { submitted_by },
  );
}

export function approveNotification(
  programmeId: string,
  stage: NotificationStage,
): Promise<NotificationApplication> {
  return post(
    `${BASE}/programmes/${programmeId}/compliance/${stage}/approve`,
    {},
  );
}

export function getStageSummary(
  programmeId: string,
  stage: NotificationStage,
): Promise<StageSummary> {
  return request(
    `${BASE}/programmes/${programmeId}/compliance/${stage}/summary`,
  );
}
