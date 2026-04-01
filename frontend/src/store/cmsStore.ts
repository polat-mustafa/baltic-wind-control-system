/**
 * CMS (Condition Monitoring System) store — M12.
 * Fleet health, turbine detail, vibration FFT, oil analysis, alerts.
 */

import { create } from "zustand";
import * as api from "../services/cmsApi";
import type {
  FleetHealthResponse,
  TurbineHealthResponse,
  VibrationSpectrumResponse,
  OilAnalysisResponse,
  CMSAlertResponse,
  FaultInjectionRequest,
  FaultInjectionResponse,
  CMSComponent,
} from "../types/cms";

interface CMSState {
  fleetHealth: FleetHealthResponse | null;
  turbineHealth: TurbineHealthResponse | null;
  vibration: VibrationSpectrumResponse | null;
  oilAnalysis: OilAnalysisResponse | null;
  alerts: CMSAlertResponse[];
  lastFaultInjection: FaultInjectionResponse | null;
  // Selection
  selectedTurbineId: string;
  selectedComponent: CMSComponent;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;

  fetchFleetHealth(): Promise<void>;
  fetchTurbineDetail(turbineId: string): Promise<void>;
  fetchVibration(turbineId: string, component: CMSComponent): Promise<void>;
  injectFault(req: FaultInjectionRequest): Promise<void>;
  setSelectedTurbineId(id: string): void;
  setSelectedComponent(c: CMSComponent): void;
  clearError(): void;
}

export const useCMSStore = create<CMSState>((set, get) => ({
  fleetHealth: null,
  turbineHealth: null,
  vibration: null,
  oilAnalysis: null,
  alerts: [],
  lastFaultInjection: null,
  selectedTurbineId: "WTG-01",
  selectedComponent: "GEARBOX",
  loading: false,
  detailLoading: false,
  error: null,

  fetchFleetHealth: async () => {
    set({ loading: true, error: null });
    try {
      const [fleetHealth, alerts] = await Promise.all([
        api.getFleetOverview(),
        api.getCMSAlerts(),
      ]);
      set({ fleetHealth, alerts });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch fleet health" });
    } finally {
      set({ loading: false });
    }
  },

  fetchTurbineDetail: async (turbineId: string) => {
    set({ detailLoading: true, error: null, selectedTurbineId: turbineId });
    try {
      const [turbineHealth, oilAnalysis] = await Promise.all([
        api.getTurbineHealth(turbineId),
        api.getOilAnalysis(turbineId),
      ]);
      set({ turbineHealth, oilAnalysis });
      // Also fetch vibration for the selected component
      const vibration = await api.getVibrationSpectrum(turbineId, get().selectedComponent);
      set({ vibration });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch turbine detail" });
    } finally {
      set({ detailLoading: false });
    }
  },

  fetchVibration: async (turbineId: string, component: CMSComponent) => {
    set({ selectedComponent: component });
    try {
      const vibration = await api.getVibrationSpectrum(turbineId, component);
      set({ vibration });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch vibration" });
    }
  },

  injectFault: async (req: FaultInjectionRequest) => {
    const { selectedTurbineId } = get();
    try {
      const lastFaultInjection = await api.simulateFault(selectedTurbineId, req);
      set({ lastFaultInjection });
      // Refresh fleet health to show the degradation
      await get().fetchFleetHealth();
      await get().fetchTurbineDetail(selectedTurbineId);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Fault injection failed" });
    }
  },

  setSelectedTurbineId: (id) => set({ selectedTurbineId: id }),
  setSelectedComponent: (c) => set({ selectedComponent: c }),
  clearError: () => set({ error: null }),
}));
