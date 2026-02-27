/**
 * Zustand store for P5 commissioning state.
 *
 * Single store managing the full switching programme lifecycle:
 * programme list, active programme detail, LOTO set, audit trail,
 * FAT/SAT campaigns, and all async actions that call the API.
 *
 * Future P1-P4 dashboards will get their own store files — this store
 * is scoped exclusively to the commissioning domain.
 */

import { create } from "zustand";

import * as api from "../services/commissioningApi";
import type {
  AuditRecord,
  FATCampaign,
  LOTOSet,
  PiCDecision,
  ProgrammeDetail,
  ProgrammeSummary,
  SATCampaign,
} from "../types/commissioning";

// ── Anomaly injection (client-only, educational simulation) ────

export interface AnomalyOverlay {
  id: string;
  type: "sf6_leak" | "comms_failure" | "voltage_anomaly";
  equipment_id: string;
  label: string;
  active: boolean;
}

// ── Store Interface ────────────────────────────────────────────

interface CommissioningState {
  // Data
  programmes: ProgrammeSummary[];
  activeProgramme: ProgrammeDetail | null;
  lotoSet: LOTOSet | null;
  auditRecords: AuditRecord[];
  fatCampaigns: FATCampaign[];
  satCampaign: SATCampaign | null;
  anomalies: AnomalyOverlay[];

  // UI state
  error: string | null;
  loading: boolean;

  // Programme lifecycle actions
  fetchProgrammes: () => Promise<void>;
  createProgramme: (picName: string) => Promise<void>;
  selectProgramme: (id: string) => Promise<void>;
  startProgramme: (id: string) => Promise<void>;
  refreshActiveProgramme: () => Promise<void>;

  // Step execution
  executeStep: (stepId: string, executedBy: string) => Promise<void>;

  // PiC decisions
  picDecision: (decision: PiCDecision, picName: string, reason?: string) => Promise<void>;
  emergencyStop: (initiatedBy: string, reason: string) => Promise<void>;

  // LOTO
  fetchLOTO: () => Promise<void>;
  applyLOTO: (pointId: string, performedBy: string) => Promise<void>;
  removeLOTO: (pointId: string, performedBy: string) => Promise<void>;

  // Audit trail
  fetchAuditTrail: () => Promise<void>;

  // FAT/SAT
  fetchFATCampaigns: () => Promise<void>;
  createFATCampaign: (equipmentTag: string) => Promise<void>;
  recordFATResult: (campaignId: string, testId: string, value: number, recordedBy: string, notes?: string) => Promise<void>;
  approveFATCampaign: (campaignId: string, approvedBy: string) => Promise<void>;
  createSATCampaign: (requireFat?: boolean) => Promise<void>;
  fetchSATCampaign: () => Promise<void>;
  recordSATResult: (testId: string, value: number, recordedBy: string, notes?: string) => Promise<void>;
  approveSATCampaign: (approvedBy: string) => Promise<void>;

  // Anomaly injection (client-only)
  injectAnomaly: (anomaly: Omit<AnomalyOverlay, "active">) => void;
  clearAnomaly: (id: string) => void;
  clearAllAnomalies: () => void;

  // Utility
  clearError: () => void;
}

// ── Store Implementation ───────────────────────────────────────

