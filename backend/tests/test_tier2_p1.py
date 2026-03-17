"""
Tests for Tier 2 P1 features: multiple wake models, derating, FLOWERS AEP,
market-weighted AEP, multi-algorithm optimization, PCE UQ, and robust optimization.
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

        assert len(WakeDeficitModel) == 4
        assert "jensen" in [m.value for m in WakeDeficitModel]

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

    def test_flowers_fourier_decomposition(self):
        from app.services.p1.flowers_aep import _fourier_decompose_wind_rose

        freqs = np.ones(12) / 12.0
        dirs = np.radians(np.linspace(0, 330, 12))
        a_0, _a_n, _b_n = _fourier_decompose_wind_rose(freqs, dirs)
        assert abs(a_0 - 1.0 / 12.0) < 0.01


# ── Market Value-Weighted AEP ───────────────────────────────────


class TestMarketWeightedAEP:
    """Tests for market value-weighted AEP calculation."""

    def test_market_weighted_aep_runs(self):
        from app.services.p1.aep_calculator import compute_market_weighted_aep

        gen = np.full(8760, 250.0)  # 250 MW constant
        result = compute_market_weighted_aep(gen)
        assert result.flat_aep_gwh > 0
        assert result.market_weighted_aep_gwh > 0

    def test_market_value_factor(self):
        from app.services.p1.aep_calculator import compute_market_weighted_aep

        gen = np.full(8760, 250.0)
        result = compute_market_weighted_aep(gen)
        # Market value factor should be close to 1.0 for constant generation
        assert 0.5 < result.market_value_factor < 1.5

    def test_capture_price_positive(self):
        from app.services.p1.aep_calculator import compute_market_weighted_aep

        gen = np.full(8760, 250.0)
        result = compute_market_weighted_aep(gen)
        assert result.average_capture_price_eur_mwh > 0

    def test_peak_generation_fraction(self):
        from app.services.p1.aep_calculator import compute_market_weighted_aep

        gen = np.full(8760, 250.0)
        result = compute_market_weighted_aep(gen)
        assert 0.0 < result.peak_generation_fraction < 1.0


# ── Multi-Algorithm Optimization ────────────────────────────────


class TestMultiAlgorithm:
    """Tests for multi-algorithm layout optimization."""

    def test_algorithm_enum(self):
        from app.services.p1.layout_optimizer import OptimizationAlgorithm

        assert len(OptimizationAlgorithm) == 4

    def test_gradient_optimization_runs(self):
        from app.services.p1.layout_optimizer import optimize_layout_gradient

        x, y = _small_layout()
        site = _default_site()
        result = optimize_layout_gradient(x, y, site, maxiter=2)
        assert result.num_turbines == 4
        assert result.name == "Gradient Optimized"

    def test_optimize_multi_dispatcher(self):
        from app.services.p1.layout_optimizer import OptimizationAlgorithm, optimize_layout_multi

        x, y = _small_layout()
        site = _default_site()
        result = optimize_layout_multi(
            x,
            y,
            site,
            algorithm=OptimizationAlgorithm.GRADIENT_LBFGSB,
            maxiter=2,
        )
        assert result.num_turbines == 4


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

    def test_pce_exceedance_values(self):
        from app.services.p1.uncertainty_quantification import run_pce_uncertainty

        x, y = _small_layout()
        result = run_pce_uncertainty(x, y, n_samples=15, pce_order=2)
        assert result.p50_gwh >= result.p75_gwh >= result.p90_gwh


# ── Robust Optimization ────────────────────────────────────────


class TestRobustOptimization:
    """Tests for robust layout optimization."""

    def test_scenario_generation(self):
        from app.services.p1.robust_optimization import _generate_scenarios

        scenarios = _generate_scenarios(n_scenarios=10)
        assert len(scenarios) == 10
        for s in scenarios:
            assert "weibull_a" in s
            assert "weibull_k" in s
            assert "turbulence_intensity" in s

    def test_evaluate_scenarios(self):
        from app.services.p1.robust_optimization import (
            _evaluate_layout_scenarios,
            _generate_scenarios,
        )

        x, y = _small_layout()
        scenarios = _generate_scenarios(n_scenarios=3)
        aeps = _evaluate_layout_scenarios(x, y, scenarios)
        assert len(aeps) == 3
        assert all(a > 0 for a in aeps)

    def test_robust_optimization_runs(self):
        from app.services.p1.robust_optimization import run_robust_optimization

        x, y = _small_layout()
        result = run_robust_optimization(
            x,
            y,
            n_scenarios=3,
            maxiter=2,
        )
        assert result.mean_aep_gwh > 0
        assert result.layout.num_turbines == 4
        assert result.n_scenarios == 3
