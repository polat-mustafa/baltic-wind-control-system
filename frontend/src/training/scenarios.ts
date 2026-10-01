/**
 * Training scenarios for the landing map — each tied to a real procedure or
 * grid-code clause. Plant behaviour comes from the live simulation (store),
 * not from scripted numbers, so the trainee sees the same physics as always.
 */

import { TURBINE_POSITIONS } from "../constants/windFarmLayout";
import { useLandingStore } from "../store/landingStore";

export type TrainingEvent =
  | { type: "cable-selected"; stringNumber: number; segmentKey: string }
  | { type: "isolate"; segmentKey: string; ok: boolean }
  | { type: "grid-event"; kind: string };

export interface QuizOption {
  label: string;
  correct: boolean;
  why: string;
}

export interface Step {
  id: string;
  kind: "action" | "quiz";
  say: string | (() => string);
  hint?: string;
  /** Action steps: done when this returns true (plant state or events). */
  check?: (events: TrainingEvent[]) => boolean;
  /** Spoken when an action step completes. */
  done?: string;
  /** Immediate feedback on an operator event (wrong actions = mistakes). */
  onEvent?: (e: TrainingEvent) => { ok: boolean; why: string } | undefined;
  options?: () => QuizOption[];
  onEnter?: () => void;
}

export interface Scenario {
  id: string;
  title: string;
  summary: string;
  refs: string[];
  parS: number;
  intro: string;
  debrief: string;
  setup: () => void;
  teardown?: () => void;
  steps: Step[];
}

const store = () => useLandingStore.getState();
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

// ── 1. Array cable fault ─────────────────────────────────────────

const STRINGS = [1, 2, 3, 4, 5, 6].map((n) => TURBINE_POSITIONS.filter((t) => t.stringNumber === n).map((t) => t.id));
let cf: { string: number; segmentKey: string; beyond: string[]; restorable: string[] } = {
  string: 1,
  segmentKey: "",
  beyond: [],
  restorable: [],
};

/**
 * Trip a random inter-turbine section t[i-1] → t[i] (i = 1 … n-2, so both
 * sides have turbines) with isolation left to the operator. Shared by the
 * cable-fault drill and the instructor console.
 */
export function injectRandomArrayFault(): { string: number; segmentKey: string; beyond: string[]; restorable: string[] } {
  const n = 1 + Math.floor(Math.random() * 6);
  const ids = STRINGS[n - 1];
  const i = 1 + Math.floor(Math.random() * (ids.length - 2));
  const f = { string: n, segmentKey: `cable-${ids[i - 1]}-${ids[i]}`, beyond: ids.slice(0, i), restorable: ids.slice(i) };
  store().injectArrayFault({ segmentKey: f.segmentKey, stringNumber: n, stringIds: ids, beyondIds: f.beyond, manual: true });
  return f;
}

const cableFault: Scenario = {
  id: "cable-fault",
  title: "66 kV array cable fault",
  summary: "Feeder trips. Use the fault passage indicators to find the faulted section, isolate it and restore the healthy turbines.",
  refs: ["IEC 60255-151 (over-current / earth-fault protection)", "Radial collection system, FPI practice", "IEC 60502-2 / 62067 cable repair"],
  parS: 120,
  intro: "Scenario: array cable fault. You are the control room operator.",
  debrief:
    "On a radial string only the section between two switchgears is lost; fault passage indicators tell you which one, so the healthy turbines are back within minutes instead of days.",
  setup: () => {
    store().restoreArrayFault();
    cf = injectRandomArrayFault();
  },
  teardown: () => store().restoreArrayFault(),
  steps: [
    {
      id: "find-string",
      kind: "action",
      say: () =>
        `Alarm: feeder breaker BAY-OSS-66-0${cf.string} tripped on earth-fault protection. All turbines of string ${cf.string} are off. Click one of string ${cf.string}'s cables on the map.`,
      hint: "Tripped turbines are grey. The feeder cable (string head → OSS) is dashed dark — click it.",
      check: (ev) => ev.some((e) => e.type === "cable-selected" && e.stringNumber === cf.string),
      done: "Good, that is the tripped string.",
    },
    {
      id: "isolate",
      kind: "action",
      say: () =>
        `Yellow fault passage indicators are lit at ${cf.restorable.join(", ")}: fault current flowed through their switchgear. Click the section just beyond the last lit indicator and press "Open switch and isolate".`,
      hint: "Fault current flows from the OSS to the fault. The fault is on the cable right after the last turbine whose indicator is lit — walk the string with \"next section out ▶\" in the cable card.",
      check: () => store().arrayFault?.stage === "isolated",
      onEvent: (e) =>
        e.type === "isolate" && !e.ok
          ? {
              ok: false,
              why: `That section is healthy. The last lit indicator is at ${cf.restorable[0]}, so the fault is on the cable just beyond it.`,
            }
          : undefined,
      done: "Section isolated, feeder breaker re-closed. The healthy turbines are coming back.",
    },
    {
      id: "why-off",
      kind: "quiz",
      say: () => `Why do ${cf.beyond.join(", ")} stay offline?`,
      options: () => [
        {
          label: "They are beyond the fault on a radial string — no path to the OSS",
          correct: true,
          why: "A radial string has one path; everything past the open section has no grid until the cable is repaired (or a ring/back-feed exists).",
        },
        {
          label: "Their protection is blocked until someone resets it on site",
          correct: false,
          why: "Their switchgear is healthy; they simply have no grid connection.",
        },
        {
          label: "The OSS transformer is overloaded",
          correct: false,
          why: "The OSS unit has plenty of margin with one string down.",
        },
      ],
    },
    {
      id: "repair",
      kind: "action",
      say: "A cable repair takes a jack-up or cable vessel and typically weeks. For the drill, press 'Repair cable and re-energise string' in the cable card.",
      check: () => store().arrayFault === null,
      done: "String fully back in service.",
    },
  ],
};

