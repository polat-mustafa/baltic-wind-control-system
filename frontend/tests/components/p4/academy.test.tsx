import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AcademyTab from "../../../src/components/p4/academy/AcademyTab";
import TrainingMonitor from "../../../src/components/p4/academy/TrainingMonitor";
import ConceptMap from "../../../src/components/p4/academy/ConceptMap";
import { CHAPTERS, CONCEPTS, LINKS } from "../../../src/components/p4/academy/academyContent";
import { useForecastStore } from "../../../src/store/forecastStore";
import type { TrainingLive } from "../../../src/types/forecast";

vi.mock("../../../src/services/forecastApi", () => ({
  getTrainingProgress: vi.fn(() => new Promise(() => undefined)),
}));

const LIVE: TrainingLive = {
  active: true,
  overall: 0.42,
  elapsed_s: 600,
  eta_s: 830,
  last_build_s: null,
  stages: [
    { key: "data", label: "data", status: "done", fraction: 1, detail: "" },
    { key: "features", label: "features", status: "done", fraction: 1, detail: "" },
    { key: "xgboost", label: "xgboost", status: "done", fraction: 1, detail: "mean RMSE 2.9 MW" },
    { key: "lstm", label: "LSTM", status: "running", fraction: 0.4, detail: "fold 3/5 · epoch 12" },
    { key: "tft", label: "TFT", status: "running", fraction: 0.35, detail: "fold 2/5" },
    { key: "predict", label: "predict", status: "pending", fraction: 0, detail: "" },
    { key: "ensemble", label: "ensemble", status: "pending", fraction: 0, detail: "" },
  ],
  log: [{ t: 12, msg: "XGBOOST fold 1: RMSE 2.872 MW" }],
  curves: {
    lstm: [
      { fold: 0, epoch: 1, train: 0.3, val: 0.2 },
      { fold: 0, epoch: 2, train: 0.1, val: 0.12 },
    ],
  },
  folds: { xgboost: [{ fold: 0, rmse_mw: 2.87, epochs: 0 }] },
};

describe("P4 AI Academy", () => {
  beforeEach(() => useForecastStore.setState({ chapter: "why", tab: "academy", live: null, loading: false }));

  it("has a consistent course: every concept points at a chapter, every link at concepts", () => {
    const chapterIds = new Set(CHAPTERS.map((c) => c.id));
    const conceptIds = new Set(CONCEPTS.map((c) => c.id));
    expect(CONCEPTS.every((c) => chapterIds.has(c.chapter))).toBe(true);
    expect(LINKS.every(([a, b]) => conceptIds.has(a) && conceptIds.has(b))).toBe(true);
    expect(CHAPTERS.every((c) => c.body.every((b) => b.en && b.tr))).toBe(true);
  });

  it("walks the chapters and switches to Turkish", () => {
    render(<AcademyTab />);
    expect(screen.getByRole("heading", { name: CHAPTERS[0].title.en })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Decision trees and XGBoost/ }));
    expect(screen.getByRole("heading", { name: "Decision trees and XGBoost" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "TR" }));
    expect(screen.getByRole("heading", { name: "Karar ağaçları ve XGBoost" })).toBeDefined();
  });

  it("shows the live build: status, ETA, stage details and the log", () => {
    useForecastStore.setState({ live: LIVE, loading: true, progressMessage: "LSTM — fold 3/5" });
    render(<TrainingMonitor />);
    expect(screen.getByText("training")).toBeDefined();
    expect(screen.getByText(/ETA 13 min/)).toBeDefined();
    expect(screen.getByText(/XGBOOST fold 1: RMSE 2.872 MW/)).toBeDefined();
    expect(screen.getByText("42 %")).toBeDefined();
  });

  it("opens the lesson of a clicked concept", () => {
    render(<ConceptMap lang="en" />);
    fireEvent.click(screen.getByText("Attention"));
    expect(useForecastStore.getState().chapter).toBe("tft");
    expect(useForecastStore.getState().tab).toBe("academy");
  });
});
