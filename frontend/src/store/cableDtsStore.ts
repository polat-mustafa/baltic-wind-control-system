/**
 * Cable DTS store — one 220 kV export circuit. Defaults: 730 A per circuit
 * (510 MW over two circuits), 1 360 A on the survivor after an N-1 trip.
 */

import { create } from "zustand";

import * as api from "../services/cableDtsApi";
import type { DTSProfileResponse, DTSTransientResponse } from "../types/cableDts";

export const N1_CURRENT_A = 1360;
export const NORMAL_CURRENT_A = 730;

interface Params {
  currentA: number;
  ambientC: number;
  emergencyA: number;
}

interface CableDTSState extends Params {
  profile: DTSProfileResponse | null;
  transient: DTSTransientResponse | null;
  error: string | null;
  setParams(p: Partial<Params>): void;
  runProfile(): Promise<void>;
  runTransient(): Promise<void>;
  clearError(): void;
}

export const useCableDTSStore = create<CableDTSState>((set, get) => {
  const guard = async (fn: () => Promise<Partial<CableDTSState>>) => {
    try {
      set(await fn());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  };
  return {
    currentA: NORMAL_CURRENT_A,
    ambientC: 15,
    emergencyA: N1_CURRENT_A,
    profile: null,
    transient: null,
    error: null,
    setParams: (p) => set(p),
    runProfile: () => guard(async () => ({ profile: await api.getDTSProfile(get().currentA, get().ambientC) })),
    runTransient: () => {
      const { currentA, emergencyA, ambientC } = get();
      return guard(async () => ({
        transient: await api.simTransient({ prefault_current_a: currentA, emergency_current_a: emergencyA, ambient_temp_c: ambientC }),
      }));
    },
    clearError: () => set({ error: null }),
  };
});
