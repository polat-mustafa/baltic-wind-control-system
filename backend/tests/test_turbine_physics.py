"""Comprehensive tests for the Turbine Physics module.

Tests are organized by sub-module:
1. Aerodynamics: Cp surface, Betz limit, power/torque
2. Rotor dynamics: acceleration, speed clamping, kinetic energy
3. Drivetrain: generator speed, power conversion, losses
4. Pitch control: below/above rated, rate limits, bounds
5. Yaw control: wrap-around, deadband, cos³ loss
6. Simulator: steady state, step response, Rule 1
7. Router: API endpoint smoke tests
"""

from __future__ import annotations

import math

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.turbine_physics.aerodynamics import (
    BETZ_LIMIT,
    compute_aerodynamic_state,
    compute_cp,
    compute_ct,
    compute_tip_speed_ratio,
)
from app.services.turbine_physics.drivetrain import (
    GEARBOX_RATIO,
    DrivetrainConfig,
    compute_drivetrain_state,
    compute_generator_speed_rpm,
    compute_generator_torque_nm,
)
from app.services.turbine_physics.pitch_control import (
    PitchConfig,
    compute_pitch_command,
    compute_shutdown_pitch,
)
from app.services.turbine_physics.rotor_dynamics import (
    MAX_ROTOR_SPEED_RPM,
    MIN_ROTOR_SPEED_RPM,
    ROTOR_INERTIA_KG_M2,
    RotorConfig,
    compute_angular_acceleration,
    compute_kinetic_energy_mj,
    rpm_to_rad_s,
    step_rotor_speed,
)
from app.services.turbine_physics.simulator import (
    SimulationConfig,
    run_simulation,
    run_step_response,
)
from app.services.turbine_physics.yaw_control import (
    YawConfig,
    compute_yaw_error_deg,
    compute_yaw_power_loss,
    step_yaw,
)

client = TestClient(app)


# ════════════════════════════════════════════════════════════════════════
# 1. AERODYNAMICS TESTS
# ════════════════════════════════════════════════════════════════════════


class TestTipSpeedRatio:
    """Test tip-speed ratio λ = ωR/V."""

    def test_basic_calculation(self) -> None:
        """λ = ωR/V for known values."""
        # At rated: 8.33 rpm, R = 118 m, V = 11.1 m/s → λ ≈ 9.3
        lam = compute_tip_speed_ratio(8.33, 11.1, 118.0)
        expected = (8.33 * 2 * math.pi / 60) * 118.0 / 11.1
        assert abs(lam - expected) < 1e-10

    def test_zero_wind(self) -> None:
        """λ = 0 when wind speed is zero (avoid division by zero)."""
        assert compute_tip_speed_ratio(8.33, 0.0, 118.0) == 0.0

    def test_negative_wind(self) -> None:
        """λ = 0 for negative wind speed."""
        assert compute_tip_speed_ratio(8.33, -5.0, 118.0) == 0.0


class TestCpSurface:
    """Test power coefficient Cp(λ, β)."""

    def test_cp_max_near_048(self) -> None:
        """Cp_max ≈ 0.48 at optimal λ ≈ 8-9, β = 0°."""
        # Scan for maximum Cp at β = 0
        best_cp = 0.0
        for lam in np.linspace(1, 18, 200):
            cp = compute_cp(float(lam), 0.0)
            best_cp = max(best_cp, cp)
        assert 0.45 <= best_cp <= 0.50, f"Cp_max = {best_cp}, expected ≈ 0.48"

    def test_betz_limit_never_exceeded(self) -> None:
        """Cp never exceeds the Betz limit (16/27 ≈ 0.593)."""
        for lam in np.linspace(0, 20, 100):
            for beta in np.linspace(0, 30, 50):
                cp = compute_cp(float(lam), float(beta))
                assert cp <= BETZ_LIMIT + 1e-10, f"Cp = {cp} > Betz at λ={lam}, β={beta}"

    def test_cp_non_negative(self) -> None:
        """Cp is always ≥ 0."""
        for lam in np.linspace(0, 20, 100):
            for beta in np.linspace(0, 90, 50):
                cp = compute_cp(float(lam), float(beta))
                assert cp >= 0.0, f"Negative Cp at λ={lam}, β={beta}"

    def test_cp_decreases_with_pitch(self) -> None:
        """Cp decreases as pitch angle increases (at optimal λ)."""
        cp_0 = compute_cp(8.5, 0.0)
        cp_10 = compute_cp(8.5, 10.0)
        cp_20 = compute_cp(8.5, 20.0)
        assert cp_0 > cp_10 > cp_20, "Cp should decrease with pitch"

    def test_cp_zero_at_lambda_zero(self) -> None:
        """Cp = 0 when tip-speed ratio is zero."""
        assert compute_cp(0.0, 0.0) == 0.0


