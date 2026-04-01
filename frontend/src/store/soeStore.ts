/**
 * SOE Recorder store — M02.
 * Manages sequence of events log with filtering and stats.
 */

import { create } from "zustand";
import * as api from "../services/soeApi";
import type {
  SOEQueryResponse,
  SOEStatsResponse,
  SOEQueryParams,
  SOEEventType,
  SOESeverity,
} from "../types/soe";

interface SOEState {
  queryResult: SOEQueryResponse | null;
  stats: SOEStatsResponse | null;
  // Active filters
  filterDevice: string;
  filterEventType: SOEEventType | "";
  filterSeverity: SOESeverity | "";
  filterUnacknowledgedOnly: boolean;
  windowHours: number;
  loading: boolean;
  error: string | null;

  fetchSOE(params?: SOEQueryParams): Promise<void>;
  fetchStats(): Promise<void>;
  acknowledgeEvent(eventId: number, operatorId: string): Promise<void>;
  setFilterDevice(device: string): void;
  setFilterEventType(type: SOEEventType | ""): void;
  setFilterSeverity(severity: SOESeverity | ""): void;
  setFilterUnacknowledgedOnly(val: boolean): void;
  setWindowHours(hours: number): void;
  applyFilters(): Promise<void>;
  clearError(): void;
}

export const useSOEStore = create<SOEState>((set, get) => ({
  queryResult: null,
  stats: null,
  filterDevice: "",
  filterEventType: "",
  filterSeverity: "",
  filterUnacknowledgedOnly: false,
  windowHours: 24,
  loading: false,
  error: null,

  fetchSOE: async (params?: SOEQueryParams) => {
    set({ loading: true, error: null });
    try {
      const queryResult = await api.querySOE(params ?? { limit: 100 });
      set({ queryResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch SOE log" });
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api.getSOEStats(get().windowHours);
      set({ stats });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch SOE stats" });
    }
  },

  acknowledgeEvent: async (eventId: number, operatorId: string) => {
    try {
      await api.acknowledgeSOEEvent(eventId, { operator_id: operatorId });
      // Refresh log
      await get().applyFilters();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Acknowledge failed" });
    }
  },

  setFilterDevice: (device) => set({ filterDevice: device }),
  setFilterEventType: (type) => set({ filterEventType: type }),
  setFilterSeverity: (severity) => set({ filterSeverity: severity }),
  setFilterUnacknowledgedOnly: (val) => set({ filterUnacknowledgedOnly: val }),
  setWindowHours: (hours) => set({ windowHours: hours }),

  applyFilters: async () => {
    const { filterDevice, filterEventType, filterSeverity, filterUnacknowledgedOnly } = get();
    const params: SOEQueryParams = { limit: 200 };
    if (filterDevice) params.source_devices = [filterDevice];
    if (filterEventType) params.event_types = [filterEventType];
    if (filterSeverity) params.severities = [filterSeverity];
    if (filterUnacknowledgedOnly) params.unacknowledged_only = true;
    await get().fetchSOE(params);
    await get().fetchStats();
  },

  clearError: () => set({ error: null }),
}));
