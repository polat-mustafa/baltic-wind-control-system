/**
 * Bay Controller store — M01.
 * Manages state for all 8 OSS bays, interlock status, and command validation.
 */

import { create } from "zustand";
import * as api from "../services/bayApi";
import type {
  AllBaysResponse,
  BayStateResponse,
  InterlockStatusResponse,
  SwitchCommandRequest,
  CommandExecutionResponse,
  ValidateCommandRequest,
  CommandValidationResponse,
} from "../types/bay";

interface BayState {
  allBays: AllBaysResponse | null;
  selectedBayId: string | null;
  selectedBayState: BayStateResponse | null;
  interlockStatus: InterlockStatusResponse | null;
  lastCommandResult: CommandExecutionResponse | null;
  validationResult: CommandValidationResponse | null;
  loading: boolean;
  commandLoading: boolean;
  error: string | null;

  fetchAllBays(): Promise<void>;
  selectBay(bayId: string): Promise<void>;
  fetchInterlocks(bayId: string): Promise<void>;
  executeCommand(bayId: string, cmd: SwitchCommandRequest): Promise<void>;
  validateCommand(req: ValidateCommandRequest): Promise<void>;
  clearError(): void;
  clearCommandResult(): void;
}

export const useBayStore = create<BayState>((set, get) => ({
  allBays: null,
  selectedBayId: null,
  selectedBayState: null,
  interlockStatus: null,
  lastCommandResult: null,
  validationResult: null,
  loading: false,
  commandLoading: false,
  error: null,

  fetchAllBays: async () => {
    set({ loading: true, error: null });
    try {
      const allBays = await api.getAllBays();
      set({ allBays });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch bays" });
    } finally {
      set({ loading: false });
    }
  },

  selectBay: async (bayId: string) => {
    set({ selectedBayId: bayId, loading: true, error: null });
    try {
      const [selectedBayState, interlockStatus] = await Promise.all([
        api.getBayState(bayId),
        api.getBayInterlocks(bayId),
      ]);
      set({ selectedBayState, interlockStatus });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch bay detail" });
    } finally {
      set({ loading: false });
    }
  },

  fetchInterlocks: async (bayId: string) => {
    try {
      const interlockStatus = await api.getBayInterlocks(bayId);
      set({ interlockStatus });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch interlocks" });
    }
  },

  executeCommand: async (bayId: string, cmd: SwitchCommandRequest) => {
    set({ commandLoading: true, error: null, lastCommandResult: null });
    try {
      const lastCommandResult = await api.executeBayCommand(bayId, cmd);
      set({ lastCommandResult });
      // Refresh bay state after command
      await get().selectBay(bayId);
      await get().fetchAllBays();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Command execution failed" });
    } finally {
      set({ commandLoading: false });
    }
  },

  validateCommand: async (req: ValidateCommandRequest) => {
    try {
      const validationResult = await api.validateCommand(req);
      set({ validationResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Validation failed" });
    }
  },

  clearError: () => set({ error: null }),
  clearCommandResult: () => set({ lastCommandResult: null, validationResult: null }),
}));
