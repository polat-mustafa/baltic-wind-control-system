/**
 * OPC-UA store — M03.
 * Manages server status and address space tree.
 */

import { create } from "zustand";
import * as api from "../services/opcuaApi";
import type {
  OPCUAStatusResponse,
  OPCUAAddressSpaceResponse,
} from "../types/opcua";

interface OPCUAState {
  status: OPCUAStatusResponse | null;
  addressSpace: OPCUAAddressSpaceResponse | null;
  loading: boolean;
  error: string | null;

  fetchAll(): Promise<void>;
  fetchStatus(): Promise<void>;
  fetchAddressSpace(): Promise<void>;
  clearError(): void;
}

export const useOPCUAStore = create<OPCUAState>((set) => ({
  status: null,
  addressSpace: null,
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [status, addressSpace] = await Promise.all([
        api.getOPCUAStatus(),
        api.getAddressSpace(),
      ]);
      set({ status, addressSpace });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch OPC-UA data" });
    } finally {
      set({ loading: false });
    }
  },

  fetchStatus: async () => {
    try {
      const status = await api.getOPCUAStatus();
      set({ status });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch OPC-UA status" });
    }
  },

  fetchAddressSpace: async () => {
    set({ loading: true, error: null });
    try {
      const addressSpace = await api.getAddressSpace();
      set({ addressSpace });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch address space" });
    } finally {
      set({ loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
