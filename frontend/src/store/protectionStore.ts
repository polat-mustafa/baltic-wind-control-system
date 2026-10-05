/**
 * Protection tab store — relay registry, fault study and TMS changes.
 *
 * The study re-runs whenever the fault location / cable position / fault
 * type changes; a TMS change is PUT to the relay registry first so the
 * grading and the TCC follow the new setting.
 */

import { create } from "zustand";

import * as api from "../services/protectionApi";
import type {
  CoordinationStudyResponse,
  FaultLocation,
  ProtectionRelaySchema,
} from "../types/protection";

interface ProtectionState {
  relays: ProtectionRelaySchema[];
  study: CoordinationStudyResponse | null;

  faultLocation: FaultLocation;
  positionPct: number;
  faultType: "3ph" | "ph_ph";

  loading: boolean;
  error: string | null;

  setFaultLocation(loc: FaultLocation): void;
  setPositionPct(pct: number): void;
  setFaultType(t: "3ph" | "ph_ph"): void;
  runStudy(): Promise<void>;
  setTms(settingId: string, tms: number): Promise<void>;
  clearError(): void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useProtectionStore = create<ProtectionState>((set, get) => ({
  relays: [],
  study: null,

  faultLocation: "string_feeder",
  positionPct: 50,
  faultType: "3ph",

  loading: false,
  error: null,

  setFaultLocation: (loc) => set({ faultLocation: loc }),
  setPositionPct: (pct) => set({ positionPct: pct }),
  setFaultType: (t) => set({ faultType: t }),

  runStudy: async () => {
    const { faultLocation, positionPct, faultType } = get();
    set({ loading: true, error: null });
    try {
      const [relays, study] = await Promise.all([
        api.getRelays(),
        api.runCoordinationStudy({
          fault_location: faultLocation,
          position_pct: faultLocation === "export_cable" ? positionPct : null,
          fault_type: faultType,
          include_tcc_data: true,
        }),
      ]);
      set({ relays, study });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ loading: false });
    }
  },

  setTms: async (settingId, tms) => {
    try {
      await api.updateRelaySettings(settingId, { tms });
      await get().runStudy();
    } catch (err) {
      set({ error: message(err) });
    }
  },

  clearError: () => set({ error: null }),
}));
