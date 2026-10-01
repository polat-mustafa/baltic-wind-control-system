"""Live training monitor (app/services/p4/training_progress)."""

import numpy as np

from app.services.p4.lstm_model import LSTMConfig, train_lstm
from app.services.p4.training_progress import PROGRESS, STAGES


def test_reports_outside_a_build_are_ignored() -> None:
    PROGRESS.finish()
    PROGRESS.stage("data", "running", "should not appear")
    snap = PROGRESS.snapshot()
    assert snap["active"] is False
    assert all("should not appear" not in line["msg"] for line in snap["log"])


def test_overall_progress_is_the_weighted_stage_fraction() -> None:
    PROGRESS.start()
    try:
        total = sum(w for _, _, w in STAGES)
        PROGRESS.stage("data", "done")
        PROGRESS.fraction("lstm", 0.5)
        snap = PROGRESS.snapshot()
        weights = {k: w for k, _, w in STAGES}
        expected = (weights["data"] + 0.5 * weights["lstm"]) / total
        assert abs(snap["overall"] - expected) < 1e-3
        assert snap["active"] is True
        assert [s["key"] for s in snap["stages"]] == [k for k, _, _ in STAGES]
    finally:
        PROGRESS.finish()
    assert PROGRESS.snapshot()["last_build_s"] is not None


def test_lstm_training_streams_epoch_losses_and_fold_results() -> None:
    rng = np.random.default_rng(0)
    n = 260
    features = rng.normal(size=(n, 4))
    target = np.clip(7.5 + 3 * features[:, 0] + rng.normal(scale=0.5, size=n), 0, 15)
    cfg = LSTMConfig(
        lookback=12, hidden_units=(8, 4), epochs=3, patience=2, n_cv_splits=2, mc_samples=2
    )
    PROGRESS.start()
    try:
        train_lstm(features, target, cfg)
        snap = PROGRESS.snapshot()
    finally:
        PROGRESS.finish()
    curve = snap["curves"]["lstm"]
    assert curve and {"fold", "epoch", "train", "val"} <= set(curve[0])
    assert {f["fold"] for f in snap["folds"]["lstm"]} == {0, 1}
    lstm = next(s for s in snap["stages"] if s["key"] == "lstm")
    assert lstm["status"] == "done" and lstm["fraction"] == 1.0
