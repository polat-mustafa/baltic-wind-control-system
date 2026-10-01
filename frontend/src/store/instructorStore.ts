/**
 * Instructor console — runs a free-form training session on the live farm.
 *
 * The instructor injects disturbances (turbine faults, a 66 kV array cable
 * fault, grid frequency / voltage events, a wind veer); the session recorder
 * watches the plant and logs what the operator does about each one, so the
 * debrief can show a timeline with response times:
 *
 *   turbine fault     → cleared when the turbine leaves "fault"
 *   array cable fault → cleared when the faulted section is isolated
 *   grid event        → cleared when the event ends (ride-through)
 *   wind veer         → cleared when the whole farm is within 10° of the wind
 *
 * Plant samples (farm MW, frequency, active alarms) are taken on every
 * simulation tick for the debrief chart. Sessions export as JSON.
 */

import { create } from "zustand";

import { useLandingStore } from "./landingStore";
import { injectRandomArrayFault } from "../training/scenarios";
import type { GridEventKind } from "../utils/gridEvents";
import type { TurbineFaultType } from "../types/scada";

export type InjectionKind = "turbine-fault" | "array-fault" | "grid-event" | "wind-veer";

export interface SessionEvent {
  /** ms since session start */
  t: number;
  kind: InjectionKind | "operator" | "note";
  text: string;
  /** Injection id this event belongs to (injections and their clearance). */
  ref?: number;
}

export interface Injection {
  id: number;
  kind: InjectionKind;
  label: string;
  t: number;
  /** ms since start when the plant was back to normal, null while open. */
  clearedT: number | null;
  /** internal: what to watch */
  target?: string;
}

export interface PlantSample {
  t: number;
  mw: number;
  hz: number;
  alarms: number;
}

interface InstructorState {
  recording: boolean;
  startedAt: number | null;
  events: SessionEvent[];
  injections: Injection[];
  samples: PlantSample[];
  start: () => void;
  stop: () => void;
  note: (text: string) => void;
  injectTurbineFault: (turbineId: string, fault: TurbineFaultType) => void;
  injectArrayFault: () => void;
  injectGridEvent: (kind: GridEventKind) => void;
  injectWindVeer: (deltaDeg: number) => void;
  exportJson: () => string;
}

const land = () => useLandingStore.getState();
let unsub: (() => void) | null = null;
let nextId = 1;

export const useInstructorStore = create<InstructorState>((set, get) => {
  const now = () => Date.now() - (get().startedAt ?? Date.now());
  const log = (e: Omit<SessionEvent, "t">) => set((s) => ({ events: [...s.events, { ...e, t: now() }] }));
  const open = (kind: InjectionKind, label: string, target?: string) => {
    if (!get().recording) get().start();
    const id = nextId++;
    set((s) => ({ injections: [...s.injections, { id, kind, label, t: now(), clearedT: null, target }] }));
    log({ kind, text: label, ref: id });
  };
  const clear = (inj: Injection, text: string) => {
    set((s) => ({ injections: s.injections.map((i) => (i.id === inj.id ? { ...i, clearedT: now() } : i)) }));
    log({ kind: "operator", text: `${text} (${((now() - inj.t) / 1000).toFixed(0)} s)`, ref: inj.id });
  };

  /** One pass over the open injections against the current plant state. */
  const watch = () => {
    const s = land();
    for (const inj of get().injections) {
      if (inj.clearedT !== null) continue;
      if (inj.kind === "turbine-fault" && inj.target && s.turbineMap[inj.target]?.status !== "fault") {
        clear(inj, `${inj.target} fault reset`);
      } else if (inj.kind === "array-fault" && (!s.arrayFault || s.arrayFault.stage === "isolated")) {
        clear(inj, "faulted section isolated, healthy turbines restored");
      } else if (inj.kind === "grid-event" && !s.gridEvent) {
        clear(inj, "grid event ridden through");
      } else if (inj.kind === "wind-veer") {
        const dir = s.kpis.windDirectionDeg;
        const worst = Math.max(
          ...Object.values(s.turbineMap)
            .filter((t) => t.status !== "fault" && t.status !== "offline")
            .map((t) => Math.abs(((t.nacellePositionDeg - dir + 540) % 360) - 180)),
        );
        if (worst < 10) clear(inj, "farm realigned with the wind");
      }
    }
  };

  return {
    recording: false,
    startedAt: null,
    events: [],
    injections: [],
    samples: [],

    start: () => {
      unsub?.();
      nextId = 1;
      set({ recording: true, startedAt: Date.now(), events: [], injections: [], samples: [] });
      log({ kind: "note", text: "Session started" });
      let prevMap = land().turbineMap;
      unsub = useLandingStore.subscribe((s) => {
        if (s.turbineMap !== prevMap) {
          prevMap = s.turbineMap;
          set((st) => ({
            samples: [...st.samples, { t: now(), mw: s.kpis.totalOutputMW, hz: s.kpis.gridFrequencyHz, alarms: s.kpis.activeAlerts }],
          }));
        }
        watch();
      });
    },

    stop: () => {
      unsub?.();
      unsub = null;
      log({ kind: "note", text: "Session ended" });
      set({ recording: false });
    },

    note: (text) => log({ kind: "note", text }),

    injectTurbineFault: (turbineId, fault) => {
      land().setTurbineFault(turbineId, fault);
      open("turbine-fault", `${turbineId}: ${fault.replace(/_/g, " ").toLowerCase()}`, turbineId);
    },

    injectArrayFault: () => {
      land().restoreArrayFault();
      const f = injectRandomArrayFault();
      open("array-fault", `66 kV cable fault on string ${f.string} (${f.segmentKey.replace("cable-", "")})`);
    },

    injectGridEvent: (kind) => {
      land().triggerGridEvent(kind);
      open("grid-event", `grid ${kind.replace("-", " ")}`);
    },

    injectWindVeer: (deltaDeg) => {
      const from = land().kpis.windDirectionDeg;
      const to = (((from + deltaDeg) % 360) + 360) % 360;
      land().setManualWindDir(to);
      open("wind-veer", `wind veer ${deltaDeg > 0 ? "+" : ""}${deltaDeg}° → ${to.toFixed(0)}°`);
    },

    exportJson: () => {
      const { startedAt, events, injections, samples } = get();
      return JSON.stringify({ startedAt: startedAt && new Date(startedAt).toISOString(), events, injections, samples }, null, 2);
    },
  };
});

/** Response-time summary for the debrief. */
export function debriefStats(injections: Injection[]) {
  const done = injections.filter((i) => i.clearedT !== null);
  const times = done.map((i) => ((i.clearedT as number) - i.t) / 1000);
  return {
    injected: injections.length,
    cleared: done.length,
    meanS: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    worstS: times.length ? Math.max(...times) : null,
  };
}
