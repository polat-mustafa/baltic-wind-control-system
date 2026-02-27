/**
 * Zustand store for P3 SCADA & IEC 61850 dashboard state.
 *
 * Manages IEC 61850 device registry, GOOSE fault simulation results,
 * RBAC roles/zones, and Permit-to-Work lifecycle.
 *
 * Data flow: user selects fault scenario → runGooseSimulation() →
 * events populate alarm list + event log; user manages PtW lifecycle.
 */

import { create } from "zustand";

import * as api from "../services/scadaApi";
import type {
  FaultScenarioSummary,
  FaultSimulationResult,
  IEC62443Zone,
  PermitDetail,
  PermitList,
  RetransmissionResult,
  RoleDefinition,
  SubstationSummary,
  TransitionResult,
} from "../types/scada";

// ── Store Interface ────────────────────────────────────────────

interface ScadaState {
  // Device registry
  substationSummary: SubstationSummary | null;

  // GOOSE simulation
  faultScenarios: FaultScenarioSummary[];
  selectedFaultType: string;
  simulationResult: FaultSimulationResult | null;
  retransmissionResult: RetransmissionResult | null;

  // RBAC
  roles: RoleDefinition[];
  zones: IEC62443Zone[];
  selectedRoleLevel: number;

  // Permit-to-Work
  permitList: PermitList | null;
  activePermit: PermitDetail | null;

  // UI state
  loading: boolean;
  error: string | null;
  dataLoaded: boolean;

  // Parameter setters
  setSelectedFaultType: (ft: string) => void;
  setSelectedRoleLevel: (level: number) => void;

  // Data actions
  fetchInitialData: () => Promise<void>;
  runGooseSimulation: () => Promise<void>;
  calculateRetransmission: () => Promise<void>;
  fetchPermits: () => Promise<void>;
  createPermit: (params: {
    work_description: string;
    equipment_id: string;
    requested_by: string;
    person_in_charge?: string;
  }) => Promise<PermitDetail | null>;
  transitionPermit: (
    ptwNumber: string,
    params: {
      target_status: string;
      performed_by: string;
      user_level: number;
      notes?: string;
    },
  ) => Promise<TransitionResult | null>;

  // Utility
  clearError: () => void;
}

// ── Store Implementation ───────────────────────────────────────

export const useScadaStore = create<ScadaState>((set, get) => ({
  // Device registry
  substationSummary: null,

  // GOOSE simulation
  faultScenarios: [],
  selectedFaultType: "busbar_overcurrent",
  simulationResult: null,
  retransmissionResult: null,

  // RBAC
  roles: [],
  zones: [],
  selectedRoleLevel: 4,

  // PtW
  permitList: null,
  activePermit: null,

  // UI
  loading: false,
  error: null,
  dataLoaded: false,

  // ── Parameter setters ──────────────────────────────────────

  setSelectedFaultType: (ft) => set({ selectedFaultType: ft }),
  setSelectedRoleLevel: (level) => set({ selectedRoleLevel: level }),

  // ── Data actions ───────────────────────────────────────────

  fetchInitialData: async () => {
    set({ loading: true, error: null });

    try {
      const [substationSummary, faultScenarios, roles, zones, permitList] =
        await Promise.all([
          api.getSubstationSummary(),
          api.listFaultScenarios(),
          api.listRoles(),
          api.listZones(),
          api.listPermits(),
        ]);

      set({
        substationSummary,
        faultScenarios,
        roles,
        zones,
        permitList,
        dataLoaded: true,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  runGooseSimulation: async () => {
    const { selectedFaultType } = get();
    set({ loading: true, error: null });

    try {
      const [simulationResult, retransmissionResult] = await Promise.all([
        api.runFaultSimulation(selectedFaultType),
        api.calculateRetransmission(),
      ]);

      set({ simulationResult, retransmissionResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  calculateRetransmission: async () => {
    try {
      const retransmissionResult = await api.calculateRetransmission();
      set({ retransmissionResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  fetchPermits: async () => {
    try {
      const permitList = await api.listPermits();
      set({ permitList });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  createPermit: async (params) => {
    try {
      const permit = await api.createPermit(params);
      // Refresh list after creation
      const permitList = await api.listPermits();
      set({ activePermit: permit, permitList });
      return permit;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  transitionPermit: async (ptwNumber, params) => {
    try {
      const result = await api.transitionPermit(ptwNumber, params);
      // Refresh permit detail and list
      const [activePermit, permitList] = await Promise.all([
        api.getPermitDetail(ptwNumber),
        api.listPermits(),
      ]);
      set({ activePermit, permitList });
      return result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  // ── Utility ────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));
