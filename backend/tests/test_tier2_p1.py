"""
Tests for Tier 2 P1 features: multiple wake models, derating, FLOWERS AEP and PCE UQ.
"""

import numpy as np
import pytest

from app.services.p1.wake_model import create_uniform_site


def _small_layout():
    """Return a small 4-turbine layout for fast testing."""
    x = np.array([0.0, 1200.0, 2400.0, 3600.0], dtype=np.float64)
    y = np.array([0.0, 0.0, 0.0, 0.0], dtype=np.float64)
    return x, y


def _default_site():
    return create_uniform_site(10.5, 2.2, 0.06)


# ── Multiple Wake Models ────────────────────────────────────────


class TestWakeModels:
    """Tests for multiple wake deficit model support."""

    def test_wake_deficit_model_enum(self):
        from app.services.p1.wake_models import WakeDeficitModel

        # Five distinct models — "noj" was once listed beside "jensen" (the same model)
        assert [m.value for m in WakeDeficitModel] == [
            "jensen",
            "bpa_gaussian",
            "niayifar_gaussian",
            "zong_gaussian",
            "turbopark",
        ]

    def test_turbulence_model_enum(self):
        from app.services.p1.wake_models import TurbulenceModel

        assert "crespo_hernandez" in [m.value for m in TurbulenceModel]

    def test_superposition_model_enum(self):
        from app.services.p1.wake_models import SuperpositionModel

        assert len(SuperpositionModel) == 3

    def test_flexible_wake_analysis_runs(self):
        from app.services.p1.wake_models import WakeDeficitModel, run_wake_analysis_flexible

        x, y = _small_layout()
        site = _default_site()
        result = run_wake_analysis_flexible(x, y, site, deficit_model=WakeDeficitModel.BPA_GAUSSIAN)
        assert result.net_aep_gwh > 0
        assert result.wake_loss_percent > 0

    def test_jensen_model_runs(self):
        from app.services.p1.wake_models import WakeDeficitModel, run_wake_analysis_flexible

        x, y = _small_layout()
        site = _default_site()
        result = run_wake_analysis_flexible(x, y, site, deficit_model=WakeDeficitModel.JENSEN)
        assert result.net_aep_gwh > 0

    def test_compare_wake_models(self):
        from app.services.p1.wake_models import WakeDeficitModel, compare_wake_models

        x, y = _small_layout()
        site = _default_site()
        # Compare 2 models for speed
        result = compare_wake_models(
            x,
            y,
            site,
            models=[WakeDeficitModel.JENSEN, WakeDeficitModel.BPA_GAUSSIAN],
        )
        assert len(result.results) == 2
        assert result.aep_range_gwh >= 0

    def test_crespo_hernandez_turbulence(self):
        from app.services.p1.wake_models import (
            TurbulenceModel,
            WakeDeficitModel,
            run_wake_analysis_flexible,
        )

        x, y = _small_layout()
        site = _default_site()
        result = run_wake_analysis_flexible(
            x,
            y,
            site,
            deficit_model=WakeDeficitModel.BPA_GAUSSIAN,
            turbulence_model=TurbulenceModel.CRESPO_HERNANDEZ,
        )
        assert result.net_aep_gwh > 0


# ── Derating Control ────────────────────────────────────────────


class TestDerating:
    """Tests for derating control optimization."""

    def test_derating_result_structure(self):
        from app.services.p1.derating import optimize_derating

        x, y = _small_layout()
        result = optimize_derating(x, y)
        assert result.baseline_power_mw > 0
        assert 0.5 <= result.optimal_derating_fraction <= 1.0

    def test_derating_per_turbine_arrays(self):
        from app.services.p1.derating import optimize_derating

        x, y = _small_layout()
        result = optimize_derating(x, y)
        assert len(result.per_turbine_baseline_mw) == 4
        assert len(result.per_turbine_derated_mw) == 4


# ── FLOWERS Analytical AEP ──────────────────────────────────────


