"""Tests for physical constraint enforcement on ML predictions.

Validates all 5 constraints: non-negative, rated cap, below cut-in,
above cut-out, and farm total.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p4.physical_constraints import (
    ConstraintType,
    enforce_farm_constraints,
    enforce_physical_constraints,
)

# ── Single-Turbine Constraint Tests ──────────────────────────────


class TestNegativePowerConstraint:
    """C1: P ≥ 0 — no negative generation."""

    def test_negative_clipped_to_zero(self) -> None:
        predictions = np.array([-1.0, -0.5, 5.0, 10.0])
        result = enforce_physical_constraints(predictions)
        assert result.power_mw[0] == 0.0
        assert result.power_mw[1] == 0.0

    def test_negative_violation_counted(self) -> None:
        predictions = np.array([-2.0, 5.0, -0.1])
        result = enforce_physical_constraints(predictions)
        neg_violations = [
            v for v in result.violations if v.constraint == ConstraintType.NEGATIVE_POWER
        ]
        assert len(neg_violations) == 2


class TestRatedPowerConstraint:
    """C2: P ≤ 15.0 MW — rated power cap."""

    def test_above_rated_clipped(self) -> None:
        predictions = np.array([10.0, 15.5, 16.0, 20.0])
        result = enforce_physical_constraints(predictions)
        assert result.power_mw[1] == 15.0
        assert result.power_mw[2] == 15.0
        assert result.power_mw[3] == 15.0

    def test_at_rated_unchanged(self) -> None:
        predictions = np.array([15.0])
        result = enforce_physical_constraints(predictions)
        assert result.power_mw[0] == 15.0
        assert result.total_violations == 0


class TestWindBasedConstraints:
    """C3/C4: Wind-speed-based zero-power enforcement."""

    def test_below_cut_in_forced_zero(self) -> None:
        predictions = np.array([2.0, 5.0, 10.0])
        wind = np.array([2.0, 8.0, 15.0])
        result = enforce_physical_constraints(predictions, wind_speed_ms=wind)
        assert result.power_mw[0] == 0.0  # Below cut-in (3.0 m/s)
        assert result.power_mw[1] > 0.0  # Normal operation

    def test_above_cut_out_forced_zero(self) -> None:
        predictions = np.array([10.0, 5.0])
        wind = np.array([35.0, 20.0])
        result = enforce_physical_constraints(predictions, wind_speed_ms=wind)
        assert result.power_mw[0] == 0.0  # Above cut-out (31.0 m/s)
        assert result.power_mw[1] > 0.0  # Normal operation

    def test_wind_constraints_override_power(self) -> None:
        """Wind-based rules should force zero even if power was positive."""
        predictions = np.array([5.0])
        wind = np.array([1.0])
        result = enforce_physical_constraints(predictions, wind_speed_ms=wind)
        assert result.power_mw[0] == 0.0


class TestValidPredictions:
    """Valid predictions should pass through unchanged."""

    def test_valid_prediction_unchanged(self) -> None:
        predictions = np.array([0.0, 5.0, 10.0, 14.9])
        wind = np.array([3.5, 8.0, 12.0, 12.5])
        result = enforce_physical_constraints(predictions, wind_speed_ms=wind)
        np.testing.assert_array_almost_equal(result.power_mw, predictions)
        assert result.total_violations == 0

    def test_zero_power_at_zero_wind_valid(self) -> None:
        predictions = np.array([0.0])
        wind = np.array([0.0])
        result = enforce_physical_constraints(predictions, wind_speed_ms=wind)
        assert result.total_violations == 0


class TestConstraintResult:
    """Verify ConstraintResult metadata."""

    def test_energy_tracking(self) -> None:
        predictions = np.array([-1.0, 5.0, 16.0])
        result = enforce_physical_constraints(predictions)
        assert result.original_energy_mwh == pytest.approx(20.0)
        assert result.corrected_energy_mwh == pytest.approx(20.0)  # 0 + 5 + 15

    def test_violation_count_matches_list(self) -> None:
        predictions = np.array([-1.0, 5.0, 16.0])
        result = enforce_physical_constraints(predictions)
        assert result.total_violations == len(result.violations)


# ── Farm Constraint Tests ─────────────────────────────────────────


class TestFarmConstraints:
    """C5: Farm total ≤ 510 MW."""

    def test_farm_constraints_per_turbine(self) -> None:
        """Each turbine should have its own ConstraintResult."""
        power = np.random.default_rng(42).uniform(0, 14, size=(100, 34))
        results = enforce_farm_constraints(power)
        assert len(results) == 34

    def test_farm_constraints_with_wind(self) -> None:
        power = np.random.default_rng(42).uniform(5, 10, size=(10, 3))
        wind = np.random.default_rng(42).uniform(5, 20, size=(10, 3))
        results = enforce_farm_constraints(power, wind_speeds_ms=wind, num_turbines=3)
        assert len(results) == 3
        for r in results:
            assert np.all(r.power_mw >= 0.0)
