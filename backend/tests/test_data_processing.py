"""
Unit tests for ERA5 wind data processing.

Tests validate the physics pipeline against known analytical results
and typical offshore wind resource characteristics.

Test Strategy
-------------
- Wind speed computation: verify against hand-calculated results
- Wind direction: verify cardinal directions map correctly
- Shear exponent: validate offshore range (0.06–0.12)
- Hub height extrapolation: verify expected increase (~4–6% from 100m→150m)
- Weibull fitting: validate against known Baltic Sea parameters (A≈10.5, k≈2.2)
- Full pipeline: end-to-end synthetic ERA5 → hub height
"""

import numpy as np
import pytest
from numpy.typing import NDArray

from app.services.p1.data_processing import (
    WeibullParameters,
    calculate_shear_exponent,
    compute_weibull_pdf,
    compute_wind_direction_deg,
    compute_wind_speed_ms,
    extrapolate_wind_speed_ms,
    fit_weibull,
    preprocess_era5_wind,
)

# ── Wind Speed from Components ─────────────────────────────────────


class TestComputeWindSpeed:
    """Tests for u/v → wind speed conversion."""

    def test_pure_easterly(self):
        """Pure u-component (easterly wind) gives correct speed."""
        u = np.array([10.0])
        v = np.array([0.0])
        ws = compute_wind_speed_ms(u, v)
        np.testing.assert_almost_equal(ws, [10.0])

    def test_pure_northerly(self):
        """Pure v-component (northerly wind) gives correct speed."""
        u = np.array([0.0])
        v = np.array([10.0])
        ws = compute_wind_speed_ms(u, v)
        np.testing.assert_almost_equal(ws, [10.0])

    def test_diagonal_wind(self):
        """45° wind: ws = sqrt(3² + 4²) = 5."""
        u = np.array([3.0])
        v = np.array([4.0])
        ws = compute_wind_speed_ms(u, v)
        np.testing.assert_almost_equal(ws, [5.0])

    def test_calm_conditions(self):
        """Zero components give zero speed."""
        u = np.array([0.0])
        v = np.array([0.0])
        ws = compute_wind_speed_ms(u, v)
        np.testing.assert_almost_equal(ws, [0.0])

    def test_array_operations(self):
        """Vectorised computation works on arrays."""
        u = np.array([3.0, 0.0, -5.0])
        v = np.array([4.0, 7.0, 0.0])
        ws = compute_wind_speed_ms(u, v)
        expected = np.array([5.0, 7.0, 5.0])
        np.testing.assert_array_almost_equal(ws, expected)


# ── Wind Direction ─────────────────────────────────────────────────


class TestComputeWindDirection:
    """Tests for u/v → meteorological direction conversion.

    Meteorological convention: direction wind comes FROM.
    """

    def test_north_wind(self):
        """Wind from north: u=0, v=-1 → 0° (or 360°)."""
        u = np.array([0.0])
        v = np.array([-1.0])
        wd = compute_wind_direction_deg(u, v)
        # North wind is 0° or 360°; accept either
        assert wd[0] == pytest.approx(0.0, abs=0.1) or wd[0] == pytest.approx(360.0, abs=0.1)

    def test_south_wind(self):
        """Wind from south: u=0, v=1 → 180°."""
        u = np.array([0.0])
        v = np.array([1.0])
        wd = compute_wind_direction_deg(u, v)
        assert wd[0] == pytest.approx(180.0, abs=0.1)

    def test_west_wind(self):
        """Wind from west: u=1, v=0 → 270°."""
        u = np.array([1.0])
        v = np.array([0.0])
        wd = compute_wind_direction_deg(u, v)
        assert wd[0] == pytest.approx(270.0, abs=0.1)

    def test_east_wind(self):
        """Wind from east: u=-1, v=0 → 90°."""
        u = np.array([-1.0])
        v = np.array([0.0])
        wd = compute_wind_direction_deg(u, v)
        assert wd[0] == pytest.approx(90.0, abs=0.1)

    def test_direction_range(self):
        """All directions should be in [0, 360)."""
        rng = np.random.default_rng(42)
        u = rng.standard_normal(1000)
        v = rng.standard_normal(1000)
        wd = compute_wind_direction_deg(u, v)
        assert np.all(wd >= 0.0)
        assert np.all(wd < 360.0)


# ── Shear Exponent ─────────────────────────────────────────────────