class TestCt:
    """Test thrust coefficient Ct."""

    def test_ct_positive_in_operating_range(self) -> None:
        """Ct > 0 for normal operating λ."""
        ct = compute_ct(8.5, 0.0)
        assert ct > 0.0

    def test_ct_bounded(self) -> None:
        """Ct ∈ [0, 1] for all inputs."""
        for lam in np.linspace(0, 20, 50):
            for beta in np.linspace(0, 30, 20):
                ct = compute_ct(float(lam), float(beta))
                assert 0.0 <= ct <= 1.0


class TestAerodynamicState:
    """Test the master aerodynamic computation."""

    def test_rated_power_near_15mw(self) -> None:
        """Power ≈ 15 MW near rated conditions (V236: 11.1 m/s, 8.33 rpm)."""
        state = compute_aerodynamic_state(11.1, 8.33, 0.0)
        power_mw = state.aero_power_w / 1e6
        # Aerodynamic power should be in the right ballpark
        # (exact value depends on Cp at actual λ)
        assert 10.0 < power_mw < 25.0, f"Aero power = {power_mw:.1f} MW"

    def test_zero_wind_zero_power(self) -> None:
        """No power at zero wind speed."""
        state = compute_aerodynamic_state(0.0, 8.33, 0.0)
        assert state.aero_power_w == 0.0
        assert state.aero_torque_nm == 0.0
        assert state.thrust_force_n == 0.0

    def test_state_is_frozen(self) -> None:
        """AerodynamicState is immutable."""
        state = compute_aerodynamic_state(10.0, 7.0, 0.0)
        with pytest.raises(AttributeError):
            state.cp = 0.5  # type: ignore[misc]

    def test_thrust_force_positive(self) -> None:
        """Thrust force > 0 when wind blows."""
        state = compute_aerodynamic_state(11.0, 8.0, 0.0)
        assert state.thrust_force_n > 0.0


# ════════════════════════════════════════════════════════════════════════
# 2. ROTOR DYNAMICS TESTS
# ════════════════════════════════════════════════════════════════════════


class TestRotorDynamics:
    """Test rotor dynamics — Newton's 2nd law for rotation."""

    def test_positive_acceleration(self) -> None:
        """Excess aero torque → positive acceleration."""
        alpha = compute_angular_acceleration(
            aero_torque_nm=20e6,
            gen_torque_nm=15e6,
            friction_torque_nm=50_000,
            inertia_kg_m2=ROTOR_INERTIA_KG_M2,
        )
        assert alpha > 0.0

    def test_negative_acceleration(self) -> None:
        """Excess gen torque → negative acceleration."""
        alpha = compute_angular_acceleration(
            aero_torque_nm=10e6,
            gen_torque_nm=15e6,
            friction_torque_nm=50_000,
            inertia_kg_m2=ROTOR_INERTIA_KG_M2,
        )
        assert alpha < 0.0

    def test_speed_clamping_upper(self) -> None:
        """Speed doesn't exceed max_rotor_speed_rpm."""
        config = RotorConfig()
        new_rpm = step_rotor_speed(
            current_rpm=MAX_ROTOR_SPEED_RPM,
            angular_acceleration=1.0,  # Strong positive accel
            dt=10.0,
            config=config,
        )
        assert new_rpm <= MAX_ROTOR_SPEED_RPM

    def test_speed_clamping_lower(self) -> None:
        """Speed doesn't go below min_rotor_speed_rpm."""
        config = RotorConfig()
        new_rpm = step_rotor_speed(
            current_rpm=MIN_ROTOR_SPEED_RPM,
            angular_acceleration=-1.0,  # Strong negative accel
            dt=10.0,
            config=config,
        )
        assert new_rpm >= MIN_ROTOR_SPEED_RPM

    def test_kinetic_energy_positive(self) -> None:
        """KE is positive for non-zero speed."""
        omega = rpm_to_rad_s(8.33)  # V236 rated rotor speed
        ke = compute_kinetic_energy_mj(omega, ROTOR_INERTIA_KG_M2)
        assert ke > 0.0

    def test_kinetic_energy_zero_at_rest(self) -> None:
        """KE = 0 at zero speed."""
        ke = compute_kinetic_energy_mj(0.0, ROTOR_INERTIA_KG_M2)
        assert ke == 0.0

    def test_euler_integration_basic(self) -> None:
        """Euler step increases speed with positive acceleration."""
        new_rpm = step_rotor_speed(
            current_rpm=7.0,
            angular_acceleration=0.001,
            dt=1.0,
        )
        assert new_rpm > 7.0