// ── 2. Turbine component fault → crew dispatch ───────────────────

let tf = "WTG-15";

function vesselOptions() {
  const { environment, kpis } = store();
  const hs = environment.significantWaveHeightM;
  const u10 = kpis.freestreamWindMs * (10 / 150) ** 0.1;
  const ctv = hs <= 1.5 && u10 <= 10;
  const sov = hs <= 2.5 && u10 <= 15;
  const best = ctv ? "ctv" : sov ? "sov" : "none";
  const now = `Now Hs ${hs.toFixed(1)} m, 10 m wind ${u10.toFixed(1)} m/s.`;
  return [
    { label: "Crew transfer vessel from Ustka (Hs ≤ 1.5 m)", correct: best === "ctv", why: `${now} CTV limits: Hs ≤ 1.5 m, wind ≤ 10 m/s.` },
    { label: "Service operation vessel, walk-to-work gangway (Hs ≤ 2.5 m)", correct: best === "sov", why: `${now} SOV limits: Hs ≤ 2.5 m, wind ≤ 15 m/s; CTV is cheaper when it can go.` },
    { label: "No transfer now — wait for a weather window", correct: best === "none", why: `${now} Both vessels are outside their access limits.` },
  ];
}

const turbineFault: Scenario = {
  id: "turbine-fault",
  title: "Pitch system fault — reset or dispatch?",
  summary: "A turbine trips on a pitch fault. Decide the response, pick the vessel the sea state allows, and watch the crew fix it.",
  refs: ["ISA-18.2 alarm management", "IEC 61400-26-1 availability (downtime categories)", "Vessel access limits: backend services/p1/weather_window.py"],
  parS: 150,
  intro: "Scenario: turbine pitch fault.",
  debrief: "Remote reset first, a crew when the fault is a component failure — and the sea state, not the calendar, decides which vessel can go.",
  setup: () => {
    const healthy = TURBINE_POSITIONS.filter((t) => store().turbineMap[t.id]?.status === "operating");
    tf = pick(healthy.length ? healthy : TURBINE_POSITIONS).id;
    store().setTurbineFault(tf, "PITCH_CONTROL_FAULT");
  },
  steps: [
    {
      id: "first-response",
      kind: "quiz",
      say: () => `${tf} tripped: pitch control fault, critical priority. What is your first response?`,
      options: () => [
        {
          label: "One remote reset; if it re-trips, dispatch a crew",
          correct: true,
          why: "A single remote reset clears many nuisance trips; a repeat on a safety system means a component problem.",
        },
        {
          label: "Keep resetting until it runs",
          correct: false,
          why: "Repeated resets of a safety-related trip are against procedure — they can damage the drivetrain or blades.",
        },
        { label: "Wait — it will clear by itself", correct: false, why: "A pitch fault holds the turbine feathered until it is fixed." },
      ],
    },
    {
      id: "vessel",
      kind: "quiz",
      say: () => `The reset failed: the pitch actuator needs replacing. Which transfer is possible now?`,
      options: vesselOptions,
    },
    {
      id: "repair",
      kind: "action",
      say: () => `Crew dispatched. Watch the vessel and technicians work on ${tf}. The repair is shown in about 45 seconds.`,
      hint: "If the sea is too rough, the vessels wait — press Skip to end the drill.",
      check: () => store().turbineMap[tf]?.status === "operating",
      done: "Repair complete, turbine back on line.",
    },
  ],
};

// ── 3. Under-frequency event ─────────────────────────────────────

const elapsedS = () => {
  const ev = store().gridEvent;
  return ev ? (Date.now() - ev.startedAt) / 1000 / ev.slowMo : 0;
};

