/**
 * Cable DTS store — one 220 kV export circuit of the modelled farm (X-Farm header).
 * Defaults come from the farm (GET /cable/dts/farm): SB-510 ≈ 778 A at the more loaded end
 * of each circuit at 510 MW (P2 load flow, 94 % of 825 A on the 108 km route) and
 * ≈ 1 362 A on the survivor after an N-1 trip, before the runback.
 */

import { create } from "zustand";

import * as api from "../services/cableDtsApi";
import { farmKey } from "../lib/project/farmHeader";
import type { DTSFarm, DTSProfileResponse, DTSTransientResponse } from "../types/cableDts";

// SB-510 until the farm loads (per circuit, A)
const NORMAL_CURRENT_A = 778;
const N1_CURRENT_A = 1362;

interface Params {
  currentA: number;
  ambientC: number;
  emergencyA: number;
}

interface CableDTSState extends Params {
  farm: DTSFarm | null;
  /** farmKey() the farm and its currents belong to. */
  farmFor: string | null;
  loadFarm(): Promise<void>;
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
    farm: null,
    farmFor: null,
    profile: null,
    transient: null,
    error: null,
    setParams: (p) => set(p),
    loadFarm: () => {
      const id = farmKey();
      return guard(async () => {
        const farm = await api.getDTSFarm();
        return { farm, farmFor: id, currentA: farm.normal_current_a, emergencyA: farm.n1_current_a ?? farm.normal_current_a };
      });
    },
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
