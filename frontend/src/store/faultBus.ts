/**
 * Unified Fault Event Bus — single source of truth for active faults.
 *
 * Both landingStore and scadaStore publish faults here. The useFaultSync
 * hook subscribes and propagates faults across stores. A `source` field
 * prevents infinite loops: each store ignores events it originated.
 *
 * Flow:
 *   Landing fault tick → publishFault("WTG-07", "PITCH_CONTROL_FAULT", "landing")
 *     → bus notifies subscribers
 *     → scadaStore (source≠"scada") → creates ISA-18.2 alarm
 *     → does NOT re-publish → no loop
 */

import { create } from "zustand";

import type { TurbineFaultType } from "../types/scada";

// ── Types ────────────────────────────────────────────────────────

export type FaultSource = "landing" | "scada";

export interface FaultEvent {
  turbineId: string;
  faultType: TurbineFaultType;
  source: FaultSource;
  timestamp: number;
}

export type FaultAction = "add" | "remove";

export type FaultListener = (
  action: FaultAction,
  event: FaultEvent,
) => void;

// ── Store ────────────────────────────────────────────────────────

interface FaultBusState {
  activeFaults: Record<string, FaultEvent>;
  listeners: Set<FaultListener>;

  publishFault: (turbineId: string, faultType: TurbineFaultType, source: FaultSource) => void;
  clearFault: (turbineId: string, source: FaultSource) => void;
  subscribe: (listener: FaultListener) => () => void;
}

export const useFaultBus = create<FaultBusState>((set, get) => ({
  activeFaults: {},
  listeners: new Set(),

  publishFault: (turbineId, faultType, source) => {
    const { activeFaults, listeners } = get();

    // Dedup: skip if same turbineId + faultType already active
    const existing = activeFaults[turbineId];
    if (existing && existing.faultType === faultType) return;

    const event: FaultEvent = {
      turbineId,
      faultType,
      source,
      timestamp: Date.now(),
    };

    set({ activeFaults: { ...activeFaults, [turbineId]: event } });

    // Notify listeners outside of set() to avoid nested state updates
    for (const listener of listeners) {
      listener("add", event);
    }
  },

  clearFault: (turbineId, source) => {
    const { activeFaults, listeners } = get();
    const existing = activeFaults[turbineId];
    if (!existing) return;

    const rest = { ...activeFaults };
    delete rest[turbineId];
    set({ activeFaults: rest });

    const event: FaultEvent = { ...existing, source };
    for (const listener of listeners) {
      listener("remove", event);
    }
  },

  subscribe: (listener) => {
    const { listeners } = get();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
}));
