import type { TrainingStageKey } from "../../../types/forecast";

/** Share of the build time per stage (mirrors backend training_progress.STAGES). */
export const STAGE_WEIGHT: Record<TrainingStageKey, number> = {
  data: 2,
  features: 2,
  xgboost: 8,
  lstm: 40,
  tft: 40,
  predict: 6,
  ensemble: 2,
};

/** Stage colours: models use the validated series slots (.bw-viz). */
export const STAGE_TONE: Record<TrainingStageKey, string> = {
  data: "var(--color-text-muted)",
  features: "var(--color-text-secondary)",
  xgboost: "var(--viz-2)",
  lstm: "var(--viz-1)",
  tft: "var(--viz-3)",
  predict: "var(--color-accent)",
  ensemble: "var(--color-status-normal)",
};
