/**
 * P5 commissioning store — one programme open at a time.
 *
 * Every action calls the API and then refreshes the open programme (steps,
 * equipment, load-flow snapshot, audit trail) together with its isolation
 * register, SAT, compliance campaign and the FAT list, so all tabs show the
 * same state. The Person in Control's name is the actor for every action.
 */

import { create } from "zustand";

import * as api from "../services/commissioningApi";
import type {
  ComplianceCampaign,
  ComplianceVerdict,
  EmergencyProcedure,
  EquipmentClass,
  FATCampaign,
  LOTOSet,
  NotificationStage,
  ProgrammeDetail,
  ProgrammeSummary,
  SATCampaign,
} from "../types/commissioning";

interface CommissioningState {
  programmes: ProgrammeSummary[];
  active: ProgrammeDetail | null;
  loto: LOTOSet | null;
  fat: FATCampaign[];
  sat: SATCampaign | null;
  compliance: ComplianceCampaign | null;
  procedures: EmergencyProcedure[];
  busy: boolean;
  error: string | null;
  /** Result line of the last executed step (or its refusal). */
  lastResult: { stepId: string; ok: boolean; text: string } | null;

  fetchProgrammes: () => Promise<void>;
  createProgramme: (picName: string) => Promise<void>;
  openProgramme: (id: string) => Promise<void>;
  closeProgramme: () => void;
  deleteProgramme: (id: string) => Promise<void>;
  startProgramme: () => Promise<void>;
  executeCurrentStep: () => Promise<void>;
  decide: (decision: "go" | "nogo", reason?: string) => Promise<void>;
  emergencyStop: (reason: string) => Promise<void>;
  lockAction: (pointId: string, action: "apply" | "remove") => Promise<void>;
  createFAT: (tag: string, cls: EquipmentClass) => Promise<void>;
  recordFAT: (campaignId: string, testId: string, value: number) => Promise<void>;
  fillFAT: (campaignId: string) => Promise<void>;
  approveFAT: (campaignId: string) => Promise<void>;
  createSAT: () => Promise<void>;
  recordSAT: (testId: string, value: number) => Promise<void>;
  fillSAT: () => Promise<void>;
  approveSAT: () => Promise<void>;
  createCompliance: () => Promise<void>;
  recordCompliance: (testId: string, verdict: ComplianceVerdict, evidence: string) => Promise<void>;
  markStageCompliant: (stage: NotificationStage) => Promise<void>;
  stageAction: (stage: NotificationStage, action: "submit" | "approve") => Promise<void>;
  triggerEmergency: (type: string) => Promise<void>;
  clearError: () => void;
}

const orNull = <T,>(p: Promise<T>) => p.catch(() => null);

