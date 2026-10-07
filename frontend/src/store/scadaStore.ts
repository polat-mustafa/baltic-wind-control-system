/**
 * Zustand store for P3 SCADA & IEC 61850 dashboard state.
 *
 * Manages:
 * - IEC 61850 device registry + GOOSE fault simulation
 * - ISA-18.2 alarm lifecycle (ACTIVE → ACK → CLEARED → RTN)
 * - Auto-simulation: random turbine faults every 45-90s
 * - Breaker states for SLD live visualization
 * - Persistent event history (last 200 events)
 * - RBAC roles/zones and Permit-to-Work lifecycle
 */

import { create } from "zustand";

import { FAULT_CATEGORIES } from "../constants/faultCategories";
import { useFaultBus } from "./faultBus";
import { useLandingStore } from "./landingStore";
import { liveFleet, stringsOn, useFleetStore, type Fleet } from "../lib/fleet";
import {
  bayOf,
  breakerOfBay,
  breakers,
  deenergisedTurbines,
  initialBreakerStates,
  type BreakerId,
  type BreakerStates,
} from "../utils/scadaTopology";
import * as api from "../services/scadaApi";
import * as bayApi from "../services/bayApi";
import type { BayStateResponse } from "../types/bay";
import type {
  BreakerState,
  FaultScenarioSummary,
  FaultSimulationResult,
  IEC62443Zone,
  PermitDetail,
  PermitList,
  RetransmissionResult,
  RoleDefinition,
  SCADAAlarm,
  AlarmPriority,
  AlarmState,
  SubstationSummary,
  TurbineFaultType,
  TransitionResult,
} from "../types/scada";

// ── Helpers ──────────────────────────────────────────────────────

let _alarmIdCounter = 0;
function nextAlarmId(): string {
  return `ALM-${String(++_alarmIdCounter).padStart(4, "0")}`;
}

let _autoSimInterval: ReturnType<typeof setInterval> | null = null;
let _alarmTickInterval: ReturnType<typeof setInterval> | null = null;

// ── SOE Event for persistent log ─────────────────────────────────

export interface SOEEvent {
  id: string;
  timestamp: number;
  source: string;
  type: string;
  description: string;
  priority: AlarmPriority | "INFO";
}

let _soeIdCounter = 0;
function nextSOEId(): string {
  return `SOE-${String(++_soeIdCounter).padStart(5, "0")}`;
}

// ── ISA-101 Navigation Hierarchy ────────────────────────────────
// Level 2 areas (4) → Level 3 sub-tabs.

export type ScadaArea =
  | "operations"
  | "equipment"
  | "diagnostics"
  | "engineering";

export type ScadaSubTab =
  // operations
  | "mimic"
  | "sld"
  | "alarms"
  | "permits"
  | "events"
  | "bays"
  // equipment
  | "cms"
  | "vibration"
  | "historian"
  // diagnostics
  | "goose"
  | "soe"
  | "interlocks"
  | "network"
  // engineering
  | "rbac"
  | "security"
  | "opcua"
  | "scl"
  | "almrat";

// ── Store Interface ────────────────────────────────────────────

interface ScadaState {
  // Device registry
  substationSummary: SubstationSummary | null;

  // GOOSE simulation
  faultScenarios: FaultScenarioSummary[];
  selectedFaultType: string;
  simulationResult: FaultSimulationResult | null;
  retransmissionResult: RetransmissionResult | null;

  // RBAC
  roles: RoleDefinition[];
  zones: IEC62443Zone[];
  selectedRoleLevel: number;

  // Permit-to-Work
  permitList: PermitList | null;
  activePermit: PermitDetail | null;

  // ISA-18.2 Alarm System
  alarms: SCADAAlarm[];
  alarmFilter: {
    priority: AlarmPriority | "ALL";
    state: AlarmState | "ALL";
    equipment: string;
  };

  // SLD live state
  breakerStates: BreakerStates;
  faultHighlightNodeId: string | null;

  // Persistent event log
  eventLog: SOEEvent[];

  // Auto-simulation
  autoSimEnabled: boolean;

