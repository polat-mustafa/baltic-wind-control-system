/**
 * Training / scenario engine for the landing map.
 *
 * A scenario is a list of steps. "action" steps finish when their check()
 * sees the right plant state (or the right operator event); "quiz" steps
 * finish on the correct answer. Wrong actions/answers count as mistakes and
 * the explanation is read out. Narration uses the browser's built-in Web
 * Speech API (no service, no key) and can be muted.
 *
 * Score = 100 − 15 per mistake − 1 per 10 s over par, never below 0.
 */

import { useStudyStore } from "./studyStore";
import { create } from "zustand";

import { SCENARIOS, type Scenario, type TrainingEvent } from "../training/scenarios";

export interface LogLine {
  t: number;
  text: string;
  tone: "info" | "ok" | "error";
}

interface TrainingState {
  active: Scenario | null;
  stepIdx: number;
  startedAt: number;
  mistakes: number;
  events: TrainingEvent[];
  log: LogLine[];
  result: { score: number; timeS: number; mistakes: number } | null;
  voice: boolean;
  setVoice: (on: boolean) => void;
  start: (id: string) => void;
  stop: () => void;
  /** Operator events from the UI (cable selected, isolate pressed, …). */
  report: (e: TrainingEvent) => void;
  answer: (optionIdx: number) => void;
  /** Called by the panel whenever plant state changes. */
  evaluate: () => void;
  skip: () => void;
}

function speak(text: string, on: boolean) {
  if (!on || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}

export function scoreOf(mistakes: number, timeS: number, parS: number): number {
  return Math.max(0, Math.round(100 - 15 * mistakes - Math.max(0, (timeS - parS) / 10)));
}

export const useTrainingStore = create<TrainingState>((set, get) => {
  const say = (text: string, tone: LogLine["tone"] = "info") => {
    set((s) => ({ log: [...s.log, { t: Date.now(), text, tone }].slice(-30) }));
    speak(text, get().voice);
  };

  const enterStep = (idx: number) => {
    const sc = get().active;
    if (!sc) return;
    if (idx >= sc.steps.length) {
      const timeS = (Date.now() - get().startedAt) / 1000;
      const score = scoreOf(get().mistakes, timeS, sc.parS);
      set({ stepIdx: idx, result: { score, timeS, mistakes: get().mistakes } });
      useStudyStore.getState().addRun({
        scenarioId: sc.id,
        title: sc.title,
        score,
        timeS: Math.round(timeS),
        mistakes: get().mistakes,
      });
      say(`Scenario complete. Score ${score} out of 100. ${sc.debrief}`, "ok");
      sc.teardown?.();
      return;
    }
    set({ stepIdx: idx });
    const step = sc.steps[idx];
    step.onEnter?.();
    say(typeof step.say === "function" ? step.say() : step.say);
  };

  return {
    active: null,
    stepIdx: 0,
    startedAt: 0,
    mistakes: 0,
    events: [],
    log: [],
    result: null,
    voice: true,
    setVoice: (voice) => {
      if (!voice && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      set({ voice });
    },

    start: (id) => {
      const sc = SCENARIOS.find((s) => s.id === id);
      if (!sc) return;
      get().active?.teardown?.();
      set({ active: sc, stepIdx: 0, startedAt: Date.now(), mistakes: 0, events: [], log: [], result: null });
      sc.setup();
      say(sc.intro);
      enterStep(0);
    },

    stop: () => {
      get().active?.teardown?.();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      set({ active: null, result: null, log: [], events: [] });
    },

    report: (e) => {
      const { active, stepIdx } = get();
      if (!active || get().result) return;
      set((s) => ({ events: [...s.events, e] }));
      const step = active.steps[stepIdx];
      const verdict = step?.onEvent?.(e);
      if (verdict && !verdict.ok) {
        set((s) => ({ mistakes: s.mistakes + 1 }));
        say(verdict.why, "error");
      }
      get().evaluate();
    },

    answer: (i) => {
      const { active, stepIdx } = get();
      const step = active?.steps[stepIdx];
      const opt = step?.options?.()[i];
      if (!opt) return;
      if (opt.correct) {
        say(`Correct. ${opt.why}`, "ok");
        enterStep(stepIdx + 1);
      } else {
        set((s) => ({ mistakes: s.mistakes + 1 }));
        say(`Not quite. ${opt.why}`, "error");
      }
    },

    evaluate: () => {
      const { active, stepIdx, events, result } = get();
      if (!active || result) return;
      const step = active.steps[stepIdx];
      if (step?.check?.(events)) {
        if (step.done) say(step.done, "ok");
        enterStep(stepIdx + 1);
      }
    },

    skip: () => {
      const { active, stepIdx } = get();
      if (!active) return;
      set((s) => ({ mistakes: s.mistakes + 1 }));
      say("Step skipped.", "error");
      enterStep(stepIdx + 1);
    },
  };
});
