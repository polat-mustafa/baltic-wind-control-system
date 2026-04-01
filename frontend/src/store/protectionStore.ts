/**
 * Protection Relay store — M05.
 * Manages relay configurations, TCC coordination studies, and fault clearance.
 */

import { create } from "zustand";
import * as api from "../services/protectionApi";
import type {
  ProtectionRelaySchema,
  CoordinationStudyRequest,
  CoordinationStudyResponse,
  FaultClearanceRequest,
  FaultClearanceResponse,
  TCCPlotData,
} from "../types/protection";

interface ProtectionState {
  relays: ProtectionRelaySchema[];
  tccData: TCCPlotData | null;
  coordinationResult: CoordinationStudyResponse | null;
  faultClearanceResult: FaultClearanceResponse | null;
  // Coordination study params
  faultLocation: string;
  faultCurrentKA: number;
  includeTCC: boolean;
  loading: boolean;
  studyLoading: boolean;
  error: string | null;

  fetchRelays(): Promise<void>;
  runCoordinationStudy(): Promise<void>;
  runFaultClearance(req: FaultClearanceRequest): Promise<void>;
  setFaultLocation(loc: string): void;
  setFaultCurrentKA(ka: number): void;
  setIncludeTCC(val: boolean): void;
  clearError(): void;
}

export const useProtectionStore = create<ProtectionState>((set, get) => ({
  relays: [],
  tccData: null,
  coordinationResult: null,
  faultClearanceResult: null,
  faultLocation: "WTG_ARRAY",
  faultCurrentKA: 12.5,
  includeTCC: true,
  loading: false,
  studyLoading: false,
  error: null,

  fetchRelays: async () => {
    set({ loading: true, error: null });
    try {
      const [relays, tccData] = await Promise.all([
        api.getRelays(),
        api.getTCCData(),
      ]);
      set({ relays, tccData });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch relays" });
    } finally {
      set({ loading: false });
    }
  },

  runCoordinationStudy: async () => {
    const { faultLocation, faultCurrentKA, includeTCC } = get();
    set({ studyLoading: true, error: null });
    try {
      const req: CoordinationStudyRequest = {
        fault_location: faultLocation,
        fault_current_ka: faultCurrentKA,
        include_tcc_data: includeTCC,
      };
      const coordinationResult = await api.runCoordinationStudy(req);
      set({ coordinationResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Coordination study failed" });
    } finally {
      set({ studyLoading: false });
    }
  },

  runFaultClearance: async (req: FaultClearanceRequest) => {
    set({ studyLoading: true, error: null });
    try {
      const faultClearanceResult = await api.runFaultClearance(req);
      set({ faultClearanceResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Fault clearance simulation failed" });
    } finally {
      set({ studyLoading: false });
    }
  },

  setFaultLocation: (loc) => set({ faultLocation: loc }),
  setFaultCurrentKA: (ka) => set({ faultCurrentKA: ka }),
  setIncludeTCC: (val) => set({ includeTCC: val }),
  clearError: () => set({ error: null }),
}));