  // GOOSE alarm selection (for detail side panel)
  selectedAlarmId: string | null;

  // UI state
  loading: boolean;
  error: string | null;
  dataLoaded: boolean;

  // ISA-101 navigation (Level 2 area + per-area Level 3 sub-tab)
  area: ScadaArea;
  subTabs: Record<ScadaArea, ScadaSubTab>;

  // Parameter setters
  setSelectedFaultType: (ft: string) => void;
  setSelectedRoleLevel: (level: number) => void;
  setAlarmFilter: (filter: Partial<ScadaState["alarmFilter"]>) => void;
  setArea: (area: ScadaArea) => void;
  setSubTab: (area: ScadaArea, subTab: ScadaSubTab) => void;

  // Alarm actions
  acknowledgeAlarm: (alarmId: string, operator: string) => void;
  acknowledgeAll: (operator: string) => void;
  clearAlarm: (alarmId: string) => void;
  clearAllResolved: () => void;
  shelveAlarm: (alarmId: string) => void;
  unshelveAlarm: (alarmId: string) => void;
  injectTurbineFault: (turbineId: string, faultType: TurbineFaultType) => void;
  /** Inject fault from bus — same as injectTurbineFault but skips re-publishing to bus. */
  injectTurbineFaultFromBus: (turbineId: string, faultType: TurbineFaultType) => void;
  /** Transition active/acknowledged alarm for turbine to RETURN_TO_NORMAL. */
  transitionAlarmToRTN: (turbineId: string) => void;

  // SLD actions — resolves to the reason when the command is blocked
  operateBreaker: (breakerId: BreakerId) => Promise<string | null>;
  /** Mirror the 66 kV breaker positions reported by the bay controllers. */
  syncFromBays: (bays: BayStateResponse[]) => void;

  // Auto-simulation
  startAutoSimulation: () => void;
  stopAutoSimulation: () => void;

  // Event log
  addEvent: (event: Omit<SOEEvent, "id" | "timestamp">) => void;
  clearEventLog: () => void;

  // Data actions
  fetchInitialData: () => Promise<void>;
  runGooseSimulation: () => Promise<void>;
  calculateRetransmission: () => Promise<void>;
  fetchPermits: () => Promise<void>;
  openPermit: (ptwNumber: string) => Promise<void>;
  createPermit: (params: {
    work_description: string;
    equipment_id: string;
    requested_by: string;
    person_in_charge?: string;
  }) => Promise<PermitDetail | null>;
  transitionPermit: (
    ptwNumber: string,
    params: {
      target_status: string;
      performed_by: string;
      user_level: number;
      notes?: string;
    },
  ) => Promise<TransitionResult | null>;

  // Simulation
  clearSimulationResults: () => void;

  // Alarm selection
  setSelectedAlarm: (id: string | null) => void;

  // Utility
  clearError: () => void;
}

// ── GOOSE fault → breakers tripped ───────────────────────────────
// Keys are the backend scenario ids (GET /scada/goose/scenarios).

interface ProtectionScenario {
  /** Master-alarm-database tag of the trip alarm (backend alarm_manager). */
  tag: string;
  trips: BreakerId[];
  zone: string;
  protection: string;
  cause: string;
  action: string;
}