class TestShearExponent:
    """Tests for wind shear exponent calculation."""

    def test_typical_offshore(self):
        """Offshore shear exponent should be 0.06–0.12."""
        # ws_100m slightly higher than ws_10m → small alpha
        alpha = calculate_shear_exponent(
            wind_speed_upper_ms=9.5,
            wind_speed_lower_ms=7.8,
            height_upper_m=100.0,
            height_lower_m=10.0,
        )
        assert 0.06 < alpha < 0.12, f"Offshore alpha={alpha:.4f} outside expected range"

    def test_zero_shear(self):
        """Equal speeds at both heights → alpha = 0."""
        alpha = calculate_shear_exponent(
            wind_speed_upper_ms=10.0,
            wind_speed_lower_ms=10.0,
        )
        assert alpha == pytest.approx(0.0, abs=1e-10)

    def test_negative_speed_raises(self):
        """Negative wind speed should raise ValueError."""
        with pytest.raises(ValueError, match="positive"):
            calculate_shear_exponent(
                wind_speed_upper_ms=-5.0,
                wind_speed_lower_ms=7.0,
            )

    def test_zero_speed_raises(self):
        """Zero wind speed should raise ValueError."""
        with pytest.raises(ValueError, match="positive"):
            calculate_shear_exponent(
                wind_speed_upper_ms=0.0,
                wind_speed_lower_ms=7.0,
            )

    def test_invalid_heights_raises(self):
        """Upper height <= lower height should raise ValueError."""
        with pytest.raises(ValueError, match="must exceed"):
            calculate_shear_exponent(
                wind_speed_upper_ms=10.0,
                wind_speed_lower_ms=8.0,
                height_upper_m=10.0,
                height_lower_m=100.0,
            )


# ── Hub Height Extrapolation ──────────────────────────────────────


class TestExtrapolation:
    """Tests for power law wind speed extrapolation."""

    def test_100m_to_150m_increases_speed(self):
        """Extrapolation from 100m→150m with α=0.10 should increase ~4%."""
        ws_100m = np.array([10.0])
        ws_150m = extrapolate_wind_speed_ms(ws_100m, shear_exponent=0.10)
        # (150/100)^0.10 ≈ 1.041
        expected = 10.0 * (150.0 / 100.0) ** 0.10
        np.testing.assert_almost_equal(ws_150m, [expected], decimal=3)

    def test_same_height_no_change(self):
        """Extrapolating to same height should give same speed."""
        ws = np.array([10.0, 15.0])
        result = extrapolate_wind_speed_ms(ws, shear_exponent=0.10, target_height_m=100.0)
        np.testing.assert_array_almost_equal(result, ws)

    def test_zero_shear_no_change(self):
        """Zero shear exponent means no height dependence."""
        ws = np.array([10.0])
        result = extrapolate_wind_speed_ms(ws, shear_exponent=0.0, target_height_m=200.0)
        np.testing.assert_almost_equal(result, [10.0])

    def test_negative_height_raises(self):
        """Negative target height should raise ValueError."""
        with pytest.raises(ValueError, match="positive"):
            extrapolate_wind_speed_ms(np.array([10.0]), 0.1, target_height_m=-50.0)

    def test_vectorised(self):
        """Extrapolation should work on arrays."""
        ws = np.array([5.0, 10.0, 15.0, 20.0])
        result = extrapolate_wind_speed_ms(ws, shear_exponent=0.08)
        # All should be slightly higher than input
        assert np.all(result > ws)
        # Ratio should be constant
        ratios = result / ws
        np.testing.assert_array_almost_equal(ratios, ratios[0] * np.ones_like(ratios))


# ── Weibull Fitting ────────────────────────────────────────────────


class TestWeibullFit:
    """Tests for Weibull distribution fitting."""

    def _generate_weibull_samples(
        self,
        scale_a: float,
        shape_k: float,
        n_samples: int = 50000,
        seed: int = 42,
    ) -> NDArray[np.floating]:
        """Generate synthetic Weibull-distributed wind speeds."""
        rng = np.random.default_rng(seed)
        return rng.weibull(shape_k, size=n_samples) * scale_a

    def test_baltic_sea_parameters(self):
        """Fit should recover Baltic Sea-like parameters (A≈10.5, k≈2.2)."""
        samples = self._generate_weibull_samples(scale_a=10.5, shape_k=2.2)
        params = fit_weibull(samples)
        assert params.scale_a_ms == pytest.approx(10.5, abs=0.3)
        assert params.shape_k == pytest.approx(2.2, abs=0.15)

    def test_rayleigh_distribution(self):
        """k=2 (Rayleigh) should be recoverable."""
        samples = self._generate_weibull_samples(scale_a=8.0, shape_k=2.0)
        params = fit_weibull(samples)
        assert params.shape_k == pytest.approx(2.0, abs=0.15)

    def test_narrow_distribution(self):
        """High k (narrow) should give higher shape parameter."""
        narrow = self._generate_weibull_samples(scale_a=10.0, shape_k=3.5)
        wide = self._generate_weibull_samples(scale_a=10.0, shape_k=1.5, seed=99)
        params_narrow = fit_weibull(narrow)
        params_wide = fit_weibull(wide)
        assert params_narrow.shape_k > params_wide.shape_k

    def test_insufficient_data_raises(self):
        """Fewer than 100 valid points should raise ValueError."""
        tiny = np.array([5.0, 6.0, 7.0])
        with pytest.raises(ValueError, match="Insufficient"):
            fit_weibull(tiny)

    def test_mean_wind_speed_property(self):
        """WeibullParameters.mean_wind_speed_ms should match analytical formula."""
        params = WeibullParameters(scale_a_ms=10.5, shape_k=2.2)
        # E[v] = A × Γ(1 + 1/k) ≈ 10.5 × Γ(1.4545) ≈ 9.3
        assert 9.0 < params.mean_wind_speed_ms < 9.6


