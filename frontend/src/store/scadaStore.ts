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
import {
  BREAKERS,
  deenergisedTurbines,
  initialBreakerStates,
  interlockReason,
  type BreakerId,
  type BreakerStates,
} from "../utils/scadaTopology";
import * as api from "../services/scadaApi";
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

  // SLD actions — returns the reason when the command is blocked
  operateBreaker: (breakerId: BreakerId) => string | null;

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

const GOOSE_FAULT_TRIPS: Record<string, BreakerId[]> = {
  // 220 kV busbar protection clears every bay on the OSS 220 kV busbar
  busbar_overcurrent: ["cb-oss-e1", "cb-oss-e2", "cb-oss-t1", "cb-oss-t2"],
  // 87T trips TX-OSS-01 on both sides; section A goes dead until the
  // operator transfers it to TX-OSS-02 through the bus coupler
  transformer_differential: ["cb-oss-t1", "cb-66-a"],
  // Cable protection opens both ends of export circuit 1
  cable_earth_fault: ["cb-ons-e1", "cb-oss-e1"],
};

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
      alarms: s.alarms.filter(
        (a) =>
          a.state !== "CLEARED" &&
          a.state !== "RETURN_TO_NORMAL" &&
          a.state !== "ACKNOWLEDGED",
      ),
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

  operateBreaker: (breakerId) => {
    const s = get();
    const label = BREAKERS[breakerId].label;
    // RBAC (IEC 62351-8): switchgear control needs L2 Operator or above
    const reason =
      s.selectedRoleLevel < 2
        ? "Viewer role has no control rights (control_switchgear needs L2+)"
        : interlockReason(s.breakerStates, breakerId);
    if (reason) {
      s.addEvent({ source: label, type: "interlock_block", description: `${label} command blocked — ${reason}`, priority: "LOW" });
      return reason;
    }
    const current = s.breakerStates[breakerId];
    const next: BreakerState = current === "CLOSED" ? "OPEN" : "CLOSED";
    const breakerStates = { ...s.breakerStates, [breakerId]: next };
    set({ breakerStates });
    s.addEvent({
      source: label,
      type: "breaker_operation",
      description: `${label} (${BREAKERS[breakerId].bay}) ${current} → ${next} by L${s.selectedRoleLevel} operator`,
      priority: "INFO",
    });
    syncFarm(breakerStates);
    return null;
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
        const turbineNum = Math.floor(Math.random() * 34) + 1;
        const turbineId = `WTG-${String(turbineNum).padStart(2, "0")}`;
        const faultIdx = Math.floor(Math.random() * FAULT_CATEGORIES.length);
        const fault = FAULT_CATEGORIES[faultIdx];

        s.injectTurbineFault(turbineId, fault.type);


        // Also randomly clear older alarms (simulate RTN)
        set((st) => ({
          alarms: st.alarms.map((a) => {
            if (a.state === "ACKNOWLEDGED" && Date.now() - a.timestamp > 30000 && Math.random() > 0.6) {
              return { ...a, state: "RETURN_TO_NORMAL" as const };
            }
            return a;
          }),
        }));

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

      // Convert simulation events to alarms
      const newAlarms: SCADAAlarm[] = simulationResult.events.map((event) => {
        const isCritical = event.event_type === "relay_trip" || event.event_type === "breaker_open";
        const isWarning = event.event_type === "relay_pickup" || event.event_type === "fault_inception";
        const priority: AlarmPriority = isCritical ? "CRITICAL" : isWarning ? "HIGH" : "LOW";

        return {
          id: nextAlarmId(),
          timestamp: Date.now() + event.timestamp_ms,
          priority,
          tag: `GOOSE.${event.event_type}`,
          equipment: event.ied_name || "Substation",
          description: event.description,
          value: `${event.timestamp_ms.toFixed(1)} ms`,
          setpoint: "N/A",
          state: "ACTIVE" as AlarmState,
          durationSec: 0,
          acknowledgedBy: null,
          acknowledgedAt: null,
          shelved: false,
          faultType: selectedFaultType,
          probableCause: `${selectedFaultType.replace(/_/g, " ")} scenario`,
          recommendedAction: "Follow protection coordination procedures",
        };
      });

      // Add to event log
      const newEvents: SOEEvent[] = simulationResult.events.map((event) => ({
        id: nextSOEId(),
        timestamp: Date.now() + event.timestamp_ms,
        source: event.ied_name || "System",
        type: event.event_type,
        description: event.description,
        priority: (event.event_type === "relay_trip" ? "CRITICAL" : "INFO") as AlarmPriority | "INFO",
      }));

      set((s) => ({
        simulationResult,
        retransmissionResult,
        alarms: [...newAlarms, ...s.alarms],
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
      // Animates fault → relay pickup → relay trip → breaker open in the SLD.
      // Scale of 50× makes a 100 ms protection sequence take ~5 s to animate.
      const SCALE = 50;
      const tripped = GOOSE_FAULT_TRIPS[selectedFaultType] ?? [];
      const relayPickup = simulationResult.events.find((e) => e.event_type === "relay_pickup");
      const relayTrip   = simulationResult.events.find((e) => e.event_type === "relay_trip");
      const breakerOpen = simulationResult.events.find((e) => e.event_type === "breaker_open");

      // t=0: highlight the protected zone
      set({ faultHighlightNodeId: selectedFaultType });

      if (relayPickup) {
        setTimeout(() => {
          get().addEvent({
            source: relayPickup.ied_name || "Protection IED",
            type: "relay_pickup",
            description: `Relay pickup — ${relayPickup.description}`,
            priority: "HIGH",
          });
        }, relayPickup.timestamp_ms * SCALE);
      }

      if (relayTrip) {
        setTimeout(() => {
          get().addEvent({
            source: relayTrip.ied_name || "Protection IED",
            type: "relay_trip",
            description: `Relay trip — ${relayTrip.description}`,
            priority: "CRITICAL",
          });
        }, relayTrip.timestamp_ms * SCALE);
      }

      if (breakerOpen) {
        const t = breakerOpen.timestamp_ms * SCALE;
        setTimeout(() => {
          const breakerStates = { ...get().breakerStates };
          for (const id of tripped) breakerStates[id] = "TRIPPED";
          set({ breakerStates });
          syncFarm(breakerStates);
          for (const id of tripped) {
            get().addEvent({
              source: BREAKERS[id].label,
              type: "breaker_open",
              description: `${BREAKERS[id].label} (${BREAKERS[id].bay}) tripped by GOOSE — fault cleared`,
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