# ════════════════════════════════════════════════════════════════════════
# 3. DRIVETRAIN TESTS
# ════════════════════════════════════════════════════════════════════════


class TestDrivetrain:
    """Test drivetrain — gearbox and generator."""

    def test_generator_speed_ratio(self) -> None:
        """Generator speed = rotor_speed × gearbox_ratio (48:1 → 8.33 × 48 = 400 rpm)."""
        gen_rpm = compute_generator_speed_rpm(8.33, GEARBOX_RATIO)
        assert abs(gen_rpm - 8.33 * GEARBOX_RATIO) < 1e-10

    def test_generator_speed_at_rated(self) -> None:
        """At rated rotor speed, generator reaches 400 rpm."""
        gen_rpm = compute_generator_speed_rpm(8.33, GEARBOX_RATIO)
        assert abs(gen_rpm - 400.0) < 1.0  # 8.33 × 48 ≈ 400 rpm

    def test_elec_less_than_mech(self) -> None:
        """Electrical power < mechanical power (losses)."""
        state = compute_drivetrain_state(
            rotor_speed_rpm=8.33,
            aero_torque_nm=20e6,
            gen_torque_nm=18e6,
        )
        assert state.elec_power_w < state.mech_power_w

    def test_losses_positive(self) -> None:
        """Drivetrain losses > 0 when power flows."""
        state = compute_drivetrain_state(
            rotor_speed_rpm=8.33,
            aero_torque_nm=20e6,
            gen_torque_nm=18e6,
        )
        assert state.losses_w > 0.0

    def test_gen_torque_zero_at_rest(self) -> None:
        """Generator torque = 0 when rotor is stationary."""
        torque = compute_generator_torque_nm(15e6, 0.0)
        assert torque == 0.0

    def test_rated_power_approx_15mw(self) -> None:
        """At rated conditions (8.33 rpm, 11.1 m/s), electrical power ≈ 15 MW."""
        # Rated rotor speed: 400 rpm gen / 48 ratio = 8.33 rpm
        omega = rpm_to_rad_s(8.33)
        rated_power_w = 15e6
        aero_torque = rated_power_w / omega  # ≈ 17.2 MN·m

        config = DrivetrainConfig()
        gen_torque = compute_generator_torque_nm(rated_power_w, 8.33, config)

        state = compute_drivetrain_state(8.33, aero_torque, gen_torque, config)
        elec_mw = state.elec_power_w / 1e6

        # Should be close to 15 MW (minus losses)
        assert 13.0 < elec_mw < 16.0, f"Elec power = {elec_mw:.1f} MW"


# ════════════════════════════════════════════════════════════════════════
# 4. PITCH CONTROL TESTS
# ════════════════════════════════════════════════════════════════════════


class TestPitchControl:
    """Test pitch control — PI regulation."""

    def test_below_rated_pitch_zero(self) -> None:
        """Below rated speed → pitch stays at 0°."""
        state = compute_pitch_command(
            current_speed_rpm=7.0,
            current_pitch_deg=0.0,
            integral=0.0,
            dt=0.1,
        )
        assert state.angle_deg == 0.0
        assert state.region == "below_rated"

    def test_above_rated_pitch_increases(self) -> None:
        """Above rated speed → pitch increases."""
        config = PitchConfig()
        state = compute_pitch_command(
            current_speed_rpm=config.rated_speed_rpm + 0.5,
            current_pitch_deg=0.0,
            integral=0.0,
            dt=0.1,
            config=config,
        )
        assert state.angle_deg > 0.0
        assert state.region == "above_rated"

    def test_rate_limit_enforced(self) -> None:
        """Pitch rate never exceeds rate limit."""
        config = PitchConfig()
        state = compute_pitch_command(
            current_speed_rpm=config.rated_speed_rpm + 5.0,  # Way above rated
            current_pitch_deg=0.0,
            integral=100.0,  # Large integral
            dt=0.1,
            config=config,
        )
        max_delta = config.rate_limit_deg_s * 0.1
        assert state.angle_deg <= max_delta + 1e-10

    def test_pitch_bounds(self) -> None:
        """Pitch stays within [0°, 90°]."""
        state = compute_pitch_command(
            current_speed_rpm=20.0,  # Unrealistically high
            current_pitch_deg=89.0,
            integral=1000.0,
            dt=1.0,
        )
        assert 0.0 <= state.angle_deg <= 90.0

    def test_shutdown_feathering(self) -> None:
        """Emergency shutdown pitches toward 90°."""
        new_pitch = compute_shutdown_pitch(0.0, 1.0, rate_limit_deg_s=8.0)
        assert new_pitch == 8.0

        new_pitch = compute_shutdown_pitch(85.0, 1.0, rate_limit_deg_s=8.0)
        assert new_pitch == 90.0  # Clamped

    def test_integral_reset_below_rated(self) -> None:
        """Integral term resets to 0 when below rated (anti-windup)."""
        state = compute_pitch_command(
            current_speed_rpm=7.0,
            current_pitch_deg=0.0,
            integral=500.0,  # Stale integral
            dt=0.1,
        )
        assert state.integral == 0.0


