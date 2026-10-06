/**
 * Communication Network store — M15.
 * Manages network topology, OPC-UA namespace, and latency budgets.
 */

import { create } from "zustand";
import * as api from "../services/networkApi";
import type {
  NetworkTopologyResponse,
  OPCUANamespaceResponse,
  LatencyBudgetResponse,
} from "../types/network";

interface NetworkState {
  topology: NetworkTopologyResponse | null;
  opcuaNamespace: OPCUANamespaceResponse | null;
  latencyBudgets: LatencyBudgetResponse[];   // [TT6 GOOSE trip, TT3 measurement, TT1 operator display]
  loading: boolean;
  error: string | null;

  fetchAll(): Promise<void>;
  fetchTopology(): Promise<void>;
  fetchOPCUANamespace(): Promise<void>;
  fetchLatencyBudgets(): Promise<void>;
  clearError(): void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  topology: null,
  opcuaNamespace: null,
  latencyBudgets: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [topology, opcuaNamespace, tt6, tt3, tt1] = await Promise.all([
        api.getTopology(),
        api.getOPCUANamespace(),
        api.getLatencyBudget(0),
        api.getLatencyBudget(1),
        api.getLatencyBudget(2),
      ]);
      set({ topology, opcuaNamespace, latencyBudgets: [tt6, tt3, tt1] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch network data" });
    } finally {
      set({ loading: false });
    }
  },

  fetchTopology: async () => {
    try {
      const topology = await api.getTopology();
      set({ topology });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch topology" });
    }
  },

  fetchOPCUANamespace: async () => {
    try {
      const opcuaNamespace = await api.getOPCUANamespace();
      set({ opcuaNamespace });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch OPC-UA namespace" });
    }
  },

  fetchLatencyBudgets: async () => {
    try {
      const [tt6, tt3, tt1] = await Promise.all([
        api.getLatencyBudget(0),
        api.getLatencyBudget(1),
        api.getLatencyBudget(2),
      ]);
      set({ latencyBudgets: [tt6, tt3, tt1] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch latency budgets" });
    }
  },

  clearError: () => set({ error: null }),
}));
