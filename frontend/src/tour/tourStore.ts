/**
 * Guided-tour state: which tour runs, which step is shown, and the
 * persisted progress (completed tours, whether the first-visit welcome was
 * dismissed). Progress lives in localStorage under `of.tour.v1`; "Later" on
 * the welcome only lasts for the browser session.
 */

import { create } from "zustand";

import { readStored, writeStored } from "../lib/storage";
import { TOURS, tourById } from "./tours";

export const PROGRESS_KEY = "of.tour.v1";
const LATER_KEY = "of.tour.later";

export interface TourProgress {
  completed: string[];
  welcomeDismissed: boolean;
}

function loadProgress(): TourProgress {
  const raw = readStored(PROGRESS_KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<TourProgress>;
      return {
        completed: Array.isArray(p.completed) ? p.completed.filter((c) => typeof c === "string") : [],
        welcomeDismissed: p.welcomeDismissed === true,
      };
    } catch {
      // corrupt value: start fresh
    }
  }
  return { completed: [], welcomeDismissed: false };
}

function laterThisSession(): boolean {
  try {
    return sessionStorage.getItem(LATER_KEY) === "1";
  } catch {
    return false;
  }
}

interface TourState {
  activeTourId: string | null;
  stepIndex: number;
  progress: TourProgress;
  /** Welcome dialog visible (first visit, not dismissed, not "later"). */
  welcomeOpen: boolean;

  start: (tourId: string, stepIndex?: number) => void;
  next: () => void;
  prev: () => void;
  /** Leave the tour without marking it complete. */
  stop: () => void;
  /** Close the welcome; `forever` persists it, otherwise only this session. */
  dismissWelcome: (forever: boolean) => void;
  /** Re-read persisted progress (tests, storage events). */
  reload: () => void;
}

function persist(progress: TourProgress) {
  writeStored(PROGRESS_KEY, JSON.stringify(progress));
}

function initialWelcome(progress: TourProgress) {
  return !progress.welcomeDismissed && progress.completed.length === 0 && !laterThisSession();
}

const initialProgress = loadProgress();

export const useTourStore = create<TourState>((set, get) => ({
  activeTourId: null,
  stepIndex: 0,
  progress: initialProgress,
  welcomeOpen: initialWelcome(initialProgress),

  start: (tourId, stepIndex = 0) => {
    const tour = tourById(tourId);
    if (!tour) return;
    set({
      activeTourId: tourId,
      stepIndex: Math.min(Math.max(0, stepIndex), tour.steps.length - 1),
      welcomeOpen: false,
    });
  },

  next: () => {
    const { activeTourId, stepIndex, progress } = get();
    const tour = activeTourId ? tourById(activeTourId) : undefined;
    if (!tour) return;
    if (stepIndex < tour.steps.length - 1) {
      set({ stepIndex: stepIndex + 1 });
      return;
    }
    // Finished: record it once; starting a tour also retires the welcome.
    const completed = progress.completed.includes(tour.id)
      ? progress.completed
      : [...progress.completed, tour.id];
    const updated = { completed, welcomeDismissed: true };
    persist(updated);
    set({ activeTourId: null, stepIndex: 0, progress: updated });
  },

  prev: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1) })),

  stop: () => {
    const { progress } = get();
    if (!progress.welcomeDismissed) {
      const updated = { ...progress, welcomeDismissed: true };
      persist(updated);
      set({ progress: updated });
    }
    set({ activeTourId: null, stepIndex: 0 });
  },

  dismissWelcome: (forever) => {
    if (forever) {
      const updated = { ...get().progress, welcomeDismissed: true };
      persist(updated);
      set({ progress: updated, welcomeOpen: false });
      return;
    }
    try {
      sessionStorage.setItem(LATER_KEY, "1");
    } catch {
      // not remembered: the welcome returns on the next page load
    }
    set({ welcomeOpen: false });
  },

  reload: () => {
    const progress = loadProgress();
    set({ progress, welcomeOpen: initialWelcome(progress), activeTourId: null, stepIndex: 0 });
  },
}));

/** The tour after `tourId` in menu order, if any. */
export function nextTour(tourId: string) {
  const i = TOURS.findIndex((t) => t.id === tourId);
  return i >= 0 ? TOURS[i + 1] : undefined;
}
