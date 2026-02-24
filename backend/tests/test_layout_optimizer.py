"""
Unit tests for wind farm layout generation and optimization.

Tests validate the regular grid, staggered grid, and optimized layout
generators against physical constraints and expected geometry.

Test Strategy
-------------
- All layouts: 34 turbines, min spacing ≥ 1180m (5D), positive area
- Regular grid: aligned rows, known spacing
- Staggered: alternate row offsets, reduced wake alignment
- Pairwise distances: correct shape, symmetric, zero diagonal
- Optimization: marked @pytest.mark.slow (PyWake-dependent), seed reproducibility
"""

import numpy as np
import pytest

from app.services.p1.layout_optimizer import (
    MIN_SPACING_M,
    LayoutResult,
    check_minimum_spacing,
    compute_pairwise_distances_m,
    generate_regular_grid,
    generate_staggered_grid,
)

# Check if PyWake is available for optimization tests
try:
    import py_wake  # noqa: F401

    HAS_PYWAKE = True
except ImportError:
    HAS_PYWAKE = False


# ── Pairwise Distance Tests ──────────────────────────────────────


class TestPairwiseDistances:
    """Tests for pairwise distance computation."""

    def test_shape(self):
        """Distance matrix should be (n, n)."""
        x = np.array([0.0, 1000.0, 2000.0])
        y = np.array([0.0, 0.0, 0.0])
        dist = compute_pairwise_distances_m(x, y)
        assert dist.shape == (3, 3)

    def test_symmetric(self):
        """Distance matrix should be symmetric."""
        x = np.array([0.0, 1000.0, 500.0])
        y = np.array([0.0, 0.0, 500.0])
        dist = compute_pairwise_distances_m(x, y)
        np.testing.assert_array_almost_equal(dist, dist.T)

    def test_zero_diagonal(self):
        """Diagonal entries should be 0 (distance to self)."""
        x = np.array([0.0, 1000.0, 2000.0])
        y = np.array([0.0, 0.0, 0.0])
        dist = compute_pairwise_distances_m(x, y)
        np.testing.assert_array_almost_equal(np.diag(dist), 0.0)

    def test_known_distance(self):
        """Distance between (0,0) and (3000,4000) should be 5000 m."""
        x = np.array([0.0, 3000.0])
        y = np.array([0.0, 4000.0])
        dist = compute_pairwise_distances_m(x, y)
        assert dist[0, 1] == pytest.approx(5000.0, rel=1e-6)

    def test_single_turbine(self):
        """Single turbine should return 1×1 zero matrix."""
        dist = compute_pairwise_distances_m(np.array([0.0]), np.array([0.0]))
        assert dist.shape == (1, 1)
        assert dist[0, 0] == 0.0


# ── Minimum Spacing Tests ────────────────────────────────────────


class TestMinimumSpacing:
    """Tests for minimum spacing check."""

    def test_passes_with_wide_spacing(self):
        """Turbines 2000m apart should pass 1180m check."""
        x = np.array([0.0, 2000.0])
        y = np.array([0.0, 0.0])
        passes, actual = check_minimum_spacing(x, y, 1180.0)
        assert passes is True
        assert actual == pytest.approx(2000.0, rel=1e-6)

    def test_fails_with_tight_spacing(self):
        """Turbines 500m apart should fail 1180m check."""
        x = np.array([0.0, 500.0])
        y = np.array([0.0, 0.0])
        passes, actual = check_minimum_spacing(x, y, 1180.0)
        assert passes is False
        assert actual == pytest.approx(500.0, rel=1e-6)

    def test_single_turbine_always_passes(self):
        """Single turbine should always pass."""
        passes, _ = check_minimum_spacing(np.array([0.0]), np.array([0.0]))
        assert passes is True


# ── Regular Grid Tests ────────────────────────────────────────────


