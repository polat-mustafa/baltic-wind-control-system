/**
 * Switchgear topology of the export system for the P3 single-line diagram.
 *
 *   PSE 400 kV ─ CB-400-1/2 ─ TX-ONS-01/02 (220/400 kV, 2 × 300 MVA) ─ Onshore 220 kV
 *   Onshore 220 kV ─ CB-ONS-E1/E2 ─ 2 × 45 km export cable ─ CB-OSS-E1/E2 ─ OSS 220 kV
 *   OSS 220 kV ─ CB-OSS-T1/T2 ─ TX-OSS-01/02 (66/220 kV) ─ CB-66-A/B ─ 66 kV section A/B
 *   Section A ─ bus coupler CB-66-BC (normally open) ─ section B
 *   Section A: strings 1–3, section B: strings 4–6 (backend STRING_BUSBAR_SECTION)
 *
 * Breaker ids double as keys of the SCADA store's breaker state; bay names
 * for the 66 kV switchboard match the bay controller (BAY-OSS-66-01 … 09).
 */

import { OSS_BUSBAR_SECTION, TURBINE_POSITIONS } from "../constants/windFarmLayout";
import type { BreakerState } from "../types/scada";

export const BREAKERS = {
  "cb-400-1": { label: "CB-400-1", bay: "TX-ONS-01 HV", kV: 400 },
  "cb-400-2": { label: "CB-400-2", bay: "TX-ONS-02 HV", kV: 400 },
  "cb-ons-e1": { label: "CB-ONS-E1", bay: "Export cable 1 (onshore)", kV: 220 },
  "cb-ons-e2": { label: "CB-ONS-E2", bay: "Export cable 2 (onshore)", kV: 220 },
  "cb-oss-e1": { label: "CB-OSS-E1", bay: "Export cable 1 (OSS)", kV: 220 },
  "cb-oss-e2": { label: "CB-OSS-E2", bay: "Export cable 2 (OSS)", kV: 220 },
  "cb-oss-t1": { label: "CB-OSS-T1", bay: "TX-OSS-01 HV", kV: 220 },
  "cb-oss-t2": { label: "CB-OSS-T2", bay: "TX-OSS-02 HV", kV: 220 },
  "cb-66-a": { label: "CB-66-07", bay: "BAY-OSS-66-07 · TX-OSS-01 LV", kV: 66 },
  "cb-66-b": { label: "CB-66-09", bay: "BAY-OSS-66-09 · TX-OSS-02 LV", kV: 66 },
  "cb-66-bc": { label: "CB-66-08", bay: "BAY-OSS-66-08 · bus coupler", kV: 66 },
  "cb-str1": { label: "CB-66-01", bay: "BAY-OSS-66-01 · string 1", kV: 66 },
  "cb-str2": { label: "CB-66-02", bay: "BAY-OSS-66-02 · string 2", kV: 66 },
  "cb-str3": { label: "CB-66-03", bay: "BAY-OSS-66-03 · string 3", kV: 66 },
  "cb-str4": { label: "CB-66-04", bay: "BAY-OSS-66-04 · string 4", kV: 66 },
  "cb-str5": { label: "CB-66-05", bay: "BAY-OSS-66-05 · string 5", kV: 66 },
  "cb-str6": { label: "CB-66-06", bay: "BAY-OSS-66-06 · string 6", kV: 66 },
} as const;

export type BreakerId = keyof typeof BREAKERS;
export type BreakerStates = Record<BreakerId, BreakerState>;

export function initialBreakerStates(): BreakerStates {
  const s = {} as BreakerStates;
  for (const id of Object.keys(BREAKERS) as BreakerId[]) s[id] = "CLOSED";
  s["cb-66-bc"] = "OPEN"; // sections run split: one transformer per section
  return s;
}

export const STRING_IDS: string[][] = [1, 2, 3, 4, 5, 6].map((n) =>
  TURBINE_POSITIONS.filter((t) => t.stringNumber === n)
    .map((t) => t.id)
    .sort(),
);

export interface Energisation {
  onshore220: boolean;
  oss220: boolean;
  cable: [boolean, boolean];
  txOss: [boolean, boolean];
  sectionA: boolean;
  sectionB: boolean;
  /** Per string 1…6: feeder live (section live and feeder CB closed). */
  strings: boolean[];
}

/** Which parts of the network are live for a given set of breaker states. */
export function energisation(cb: BreakerStates): Energisation {
  const on = (id: BreakerId) => cb[id] === "CLOSED";
  const onshore220 = on("cb-400-1") || on("cb-400-2");
  const cable: [boolean, boolean] = [
    onshore220 && on("cb-ons-e1") && on("cb-oss-e1"),
    onshore220 && on("cb-ons-e2") && on("cb-oss-e2"),
  ];
  const oss220 = cable[0] || cable[1];
  const txOss: [boolean, boolean] = [oss220 && on("cb-oss-t1"), oss220 && on("cb-oss-t2")];
  const fedA = txOss[0] && on("cb-66-a");
  const fedB = txOss[1] && on("cb-66-b");
  const coupled = on("cb-66-bc");
  const sectionA = fedA || (coupled && fedB);
  const sectionB = fedB || (coupled && fedA);
  const strings = [1, 2, 3, 4, 5, 6].map((n) => {
    const live = OSS_BUSBAR_SECTION[n] === "A" ? sectionA : sectionB;
    return live && on(`cb-str${n}` as BreakerId);
  });
  return { onshore220, oss220, cable, txOss, sectionA, sectionB, strings };
}

/** Turbines on a dead feeder — they cannot export and are held offline. */
export function deenergisedTurbines(cb: BreakerStates): string[] {
  const { strings } = energisation(cb);
  return STRING_IDS.flatMap((ids, i) => (strings[i] ? [] : ids));
}

/**
 * Switching interlocks (a reason string blocks the command).
 * The 66 kV sections must never run in parallel through the coupler: two
 * 300 MVA units in parallel raise the 66 kV fault level towards the 25 kA
 * switchgear rating, so the coupler closes only with one incomer open.
 */
export function interlockReason(cb: BreakerStates, id: BreakerId): string | null {
  const closing = cb[id] !== "CLOSED";
  if (!closing) return null;
  const incomersClosed = cb["cb-66-a"] === "CLOSED" && cb["cb-66-b"] === "CLOSED";
  if (id === "cb-66-bc" && incomersClosed) {
    return "Bus coupler blocked: both transformer incomers closed (no parallel operation of TX-OSS-01/02)";
  }
  if ((id === "cb-66-a" || id === "cb-66-b") && cb["cb-66-bc"] === "CLOSED") {
    const other = id === "cb-66-a" ? "cb-66-b" : "cb-66-a";
    if (cb[other] === "CLOSED") {
      return "Incomer blocked: bus coupler closed and the other incomer in service";
    }
  }
  return null;
}