/** Protection scenarios on the live fleet's switchgear (SB-510: strings 1–3 on A, CB-66-08, 2 cables). */
function gooseScenarios(f: Fleet = liveFleet()): Record<string, ProtectionScenario> {
  const n = f.net.num_export_cables;
  const a = stringsOn(f, "A").map((i) => i + 1);
  const onA = a.length > 1 ? `strings ${a[0]}–${a[a.length - 1]}` : `string ${a[0]}`;
  const coupler = breakers(f)["cb-66-bc"].label;
  const rest = n === 2 ? "cable 2" : `cables 2–${n}`;
  return {
    busbar_overcurrent: {
      tag: "OSS-220.87B.TRIP",
      trips: [...Array.from({ length: n }, (_, i) => `cb-oss-e${i + 1}`), "cb-oss-t1", "cb-oss-t2"],
      zone: "OSS 220 kV busbar",
      protection: "Busbar differential protection (87B)",
      cause: "Three-phase fault on the OSS 220 kV busbar — all bays on the busbar opened, the whole farm is disconnected",
      action: "Do not re-energise until the busbar is inspected; check the disturbance record, then restore cable 1 → busbar → transformers",
    },
    transformer_differential: {
      tag: "TX-OSS-01.87T.TRIP",
      trips: ["cb-oss-t1", "cb-66-a"],
      zone: "TX-OSS-01",
      protection: "Transformer differential (87T)",
      cause: `Internal fault in TX-OSS-01 — both sides opened, 66 kV section A (${onA}) is dead`,
      action: `Lock out TX-OSS-01 (Buchholz/DGA check). Restore section A via bus coupler ${coupler} and limit TX-OSS-02 to ${f.net.oss_trafo_mva} MVA`,
    },
    cable_earth_fault: {
      tag: "CABLE-1.87L.TRIP",
      trips: ["cb-ons-e1", "cb-oss-e1"],
      zone: "Export cable 1",
      protection: "Cable differential / directional earth fault (87L / 67N)",
      cause:
        n > 1
          ? `Single-phase earth fault on export cable 1 — both ends opened, the farm runs on ${rest}`
          : "Single-phase earth fault on the only export cable — both ends opened, the farm is disconnected",
      action:
        n > 1
          ? `No auto-reclose on cable. Check ${rest} loading against 950 A; arrange fault location before re-energising`
          : "No auto-reclose on cable. Arrange fault location; one export circuit has no redundancy (N-0), the farm stays off until the repair",
    },
  };
}

const goose = (faultType: string): ProtectionScenario | undefined => gooseScenarios()[faultType];

/** Feeders follow the switchgear: dead strings are held offline in the farm sim. */
function syncFarm(states: BreakerStates): void {
  useLandingStore.getState().setDeenergised(deenergisedTurbines(states));
}

// ── Store Implementation ───────────────────────────────────────