const underFrequency: Scenario = {
  id: "underfrequency",
  title: "Loss of 3 GW in Continental Europe",
  summary: "The reference incident. Watch the frequency and learn why a wind farm at full output cannot help — unless it keeps a reserve.",
  refs: ["ENTSO-E SOGL Art. 153 (FCR dimensioning, 3 GW reference incident)", "NC RfG Art. 15(2)(c) LFSM-U", "PSE IRiESP"],
  parS: 120,
  intro: "Scenario: a large generator trips somewhere in Continental Europe.",
  debrief:
    "Inverter-based plants only give upward frequency response if the controller holds headroom; the price is energy spilled all the time. That trade-off is why FCR is a paid service.",
  setup: () => {
    store().setDeltaReserve(0);
    store().triggerGridEvent("underfrequency");
  },
  teardown: () => {
    store().setDeltaReserve(0);
    store().clearGridEvent();
  },
  steps: [
    {
      id: "watch",
      kind: "action",
      say: "Three gigawatts of generation just tripped. Watch the frequency in the Grid events panel.",
      check: () => elapsedS() > 16,
      done: "The frequency bottomed out near 49.7 hertz and FCR is pulling it back.",
    },
    {
      id: "why",
      kind: "quiz",
      say: "Frequency fell well below 49.8 hertz. Why did the farm's output not rise?",
      options: () => [
        {
          label: "It runs at maximum power point: no headroom for LFSM-U",
          correct: true,
          why: "LFSM-U asks for more power below 49.8 Hz, but a plant already at maximum available power has nothing to add.",
        },
        { label: "Wind turbines cannot respond to frequency", correct: false, why: "Their converters can respond within a second — if power is held back." },
        { label: "The STATCOM absorbed the response", correct: false, why: "A STATCOM exchanges reactive power; it cannot supply active power." },
      ],
    },
    {
      id: "reserve",
      kind: "action",
      say: "Set a 5 percent delta reserve in the Grid events panel and repeat the event.",
      check: () => {
        const ev = store().gridEvent;
        return !!ev && ev.kind === "underfrequency" && ev.reservePct >= 5 && elapsedS() > 16;
      },
      done: "Now the farm pushed extra power into the dip.",
    },
    {
      id: "cost",
      kind: "quiz",
      say: "What did the 5 percent reserve buy, and what did it cost?",
      options: () => [
        {
          label: "About 16 MW of fast upward response, for about 5 % less energy all the time",
          correct: true,
          why: "Droop 5 %: ΔP = P/0.05 × (49.8 − f)/50 ≈ 16 MW at 49.72 Hz, capped by the headroom.",
        },
        { label: "Unlimited response at no cost", correct: false, why: "The response is capped by the headroom and the headroom is spilled energy." },
        { label: "It only improves voltage", correct: false, why: "It is active-power headroom; voltage is the reactive side." },
      ],
    },
  ],
};

// ── 4. Voltage dip / FRT ─────────────────────────────────────────

const voltageDip: Scenario = {
  id: "voltage-dip",
  title: "400 kV fault near Słupsk — ride through",
  summary: "A line fault drops the PCC voltage to 0.3 pu for 140 ms. See the farm stay connected, inject reactive current and recover.",
  refs: ["NC RfG Art. 16 / 20 (FRT, fast fault current)", "PSE IRiESP LVRT profile", "backend services/p2/frt_simulation.py"],
  parS: 90,
  intro: "Scenario: a fault on the 400 kilovolt grid near Słupsk.",
  debrief: "Fault ride-through keeps the plant on line so the grid does not lose 500 MW on top of the fault; the reactive current helps the protection see and clear it.",
  setup: () => store().triggerGridEvent("voltage-dip"),
  teardown: () => store().clearGridEvent(),
  steps: [
    {
      id: "watch",
      kind: "action",
      say: "Watch the voltage and the farm's response. The event is replayed ten times slower.",
      check: () => elapsedS() > 1.6,
      done: "Voltage recovered and the farm stayed connected.",
    },
    {
      id: "iq",
      kind: "quiz",
      say: "During the dip active power fell almost to zero. Why?",
      options: () => [
        {
          label: "Converters give reactive current priority: ΔIq = 2 × ΔU, capped at rated current",
          correct: true,
          why: "With 0.3 pu voltage the reactive current demand is above 1 pu, so no current is left for active power.",
        },
        { label: "The turbines tripped", correct: false, why: "They stayed connected — the voltage stayed above the LVRT envelope." },
        { label: "The wind dropped", correct: false, why: "140 ms is far too short for the wind to change." },
      ],
    },
    {
      id: "recovery",
      kind: "quiz",
      say: "How fast must active power come back after the fault is cleared?",
      options: () => [
        { label: "At least 90 % within about 1 second", correct: true, why: "That is the recovery requirement used for this Type D plant." },
        { label: "Within 10 minutes", correct: false, why: "Far too slow — the grid needs the power back almost at once." },
        { label: "It stays off until manually reconnected", correct: false, why: "Ride-through means it never disconnects." },
      ],
    },
  ],
};

export const SCENARIOS: Scenario[] = [cableFault, turbineFault, underFrequency, voltageDip];