# ════════════════════════════════════════════════════════════════════════
# 5. YAW CONTROL TESTS
# ════════════════════════════════════════════════════════════════════════


class TestYawControl:
    """Test yaw control — nacelle alignment."""

    def test_wrap_around_positive(self) -> None:
        """350° nacelle, 10° wind → +20° error (yaw right)."""
        error = compute_yaw_error_deg(350.0, 10.0)
        assert abs(error - 20.0) < 1e-10

    def test_wrap_around_negative(self) -> None:
        """10° nacelle, 350° wind → -20° error (yaw left)."""
        error = compute_yaw_error_deg(10.0, 350.0)
        assert abs(error - (-20.0)) < 1e-10

    def test_deadband_suppresses_yaw(self) -> None:
        """Small error within deadband → no yaw action."""
        config = YawConfig(deadband_deg=8.0)
        state = step_yaw(0.0, 5.0, 1.0, config)  # 5° error < 8° deadband
        assert not state.is_yawing
        assert state.rate_deg_s == 0.0

    def test_large_error_triggers_yaw(self) -> None:
        """Error > deadband → active yawing."""
        config = YawConfig(deadband_deg=8.0)
        state = step_yaw(0.0, 20.0, 1.0, config)  # 20° error > 8° deadband
        assert state.is_yawing
        assert state.rate_deg_s != 0.0

    def test_cos3_power_loss(self) -> None:
        """cos³(8°) ≈ 0.971."""
        loss = compute_yaw_power_loss(8.0, 3.0)
        expected = math.cos(math.radians(8.0)) ** 3
        assert abs(loss - expected) < 1e-10

    def test_zero_error_no_loss(self) -> None:
        """Zero yaw error → no power loss."""
        loss = compute_yaw_power_loss(0.0, 3.0)
        assert loss == 1.0

    def test_90_degree_zero_power(self) -> None:
        """90° yaw error → zero power (cos³(90°) = 0)."""
        loss = compute_yaw_power_loss(90.0, 3.0)
        assert abs(loss) < 1e-10


# ════════════════════════════════════════════════════════════════════════
# 6. SIMULATOR TESTS
# ════════════════════════════════════════════════════════════════════════


