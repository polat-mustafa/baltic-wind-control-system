/**
 * Bay controller store — M01. The backend bay controllers own the 66 kV
 * switchgear positions; every refresh is mirrored into the SCADA store so
 * the single-line diagram and the farm simulation follow.
 */

import { create } from "zustand";

import * as api from "../services/bayApi";
import { useScadaStore } from "./scadaStore";
import type {
  AllBaysResponse,
  CommandValidationResponse,
  InterlockStatusResponse,
  SwitchCommand,
} from "../types/bay";

interface BayState {
  allBays: AllBaysResponse | null;
  /** Bay name, e.g. "BAY-OSS-66-03". */
  selectedBay: string | null;
  interlocks: Record<string, InterlockStatusResponse>;
  validation: (CommandValidationResponse & { equipment_id: string; action: SwitchCommand }) | null;
  busy: boolean;
  error: string | null;

  fetchAllBays(): Promise<void>;
  fetchAllInterlocks(): Promise<void>;
  selectBay(name: string | null): void;
  /** Dry run (IEC 61850 select): shows whether the interlocks allow it. */
  validate(bay: string, equipmentId: string, action: SwitchCommand): Promise<void>;
  /** Operate after a successful validation. */
  execute(bay: string, equipmentId: string, action: SwitchCommand): Promise<void>;
  clearValidation(): void;
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const useBayStore = create<BayState>((set, get) => ({
  allBays: null,
  selectedBay: null,
  interlocks: {},
  validation: null,
  busy: false,
  error: null,

  fetchAllBays: async () => {
    try {
      const allBays = await api.getAllBays();
      set({ allBays, error: null });
      useScadaStore.getState().syncFromBays(allBays.bays);
    } catch (err) {
      set({ error: message(err) });
    }
  },

  fetchAllInterlocks: async () => {
    const bays = get().allBays?.bays ?? [];
    try {
      const list = await Promise.all(bays.map((b) => api.getBayInterlocks(b.name)));
      set({ interlocks: Object.fromEntries(bays.map((b, i) => [b.name, list[i]])) });
    } catch (err) {
      set({ error: message(err) });
    }
  },

  selectBay: (name) => set({ selectedBay: name, validation: null }),

  validate: async (bay, equipment_id, action) => {
    set({ busy: true, validation: null });
    try {
      const v = await api.validateCommand({
        bay_id: bay,
        equipment_id,
        action,
        operator_id: `L${useScadaStore.getState().selectedRoleLevel}-operator`,
        is_auto_reclose: false,
        synchrocheck: null,
      });
      set({ validation: { ...v, equipment_id, action } });
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ busy: false });
    }
  },

  execute: async (bay, equipment_id, action) => {
    const level = useScadaStore.getState().selectedRoleLevel;
    if (level < 2) {
      set({ error: "Viewer role has no control rights (control_switchgear needs L2+)" });
      return;
    }
    set({ busy: true });
    try {
      const r = await api.executeBayCommand(bay, {
        equipment_id,
        action,
        operator_id: `L${level}-operator`,
        is_auto_reclose: false,
        synchrocheck: null,
      });
      useScadaStore.getState().addEvent({
        source: equipment_id,
        type: "breaker_operation",
        description: `${bay} · ${r.message}`,
        priority: "INFO",
      });
      set({ validation: null, error: null });
      await get().fetchAllBays();
      await get().fetchAllInterlocks();
    } catch (err) {
      set({ error: message(err) });
    } finally {
      set({ busy: false });
    }
  },

  clearValidation: () => set({ validation: null, error: null }),
}));
