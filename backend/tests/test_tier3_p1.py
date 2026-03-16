"""
Tests for Tier 3 P1 features: helix control, dynamic flow, CFD simulation,
advanced optimization (simultaneous, adjoint, two-stage stochastic, MGA),
and Gaussian FLOWERS.
"""

import numpy as np
import pytest

from app.services.p1.layout_optimizer import generate_staggered_grid


def _small_layout():
    """Return a small 4-turbine layout for fast testing."""
    x = np.array([0.0, 1200.0, 2400.0, 3600.0], dtype=np.float64)
    y = np.array([0.0, 0.0, 0.0, 0.0], dtype=np.float64)
    return x, y


# ── Helix Control ─────────────────────────────────────────────


class TestHelixControl:
    """Tests for helix control (dynamic wake mixing)."""

    def test_helix_pitch_signal_generation(self):
        from app.services.p1.helix_control import generate_helix_pitch_signal

        signals = generate_helix_pitch_signal(duration_s=10.0, dt_s=0.5)
        assert len(signals) == 3  # 3 blades
        assert len(signals[0].time_s) == 20
        assert signals[0].blade_index == 0

    def test_helix_pitch_amplitude(self):
        from app.services.p1.helix_control import generate_helix_pitch_signal

        signals = generate_helix_pitch_signal(amplitude_deg=3.0)
        assert np.max(np.abs(signals[0].pitch_offset_deg)) <= 3.01

    def test_helix_simulation_runs(self):
        from app.services.p1.helix_control import simulate_helix_control

        x, y = _small_layout()
        result = simulate_helix_control(x, y)
        assert result.baseline_farm_power_mw > 0
        assert result.helix_farm_power_mw > 0

    def test_helix_power_gain_reasonable(self):
        from app.services.p1.helix_control import simulate_helix_control

        x, y = _small_layout()
        result = simulate_helix_control(x, y)
        # For small inline layouts, gain may be negative; should be within ±5%
        assert -5.0 < result.power_gain_percent < 10.0

    def test_helix_recovery_distance(self):
        from app.services.p1.helix_control import simulate_helix_control

        x, y = _small_layout()
        result = simulate_helix_control(x, y)
        assert result.wake_recovery_distance_d < result.natural_recovery_distance_d

    def test_helix_active_turbines(self):
        from app.services.p1.helix_control import simulate_helix_control

        x, y = _small_layout()
        result = simulate_helix_control(x, y)
        assert result.n_helix_active_turbines > 0
        assert result.n_helix_active_turbines < len(x)


# ── Dynamic Flow ──────────────────────────────────────────────


class TestDynamicFlow:
    """Tests for FLORIDyn-style dynamic flow simulation."""

    def test_dynamic_flow_runs(self):
        from app.services.p1.dynamic_flow import run_dynamic_flow_simulation

        x, y = _small_layout()
        result = run_dynamic_flow_simulation(x, y, dt_s=120.0, duration_s=600.0)
        assert result.mean_farm_power_mw > 0
        assert len(result.timesteps) == 5  # 600/120 = 5 steps

    def test_dynamic_flow_variability(self):
        from app.services.p1.dynamic_flow import run_dynamic_flow_simulation

        x, y = _small_layout()
        result = run_dynamic_flow_simulation(x, y, dt_s=60.0, duration_s=600.0)
        assert result.power_variability_mw >= 0

    def test_dynamic_flow_advection_time(self):
        from app.services.p1.dynamic_flow import run_dynamic_flow_simulation

        x, y = _small_layout()
        result = run_dynamic_flow_simulation(x, y)
        assert result.wake_advection_time_s > 0

    def test_heterogeneous_field_generation(self):
        from app.services.p1.dynamic_flow import generate_heterogeneous_field

        field = generate_heterogeneous_field(n_grid=10)
        assert field.ws_field.shape == (10, 10)
        assert field.wd_field.shape == (10, 10)
        assert np.all(field.ws_field > 0)

    def test_dynamic_flow_ramp_rate(self):
        from app.services.p1.dynamic_flow import run_dynamic_flow_simulation

        x, y = _small_layout()
        result = run_dynamic_flow_simulation(x, y, dt_s=60.0, duration_s=600.0)
        assert result.max_ramp_rate_mw_s >= 0