class TestSimulator:
    """Test the time-stepping simulator."""

    def test_constant_wind_converges(self) -> None:
        """Constant 10 m/s wind → power converges to steady state."""
        config = SimulationConfig(dt=0.5)
        n_steps = 600  # 300 seconds
        wind = [10.0] * n_steps

        result = run_simulation(wind, config=config)

        # Last 100 steps should be nearly constant
        last_powers = result.electrical_power_mw[-100:]
        std = float(np.std(last_powers))
        assert std < 0.5, f"Power std = {std:.3f}, expected steady state"

    def test_step_response_stabilizes(self) -> None:
        """Step from 8→14 m/s → power rises and stabilizes."""
        config = SimulationConfig(dt=0.5)
        result = run_step_response(
            v_init_ms=8.0,
            v_final_ms=14.0,
            ramp_s=10.0,
            total_s=300.0,
            config=config,
        )

        # Power should be higher at end than start
        start_power = float(np.mean(result.electrical_power_mw[:10]))
        end_power = float(np.mean(result.electrical_power_mw[-50:]))
        assert end_power > start_power

    def test_rule1_power_clamped(self) -> None:
        """Rule 1: Power never exceeds rated (15 MW) or goes negative."""
        config = SimulationConfig(dt=0.5)
        # Use extreme winds to test limits
        wind = [5.0] * 100 + [20.0] * 200 + [30.0] * 100 + [2.0] * 100
        result = run_simulation(wind, config=config)

        assert float(np.max(result.electrical_power_mw)) <= 15.0 + 1e-10
        assert float(np.min(result.electrical_power_mw)) >= -1e-10

    def test_below_cut_in_no_power(self) -> None:
        """Wind below cut-in → zero power."""
        config = SimulationConfig(dt=0.5)
        wind = [2.0] * 200  # Below 3.0 m/s cut-in
        result = run_simulation(wind, config=config)

        assert float(np.max(result.electrical_power_mw)) == 0.0

    def test_summary_energy_positive(self) -> None:
        """Simulation summary has positive energy for productive wind."""
        config = SimulationConfig(dt=0.5)
        wind = [10.0] * 200
        result = run_simulation(wind, config=config)

        assert result.summary.total_energy_mwh > 0.0
        assert result.summary.mean_power_mw > 0.0
        assert result.summary.num_steps == 200

    def test_output_array_lengths(self) -> None:
        """All output arrays have the same length as input."""
        n = 50
        wind = [12.0] * n
        config = SimulationConfig(dt=0.1)
        result = run_simulation(wind, config=config)

        assert len(result.time_s) == n
        assert len(result.wind_speed_ms) == n
        assert len(result.rotor_speed_rpm) == n
        assert len(result.electrical_power_mw) == n
        assert len(result.status) == n


# ════════════════════════════════════════════════════════════════════════
# 7. ROUTER / API TESTS
# ════════════════════════════════════════════════════════════════════════


class TestRouter:
    """Test FastAPI endpoints for turbine physics."""

    def test_get_config(self) -> None:
        """GET /config returns 200 with turbine spec."""
        resp = client.get("/api/v1/turbine-physics/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["turbine_name"] == "Vestas V236-15.0 MW"
        assert data["rated_power_mw"] == 15.0
        assert data["rotor_diameter_m"] == 236.0

    def test_get_cp_surface(self) -> None:
        """GET /cp-surface returns Cp matrix."""
        resp = client.get("/api/v1/turbine-physics/cp-surface")
        assert resp.status_code == 200
        data = resp.json()
        assert "cp_matrix" in data
        assert len(data["cp_matrix"]) > 0
        assert data["cp_max"] > 0.4
        assert data["betz_limit"] == pytest.approx(BETZ_LIMIT, abs=1e-5)

    def test_post_aerodynamic_state(self) -> None:
        """POST /aerodynamic-state returns valid state."""
        resp = client.post(
            "/api/v1/turbine-physics/aerodynamic-state",
            json={
                "wind_speed_ms": 12.0,
                "rotor_speed_rpm": 8.0,
                "pitch_angle_deg": 0.0,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["cp"] > 0.0
        assert data["aero_power_mw"] > 0.0

    def test_post_simulate(self) -> None:
        """POST /simulate returns time-series data."""
        resp = client.post(
            "/api/v1/turbine-physics/simulate",
            json={
                "wind_speeds_ms": [8.0, 10.0, 12.0, 14.0, 12.0, 10.0],
                "dt": 1.0,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["time_s"]) == 6
        assert len(data["electrical_power_mw"]) == 6
        assert "summary" in data
        assert data["summary"]["num_steps"] == 6

    def test_post_step_response(self) -> None:
        """POST /step-response returns step analysis."""
        resp = client.post(
            "/api/v1/turbine-physics/step-response",
            json={
                "v_init_ms": 8.0,
                "v_final_ms": 14.0,
                "ramp_s": 5.0,
                "total_s": 30.0,
                "dt": 0.5,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["time_s"]) > 0
        assert data["summary"]["max_power_mw"] > 0.0

    def test_simulate_validation_rejects_empty(self) -> None:
        """POST /simulate rejects empty wind array."""
        resp = client.post(
            "/api/v1/turbine-physics/simulate",
            json={"wind_speeds_ms": []},
        )
        assert resp.status_code == 422  # Validation error

    def test_aerodynamic_state_rejects_invalid(self) -> None:
        """POST /aerodynamic-state rejects out-of-range values."""
        resp = client.post(
            "/api/v1/turbine-physics/aerodynamic-state",
            json={
                "wind_speed_ms": -5.0,  # Negative wind
                "rotor_speed_rpm": 8.0,
            },
        )
        assert resp.status_code == 422
