/**
 * How the learner works: on the SB-510 reference case study (every module
 * open) or on their own project (modules unlock stage by stage,
 * lib/project/progress.ts). null until chosen (components/project/ProjectChooser.tsx).
 * Persisted as `of.mode.v1`.
 */

import { create } from "zustand";

import { readStored, writeStored } from "../lib/storage";

export const MODE_KEY = "of.mode.v1";

export type Mode = "reference" | "own";

const stored = readStored(MODE_KEY);

interface ModeStore {
  mode: Mode | null;
  setMode: (mode: Mode) => void;
}

export const useModeStore = create<ModeStore>((set) => ({
  mode: stored === "reference" || stored === "own" ? stored : null,
  setMode: (mode) => {
    writeStored(MODE_KEY, mode);
    set({ mode });
  },
}));
