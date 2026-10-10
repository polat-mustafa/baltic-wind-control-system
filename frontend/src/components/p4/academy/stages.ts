import type { TrainingStageKey } from "../../../types/forecast";

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
