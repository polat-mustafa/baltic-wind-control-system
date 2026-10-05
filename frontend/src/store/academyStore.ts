/**
 * Academy progress: lessons opened and mission attempts, kept only in this
 * browser (`of.academy.v1`). The training record prints from it and exports
 * as JSON; nothing leaves the machine unless the learner exports it.
 *
 * Control-room drills (store/trainingStore) record their result here too.
 */

import { create } from "zustand";

import { readStored, writeStored } from "../lib/storage";

export const ACADEMY_KEY = "of.academy.v1";
/** Score at or above which a mission counts as passed. */
export const PASS_MARK = 70;
const MAX_ATTEMPTS = 500;

export interface Attempt {
  mission: string;
  score: number;
  /** ISO time */
  at: string;
  /** One-line summary of what was graded. */
  detail: string;
  /** Seed of generated cases, so an attempt can be replayed. */
  seed?: number;
}

interface Persisted {
  learner: string;
  lessons: string[];
  attempts: Attempt[];
}

const EMPTY: Persisted = { learner: "", lessons: [], attempts: [] };

function validAttempt(v: unknown): v is Attempt {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return typeof a.mission === "string" && typeof a.score === "number" && Number.isFinite(a.score) && typeof a.at === "string";
}

function load(): Persisted {
  try {
    const raw = readStored(ACADEMY_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      return {
        learner: typeof p.learner === "string" ? p.learner : "",
        lessons: Array.isArray(p.lessons) ? p.lessons.filter((x): x is string => typeof x === "string") : [],
        attempts: Array.isArray(p.attempts) ? p.attempts.filter(validAttempt).map((a) => ({ ...a, detail: a.detail ?? "" })) : [],
      };
    }
  } catch {
    // corrupt value: start fresh
  }
  return { ...EMPTY };
}

interface AcademyState extends Persisted {
  setLearner: (name: string) => void;
  openLesson: (id: string) => void;
  record: (a: Omit<Attempt, "at">) => void;
  reset: () => void;
  exportJson: () => string;
}

export const useAcademyStore = create<AcademyState>((set, get) => {
  const update = (patch: Partial<Persisted>) => {
    set(patch);
    const { learner, lessons, attempts } = get();
    writeStored(ACADEMY_KEY, JSON.stringify({ learner, lessons, attempts }));
  };
  return {
    ...load(),
    setLearner: (name) => update({ learner: name.trim().slice(0, 48) }),
    openLesson: (id) => {
      if (!get().lessons.includes(id)) update({ lessons: [...get().lessons, id] });
    },
    record: (a) =>
      update({
        attempts: [
          ...get().attempts,
          { ...a, score: Math.max(0, Math.min(100, Math.round(a.score))), at: new Date().toISOString() },
        ].slice(-MAX_ATTEMPTS),
      }),
    reset: () => update({ ...EMPTY }),
    exportJson: () => {
      const { learner, lessons, attempts } = get();
      return JSON.stringify({ app: "OffshoreForge", record: "academy", schema: 1, learner, lessons, attempts, exported: new Date().toISOString() }, null, 2);
    },
  };
});

/** Academy mission id of a control-room drill (training/scenarios.ts id). */
export const drillMissionId = (scenarioId: string) => `drill-${scenarioId}`;

/** Best score per mission. */
export function bestScores(attempts: Attempt[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of attempts) out[a.mission] = Math.max(out[a.mission] ?? 0, a.score);
  return out;
}

export const passed = (best: number | undefined) => best != null && best >= PASS_MARK;
