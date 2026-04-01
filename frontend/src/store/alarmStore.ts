/**
 * Alarm Rationalization store — M09 (EEMUA 191).
 * Manages alarm KPIs, rationalization database, chattering, and flood events.
 */

import { create } from "zustand";
import * as api from "../services/alarmApi";
import type {
  AlarmKPIResponse,
  AlarmResponse,
  AlarmRationalizationDetail,
  AlarmFloodEventResponse,
  ChatteringResponse,
} from "../types/alarm";

interface AlarmStoreState {
  kpi: AlarmKPIResponse | null;
  alarms: AlarmResponse[];
  rationalization: AlarmRationalizationDetail[];
  floodEvents: AlarmFloodEventResponse[];
  chattering: ChatteringResponse | null;
  windowHours: number;
  loading: boolean;
  error: string | null;

  fetchAll(): Promise<void>;
  fetchKPI(): Promise<void>;
  fetchAlarms(): Promise<void>;
  fetchChatterers(): Promise<void>;
  shelveAlarm(alarmId: string, operatorId: string, reason: string, durationHours: number): Promise<void>;
  unshelveAlarm(alarmId: string, operatorId: string): Promise<void>;
  setWindowHours(hours: number): void;
  clearError(): void;
}

export const useAlarmStore = create<AlarmStoreState>((set, get) => ({
  kpi: null,
  alarms: [],
  rationalization: [],
  floodEvents: [],
  chattering: null,
  windowHours: 24,
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [kpi, alarms, rationalization, floodEvents, chattering] = await Promise.all([
        api.getAlarmKPI(get().windowHours),
        api.getAlarms(),
        api.getRationalization(),
        api.getFloodEvents(),
        api.getChatterers(),
      ]);
      set({ kpi, alarms, rationalization, floodEvents, chattering });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch alarm data" });
    } finally {
      set({ loading: false });
    }
  },

  fetchKPI: async () => {
    try {
      const kpi = await api.getAlarmKPI(get().windowHours);
      set({ kpi });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch alarm KPIs" });
    }
  },

  fetchAlarms: async () => {
    try {
      const alarms = await api.getAlarms();
      set({ alarms });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch alarms" });
    }
  },

  fetchChatterers: async () => {
    try {
      const chattering = await api.getChatterers();
      set({ chattering });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch chattering data" });
    }
  },

  shelveAlarm: async (alarmId, operatorId, reason, durationHours) => {
    try {
      await api.shelveAlarm(alarmId, { operator_id: operatorId, reason, duration_hours: durationHours });
      await get().fetchAlarms();
      await get().fetchKPI();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Shelve alarm failed" });
    }
  },

  unshelveAlarm: async (alarmId, operatorId) => {
    try {
      await api.unshelveAlarm(alarmId, { operator_id: operatorId });
      await get().fetchAlarms();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Unshelve alarm failed" });
    }
  },

  setWindowHours: (hours) => set({ windowHours: hours }),
  clearError: () => set({ error: null }),
}));
