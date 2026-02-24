"""
Unit tests for wind farm blockage effect model.

Tests validate the Nygaard et al. (2020) empirical blockage model against
expected physical behavior and numerical ranges.

Test Strategy
-------------
- Array density: correct ratio of rotor area to farm area
- Blockage loss: 1.5-2.5% for 34-turbine V236 array
- Edge cases: single turbine → ~0%, two turbines → ~0%, density scaling
- Convex hull: area computation for known geometries
"""

import numpy as np
import pytest

from app.services.p1.blockage import (
    BlockageResult,
    compute_array_density,
    estimate_blockage_loss_percent,
)


class TestArrayDensity:
    """Tests for array density calculation."""

    def test_known_density(self):
        """Array density for known inputs should match hand calculation.

        34 turbines × π/4 × 236² ≈ 1,487,139 m²
        Farm area = 40 km² = 40,000,000 m²
        Density = 1,487,139 / 40,000,000 ≈ 0.0372
        """
        rotor_area = np.pi / 4.0 * 236.0**2
        total_rotor = 34 * rotor_area
        farm_area_km2 = 40.0
        expected = total_rotor / (farm_area_km2 * 1e6)

        result = compute_array_density(34, 236.0, farm_area_km2)
        assert result == pytest.approx(expected, rel=1e-6)

    def test_zero_area_returns_zero(self):
        """Farm area of 0 should return density 0 (avoid division by zero)."""
        assert compute_array_density(34, 236.0, 0.0) == 0.0

    def test_negative_area_returns_zero(self):
        """Negative farm area should return density 0."""
        assert compute_array_density(34, 236.0, -1.0) == 0.0

    def test_density_scales_with_turbines(self):
        """Doubling turbines should double the density."""
        d1 = compute_array_density(17, 236.0, 40.0)
        d2 = compute_array_density(34, 236.0, 40.0)
        assert d2 == pytest.approx(2.0 * d1, rel=1e-6)

    def test_density_typical_range(self):
        """Density for typical offshore farms should be 0.01-0.10."""
        density = compute_array_density(34, 236.0, 40.0)
        assert 0.01 < density < 0.10


class TestBlockageEstimate:
    """Tests for blockage loss estimation."""

    def test_blockage_result_type(self):
        """Result should be a BlockageResult dataclass."""
        x = np.linspace(0, 10000, 34)
        y = np.zeros(34)
        y[::2] = 1000.0  # Stagger to create area
        result = estimate_blockage_loss_percent(34, x, y)
        assert isinstance(result, BlockageResult)

    def test_blockage_range_34_turbines(self):
        """Blockage loss for 34 V236 turbines should be ~1.5-2.5%.

        This is the expected range from Nygaard (2020) for large offshore arrays.
        """
        # Create a realistic grid layout
        cols, rows = 6, 6
        spacing_x = 5 * 236.0  # 5D streamwise
        spacing_y = 8 * 236.0  # 8D crosswind
        x_grid, y_grid = np.meshgrid(
            np.arange(cols) * spacing_x,
            np.arange(rows) * spacing_y,
        )
        x = x_grid.ravel()[:34]
        y = y_grid.ravel()[:34]

        result = estimate_blockage_loss_percent(34, x, y)
        assert 1.0 < result.blockage_loss_percent < 3.5, (
            f"Blockage = {result.blockage_loss_percent:.2f}%"
        )

    def test_single_turbine_zero_blockage(self):
        """Single turbine should have 0% blockage (no farm effect)."""
        x = np.array([0.0])
        y = np.array([0.0])
        result = estimate_blockage_loss_percent(1, x, y)
        assert result.blockage_loss_percent == 0.0

    def test_two_turbines_zero_blockage(self):
        """Two turbines can't form a convex hull area, so blockage = 0."""
        x = np.array([0.0, 1000.0])
        y = np.array([0.0, 0.0])
        result = estimate_blockage_loss_percent(2, x, y)
        assert result.blockage_loss_percent == 0.0

    def test_mean_ct_positive(self):
        """Mean Ct at 10.5 m/s should be positive."""
        x = np.linspace(0, 10000, 34)
        y = np.zeros(34)
        y[::2] = 1000.0
        result = estimate_blockage_loss_percent(34, x, y)
        assert result.mean_ct > 0.0

    def test_mean_ct_at_rated(self):
        """Mean Ct at rated wind speed (12.5 m/s) should be ~0.28."""
        x = np.linspace(0, 10000, 34)
        y = np.zeros(34)
        y[::2] = 1000.0
        result = estimate_blockage_loss_percent(34, x, y, mean_wind_speed_ms=12.5)
        assert result.mean_ct == pytest.approx(0.28, abs=0.05)

    def test_method_name(self):
        """Method should be 'nygaard_2020'."""
        x = np.array([0.0])
        y = np.array([0.0])
        result = estimate_blockage_loss_percent(1, x, y)
        assert result.method == "nygaard_2020"

    def test_farm_area_positive_for_valid_layout(self):
        """Farm area should be positive for non-degenerate layouts."""
        cols, rows = 6, 6
        spacing_x = 5 * 236.0
        spacing_y = 8 * 236.0
        x_grid, y_grid = np.meshgrid(
            np.arange(cols) * spacing_x,
            np.arange(rows) * spacing_y,
        )
        x = x_grid.ravel()[:34]
        y = y_grid.ravel()[:34]

        result = estimate_blockage_loss_percent(34, x, y)
        assert result.farm_area_km2 > 0

    def test_blockage_increases_with_density(self):
        """Tighter spacing → higher density → higher blockage."""
        # Wide spacing
        x_wide = np.linspace(0, 20000, 10)
        y_wide = np.zeros(10)
        y_wide[::2] = 5000.0

        # Tight spacing
        x_tight = np.linspace(0, 5000, 10)
        y_tight = np.zeros(10)
        y_tight[::2] = 1000.0

        result_wide = estimate_blockage_loss_percent(10, x_wide, y_wide)
        result_tight = estimate_blockage_loss_percent(10, x_tight, y_tight)

        assert result_tight.blockage_loss_percent > result_wide.blockage_loss_percent