export const useCommissioningStore = create<CommissioningState>((set, get) => {
  const pic = () => get().active?.pic_name ?? "";
  const id = () => {
    const a = get().active;
    if (!a) throw new Error("No programme open");
    return a.programme_id;
  };

  async function refresh() {
    const a = get().active;
    if (!a) return;
    const [detail, loto, sat, compliance, fat] = await Promise.all([
      api.getProgramme(a.programme_id),
      orNull(api.getLOTO(a.programme_id)),
      orNull(api.getSAT(a.programme_id)),
      orNull(api.getCompliance(a.programme_id)),
      api.listFAT(),
    ]);
    set({ active: detail, loto, sat, compliance, fat });
  }

  /** Run an API call, then refresh; surface errors in the banner. */
  async function run(fn: () => Promise<unknown>) {
    set({ busy: true, error: null });
    try {
      await fn();
      await refresh();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  }

  return {
    programmes: [],
    active: null,
    loto: null,
    fat: [],
    sat: null,
    compliance: null,
    procedures: [],
    busy: false,
    error: null,
    lastResult: null,

    fetchProgrammes: async () => {
      try {
        const [programmes, procedures] = await Promise.all([api.listProgrammes(), api.listProcedures()]);
        set({ programmes, procedures });
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
    },

    createProgramme: async (picName) => {
      set({ busy: true, error: null });
      try {
        const p = await api.createProgramme(picName);
        await get().fetchProgrammes();
        await get().openProgramme(p.programme_id);
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    openProgramme: async (programmeId) => {
      set({ busy: true, error: null, lastResult: null });
      try {
        set({ active: await api.getProgramme(programmeId) });
        await refresh();
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      } finally {
        set({ busy: false });
      }
    },

    closeProgramme: () => {
      set({ active: null, loto: null, sat: null, compliance: null, lastResult: null });
      void get().fetchProgrammes();
    },

    deleteProgramme: async (programmeId) => {
      try {
        await api.deleteProgramme(programmeId);
        await get().fetchProgrammes();
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
      }
    },

    startProgramme: () => run(() => api.startProgramme(id())),

    executeCurrentStep: async () => {
      const a = get().active;
      if (!a) return;
      const step = a.steps[a.current_step_index];
      if (!step) return;
      set({ busy: true, error: null });
      try {
        const r = await api.executeStep(a.programme_id, step.step_id, a.pic_name);
        set({
          lastResult: {
            stepId: step.step_id,
            ok: r.success,
            text: r.success ? r.reading || "Completed" : r.message,
          },
        });
      } catch (e) {
        // A refused step is not an application error: show it in the step panel
        set({ lastResult: { stepId: step.step_id, ok: false, text: e instanceof Error ? e.message : String(e) } });
      }
      try {
        await refresh();
      } finally {
        set({ busy: false });
      }
    },

    decide: (decision, reason = "") => run(() => api.picDecision(id(), pic(), decision, reason)),
    emergencyStop: (reason) => run(() => api.emergencyStop(id(), pic(), reason)),
    lockAction: (pointId, action) => run(() => api.lotoAction(id(), pointId, action, pic())),

    createFAT: (tag, cls) => run(() => api.createFAT(tag, cls)),
    recordFAT: (campaignId, testId, value) => run(() => api.recordFAT(campaignId, testId, value, pic())),
    fillFAT: (campaignId) =>
      run(async () => {
        const c = get().fat.find((f) => f.campaign_id === campaignId);
        const done = new Set(c?.results.map((r) => r.test_id));
        for (const s of c?.specs ?? []) {
          if (!done.has(s.test_id)) await api.recordFAT(campaignId, s.test_id, s.typical_value, pic());
        }
      }),
    approveFAT: (campaignId) => run(() => api.approveFAT(campaignId, pic())),

    createSAT: () => run(() => api.createSAT(id())),
    recordSAT: (testId, value) => run(() => api.recordSAT(id(), testId, value, pic())),
    fillSAT: () =>
      run(async () => {
        const sat = get().sat;
        const done = new Set(sat?.results.map((r) => r.test_id));
        for (const s of sat?.specs ?? []) {
          if (!done.has(s.test_id)) await api.recordSAT(id(), s.test_id, s.typical_value, pic());
        }
      }),
    approveSAT: () => run(() => api.approveSAT(id(), pic())),

    createCompliance: () => run(() => api.createCompliance(id())),
    recordCompliance: (testId, verdict, evidence) =>
      run(() => api.recordCompliance(id(), testId, verdict, evidence, pic())),
    markStageCompliant: (stage) =>
      run(async () => {
        for (const t of get().compliance?.stages[stage].tests ?? []) {
          if (t.verdict !== "compliant") {
            await api.recordCompliance(id(), t.test_id, "compliant", "Demonstration record", pic());
          }
        }
      }),
    stageAction: (stage, action) => run(() => api.stageAction(id(), stage, action)),

    triggerEmergency: (type) => run(() => api.triggerEmergency(id(), type, pic())),
    clearError: () => set({ error: null }),
  };
});
