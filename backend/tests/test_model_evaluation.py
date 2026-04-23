"""Tests for P4 model evaluation and comparison metrics.

Covers: RMSE, MAE, MAPE, R², Skill Score, quantile coverage,
pinball loss, evaluate_model(), and compare_models().
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.model_evaluation import (
    ModelComparisonResult,
    ModelMetrics,
    compare_models,
    compute_mae,
    compute_mape,
    compute_pinball_loss,
    compute_quantile_coverage,
    compute_r_squared,
    compute_rmse,
    compute_skill_score,
    evaluate_model,
)

# ── RMSE ──────────────────────────────────────────────────────────


class TestRMSE:
    """Root Mean Square Error tests."""

    def test_perfect_prediction(self) -> None:
        """Perfect model → RMSE = 0."""
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        assert compute_rmse(actual, actual) == 0.0

    def test_known_value(self) -> None:
        """Known RMSE calculation."""
        actual = np.array([1.0, 2.0, 3.0])
        predicted = np.array([1.5, 2.5, 3.5])
        # Residuals: [-0.5, -0.5, -0.5], squared: [0.25, 0.25, 0.25]
        # Mean = 0.25, sqrt = 0.5
        assert compute_rmse(actual, predicted) == pytest.approx(0.5, abs=1e-6)

    def test_asymmetric_errors(self) -> None:
        """RMSE penalises large errors more than small ones."""
        actual = np.array([0.0, 0.0, 0.0, 0.0])
        small_errors = np.array([1.0, 1.0, 1.0, 1.0])
        one_big_error = np.array([0.0, 0.0, 0.0, 4.0])
        # Same MAE (1.0) but different RMSE
        assert compute_rmse(actual, one_big_error) > compute_rmse(actual, small_errors)


# ── MAE ───────────────────────────────────────────────────────────


class TestMAE:
    """Mean Absolute Error tests."""

    def test_perfect_prediction(self) -> None:
        actual = np.array([1.0, 2.0, 3.0])
        assert compute_mae(actual, actual) == 0.0

    def test_known_value(self) -> None:
        actual = np.array([1.0, 2.0, 3.0])
        predicted = np.array([2.0, 1.0, 4.0])
        # |1|, |1|, |1| → mean = 1.0
        assert compute_mae(actual, predicted) == pytest.approx(1.0)


# ── MAPE ──────────────────────────────────────────────────────────


class TestMAPE:
    """Mean Absolute Percentage Error tests."""

    def test_excludes_near_zero(self) -> None:
        """Near-zero actuals (< 0.5 MW) are excluded from MAPE."""
        actual = np.array([0.1, 0.2, 10.0, 10.0])
        predicted = np.array([5.0, 5.0, 10.0, 10.0])
        # Only indices 2,3 pass threshold; errors = 0%, 0%
        assert compute_mape(actual, predicted) == pytest.approx(0.0)

    def test_all_below_threshold(self) -> None:
        """Returns 0.0 when all actuals are below threshold."""
        actual = np.array([0.1, 0.2, 0.3])
        predicted = np.array([1.0, 2.0, 3.0])
        assert compute_mape(actual, predicted) == 0.0

    def test_known_percentage(self) -> None:
        """Known MAPE calculation."""
        actual = np.array([10.0, 20.0])
        predicted = np.array([9.0, 18.0])
        # |1/10|, |2/20| = 0.1, 0.1 → mean = 0.1 → 10%
        assert compute_mape(actual, predicted) == pytest.approx(10.0, abs=0.01)


# ── R² ────────────────────────────────────────────────────────────


class TestRSquared:
    """Coefficient of determination tests."""

    def test_perfect_model(self) -> None:
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        assert compute_r_squared(actual, actual) == pytest.approx(1.0)

    def test_mean_prediction(self) -> None:
        """Predicting the mean → R² ≈ 0."""
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        mean_pred = np.full_like(actual, np.mean(actual))
        assert compute_r_squared(actual, mean_pred) == pytest.approx(0.0, abs=1e-10)

    def test_worse_than_mean(self) -> None:
        """Bad model → R² < 0."""
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        bad_pred = np.array([5.0, 4.0, 3.0, 2.0, 1.0])
        assert compute_r_squared(actual, bad_pred) < 0.0

    def test_constant_actual(self) -> None:
        """All same actual values → SS_tot = 0, handle gracefully."""
        actual = np.array([5.0, 5.0, 5.0])
        predicted = np.array([5.0, 5.0, 5.0])
        assert compute_r_squared(actual, predicted) == 1.0


# ── Skill Score ───────────────────────────────────────────────────


class TestSkillScore:
    """Skill score vs persistence tests."""

    def test_perfect_model_positive_skill(self) -> None:
        """Perfect model should have positive skill score."""
        actual = np.array([1.0, 2.0, 3.0, 2.0, 1.0])
        assert compute_skill_score(actual, actual) > 0.0

    def test_persistence_model_zero_skill(self) -> None:
        """Persistence (predict previous) → skill ≈ 0 or slightly > 0."""
        actual = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        # Persistence: use actual shifted by 1
        persist = np.concatenate([[actual[0]], actual[:-1]])
        skill = compute_skill_score(actual, persist)
        # Persistence as prediction should give skill close to 0
        assert abs(skill) < 1.0

    def test_insufficient_data(self) -> None:
        """Less than 2 samples → skill = 0."""
        actual = np.array([5.0])
        predicted = np.array([5.0])
        assert compute_skill_score(actual, predicted) == 0.0


# ── Quantile Coverage ────────────────────────────────────────────


class TestQuantileCoverage:
    """Quantile calibration tests."""

    def test_well_calibrated_p90(self) -> None:
        """High P90 forecast → ~90% of actuals should be below."""
        rng = np.random.default_rng(42)
        actual = rng.normal(5.0, 1.0, size=1000)
        # P90 set well above most actuals
        p90 = np.full(1000, 8.0)
        coverage = compute_quantile_coverage(actual, {0.90: p90})
        # Should be close to 1.0 (nearly all below)
        assert coverage["P90"] > 0.90

    def test_low_p10_coverage(self) -> None:
        """Low P10 forecast → very few actuals below."""
        rng = np.random.default_rng(42)
        actual = rng.normal(5.0, 1.0, size=1000)
        p10 = np.full(1000, 2.0)
        coverage = compute_quantile_coverage(actual, {0.10: p10})
        assert coverage["P10"] < 0.20


# ── Pinball Loss ──────────────────────────────────────────────────


class TestPinballLoss:
    """Pinball (quantile) loss tests."""

    def test_perfect_forecast_zero_loss(self) -> None:
        """Perfect forecast → pinball loss = 0."""
        actual = np.array([1.0, 2.0, 3.0])
        assert compute_pinball_loss(actual, actual, 0.50) == pytest.approx(0.0)

    def test_underestimate_p90(self) -> None:
        """Underestimating P90 is penalised more (quantile = 0.90)."""
        actual = np.array([10.0])
        low_pred = np.array([5.0])
        high_pred = np.array([15.0])
        # Under: q × (10-5) = 0.9 × 5 = 4.5
        # Over: (1-q) × (15-10) = 0.1 × 5 = 0.5
        loss_under = compute_pinball_loss(actual, low_pred, 0.90)
        loss_over = compute_pinball_loss(actual, high_pred, 0.90)
        assert loss_under > loss_over

    def test_overestimate_p10(self) -> None:
        """Overestimating P10 is penalised more (quantile = 0.10)."""
        actual = np.array([5.0])
        low_pred = np.array([2.0])
        high_pred = np.array([8.0])
        # Under: q × (5-2) = 0.1 × 3 = 0.3
        # Over: (1-q) × (8-5) = 0.9 × 3 = 2.7
        loss_under = compute_pinball_loss(actual, low_pred, 0.10)
        loss_over = compute_pinball_loss(actual, high_pred, 0.10)
        assert loss_over > loss_under


# ── Evaluate Model ────────────────────────────────────────────────


class TestEvaluateModel:
    """Integration test for evaluate_model()."""

    def test_returns_model_metrics(self) -> None:
        """evaluate_model returns complete ModelMetrics."""
        rng = np.random.default_rng(42)
        actual = rng.uniform(0.0, 15.0, size=100)
        predicted = actual + rng.normal(0, 0.5, size=100)
        p10 = predicted - 1.0
        p90 = predicted + 1.0

        result = evaluate_model("TestModel", actual, predicted, p10, p90)

        assert isinstance(result, ModelMetrics)
        assert result.model_name == "TestModel"
        assert result.rmse_mw > 0.0
        assert result.num_samples == 100
        assert "P10" in result.quantile_coverage
        assert "P90" in result.quantile_coverage
        assert "P10" in result.pinball_losses

    def test_without_quantiles(self) -> None:
        """evaluate_model works with P50 only."""
        actual = np.array([1.0, 2.0, 3.0, 4.0])
        predicted = np.array([1.1, 2.1, 3.1, 4.1])
        result = evaluate_model("P50Only", actual, predicted)
        assert result.rmse_mw > 0.0
        assert "P50" in result.quantile_coverage


# ── Compare Models ────────────────────────────────────────────────


class TestCompareModels:
    """Model comparison tests."""

    def test_ranks_by_rmse(self) -> None:
        """Best RMSE model should be ranked first."""
        good = ModelMetrics(
            model_name="Good",
            rmse_mw=0.5,
            mae_mw=0.4,
            mape_pct=5.0,
            r_squared=0.95,
            skill_score=0.8,
            quantile_coverage={"P90": 0.89},
            pinball_losses={"P90": 0.3},
            num_samples=100,
        )
        bad = ModelMetrics(
            model_name="Bad",
            rmse_mw=2.0,
            mae_mw=1.5,
            mape_pct=20.0,
            r_squared=0.60,
            skill_score=0.3,
            quantile_coverage={"P90": 0.70},
            pinball_losses={"P90": 1.0},
            num_samples=100,
        )
        result = compare_models([bad, good])
        assert isinstance(result, ModelComparisonResult)
        assert result.best_rmse == "Good"
        assert result.best_mae == "Good"
        assert result.ranking[0] == "Good"
        assert result.ranking[1] == "Bad"

    def test_best_mae_differs_from_best_rmse(self) -> None:
        """When one model minimises MAE and another minimises RMSE, both are reported."""
        rmse_winner = ModelMetrics(
            model_name="RMSEWinner",
            rmse_mw=0.80,  # lowest RMSE
            mae_mw=0.60,
            mape_pct=10.0,
            r_squared=0.88,
            skill_score=0.5,
            quantile_coverage={"P90": 0.88},
            pinball_losses={"P90": 0.3},
            num_samples=100,
        )
        mae_winner = ModelMetrics(
            model_name="MAEWinner",
            rmse_mw=0.90,
            mae_mw=0.45,  # lowest MAE (fewer large outliers, more small errors)
            mape_pct=9.0,
            r_squared=0.85,
            skill_score=0.5,
            quantile_coverage={"P90": 0.88},
            pinball_losses={"P90": 0.3},
            num_samples=100,
        )
        result = compare_models([rmse_winner, mae_winner])
        assert result.best_rmse == "RMSEWinner"
        assert result.best_mae == "MAEWinner"

    def test_empty_list_raises(self) -> None:
        """Empty model list should raise ValueError."""
        with pytest.raises(ValueError, match="At least one model"):
            compare_models([])

    def test_best_calibration(self) -> None:
        """Model closest to P90=0.90 wins calibration."""
        well_cal = ModelMetrics(
            model_name="WellCal",
            rmse_mw=1.0,
            mae_mw=0.8,
            mape_pct=10.0,
            r_squared=0.85,
            skill_score=0.5,
            quantile_coverage={"P90": 0.89},
            pinball_losses={"P90": 0.4},
            num_samples=100,
        )
        poor_cal = ModelMetrics(
            model_name="PoorCal",
            rmse_mw=0.8,
            mae_mw=0.6,
            mape_pct=8.0,
            r_squared=0.90,
            skill_score=0.6,
            quantile_coverage={"P90": 0.70},
            pinball_losses={"P90": 0.8},
            num_samples=100,
        )
        result = compare_models([well_cal, poor_cal])
        assert result.best_calibration == "WellCal"