export const useScadaStore = create<ScadaState>((set, get) => ({
  // Device registry
  substationSummary: null,

  // GOOSE simulation
  faultScenarios: [],
  selectedFaultType: "busbar_overcurrent",
  simulationResult: null,
  retransmissionResult: null,

  // RBAC
  roles: [],
  zones: [],
  selectedRoleLevel: 4,

  // PtW
  permitList: null,
  activePermit: null,

  // ISA-18.2 Alarms
  alarms: [],
  alarmFilter: { priority: "ALL", state: "ALL", equipment: "" },

  // SLD
  breakerStates: initialBreakerStates(),
  faultHighlightNodeId: null,

  // Event log
  eventLog: [],

  // Auto-sim
  autoSimEnabled: false,

  // Alarm selection
  selectedAlarmId: null,

  // UI
  loading: false,
  error: null,
  dataLoaded: false,

  // ISA-101 nav defaults — operator landing on Operations · Plant Mimic
  area: "operations",
  subTabs: {
    operations: "mimic",
    equipment: "cms",
    diagnostics: "goose",
    engineering: "rbac",
  },

  // ── Parameter setters ──────────────────────────────────────

  setSelectedFaultType: (ft) => set({ selectedFaultType: ft }),
  setSelectedRoleLevel: (level) => set({ selectedRoleLevel: level }),
  setAlarmFilter: (filter) =>
    set((s) => ({ alarmFilter: { ...s.alarmFilter, ...filter } })),
  setArea: (area) => set({ area }),
  setSubTab: (area, subTab) =>
    set((s) => ({ subTabs: { ...s.subTabs, [area]: subTab } })),

  setSelectedAlarm: (id) => set({ selectedAlarmId: id }),

  // ── Alarm Actions ──────────────────────────────────────────

  acknowledgeAlarm: (alarmId, operator) =>
    set((s) => ({
      alarms: s.alarms.map((a) =>
        a.id === alarmId
          ? { ...a, state: "ACKNOWLEDGED" as const, acknowledgedBy: operator, acknowledgedAt: Date.now() }
          : a,
      ),
    })),

  acknowledgeAll: (operator) =>
    set((s) => ({
      alarms: s.alarms.map((a) =>
        a.state === "ACTIVE"
          ? { ...a, state: "ACKNOWLEDGED" as const, acknowledgedBy: operator, acknowledgedAt: Date.now() }
          : a,
      ),
    })),

  clearAlarm: (alarmId) =>
    set((s) => ({
      alarms: s.alarms.map((a) =>
        a.id === alarmId ? { ...a, state: "CLEARED" as const } : a,
      ),
    })),

  clearAllResolved: () =>
    set((s) => ({
      alarms: s.alarms.filter((a) => a.state !== "CLEARED" && a.state !== "RETURN_TO_NORMAL"),
    })),

  shelveAlarm: (alarmId) =>
    set((s) => ({
      alarms: s.alarms.map((a) =>
        a.id === alarmId ? { ...a, shelved: true } : a,
      ),
    })),

  unshelveAlarm: (alarmId) =>
    set((s) => ({
      alarms: s.alarms.map((a) =>
        a.id === alarmId ? { ...a, shelved: false } : a,
      ),
    })),

  injectTurbineFault: (turbineId, faultType) => {
    const category = FAULT_CATEGORIES.find((c) => c.type === faultType);
    if (!category) return;

    const alarm: SCADAAlarm = {
      id: nextAlarmId(),
      timestamp: Date.now(),
      priority: category.priority,
      tag: `${turbineId}.${faultType}`,
      equipment: turbineId,
      description: `${category.label} — ${turbineId}`,
      value: category.valueTemplate(),
      setpoint: category.setpoint,
      state: "ACTIVE",
      durationSec: 0,
      acknowledgedBy: null,
      acknowledgedAt: null,
      shelved: false,
      faultType: category.type,
      probableCause: category.probableCause,
      recommendedAction: category.recommendedAction,
    };

    const event: SOEEvent = {
      id: nextSOEId(),
      timestamp: Date.now(),
      source: turbineId,
      type: faultType,
      description: `${category.label} on ${turbineId}`,
      priority: category.priority,
    };

    set((s) => ({
      alarms: [alarm, ...s.alarms],
      eventLog: [event, ...s.eventLog].slice(0, 200),
    }));

    // Publish to unified fault bus → syncs to landing map
    useFaultBus.getState().publishFault(turbineId, faultType, "scada");
  },

  injectTurbineFaultFromBus: (turbineId, faultType) => {
    // Same alarm creation as injectTurbineFault but does NOT re-publish to bus
    const category = FAULT_CATEGORIES.find((c) => c.type === faultType);
    if (!category) return;

    const alarm: SCADAAlarm = {
      id: nextAlarmId(),
      timestamp: Date.now(),
      priority: category.priority,
      tag: `${turbineId}.${faultType}`,
      equipment: turbineId,
      description: `${category.label} — ${turbineId}`,
      value: category.valueTemplate(),
      setpoint: category.setpoint,
      state: "ACTIVE",
      durationSec: 0,
      acknowledgedBy: null,
      acknowledgedAt: null,
      shelved: false,
      faultType: category.type,
      probableCause: category.probableCause,
      recommendedAction: category.recommendedAction,
    };

    const event: SOEEvent = {
      id: nextSOEId(),
      timestamp: Date.now(),
      source: turbineId,
      type: faultType,
      description: `${category.label} on ${turbineId} (synced)`,
      priority: category.priority,
    };

    set((s) => ({
      alarms: [alarm, ...s.alarms],
      eventLog: [event, ...s.eventLog].slice(0, 200),
    }));
  },

  transitionAlarmToRTN: (turbineId) =>
    set((s) => ({
      alarms: s.alarms.map((a) =>
        a.equipment === turbineId && (a.state === "ACTIVE" || a.state === "ACKNOWLEDGED")
          ? { ...a, state: "RETURN_TO_NORMAL" as const }
          : a,
      ),
    })),

  // ── SLD Actions ────────────────────────────────────────────

  operateBreaker: async (breakerId) => {
    const s = get();
    const { label, bay } = breakers()[breakerId];
    const current = s.breakerStates[breakerId];
    const next: BreakerState = current === "CLOSED" ? "OPEN" : "CLOSED";
    let reason: string | null =
      s.selectedRoleLevel < 2 ? "Viewer role has no control rights (control_switchgear needs L2+)" : null;
    const owner = bayOf()[breakerId];
    if (!reason && owner) {
      // 66 kV: the bay controller enforces the interlocks and logs the SOE
      try {
        await bayApi.executeBayCommand(owner.bay, {
          equipment_id: owner.cb,
          action: next === "CLOSED" ? "close" : "open",
          operator_id: `L${s.selectedRoleLevel}-operator`,
          is_auto_reclose: false,
          synchrocheck: null,
        });
      } catch (err) {
        reason = (err instanceof Error ? err.message : String(err)).replace(/^.*?Interlock violation for \S+ \w+: /, "");
      }
    }
    if (reason) {
      s.addEvent({ source: label, type: "interlock_block", description: `${label} command blocked — ${reason}`, priority: "LOW" });
      return reason;
    }
    const breakerStates = { ...get().breakerStates, [breakerId]: next };
    set({ breakerStates });
    s.addEvent({
      source: label,
      type: "breaker_operation",
      description: `${label} (${bay}) ${current} → ${next} by L${s.selectedRoleLevel} operator`,
      priority: "INFO",
    });
    syncFarm(breakerStates);
    // Protection trip alarms return to normal when all their breakers are closed again
    set((st) => ({
      alarms: st.alarms.map((a) => {
        const scenario = a.tag.endsWith(".TRIP") && a.faultType ? goose(a.faultType)?.trips : undefined;
        const inAlarm = a.state === "ACTIVE" || a.state === "ACKNOWLEDGED";
        return scenario && inAlarm && scenario.every((id) => breakerStates[id] === "CLOSED")
          ? { ...a, state: "RETURN_TO_NORMAL" as const }
          : a;
      }),
    }));
    return null;
  },

  syncFromBays: (bays) => {
    const breakerStates = { ...get().breakerStates };
    let changed = false;
    for (const b of bays) {
      const id = breakerOfBay()[b.name];
      if (!id) continue;
      const cur = breakerStates[id];
      const next: BreakerState = b.circuit_breaker === "closed" ? "CLOSED" : cur === "TRIPPED" ? "TRIPPED" : "OPEN";
      if (next !== cur) {
        breakerStates[id] = next;
        changed = true;
      }
    }
    if (changed) {
      set({ breakerStates });
      syncFarm(breakerStates);
    }
  },

  // ── Auto-Simulation ───────────────────────────────────────

  startAutoSimulation: () => {
    const state = get();
    if (state.autoSimEnabled) return;
    set({ autoSimEnabled: true });

    // Generate random faults every 45-90s (first fault fires in ~3s)
    const scheduleFault = (isFirst = false) => {
      const delay = isFirst ? 3000 : 45000 + Math.random() * 45000;
      _autoSimInterval = setTimeout(() => {
        const s = get();
        if (!s.autoSimEnabled) return;

        // Pick random turbine and fault
        const fleetIds = liveFleet().turbines;
        const turbineId = fleetIds[Math.floor(Math.random() * fleetIds.length)].id;
        const faultIdx = Math.floor(Math.random() * FAULT_CATEGORIES.length);
        const fault = FAULT_CATEGORIES[faultIdx];

        s.injectTurbineFault(turbineId, fault.type);



        scheduleFault();
      }, delay) as unknown as ReturnType<typeof setInterval>;
    };

    scheduleFault(true);

    // Update alarm durations every second (guard against duplicate if GOOSE sim already started it)
    if (!_alarmTickInterval) {
    _alarmTickInterval = setInterval(() => {
      set((s) => ({
        alarms: s.alarms.map((a) =>
          a.state === "ACTIVE" || a.state === "ACKNOWLEDGED"
            ? { ...a, durationSec: Math.round((Date.now() - a.timestamp) / 1000) }
            : a,
        ),
      }));
    }, 1000);
    } // end if (!_alarmTickInterval)
  },

  stopAutoSimulation: () => {
    set({ autoSimEnabled: false });
    if (_autoSimInterval) {
      clearTimeout(_autoSimInterval as unknown as number);
      _autoSimInterval = null;
    }
    if (_alarmTickInterval) {
      clearInterval(_alarmTickInterval);
      _alarmTickInterval = null;
    }
  },

  // ── Event Log ──────────────────────────────────────────────

  addEvent: (event) =>
    set((s) => ({
      eventLog: [
        { ...event, id: nextSOEId(), timestamp: Date.now() },
        ...s.eventLog,
      ].slice(0, 200),
    })),

  clearEventLog: () => set({ eventLog: [] }),

  // ── Data actions ───────────────────────────────────────────

  fetchInitialData: async () => {
    set({ loading: true, error: null });

    try {
      const [substationSummary, faultScenarios, roles, zones, permitList] =
        await Promise.all([
          api.getSubstationSummary(),
          api.listFaultScenarios(),
          api.listRoles(),
          api.listZones(),
          api.listPermits(),
        ]);

      set({
        substationSummary,
        faultScenarios,
        roles,
        zones,
        permitList,
        dataLoaded: true,
      });
      bayApi
        .getAllBays()
        .then((r) => get().syncFromBays(r.bays))
        .catch(() => undefined);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  runGooseSimulation: async () => {
    const { selectedFaultType } = get();
    set({ loading: true, error: null });

    try {
      const [simulationResult, retransmissionResult] = await Promise.all([
        api.runFaultSimulation(selectedFaultType),
        api.calculateRetransmission(),
      ]);

      // Add to event log
      const newEvents: SOEEvent[] = simulationResult.events.map((event) => ({
        id: nextSOEId(),
        timestamp: Date.now() + event.timestamp_ms,
        source: event.ied_name || "System",
        type: event.event_type,
        description: event.description,
        priority: "INFO" as const,
      }));

      set((s) => ({
        simulationResult,
        retransmissionResult,
        eventLog: [...newEvents, ...s.eventLog].slice(0, 200),
      }));

      // ── Duration ticker ──────────────────────────────────────
      // Start the ticker if auto-sim hasn't already started it, so durationSec
      // advances on manually-created GOOSE alarms without needing auto-sim.
      if (!_alarmTickInterval) {
        _alarmTickInterval = setInterval(() => {
          set((s) => ({
            alarms: s.alarms.map((a) =>
              a.state === "ACTIVE" || a.state === "ACKNOWLEDGED"
                ? { ...a, durationSec: Math.round((Date.now() - a.timestamp) / 1000) }
                : a,
            ),
          }));
        }, 1000);
      }

      // ── SLD Animation (scaled: 1 ms real → 50 ms display) ───
      // The fault zone flashes at once; the breakers open (and the P1 alarm
      // is raised) at the breaker-open time of the backend sequence.
      // Scale of 50× makes a 100 ms protection sequence take ~5 s to animate.
      const SCALE = 50;
      const tripped = goose(selectedFaultType)?.trips ?? [];
      const breakerOpen = simulationResult.events.find((e) => e.event_type === "breaker_open");

      // t=0: highlight the protected zone
      set({ faultHighlightNodeId: selectedFaultType });

      if (breakerOpen) {
        const t = breakerOpen.timestamp_ms * SCALE;
        setTimeout(() => {
          const breakerStates = { ...get().breakerStates };
          for (const id of tripped) {
            breakerStates[id] = "TRIPPED";
            const owner = bayOf()[id];
            if (owner) {
              void bayApi
                .executeBayCommand(owner.bay, { equipment_id: owner.cb, action: "open", operator_id: "PROTECTION", is_auto_reclose: false, synchrocheck: null })
                .catch(() => undefined);
            }
          }
          set({ breakerStates });
          syncFarm(breakerStates);
          const sc = goose(selectedFaultType);
          if (sc) {
            const alarm: SCADAAlarm = {
              id: nextAlarmId(),
              timestamp: Date.now(),
              priority: "CRITICAL",
              tag: sc.tag,
              equipment: sc.zone,
              description: `${sc.protection} operated — ${tripped.length} breakers open`,
              value: `${breakerOpen.timestamp_ms.toFixed(0)} ms`,
              setpoint: "≤ 100 ms clearing",
              state: "ACTIVE",
              durationSec: 0,
              acknowledgedBy: null,
              acknowledgedAt: null,
              shelved: false,
              faultType: selectedFaultType,
              probableCause: sc.cause,
              recommendedAction: sc.action,
            };
            set((st) => ({ alarms: [alarm, ...st.alarms] }));
          }
          for (const id of tripped) {
            get().addEvent({
              source: breakers()[id].label,
              type: "breaker_open",
              description: `${breakers()[id].label} (${breakers()[id].bay}) tripped by GOOSE — fault cleared`,
              priority: "CRITICAL",
            });
          }
        }, t);
        // Clear highlight 5 s after breaker opens; breaker stays TRIPPED for operator to see
        setTimeout(() => set({ faultHighlightNodeId: null }), t + 5000);
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ loading: false });
    }
  },

  calculateRetransmission: async () => {
    try {
      const retransmissionResult = await api.calculateRetransmission();
      set({ retransmissionResult });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  fetchPermits: async () => {
    try {
      const permitList = await api.listPermits();
      set({ permitList });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  openPermit: async (ptwNumber) => {
    try {
      set({ activePermit: await api.getPermitDetail(ptwNumber) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  createPermit: async (params) => {
    try {
      const permit = await api.createPermit(params);
      const permitList = await api.listPermits();
      set({ activePermit: permit, permitList });
      return permit;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  transitionPermit: async (ptwNumber, params) => {
    try {
      const result = await api.transitionPermit(ptwNumber, params);
      const [activePermit, permitList] = await Promise.all([
        api.getPermitDetail(ptwNumber),
        api.listPermits(),
      ]);
      set({ activePermit, permitList });
      return result;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  },

  // ── Simulation ─────────────────────────────────────────────

  clearSimulationResults: () => {
    // Stop the duration ticker if auto-sim isn't running (it was started by runGooseSimulation)
    if (_alarmTickInterval && !get().autoSimEnabled) {
      clearInterval(_alarmTickInterval);
      _alarmTickInterval = null;
    }
    set({ simulationResult: null, retransmissionResult: null });
  },

  // ── Utility ────────────────────────────────────────────────

  clearError: () => set({ error: null }),
}));

// ── Alarm journal → backend (EEMUA 191 KPIs, rationalisation) ─────
// Every alarm state change, whichever action caused it, is reported once.

useScadaStore.subscribe((next, prev) => {
  if (next.alarms === prev.alarms) return;
  const before = new Map(prev.alarms.map((a) => [a.id, a]));
  const send = (a: SCADAAlarm, transition: api.AlarmTransition) =>
    void api
      .logAlarmTransition({ tag: a.tag, transition, source_device: a.equipment, operator_id: a.acknowledgedBy })
      .catch(() => undefined);
  for (const a of next.alarms) {
    const b = before.get(a.id);
    if (!b) {
      if (a.state === "ACTIVE") send(a, "NORMAL_TO_ACTIVE");
      continue;
    }
    if (b.state === "ACTIVE" && a.state === "ACKNOWLEDGED") send(a, "ACTIVE_TO_ACK");
    if (a.state === "RETURN_TO_NORMAL" && b.state !== a.state) {
      send(a, b.state === "ACKNOWLEDGED" ? "ACK_TO_NORMAL" : "ACTIVE_TO_NORMAL");
    }
    if (a.shelved !== b.shelved) send(a, a.shelved ? "SHELVED" : "UNSHELVED");
  }
});

// A new live fleet brings its own switchboard: breakers back to normal, alarms of the old plant dropped.
useFleetStore.subscribe((st, prev) => {
  if (st.fleet !== prev.fleet) {
    useScadaStore.setState({ breakerStates: initialBreakerStates(st.fleet), alarms: [], faultHighlightNodeId: null });
  }
});
