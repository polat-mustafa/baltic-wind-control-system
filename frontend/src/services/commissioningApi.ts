/**
 * P5 commissioning API client — routes in backend/app/routers/p5/.
 * Throws on non-2xx with the server's detail message.
 */

import type {
  ComplianceCampaign,
  ComplianceVerdict,
  EmergencyEvent,
  EmergencyProcedure,
  EquipmentClass,
  ExecuteStepResponse,
  FATCampaign,
  LOTOSet,
  NotificationStage,
  ProgrammeDetail,
  ProgrammeSummary,
  SATCampaign,
} from "../types/commissioning";

import { formatErrorDetail, post, request } from "./apiClient";

const BASE = "/api/v1/commissioning";
const P = (id: string) => `${BASE}/programmes/${id}`;

// ── Programme ──

export const listProgrammes = () => request<ProgrammeSummary[]>(`${BASE}/programmes`);
export const createProgramme = (pic_name: string) =>
  post<ProgrammeSummary>(`${BASE}/programmes`, { pic_name });
export const getProgramme = (id: string) => request<ProgrammeDetail>(P(id));
export const startProgramme = (id: string) => post<ProgrammeSummary>(`${P(id)}/start`, {});

export async function deleteProgramme(id: string): Promise<void> {
  const res = await fetch(P(id), { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatErrorDetail(body?.detail, res.status));
  }
}

export const executeStep = (id: string, stepId: string, executed_by: string) =>
  post<ExecuteStepResponse>(`${P(id)}/steps/${stepId}/execute`, { executed_by, pic_confirmed: true });

export const picDecision = (id: string, pic_name: string, decision: "go" | "nogo", reason = "") =>
  post(`${P(id)}/pic-decision`, { pic_name, decision, reason });

export const emergencyStop = (id: string, initiated_by: string, reason: string) =>
  post(`${P(id)}/emergency-stop`, { initiated_by, reason });

// ── Isolation locks ──

export const getLOTO = (id: string) => request<LOTOSet>(`${P(id)}/loto`);
export const lotoAction = (id: string, pointId: string, action: "apply" | "remove", performed_by: string) =>
  post<LOTOSet>(`${P(id)}/loto/${pointId}/${action}`, { performed_by });

// ── FAT ──

export const listFAT = () => request<FATCampaign[]>(`${BASE}/fat`);
export const createFAT = (equipment_tag: string, equipment_class: EquipmentClass) =>
  post<FATCampaign>(`${BASE}/fat`, { equipment_tag, equipment_class });
export const recordFAT = (campaignId: string, testId: string, measured_value: number, recorded_by: string) =>
  post<FATCampaign>(`${BASE}/fat/${campaignId}/tests/${testId}/record`, { measured_value, recorded_by });
export const approveFAT = (campaignId: string, approved_by: string) =>
  post<FATCampaign>(`${BASE}/fat/${campaignId}/approve`, { approved_by });

// ── SAT ──

export const getSAT = (id: string) => request<SATCampaign>(`${P(id)}/sat`);
export const createSAT = (id: string) => post<SATCampaign>(`${P(id)}/sat`, {});
export const recordSAT = (id: string, testId: string, measured_value: number, recorded_by: string) =>
  post<SATCampaign>(`${P(id)}/sat/tests/${testId}/record`, { measured_value, recorded_by });
export const approveSAT = (id: string, approved_by: string) =>
  post<SATCampaign>(`${P(id)}/sat/approve`, { approved_by });

// ── Grid-code compliance ──

export const getCompliance = (id: string) => request<ComplianceCampaign>(`${P(id)}/compliance`);
export const createCompliance = (id: string) => post<ComplianceCampaign>(`${P(id)}/compliance`, {});
export const recordCompliance = (
  id: string,
  testId: string,
  verdict: ComplianceVerdict,
  evidence: string,
  tested_by: string,
) => post<ComplianceCampaign>(`${P(id)}/compliance/tests/${testId}`, { verdict, evidence, tested_by });
export const stageAction = (id: string, stage: NotificationStage, action: "submit" | "approve") =>
  post<ComplianceCampaign>(`${P(id)}/compliance/${stage}/${action}`, {});

// ── Emergencies ──

export const listProcedures = () => request<EmergencyProcedure[]>(`${BASE}/emergency-procedures`);
export const triggerEmergency = (id: string, emergency_type: string, triggered_by: string) =>
  post<EmergencyEvent>(`${P(id)}/emergency`, { emergency_type, triggered_by });