# ── Weibull PDF ────────────────────────────────────────────────────


class TestWeibullPDF:
    """Tests for Weibull PDF computation."""

    def test_pdf_positive(self):
        """PDF values should be non-negative."""
        bins = np.arange(0.5, 30.0, 0.5)
        params = WeibullParameters(scale_a_ms=10.5, shape_k=2.2)
        pdf = compute_weibull_pdf(bins, params)
        assert np.all(pdf >= 0.0)

    def test_pdf_integrates_to_one(self):
        """PDF should integrate to ~1 over a wide range."""
        bins = np.arange(0.01, 50.0, 0.01)
        params = WeibullParameters(scale_a_ms=10.5, shape_k=2.2)
        pdf = compute_weibull_pdf(bins, params)
        integral = np.trapezoid(pdf, bins)
        assert integral == pytest.approx(1.0, abs=0.01)


# ── Full Pipeline ──────────────────────────────────────────────────


class TestPreprocessERA5:
    """Integration test for the full ERA5 preprocessing pipeline."""

    def _generate_synthetic_era5(
        self, n_hours: int = 8760, seed: int = 42
    ) -> tuple[
        NDArray[np.floating],
        NDArray[np.floating],
        NDArray[np.floating],
        NDArray[np.floating],
    ]:
        """Generate synthetic ERA5-like u/v data at 10m and 100m.

        Simulates a site with mean speed ~9 m/s at 100m, ~7.5 m/s at 10m
        (shear exponent ~0.08), predominantly south-westerly winds.
        """
        rng = np.random.default_rng(seed)

        # Predominantly SW winds (u > 0, v > 0 in ERA5 convention)
        mean_u100, mean_v100 = 5.0, 6.0  # SW dominant
        u100 = rng.normal(mean_u100, 3.0, n_hours)
        v100 = rng.normal(mean_v100, 3.0, n_hours)

        # 10m winds: scale down by shear (~0.08 power law)
        shear_factor = (10.0 / 100.0) ** 0.08  # ≈ 0.831
        u10 = u100 * shear_factor + rng.normal(0, 0.5, n_hours)
        v10 = v100 * shear_factor + rng.normal(0, 0.5, n_hours)

        return u100, v100, u10, v10

    def test_pipeline_output_shapes(self):
        """Pipeline should return arrays of correct length."""
        u100, v100, u10, v10 = self._generate_synthetic_era5(n_hours=1000)
        ws_hub, wd, _alpha = preprocess_era5_wind(u100, v100, u10, v10)
        assert len(ws_hub) == 1000
        assert len(wd) == 1000

    def test_hub_speed_higher_than_100m(self):
        """Hub height speed (150m) should exceed 100m speed on average."""
        u100, v100, u10, v10 = self._generate_synthetic_era5()
        ws_hub, _wd, _alpha = preprocess_era5_wind(u100, v100, u10, v10)
        ws_100m = compute_wind_speed_ms(u100, v100)
        assert np.mean(ws_hub) > np.mean(ws_100m)

    def test_shear_exponent_offshore_range(self):
        """Estimated shear exponent should be in offshore range."""
        u100, v100, u10, v10 = self._generate_synthetic_era5()
        _ws_hub, _wd, alpha = preprocess_era5_wind(u100, v100, u10, v10)
        assert 0.04 < alpha < 0.15, f"Shear exponent {alpha:.4f} outside offshore range"

    def test_direction_range(self):
        """All hub-height directions should be in [0, 360)."""
        u100, v100, u10, v10 = self._generate_synthetic_era5()
        _ws_hub, wd, _alpha = preprocess_era5_wind(u100, v100, u10, v10)
        assert np.all(wd >= 0.0)
        assert np.all(wd < 360.0)

    def test_weibull_fit_on_pipeline_output(self):
        """Weibull fit on pipeline output should give reasonable Baltic-like parameters."""
        u100, v100, u10, v10 = self._generate_synthetic_era5(n_hours=50000)
        ws_hub, _wd, _alpha = preprocess_era5_wind(u100, v100, u10, v10)
        params = fit_weibull(ws_hub)
        # Synthetic data won't match Baltic exactly, but should be reasonable
        assert 1.5 < params.shape_k < 3.5
        assert 5.0 < params.scale_a_ms < 15.0
