/**
 * P4 types shared by the academy's pipeline illustration. The day-ahead API types live
 * with their client in services/forecastApi.ts.
 */

export type TrainingStageKey = "data" | "features" | "xgboost" | "lstm" | "tft" | "predict" | "ensemble";

export interface TrainingStage {
  key: TrainingStageKey;
  label: string;
  status: "pending" | "running" | "done";
  /** 0–1 share of this stage's work done. */
  fraction: number;
  detail: string;
}