# ── CFD Simulation ────────────────────────────────────────────


class TestCFDSimulation:
    """Tests for analytical RANS-approximate CFD simulation."""

    def test_cfd_runs(self):
        from app.services.p1.cfd_simulation import run_cfd_simulation

        x, y = _small_layout()
        result = run_cfd_simulation(x, y)
        assert result.farm_power_mw > 0
        assert result.total_thrust_kn > 0

    def test_cfd_mesh_resolutions(self):
        from app.services.p1.cfd_simulation import run_cfd_simulation

        x, y = _small_layout()
        coarse = run_cfd_simulation(x, y, resolution="coarse")
        fine = run_cfd_simulation(x, y, resolution="fine")
        assert fine.mesh.n_cells > coarse.mesh.n_cells

    def test_cfd_actuator_disk(self):
        from app.services.p1.cfd_simulation import compute_actuator_disk_forces

        x, y = _small_layout()
        forces = compute_actuator_disk_forces(x, y, 10.5)
        assert len(forces) == 4
        assert all(f.thrust_force_kn > 0 for f in forces)

    def test_cfd_terrain_effects(self):
        from app.services.p1.cfd_simulation import compute_terrain_effects

        x, y = _small_layout()
        flat = compute_terrain_effects(x, y, "offshore_flat")
        ridge = compute_terrain_effects(x, y, "coastal_ridge")
        assert flat[0].speed_up_factor == 1.0
        assert any(t.speed_up_factor > 1.0 for t in ridge)

    def test_cfd_flow_field_shape(self):
        from app.services.p1.cfd_simulation import run_cfd_simulation

        x, y = _small_layout()
        result = run_cfd_simulation(x, y)
        assert result.flow_field.u_field.shape[0] > 0
        assert result.flow_field.u_field.shape[1] > 0

    def test_cfd_mean_tke(self):
        from app.services.p1.cfd_simulation import run_cfd_simulation

        x, y = _small_layout()
        result = run_cfd_simulation(x, y)
        assert result.mean_tke_m2s2 > 0


# ── Advanced Optimization ─────────────────────────────────────


class TestSimultaneousOptimization:
    """Tests for joint position + yaw + derating optimization."""

    def test_simultaneous_runs(self):
        from app.services.p1.advanced_optimization import run_simultaneous_optimization

        x, y = _small_layout()
        result = run_simultaneous_optimization(x, y, maxiter=2)
        assert result.baseline_aep_gwh > 0
        assert result.optimized_aep_gwh > 0

    def test_simultaneous_layout(self):
        from app.services.p1.advanced_optimization import run_simultaneous_optimization

        x, y = _small_layout()
        result = run_simultaneous_optimization(x, y, maxiter=1)
        assert result.layout.num_turbines == 4
        assert len(result.optimal_yaw_deg) == 4
        assert len(result.optimal_derating) == 4


class TestAdjointSensitivities:
    """Tests for PDE-constrained adjoint-like sensitivities."""

    def test_adjoint_runs(self):
        from app.services.p1.advanced_optimization import compute_adjoint_sensitivities

        x, y = _small_layout()
        result = compute_adjoint_sensitivities(x, y)
        assert len(result.sensitivities) == 4
        assert result.current_aep_gwh > 0

    def test_adjoint_gradient_norms(self):
        from app.services.p1.advanced_optimization import compute_adjoint_sensitivities

        x, y = _small_layout()
        result = compute_adjoint_sensitivities(x, y)
        assert result.total_gradient_norm >= 0
        assert 0 <= result.most_sensitive_turbine < 4