export const useCommissioningStore = create<CommissioningState>((set, get) => ({
  // Initial state
  programmes: [],
  activeProgramme: null,
  lotoSet: null,
  auditRecords: [],
  fatCampaigns: [],
  satCampaign: null,
  anomalies: [],
  error: null,
  loading: false,

  // ── Programme lifecycle ──────────────────────────────────────

  fetchProgrammes: async () => {
    try {
      const programmes = await api.listProgrammes();
      set({ programmes });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  createProgramme: async (picName) => {
    try {
      set({ loading: true, error: null });
      await api.createProgramme(picName);
      await get().fetchProgrammes();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  selectProgramme: async (id) => {
    try {
      set({ loading: true, error: null });
      const detail = await api.getProgrammeDetail(id);
      set({ activeProgramme: detail });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  startProgramme: async (id) => {
    try {
      set({ error: null });
      await api.startProgramme(id);
      await get().selectProgramme(id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  refreshActiveProgramme: async () => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      const detail = await api.getProgrammeDetail(prog.programme_id);
      set({ activeProgramme: detail });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ── Step execution ───────────────────────────────────────────

  executeStep: async (stepId, executedBy) => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      await api.executeStep(prog.programme_id, stepId, {
        executed_by: executedBy,
        pic_confirmed: true,
      });
      await get().refreshActiveProgramme();
      await get().fetchAuditTrail();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ── PiC decisions ────────────────────────────────────────────

  picDecision: async (decision, picName, reason = "") => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      await api.picDecision(prog.programme_id, {
        pic_name: picName,
        decision,
        reason,
      });
      await get().refreshActiveProgramme();
      await get().fetchAuditTrail();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  emergencyStop: async (initiatedBy, reason) => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      await api.emergencyStop(prog.programme_id, {
        initiated_by: initiatedBy,
        reason,
      });
      await get().refreshActiveProgramme();
      await get().fetchAuditTrail();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ── LOTO ─────────────────────────────────────────────────────

  fetchLOTO: async () => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      const lotoSet = await api.getLOTOStatus(prog.programme_id);
      set({ lotoSet });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  applyLOTO: async (pointId, performedBy) => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      await api.applyLOTO(prog.programme_id, pointId, {
        performed_by: performedBy,
      });
      await get().fetchLOTO();
      await get().fetchAuditTrail();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  removeLOTO: async (pointId, performedBy) => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      await api.removeLOTO(prog.programme_id, pointId, {
        performed_by: performedBy,
      });
      await get().fetchLOTO();
      await get().fetchAuditTrail();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ── Audit trail ──────────────────────────────────────────────

  fetchAuditTrail: async () => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      const trail = await api.getAuditTrail(prog.programme_id);
      set({ auditRecords: trail.records });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ── FAT ──────────────────────────────────────────────────────

  fetchFATCampaigns: async () => {
    try {
      const fatCampaigns = await api.listFATCampaigns();
      set({ fatCampaigns });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  createFATCampaign: async (equipmentTag) => {
    try {
      set({ error: null });
      await api.createFATCampaign(equipmentTag);
      await get().fetchFATCampaigns();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  recordFATResult: async (campaignId, testId, value, recordedBy, notes = "") => {
    try {
      set({ error: null });
      await api.recordFATResult(campaignId, testId, value, recordedBy, notes);
      await get().fetchFATCampaigns();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  approveFATCampaign: async (campaignId, approvedBy) => {
    try {
      set({ error: null });
      await api.approveFATCampaign(campaignId, approvedBy);
      await get().fetchFATCampaigns();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ── SAT ──────────────────────────────────────────────────────

  createSATCampaign: async (requireFat = false) => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      const sat = await api.createSATCampaign(prog.programme_id, requireFat);
      set({ satCampaign: sat });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  fetchSATCampaign: async () => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      const sat = await api.getSATCampaign(prog.programme_id);
      set({ satCampaign: sat });
    } catch {
      // 404 is expected when no SAT campaign exists
      set({ satCampaign: null });
    }
  },

  recordSATResult: async (testId, value, recordedBy, notes = "") => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      await api.recordSATResult(prog.programme_id, testId, value, recordedBy, notes);
      await get().fetchSATCampaign();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  approveSATCampaign: async (approvedBy) => {
    const prog = get().activeProgramme;
    if (!prog) return;
    try {
      set({ error: null });
      await api.approveSATCampaign(prog.programme_id, approvedBy);
      await get().fetchSATCampaign();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ── Anomaly injection (client-only) ──────────────────────────

  injectAnomaly: (anomaly) => {
    set((state) => ({
      anomalies: [...state.anomalies, { ...anomaly, active: true }],
    }));
  },

  clearAnomaly: (id) => {
    set((state) => ({
      anomalies: state.anomalies.filter((a) => a.id !== id),
    }));
  },

  clearAllAnomalies: () => {
    set({ anomalies: [] });
  },

  // ── Utility ──────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
