/**
 * Evaluation study data for the thesis: scenario results and System
 * Usability Scale (SUS) questionnaires, keyed by an anonymous participant
 * code. Stored only in this browser (localStorage) and exported as CSV —
 * no personal data, nothing leaves the machine unless the researcher exports it.
 *
 * SUS (Brooke 1996): 10 items, 1–5 Likert; odd items score (x − 1), even
 * items (5 − x); the sum × 2.5 gives 0–100. Grades: Sauro & Lewis (2016)
 * curved scale; 68 is the cross-study average.
 */

import { create } from "zustand";
import { readStored } from "../lib/storage";

export interface StudyRun {
  participant: string;
  scenarioId: string;
  title: string;
  score: number;
  timeS: number;
  mistakes: number;
  at: string; // ISO time
}

export interface SusResponse {
  participant: string;
  answers: number[]; // 10 × 1..5
  score: number;
  at: string;
}

export const SUS_ITEMS = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to be able to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
] as const;

export function susScore(answers: number[]): number {
  if (answers.length !== 10 || answers.some((a) => a < 1 || a > 5)) return NaN;
  const sum = answers.reduce((s, a, i) => s + (i % 2 === 0 ? a - 1 : 5 - a), 0);
  return sum * 2.5;
}

/** Sauro & Lewis (2016) curved grading scale. */
export function susGrade(score: number): string {
  const scale: [number, string][] = [
    [84.1, "A+"], [80.8, "A"], [78.9, "A−"], [77.2, "B+"], [74.1, "B"], [72.6, "B−"],
    [71.1, "C+"], [65.0, "C"], [62.7, "C−"], [51.7, "D"],
  ];
  return scale.find(([min]) => score >= min)?.[1] ?? "F";
}

/** Mean, sample SD and 95 % CI half-width (t for small n). */
export function summary(xs: number[]): { n: number; mean: number; sd: number; ci95: number } {
  const n = xs.length;
  if (n === 0) return { n, mean: NaN, sd: NaN, ci95: NaN };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  const t = [12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23][n - 2] ?? (n < 30 ? 2.1 : 1.96);
  return { n, mean, sd, ci95: n > 1 ? (t * sd) / Math.sqrt(n) : NaN };
}

const KEY = "of.study.v1";
interface Persisted {
  participant: string;
  runs: StudyRun[];
  sus: SusResponse[];
}

function load(): Persisted {
  try {
    const raw = readStored(KEY);
    if (raw) return { participant: "", runs: [], sus: [], ...JSON.parse(raw) };
  } catch {
    // blocked storage: start empty
  }
  return { participant: "", runs: [], sus: [] };
}

function save(p: Persisted) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // not persisted (private mode) — the session still works
  }
}

interface StudyState extends Persisted {
  setParticipant: (code: string) => void;
  addRun: (r: Omit<StudyRun, "participant" | "at">) => void;
  addSus: (answers: number[]) => number;
  clear: () => void;
}

export const useStudyStore = create<StudyState>((set, get) => {
  const persist = () => {
    const { participant, runs, sus } = get();
    save({ participant, runs, sus });
  };
  return {
    ...load(),
    setParticipant: (participant) => {
      set({ participant: participant.trim().slice(0, 24) });
      persist();
    },
    addRun: (r) => {
      set((s) => ({ runs: [...s.runs, { ...r, participant: s.participant || "anon", at: new Date().toISOString() }] }));
      persist();
    },
    addSus: (answers) => {
      const score = susScore(answers);
      set((s) => ({ sus: [...s.sus, { participant: s.participant || "anon", answers, score, at: new Date().toISOString() }] }));
      persist();
      return score;
    },
    clear: () => {
      set({ runs: [], sus: [] });
      persist();
    },
  };
});

/** CSV (RFC 4180) of the runs and SUS responses. */
export function studyCsv(runs: StudyRun[], sus: SusResponse[]): { runs: string; sus: string } {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return {
    runs: ["participant,scenario_id,title,score,time_s,mistakes,at"]
      .concat(runs.map((r) => [r.participant, r.scenarioId, r.title, r.score, r.timeS, r.mistakes, r.at].map(q).join(",")))
      .join("\n"),
    sus: [`participant,${SUS_ITEMS.map((_, i) => `q${i + 1}`).join(",")},sus_score,at`]
      .concat(sus.map((r) => [r.participant, ...r.answers, r.score, r.at].map(q).join(",")))
      .join("\n"),
  };
}
