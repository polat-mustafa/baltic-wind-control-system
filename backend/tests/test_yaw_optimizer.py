"""Tests for P1 yaw optimization / wake steering service."""

from __future__ import annotations

import numpy as np
import pytest

from app.services.p1.layout_optimizer import generate_staggered_grid
from app.services.p1.wake_model import create_uniform_site
from app.services.p1.yaw_optimizer import (
    COS_POWER_EXPONENT,
    MAX_YAW_DEG,
    FarmYawOptimizationResult,
    YawOptimizationResult,
    compute_farm_power_with_yaw,
    configure_wake_model_with_deflection,
    create_v236_wind_turbine,
    optimize_yaw_all_directions,
    optimize_yaw_single_direction,
)


@pytest.fixture()
def site():
    """Create a uniform site for testing."""
    return create_uniform_site(weibull_a_ms=10.5, weibull_k=2.2, turbulence_intensity=0.06)


@pytest.fixture()
def layout():
    """Generate staggered layout for testing."""
    return generate_staggered_grid()


class TestYawConstants:
    """Test yaw optimization constants are physically valid."""

    def test_max_yaw_angle_positive(self):
        assert MAX_YAW_DEG > 0.0

    def test_max_yaw_angle_reasonable(self):
        """Yaw actuators typically limited to ±30-40 degrees."""
        assert 5.0 <= MAX_YAW_DEG <= 45.0

    def test_cos_power_exponent_reasonable(self):
        """Howland et al. (2019): p ≈ 1.88."""
        assert 1.0 < COS_POWER_EXPONENT < 3.0


class TestConfigureWakeModelWithDeflection:
    """Test wake model with Jiménez deflection is properly configured."""

    def test_model_creates_successfully(self, site):
        turbine = create_v236_wind_turbine()
        model = configure_wake_model_with_deflection(site, turbine)
        assert model is not None

    def test_model_accepts_yaw_parameter(self, site, layout):
        """Verify the model can run with yaw angles."""
        turbine = create_v236_wind_turbine()
        model = configure_wake_model_with_deflection(site, turbine)
        n = layout.num_turbines
        yaw = np.zeros(n, dtype=np.float64)
        total_mw, per_turbine = compute_farm_power_with_yaw(
            layout.x_positions,
            layout.y_positions,
            yaw,
            240.0,
            10.0,
            model,
        )
        assert total_mw > 0.0
        assert len(per_turbine) == n
        assert all(p >= 0.0 for p in per_turbine)


class TestComputeFarmPowerWithYaw:
    """Test farm power computation with yaw angles."""

    def test_zero_yaw_gives_positive_power(self, site, layout):
        turbine = create_v236_wind_turbine()
        model = configure_wake_model_with_deflection(site, turbine)
        n = layout.num_turbines
        total_mw, _ = compute_farm_power_with_yaw(
            layout.x_positions,
            layout.y_positions,
            np.zeros(n),
            240.0,
            10.0,
            model,
        )
        assert total_mw > 0.0

    def test_large_yaw_reduces_upstream_power(self, site, layout):
        """Large yaw misalignment should reduce total power (cosine loss)."""
        turbine = create_v236_wind_turbine()
        model = configure_wake_model_with_deflection(site, turbine)
        n = layout.num_turbines

        _, power_zero_yaw = compute_farm_power_with_yaw(
            layout.x_positions,
            layout.y_positions,
            np.zeros(n),
            240.0,
            10.0,
            model,
        )
        # Set all turbines to maximum yaw
        _, power_max_yaw = compute_farm_power_with_yaw(
            layout.x_positions,
            layout.y_positions,
            np.full(n, MAX_YAW_DEG),
            240.0,
            10.0,
            model,
        )
        # Total power should decrease when ALL turbines are yawed
        # (no downstream benefit when all are yawed equally)
        total_zero = float(np.sum(power_zero_yaw))
        total_max = float(np.sum(power_max_yaw))
        assert total_max < total_zero


class TestOptimizeYawSingleDirection:
    """Test single-direction yaw optimization."""

    def test_returns_valid_result(self, site, layout):
        result = optimize_yaw_single_direction(
            layout.x_positions,
            layout.y_positions,
            wind_direction_deg=240.0,
            wind_speed_ms=10.0,
            site=site,
            maxiter=10,
        )
        assert isinstance(result, YawOptimizationResult)
        assert result.baseline_power_mw > 0.0
        assert result.optimized_power_mw > 0.0
        assert len(result.optimal_yaw_angles_deg) == layout.num_turbines

    def test_yaw_angles_within_bounds(self, site, layout):
        result = optimize_yaw_single_direction(
            layout.x_positions,
            layout.y_positions,
            wind_direction_deg=240.0,
            wind_speed_ms=10.0,
            site=site,
            max_yaw_deg=25.0,
            maxiter=10,
        )
        assert all(abs(y) <= 25.0 + 0.1 for y in result.optimal_yaw_angles_deg)

    def test_optimized_power_not_less_than_zero(self, site, layout):
        result = optimize_yaw_single_direction(
            layout.x_positions,
            layout.y_positions,
            wind_direction_deg=240.0,
            wind_speed_ms=10.0,
            site=site,
            maxiter=10,
        )
        assert result.optimized_power_mw >= 0.0

    def test_power_gain_is_non_negative(self, site, layout):
        """Optimizer should find at least as good as baseline (or very close)."""
        result = optimize_yaw_single_direction(
            layout.x_positions,
            layout.y_positions,
            wind_direction_deg=240.0,
            wind_speed_ms=10.0,
            site=site,
            maxiter=20,
        )
        # Allow tiny floating point tolerance
        assert result.power_gain_percent >= -0.5


class TestOptimizeYawAllDirections:
    """Test multi-direction yaw optimization."""

    def test_returns_valid_result(self, site, layout):
        result = optimize_yaw_all_directions(
            layout.x_positions,
            layout.y_positions,
            site=site,
            wind_directions_deg=np.array([0.0, 90.0, 180.0, 270.0]),
            wind_speed_ms=10.0,
        )
        assert isinstance(result, FarmYawOptimizationResult)
        assert result.baseline_aep_gwh > 0.0
        assert len(result.per_direction_results) == 4

    def test_best_direction_is_valid(self, site, layout):
        directions = np.array([0.0, 120.0, 240.0])
        result = optimize_yaw_all_directions(
            layout.x_positions,
            layout.y_positions,
            site=site,
            wind_directions_deg=directions,
            wind_speed_ms=10.0,
        )
        assert result.best_direction_deg in directions