class TestRegularGrid:
    """Tests for regular grid layout generation."""

    def test_result_type(self):
        """Should return LayoutResult."""
        result = generate_regular_grid()
        assert isinstance(result, LayoutResult)

    def test_correct_turbine_count(self):
        """Should place exactly 34 turbines."""
        result = generate_regular_grid(34)
        assert result.num_turbines == 34
        assert len(result.x_positions) == 34
        assert len(result.y_positions) == 34

    def test_minimum_spacing_met(self):
        """All turbine pairs should be ≥ 1180m apart."""
        result = generate_regular_grid(34)
        assert result.min_spacing_m >= MIN_SPACING_M - 1.0  # 1m tolerance

    def test_positive_area(self):
        """Layout area should be positive."""
        result = generate_regular_grid(34)
        assert result.area_km2 > 0

    def test_name(self):
        """Layout name should be 'Regular Grid'."""
        result = generate_regular_grid()
        assert result.name == "Regular Grid"

    def test_aligned_rows(self):
        """Regular grid should have aligned (non-staggered) rows."""
        result = generate_regular_grid(12)
        # First 6 turbines (row 0) should all have same y
        y_row0 = result.y_positions[:6]
        assert np.allclose(y_row0, y_row0[0])

    def test_custom_turbine_count(self):
        """Should work with fewer turbines."""
        result = generate_regular_grid(10)
        assert result.num_turbines == 10
        assert len(result.x_positions) == 10

    def test_grid_spacing_is_5d_by_8d(self):
        """Default spacing should be 5D streamwise × 8D crosswind."""
        result = generate_regular_grid(12)
        # Check x spacing (streamwise): column 0 to column 1
        dx = result.x_positions[1] - result.x_positions[0]
        assert dx == pytest.approx(5.0 * 236.0, rel=1e-3)

        # Check y spacing (crosswind): row 0 to row 1
        dy = result.y_positions[6] - result.y_positions[0]
        assert dy == pytest.approx(8.0 * 236.0, rel=1e-3)


# ── Staggered Grid Tests ─────────────────────────────────────────


class TestStaggeredGrid:
    """Tests for staggered grid layout generation."""

    def test_result_type(self):
        """Should return LayoutResult."""
        result = generate_staggered_grid()
        assert isinstance(result, LayoutResult)

    def test_correct_turbine_count(self):
        """Should place exactly 34 turbines."""
        result = generate_staggered_grid(34)
        assert result.num_turbines == 34
        assert len(result.x_positions) == 34
        assert len(result.y_positions) == 34

    def test_minimum_spacing_met(self):
        """All turbine pairs should be ≥ 1180m apart."""
        result = generate_staggered_grid(34)
        assert result.min_spacing_m >= MIN_SPACING_M - 1.0

    def test_positive_area(self):
        """Layout area should be positive."""
        result = generate_staggered_grid(34)
        assert result.area_km2 > 0

    def test_name(self):
        """Layout name should be 'Staggered'."""
        result = generate_staggered_grid()
        assert result.name == "Staggered"

    def test_different_from_regular(self):
        """Staggered layout should differ from regular grid."""
        regular = generate_regular_grid(34)
        staggered = generate_staggered_grid(34)
        # Positions should not be identical
        assert not np.allclose(regular.x_positions, staggered.x_positions) or not np.allclose(
            regular.y_positions, staggered.y_positions
        )


# ── Optimization Tests (PyWake required) ─────────────────────────


@pytest.mark.slow
@pytest.mark.skipif(not HAS_PYWAKE, reason="PyWake not installed")
class TestOptimizeLayout:
    """Integration tests for layout optimization (slow, requires PyWake)."""

    def test_optimize_returns_layout_result(self):
        """optimize_layout should return a LayoutResult."""
        from app.services.p1.layout_optimizer import optimize_layout
        from app.services.p1.wake_model import create_uniform_site

        site = create_uniform_site()
        initial = generate_regular_grid(6)  # Small for speed

        result = optimize_layout(
            initial.x_positions,
            initial.y_positions,
            site,
            maxiter=5,
            seed=42,
        )

        assert isinstance(result, LayoutResult)
        assert result.num_turbines == 6
        assert result.name == "Optimized"

    def test_optimize_seed_reproducibility(self):
        """Same seed should give same result."""
        from app.services.p1.layout_optimizer import optimize_layout
        from app.services.p1.wake_model import create_uniform_site

        site = create_uniform_site()
        initial = generate_regular_grid(6)

        r1 = optimize_layout(initial.x_positions, initial.y_positions, site, maxiter=3, seed=42)
        r2 = optimize_layout(initial.x_positions, initial.y_positions, site, maxiter=3, seed=42)

        np.testing.assert_array_almost_equal(r1.x_positions, r2.x_positions)
        np.testing.assert_array_almost_equal(r1.y_positions, r2.y_positions)

    def test_optimize_positive_area(self):
        """Optimized layout with 2D initial spread should have positive area."""
        from app.services.p1.layout_optimizer import optimize_layout
        from app.services.p1.wake_model import create_uniform_site

        site = create_uniform_site()
        # Use staggered 12-turbine layout (2D spread) so optimizer can't collapse to line
        initial = generate_staggered_grid(12)

        result = optimize_layout(initial.x_positions, initial.y_positions, site, maxiter=3, seed=42)

        assert result.area_km2 > 0