class TestFLOWERS:
    """Tests for FLOWERS fast analytical AEP estimation."""

    def test_flowers_runs(self):
        from app.services.p1.flowers_aep import compute_flowers_aep

        x, y = _small_layout()
        result = compute_flowers_aep(x, y, mean_wind_speed_ms=10.5)
        assert result.aep_gwh > 0
        assert result.gross_aep_gwh > 0

    def test_flowers_wake_loss(self):
        from app.services.p1.flowers_aep import compute_flowers_aep

        x, y = _small_layout()
        result = compute_flowers_aep(x, y)
        assert 0 <= result.wake_loss_percent < 50.0

    def test_flowers_fast_computation(self):
        from app.services.p1.flowers_aep import compute_flowers_aep

        x, y = _small_layout()
        result = compute_flowers_aep(x, y)
        assert result.computation_time_ms < 5000.0  # Should be fast

    def test_flowers_per_turbine(self):
        from app.services.p1.flowers_aep import compute_flowers_aep

        x, y = _small_layout()
        result = compute_flowers_aep(x, y)
        assert len(result.per_turbine_aep_gwh) == 4

    def test_flowers_gross_is_weibull_integral_not_mean_speed(self):
        """Gross = 8760·∫P·f dv. P(v̄)·8760 gave CF ≈ 84 % — physically impossible here."""
        from app.services.p1.flowers_aep import compute_flowers_aep

        x, y = _small_layout()
        result = compute_flowers_aep(x, y, mean_wind_speed_ms=9.3, weibull_k=2.2)
        per_turbine = result.gross_aep_gwh / len(x)
        assert 72.0 < per_turbine < 77.0  # PyWake: 74.7 GWh, IEA 15 MW, A = 10.5, k = 2.2
        assert result.capacity_factor < 0.6

    def test_flowers_wind_direction_convention(self):
        """Wind only from the north: the southern turbine is waked, the northern one is not."""
        from app.services.p1.flowers_aep import compute_flowers_aep

        x = np.array([0.0, 0.0])
        y = np.array([0.0, 7 * 236.0])  # turbine 1 is 7D north of turbine 0
        freqs = np.zeros(12)
        freqs[0] = 1.0  # all wind from 0° (north)
        r = compute_flowers_aep(x, y, sector_frequencies=freqs)
        south, north = r.per_turbine_aep_gwh
        assert south < north

    def test_flowers_fourier_decomposition(self):
        from app.services.p1.flowers_aep import _fourier_decompose_wind_rose

        freqs = np.ones(12) / 12.0
        dirs = np.radians(np.linspace(0, 330, 12))
        a_0, _a_n, _b_n = _fourier_decompose_wind_rose(freqs, dirs)
        assert abs(a_0 - 1.0 / 12.0) < 0.01


# ── Market Value-Weighted AEP ───────────────────────────────────


# ── Polynomial Chaos UQ ────────────────────────────────────────


class TestPCEUQ:
    """Tests for Polynomial Chaos Expansion uncertainty quantification."""

    def test_pce_default_parameters(self):
        from app.services.p1.uncertainty_quantification import UncertainParameter

        p = UncertainParameter("test", 10.0, 1.0)
        assert p.distribution == "gaussian"

    def test_pce_lhs_samples(self):
        from app.services.p1.uncertainty_quantification import (
            UncertainParameter,
            _generate_lhs_samples,
        )

        params = [
            UncertainParameter("a", 10.5, 0.5),
            UncertainParameter("k", 2.2, 0.15),
        ]
        samples = _generate_lhs_samples(params, 20)
        assert samples.shape == (20, 2)
        # All samples should be near nominal values
        assert np.mean(samples[:, 0]) == pytest.approx(10.5, abs=1.5)

    def test_pce_runs_small(self):
        from app.services.p1.uncertainty_quantification import run_pce_uncertainty

        x, y = _small_layout()
        result = run_pce_uncertainty(x, y, n_samples=10, pce_order=2)
        assert result.mean_aep_gwh > 0
        assert result.std_aep_gwh >= 0

    def test_pce_sobol_indices(self):
        from app.services.p1.uncertainty_quantification import run_pce_uncertainty

        x, y = _small_layout()
        result = run_pce_uncertainty(x, y, n_samples=15, pce_order=2)
        assert len(result.sobol_indices) == 3  # 3 default parameters
        for si in result.sobol_indices:
            assert 0 <= si.first_order <= 1.0

    def test_pce_matches_monte_carlo_on_a_known_function(self):
        """Orthonormal Hermite basis: mean = c_0 and Var = Σc² must reproduce Monte Carlo
        (the old Legendre basis on Gaussian inputs gave a wrong variance)."""
        from app.services.p1.uncertainty_quantification import (
            UncertainParameter,
            _build_polynomial_basis,
            _generate_lhs_samples,
        )

        params = [UncertainParameter("a", 10.0, 0.5), UncertainParameter("b", 2.0, 0.2)]
        xs = _generate_lhs_samples(params, 40, 1)
        f = lambda a, b: 3 * a**2 + 5 * b + a * b  # noqa: E731
        xi = (xs - np.array([10.0, 2.0])) / np.array([0.5, 0.2])
        basis = _build_polynomial_basis(xi, 2, ["gaussian", "gaussian"])
        c = np.linalg.lstsq(basis, f(xs[:, 0], xs[:, 1]), rcond=None)[0]
        rng = np.random.default_rng(0)
        y = f(rng.normal(10.0, 0.5, 400_000), rng.normal(2.0, 0.2, 400_000))
        assert c[0] == pytest.approx(y.mean(), rel=1e-3)
        assert np.sqrt(np.sum(c[1:] ** 2)) == pytest.approx(y.std(), rel=5e-3)

    def test_pce_exceedance_values(self):
        from app.services.p1.uncertainty_quantification import run_pce_uncertainty

        x, y = _small_layout()
        result = run_pce_uncertainty(x, y, n_samples=15, pce_order=2)
        assert result.p50_gwh >= result.p75_gwh >= result.p90_gwh


# ── Robust Optimization ────────────────────────────────────────
