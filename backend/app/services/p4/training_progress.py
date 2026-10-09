"""
Live progress of the forecast model build, for the P4 "training monitor".

Building the ensemble (SCADA → features → XGBoost + LSTM + TFT → forecast →
ensemble) takes tens of minutes on a CPU-only server. Instead of a spinner,
the trainers report what they are doing — stage, cross-validation fold,
epoch, training / validation loss — and the status endpoint returns a
snapshot that the UI turns into a pipeline diagram, live loss curves and an
event log, so a student can watch the models learn.

Only one build runs at a time (``_build_lock`` in routers/p4/_pipeline.py),
so a single module-level tracker is enough. Reports made while no build is
active (e.g. the SHAP endpoint re-using the feature pipeline) are ignored.
The trainers run in worker threads, hence the lock.
"""

from __future__ import annotations

import threading
import time
from typing import Any

# (key, label, weight in the overall bar). LSTM and TFT dominate the time.
STAGES: list[tuple[str, str, float]] = [
    ("data", "Synthetic SCADA + quality filters", 2.0),
    ("features", "Causal features + NWP merge", 2.0),
    ("xgboost", "XGBoost — 5-fold TimeSeriesSplit × 3 quantiles", 8.0),
    ("lstm", "LSTM — 5 folds, early-stopped epochs", 40.0),
    ("tft", "TFT — 5 folds, early-stopped epochs", 40.0),
    ("predict", "Forecast + MC-dropout uncertainty", 6.0),
    ("ensemble", "Skill-gated ensemble + physical constraints", 2.0),
]
_WEIGHT = {k: w for k, _, w in STAGES}
_MAX_LOG = 400  # epoch lines included (every 5th + new bests)
_MAX_CURVE = 600  # epochs kept per model (5 folds × ≤ 100)


class _Tracker:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._active = False
        self._t0 = 0.0
        self._stages: dict[str, dict[str, Any]] = {}
        self._log: list[dict[str, Any]] = []
        self._curves: dict[str, list[dict[str, float]]] = {}
        self._folds: dict[str, list[dict[str, float]]] = {}
        self._best_val: dict[tuple[str, int], float] = {}
        self._last_build_s: float | None = None
        self._finished_at: float | None = None

    # ── lifecycle ────────────────────────────────────────────────────
    def start(self) -> None:
        with self._lock:
            self._active = True
            self._t0 = time.time()
            self._stages = {
                k: {"status": "pending", "fraction": 0.0, "detail": ""} for k, _, _ in STAGES
            }
            self._log = []
            self._curves = {"lstm": [], "tft": []}
            self._folds = {"xgboost": [], "lstm": [], "tft": []}
            self._best_val = {}
        self.log("Build started — no cached models for this configuration, training from scratch")

    def finish(self) -> None:
        with self._lock:
            if not self._active:
                return
            self._active = False
            self._finished_at = time.time()
            self._last_build_s = self._finished_at - self._t0
        self.log(
            f"Build finished in {(self._last_build_s or 0) / 60:.1f} min — cached for reuse",
            force=True,
            level="ok",
        )

    # ── reports (no-ops outside a build) ─────────────────────────────
    def log(
        self, message: str, *, force: bool = False, level: str = "info", stage: str | None = None
    ) -> None:
        """One console line; level info | ok | debug (epochs) | warn."""
        with self._lock:
            if not self._active and not force:
                return
            self._log.append(
                {
                    "t": round(time.time() - self._t0, 1),
                    "msg": message,
                    "level": level,
                    "stage": stage,
                }
            )
            del self._log[:-_MAX_LOG]

    def stage(self, key: str, status: str, detail: str = "") -> None:
        with self._lock:
            if not self._active:
                return  # also skips the log line below
            st = self._stages[key]
            st["status"] = status
            if status == "done":
                st["fraction"] = 1.0
            if detail:
                st["detail"] = detail
        if status in ("running", "done"):
            label = next(lbl for k, lbl, _ in STAGES if k == key)
            self.log(
                f"{'▶' if status == 'running' else '✔'} {label}{' — ' + detail if detail else ''}",
                level="info" if status == "running" else "ok",
                stage=key,
            )

    def model_done(self, key: str, rmse_mw: float, skill: float) -> None:
        self.stage(key, "done", f"mean RMSE {rmse_mw:.3f} MW · skill {skill:.2f}")

    def fraction(self, key: str, fraction: float, detail: str = "") -> None:
        with self._lock:
            if not self._active:
                return
            st = self._stages[key]
            st["status"] = "running"
            st["fraction"] = max(0.0, min(1.0, fraction))
            if detail:
                st["detail"] = detail

    def epoch(self, key: str, fold: int, epoch: int, train_loss: float, val_loss: float) -> None:
        with self._lock:
            if not self._active:
                return
            best = val_loss < self._best_val.get((key, fold), float("inf"))
            if best:
                self._best_val[(key, fold)] = val_loss
            curve = self._curves.setdefault(key, [])
            curve.append(
                {
                    "fold": fold,
                    "epoch": epoch,
                    "train": round(train_loss, 5),
                    "val": round(val_loss, 5),
                }
            )
            del curve[:-_MAX_CURVE]
        # every 5th epoch and every new best: enough to follow, few enough to read
        if epoch == 1 or epoch % 5 == 0 or best:
            self.log(
                f"{key.upper()} fold {fold + 1} · epoch {epoch:>3}: loss {train_loss:.4f}"
                f" / val {val_loss:.4f}{'  ★ best' if best else ''}",
                level="debug",
                stage=key,
            )

    def fold(self, key: str, fold: int, rmse_mw: float, epochs: int | None = None) -> None:
        with self._lock:
            if not self._active:
                return  # also skips the log line below
            self._folds.setdefault(key, []).append(
                {"fold": fold, "rmse_mw": round(rmse_mw, 4), "epochs": epochs or 0}
            )
        tail = f" after {epochs} epochs" if epochs else ""
        self.log(
            f"{key.upper()} fold {fold + 1}: RMSE {rmse_mw:.3f} MW{tail}", level="ok", stage=key
        )

    # ── read ─────────────────────────────────────────────────────────
    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            total_w = sum(_WEIGHT.values())
            done_w = (
                sum(_WEIGHT[k] * s["fraction"] for k, s in self._stages.items())
                if self._stages
                else 0.0
            )
            overall = done_w / total_w if total_w else 0.0
            elapsed = time.time() - self._t0 if self._t0 else 0.0
            eta = elapsed * (1 - overall) / overall if self._active and overall > 0.03 else None
            return {
                "active": self._active,
                "overall": round(overall, 4),
                "elapsed_s": round(elapsed, 1) if self._active else None,
                "eta_s": round(eta) if eta is not None else None,
                "last_build_s": round(self._last_build_s, 1) if self._last_build_s else None,
                "stages": [
                    {
                        "key": k,
                        "label": lbl,
                        **self._stages.get(k, {"status": "pending", "fraction": 0.0, "detail": ""}),
                    }
                    for k, lbl, _ in STAGES
                ],
                "log": list(self._log),
                "curves": {k: list(v) for k, v in self._curves.items()},
                "folds": {k: list(v) for k, v in self._folds.items()},
            }


PROGRESS = _Tracker()
