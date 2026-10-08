/**
 * Switchgear topology of the export system for the P3 single-line diagram,
 * built for the live fleet (lib/fleet.ts — SB-510 or the own project):
 *
 *   PSE 400 kV ─ CB-400-1/2 ─ TX-ONS-01/02 (220/400 kV) ─ Onshore 220 kV
 *   Onshore 220 kV ─ CB-ONS-E1…En ─ n export cables ─ CB-OSS-E1…En ─ OSS 220 kV
 *   OSS 220 kV ─ CB-OSS-T1/T2 ─ TX-OSS-01/02 (66/220 kV) ─ incomers A/B ─ 66 kV section A/B
 *   Section A ─ bus coupler (normally open) ─ section B
 *   Strings 1…k on section A, the rest on B (backend FarmSpec.section_a_strings)
 *
 * The 66 kV bays are numbered like the backend bay controller: feeders 01…m,
 * incomer A m+1, coupler m+2, incomer B m+3 (SB-510: 01–06, 07, 08, 09).
 * Breaker ids double as keys of the SCADA store's breaker state.
 */

import { liveFleet, sectionOf, type Fleet } from "../lib/fleet";
import { bayName } from "../lib/lifecycle/farm";
import type { BreakerState } from "../types/scada";

export interface BreakerInfo {
  label: string;
  bay: string;
  kV: number;
}

export type BreakerId = string;
export type BreakerStates = Record<BreakerId, BreakerState>;

interface Topology {
  breakers: Record<BreakerId, BreakerInfo>;
  /** 66 kV breakers operated through a backend bay controller (interlocks ILK-001 … 007, SOE log). */
  bayOf: Record<BreakerId, { bay: string; cb: string }>;
  /** Bay name → SLD breaker id. */
  breakerOfBay: Record<string, BreakerId>;
}

const nn = (n: number) => String(n).padStart(2, "0");

const cache = new WeakMap<Fleet, Topology>();

function topology(f: Fleet): Topology {
  const hit = cache.get(f);
  if (hit) return hit;
  const m = f.strings.length;
  const breakers: Record<BreakerId, BreakerInfo> = {
    "cb-400-1": { label: "CB-400-1", bay: "TX-ONS-01 HV", kV: 400 },
    "cb-400-2": { label: "CB-400-2", bay: "TX-ONS-02 HV", kV: 400 },
  };
  const circuits = Array.from({ length: f.net.num_export_cables }, (_, i) => i + 1);
  for (const i of circuits) breakers[`cb-ons-e${i}`] = { label: `CB-ONS-E${i}`, bay: `Export cable ${i} (onshore)`, kV: 220 };
  for (const i of circuits) breakers[`cb-oss-e${i}`] = { label: `CB-OSS-E${i}`, bay: `Export cable ${i} (OSS)`, kV: 220 };
  breakers["cb-oss-t1"] = { label: "CB-OSS-T1", bay: "TX-OSS-01 HV", kV: 220 };
  breakers["cb-oss-t2"] = { label: "CB-OSS-T2", bay: "TX-OSS-02 HV", kV: 220 };
  const bayOf: Topology["bayOf"] = {};
  const bay66 = (id: BreakerId, n: number, cb: string, what: string) => {
    breakers[id] = { label: `CB-66-${nn(n)}`, bay: `${bayName(n)} · ${what}`, kV: 66 };
    bayOf[id] = { bay: bayName(n), cb };
  };
  bay66("cb-66-a", m + 1, "CB-TX-OSS-LV", "TX-OSS-01 LV");
  bay66("cb-66-b", m + 3, "CB-TX-OSS-02-LV", "TX-OSS-02 LV");
  bay66("cb-66-bc", m + 2, "CB-TIE-66-01", "bus coupler");
  for (let s = 1; s <= m; s++) bay66(`cb-str${s}`, s, `CB-STR-${nn(s)}`, `string ${s}`);
  const breakerOfBay = Object.fromEntries(Object.entries(bayOf).map(([id, v]) => [v.bay, id]));
  const t = { breakers, bayOf, breakerOfBay };
  cache.set(f, t);
  return t;
}

export const breakers = (f: Fleet = liveFleet()) => topology(f).breakers;
export const bayOf = (f: Fleet = liveFleet()) => topology(f).bayOf;
export const breakerOfBay = (f: Fleet = liveFleet()) => topology(f).breakerOfBay;

export function initialBreakerStates(f: Fleet = liveFleet()): BreakerStates {
  const s: BreakerStates = {};
  for (const id of Object.keys(breakers(f))) s[id] = "CLOSED";
  s["cb-66-bc"] = "OPEN"; // sections run split: one transformer per section
  return s;
}

export interface Energisation {
  onshore220: boolean;
  oss220: boolean;
  /** Per export circuit 1…n. */
  cable: boolean[];
  txOss: [boolean, boolean];
  sectionA: boolean;
  sectionB: boolean;
  /** Per string 1…m: feeder live (section live and feeder CB closed). */
  strings: boolean[];
}

/** Which parts of the network are live for a given set of breaker states. */
export function energisation(cb: BreakerStates, f: Fleet = liveFleet()): Energisation {
  const on = (id: BreakerId) => cb[id] === "CLOSED";
  const onshore220 = on("cb-400-1") || on("cb-400-2");
  const cable = Array.from(
    { length: f.net.num_export_cables },
    (_, i) => onshore220 && on(`cb-ons-e${i + 1}`) && on(`cb-oss-e${i + 1}`),
  );
  const oss220 = cable.some(Boolean);
  const txOss: [boolean, boolean] = [oss220 && on("cb-oss-t1"), oss220 && on("cb-oss-t2")];
  const fedA = txOss[0] && on("cb-66-a");
  const fedB = txOss[1] && on("cb-66-b");
  const coupled = on("cb-66-bc");
  const sectionA = fedA || (coupled && fedB);
  const sectionB = fedB || (coupled && fedA);
  const strings = f.strings.map((_, i) => (sectionOf(f, i) === "A" ? sectionA : sectionB) && on(`cb-str${i + 1}`));
  return { onshore220, oss220, cable, txOss, sectionA, sectionB, strings };
}

/** Turbines on a dead feeder — they cannot export and are held offline. */
export function deenergisedTurbines(cb: BreakerStates, f: Fleet = liveFleet()): string[] {
  const { strings } = energisation(cb, f);
  return f.strings.flatMap((ids, i) => (strings[i] ? [] : ids));
}
