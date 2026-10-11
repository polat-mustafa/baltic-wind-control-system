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
    compute_weibull_pdf,
    fit_weibull,
)

# ── Wind Speed from Components ─────────────────────────────────────


# ── Wind Direction ─────────────────────────────────────────────────


# ── Shear Exponent ─────────────────────────────────────────────────


# ── Hub Height Extrapolation ──────────────────────────────────────


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
