/** Planning & P2X store — both studies are analytic (milliseconds on the backend). */

import { create } from "zustand";

import { currentNetwork } from "./gridStore";
import { post } from "../services/apiClient";
import type { ExportResponse, P2XRequest, P2XResponse } from "../types/planning";

interface PlanningState extends P2XRequest {
  design_length_km: number;
  exportStudy: ExportResponse | null;
  p2x: P2XResponse | null;
  error: string | null;
  setParams(p: Partial<P2XRequest & { design_length_km: number }>): void;
  runExport(): Promise<void>;
  runP2X(): Promise<void>;
  clearError(): void;
}

export const usePlanningStore = create<PlanningState>((set, get) => {
  const guard = async (fn: () => Promise<Partial<PlanningState>>) => {
    try {
      set(await fn());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  };
  return {
    design_length_km: 45,
    connection_mw: 400,
    electrolyser_mw: 60,
    capex_eur_per_kw: 2000,
    exportStudy: null,
    p2x: null,
    error: null,
    setParams: (p) => set(p),
    runExport: () =>
      guard(async () => ({
        exportStudy: await post<ExportResponse>("/api/v1/grid/planning/export", { design_length_km: get().design_length_km }),
      })),
    runP2X: () =>
      guard(async () => {
        const { electrolyser_mw, capex_eur_per_kw } = get();
        const connection_mw = Math.min(get().connection_mw, currentNetwork().total_capacity_mw); // the backend refuses more than the farm
        return { p2x: await post<P2XResponse>("/api/v1/grid/planning/p2x", { connection_mw, electrolyser_mw, capex_eur_per_kw }) };
      }),
    clearError: () => set({ error: null }),
  };
});
