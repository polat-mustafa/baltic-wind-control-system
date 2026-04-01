/**
 * Cybersecurity (IEC 62443) store — M07.
 * Manages Purdue Model zones, conduits, attack simulations, and compliance.
 */

import { create } from "zustand";
import * as api from "../services/securityApi";
import type {
  ZonesResponse,
  ConduitsResponse,
  AttackSimulationResponse,
  AttackScenarioRequest,
  AttackScenarioId,
  SecurityEventsResponse,
  ComplianceSummaryResponse,
} from "../types/security";

interface SecurityState {
  zones: ZonesResponse | null;
  conduits: ConduitsResponse | null;
  attackResult: AttackSimulationResponse | null;
  securityEvents: SecurityEventsResponse | null;
  compliance: ComplianceSummaryResponse | null;
  // Attack sim params
  selectedScenario: AttackScenarioId;
  targetZone: string;
  loading: boolean;
  attackLoading: boolean;
  error: string | null;

  fetchAll(): Promise<void>;
  simulateAttack(): Promise<void>;
  setSelectedScenario(id: AttackScenarioId): void;
  setTargetZone(zone: string): void;
  clearError(): void;
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  zones: null,
  conduits: null,
  attackResult: null,
  securityEvents: null,
  compliance: null,
  selectedScenario: "REPLAY_ATTACK",
  targetZone: "FIELD_DEVICE_ZONE",
  loading: false,
  attackLoading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [zones, conduits, securityEvents, compliance] = await Promise.all([
        api.getZones(),
        api.getConduits(),
        api.getSecurityEvents(),
        api.getCompliance(),
      ]);
      set({ zones, conduits, securityEvents, compliance });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch security data" });
    } finally {
      set({ loading: false });
    }
  },

  simulateAttack: async () => {
    const { selectedScenario, targetZone } = get();
    set({ attackLoading: true, error: null, attackResult: null });
    try {
      const req: AttackScenarioRequest = {
        scenario_id: selectedScenario,
        target_zone: targetZone,
      };
      const attackResult = await api.simulateAttack(req);
      set({ attackResult });
      // Refresh events after simulation
      const securityEvents = await api.getSecurityEvents();
      set({ securityEvents });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Attack simulation failed" });
    } finally {
      set({ attackLoading: false });
    }
  },

  setSelectedScenario: (id) => set({ selectedScenario: id }),
  setTargetZone: (zone) => set({ targetZone: zone }),
  clearError: () => set({ error: null }),
}));