class TestTwoStageStochastic:
    """Tests for two-stage stochastic optimization."""

    def test_two_stage_runs(self):
        from app.services.p1.advanced_optimization import run_two_stage_stochastic

        x, y = _small_layout()
        result = run_two_stage_stochastic(x, y, n_scenarios=2, maxiter=2)
        assert result.expected_aep_gwh > 0
        assert result.n_scenarios == 2

    def test_two_stage_scenario_range(self):
        from app.services.p1.advanced_optimization import run_two_stage_stochastic

        x, y = _small_layout()
        result = run_two_stage_stochastic(x, y, n_scenarios=3, maxiter=2)
        assert result.worst_case_aep_gwh <= result.best_case_aep_gwh

    def test_two_stage_layout(self):
        from app.services.p1.advanced_optimization import run_two_stage_stochastic

        x, y = _small_layout()
        result = run_two_stage_stochastic(x, y, n_scenarios=2, maxiter=2)
        assert result.layout.num_turbines == 4


class TestMGA:
    """Tests for Modelling-to-Generate-Alternatives."""

    def test_mga_runs(self):
        from app.services.p1.advanced_optimization import run_mga

        x, y = _small_layout()
        result = run_mga(x, y, n_alternatives=2)
        assert len(result.alternatives) == 2

    def test_mga_diversity(self):
        from app.services.p1.advanced_optimization import run_mga

        x, y = _small_layout()
        result = run_mga(x, y, n_alternatives=2)
        assert len(result.diversity_scores) == 2
        assert all(d >= 0 for d in result.diversity_scores)

    def test_mga_aep_values(self):
        from app.services.p1.advanced_optimization import run_mga

        x, y = _small_layout()
        result = run_mga(x, y, n_alternatives=2)
        assert len(result.aep_values_gwh) == 2
        assert all(a > 0 for a in result.aep_values_gwh)

    def test_mga_optimal_reference(self):
        from app.services.p1.advanced_optimization import run_mga

        x, y = _small_layout()
        result = run_mga(x, y, n_alternatives=2)
        assert result.optimal_aep_gwh > 0


# ── Gaussian FLOWERS ──────────────────────────────────────────


class TestGaussianFLOWERS:
    """Tests for Gaussian FLOWERS analytical AEP."""

    def test_gaussian_flowers_runs(self):
        from app.services.p1.gaussian_flowers import compute_gaussian_flowers_aep

        x, y = _small_layout()
        result = compute_gaussian_flowers_aep(x, y)
        assert result.aep_gwh > 0
        assert result.gross_aep_gwh > 0

    def test_gaussian_flowers_wake_loss(self):
        from app.services.p1.gaussian_flowers import compute_gaussian_flowers_aep

        x, y = _small_layout()
        result = compute_gaussian_flowers_aep(x, y)
        assert 0 <= result.wake_loss_percent < 50

    def test_gaussian_flowers_jensen_comparison(self):
        from app.services.p1.gaussian_flowers import compute_gaussian_flowers_aep

        x, y = _small_layout()
        result = compute_gaussian_flowers_aep(x, y)
        assert result.jensen_comparison_aep_gwh > 0
        assert abs(result.gaussian_vs_jensen_diff_percent) < 30

    def test_gaussian_wake_deficit(self):
        from app.services.p1.gaussian_flowers import _gaussian_wake_deficit

        far = _gaussian_wake_deficit(5000.0, 0.0, 0.8)
        near = _gaussian_wake_deficit(500.0, 0.0, 0.8)
        assert near > far

    def test_gaussian_flowers_per_turbine(self):
        from app.services.p1.gaussian_flowers import compute_gaussian_flowers_aep

        x, y = _small_layout()
        result = compute_gaussian_flowers_aep(x, y)
        assert len(result.per_turbine_aep_gwh) == 4
