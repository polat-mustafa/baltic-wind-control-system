"""Comprehensive tests for the Turbine Physics module — IEA 15 MW direct drive.

The SB-510 turbine ("V236 class") is the IEA 15 MW reference turbine; the time-domain
model uses its official ROSCO data (Cp/Ct table, DISCON.IN controller, ElastoDyn
drivetrain) and must reproduce the official steady-state table.

Tests are organized by sub-module:
1. Aerodynamics: ROSCO Cp surface, Betz limit, braking blades, start-up torque
2. Rotor dynamics: inertia, acceleration, no artificial clamp, kinetic energy
3. Drivetrain: direct drive, 12.6 Hz PMSG, efficiencies, ROSCO torque controller
4. Pitch control: ROSCO gain-scheduled PI, minimum-pitch schedule, rate limit
5. Yaw control: wrap-around, deadband, cos³ loss
6. Simulator: steady state vs the official table, IEC EOG gust, shutdown, Rule 1
7. Router: API endpoint smoke tests
"""

from __future__ import annotations

import math

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.p1.turbine_models import get_turbine
from app.services.turbine_physics.aerodynamics import (
    BETZ_LIMIT,
    compute_aerodynamic_state,
    compute_cp,
    compute_ct,
    compute_tip_speed_ratio,
)
from app.services.turbine_physics.drivetrain import (
    CONVERTER_EFFICIENCY,
    GENERATOR_EFFICIENCY,
    GENERATOR_POLES,
    RATED_TORQUE_NM,
    DrivetrainConfig,
    compute_drivetrain_state,
    compute_generator_frequency_hz,
    compute_generator_torque_nm,
    compute_torque_reference_rad_s,
)
from app.services.turbine_physics.pitch_control import (
    PITCH_RATE_LIMIT_DEG_S,
    PitchConfig,
    compute_pitch_command,
    compute_shutdown_pitch,
)
from app.services.turbine_physics.rotor_dynamics import (
    MAX_ROTOR_SPEED_RPM,
    MIN_ROTOR_SPEED_RPM,
    OVERSPEED_SHUTDOWN_RPM,
    ROTOR_INERTIA_KG_M2,
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
    DEADBAND_DEG,
    YAW_RATE_DEG_S,
    YawConfig,
    compute_yaw_error_deg,
    compute_yaw_power_loss,
    step_yaw,
)

client = TestClient(app)
RADIUS_M = 241.35 / 2.0


# ════════════════════════════════════════════════════════════════════════
# 1. AERODYNAMICS TESTS
# ════════════════════════════════════════════════════════════════════════


class TestTipSpeedRatio:
    """Test tip-speed ratio λ = ωR/V."""

    def test_basic_calculation(self) -> None:
        """At 8 m/s the controller holds λ = 9 → 5.70 rpm."""
        lam = compute_tip_speed_ratio(5.698, 8.0, RADIUS_M)
        assert lam == pytest.approx(9.0, abs=0.01)

    def test_zero_wind(self) -> None:
        assert compute_tip_speed_ratio(7.56, 0.0, RADIUS_M) == 0.0

    def test_negative_wind(self) -> None:
        assert compute_tip_speed_ratio(7.56, -5.0, RADIUS_M) == 0.0


class TestCpSurface:
    """ROSCO Cp(λ, β) table of the IEA 15 MW rotor."""

    def test_cp_max_at_tsr_9(self) -> None:
        """Cp_max = 0.469 at λ = 9, β = 0° (ROSCO VS_TSRopt)."""
        lams = np.linspace(2.0, 14.5, 251)
        cps = [compute_cp(float(lam), 0.0) for lam in lams]
        assert max(cps) == pytest.approx(0.4693, abs=0.001)
        assert lams[int(np.argmax(cps))] == pytest.approx(9.0, abs=0.5)

    def test_betz_limit_never_exceeded(self) -> None:
        for lam in np.linspace(0, 20, 60):
            for beta in np.linspace(-5, 90, 40):
                assert compute_cp(float(lam), float(beta)) <= BETZ_LIMIT

    def test_cp_decreases_with_pitch(self) -> None:
        assert compute_cp(9.0, 0.0) > compute_cp(9.0, 10.0) > compute_cp(9.0, 20.0)

    def test_feathered_blades_brake(self) -> None:
        """At high λ and large pitch the table Cp is negative — the blades brake."""
        assert compute_cp(10.0, 30.0) < 0.0
        assert compute_cp(10.0, 60.0) <= 0.0  # beyond the table: braking only

    def test_cp_zero_at_lambda_zero(self) -> None:
        assert compute_cp(0.0, 0.0) == 0.0


class TestCt:
    """ROSCO Ct(λ, β) table."""

    def test_ct_near_08_at_optimum(self) -> None:
        assert compute_ct(9.0, 0.0) == pytest.approx(0.8, abs=0.05)

    def test_ct_non_negative_and_falls_with_pitch(self) -> None:
        assert compute_ct(9.0, 0.0) > compute_ct(9.0, 15.0) >= 0.0


class TestAerodynamicState:
    """Test the master aerodynamic computation."""

    def test_rated_aero_power(self) -> None:
        """10.66 m/s, 7.52 rpm, β 0: ½ρAV³Cp ≈ 15.9 MW of shaft power."""
        state = compute_aerodynamic_state(10.66, 7.518, 0.0)
        p = 0.5 * 1.225 * math.pi * RADIUS_M**2 * 10.66**3 * state.cp
        assert state.aero_power_w == pytest.approx(p)
        assert 15.0 < state.aero_power_w / 1e6 < 16.5

    def test_torque_is_power_over_speed(self) -> None:
        state = compute_aerodynamic_state(9.0, 6.4, 0.0)
        assert state.aero_torque_nm == pytest.approx(state.aero_power_w / rpm_to_rad_s(6.4))

    def test_starting_torque_at_standstill(self) -> None:
        """λ = 0: no power, but the held Cq still gives a starting torque."""
        state = compute_aerodynamic_state(8.0, 0.0, 3.0)
        assert state.aero_power_w == 0.0
        assert state.aero_torque_nm > 0.0

    def test_zero_wind_zero_power(self) -> None:
        state = compute_aerodynamic_state(0.0, 7.56, 0.0)
        assert state.aero_power_w == 0.0
        assert state.aero_torque_nm == 0.0
        assert state.thrust_force_n == 0.0

    def test_state_is_frozen(self) -> None:
        state = compute_aerodynamic_state(10.0, 7.0, 0.0)
        with pytest.raises(AttributeError):
            state.cp = 0.5  # type: ignore[misc]

    def test_rated_thrust(self) -> None:
        """Thrust near rated ≈ 2.4 MN (table: 2,430 kN at 10.66 m/s)."""
        state = compute_aerodynamic_state(10.66, 7.518, 0.0)
        assert state.thrust_force_n / 1e3 == pytest.approx(2430, rel=0.08)


# ════════════════════════════════════════════════════════════════════════
# 2. ROTOR DYNAMICS TESTS
# ════════════════════════════════════════════════════════════════════════


class TestRotorDynamics:
    """Newton's 2nd law for rotation, direct-drive inertia."""

    def test_inertia_rotor_plus_generator(self) -> None:
        """3.5246e8 (rigid rotor, report §5.7) + 1.8368e6 (generator, no N² factor)."""
        assert pytest.approx(3.5246e8 + 1.8368e6, rel=1e-4) == ROTOR_INERTIA_KG_M2

    def test_speed_limits_from_rosco(self) -> None:
        assert pytest.approx(5.0, abs=1e-3) == MIN_ROTOR_SPEED_RPM
        assert pytest.approx(7.56, abs=1e-3) == MAX_ROTOR_SPEED_RPM
        assert pytest.approx(1.2 * MAX_ROTOR_SPEED_RPM, abs=1e-3) == OVERSPEED_SHUTDOWN_RPM

    def test_acceleration_sign(self) -> None:
        assert compute_angular_acceleration(20e6, 15e6, 0.0, ROTOR_INERTIA_KG_M2) > 0.0
        assert compute_angular_acceleration(10e6, 15e6, 0.0, ROTOR_INERTIA_KG_M2) < 0.0

    def test_no_artificial_upper_clamp(self) -> None:
        """Speed limits are the controllers' job — the integrator does not clamp."""
        new_rpm = step_rotor_speed(MAX_ROTOR_SPEED_RPM, 0.01, 10.0)
        assert new_rpm > MAX_ROTOR_SPEED_RPM

    def test_never_negative(self) -> None:
        assert step_rotor_speed(1.0, -1.0, 10.0) == 0.0

    def test_kinetic_energy_at_rated(self) -> None:
        """½·J·ω² at 7.56 rpm ≈ 111 MJ (7.4 s of rated power)."""
        ke = compute_kinetic_energy_mj(rpm_to_rad_s(7.56), ROTOR_INERTIA_KG_M2)
        assert ke == pytest.approx(111.0, abs=1.0)

    def test_kinetic_energy_zero_at_rest(self) -> None:
        assert compute_kinetic_energy_mj(0.0, ROTOR_INERTIA_KG_M2) == 0.0


# ════════════════════════════════════════════════════════════════════════
# 3. DRIVETRAIN TESTS
# ════════════════════════════════════════════════════════════════════════


class TestDrivetrain:
    """Direct-drive PMSG, full converter, ROSCO torque controller."""

    def test_generator_frequency_at_rated(self) -> None:
        """200 poles × 7.56 rpm → 12.6 Hz (report Table 5-4)."""
        assert GENERATOR_POLES == 200
        assert compute_generator_frequency_hz(7.56) == pytest.approx(12.6, abs=0.01)

    def test_efficiency_chain(self) -> None:
        """η_gen 96.55 % × η_conv 99.18 % = 95.756 % (ROSCO VS_GenEff)."""
        assert pytest.approx(0.9655) == GENERATOR_EFFICIENCY
        assert pytest.approx(0.95756) == GENERATOR_EFFICIENCY * CONVERTER_EFFICIENCY

    def test_rated_torque_gives_rated_power(self) -> None:
        """19.79 MN·m × 0.79168 rad/s × 0.95756 = 15.00 MW."""
        state = compute_drivetrain_state(7.56, 20e6, RATED_TORQUE_NM)
        assert state.elec_power_w / 1e6 == pytest.approx(15.0, abs=0.01)
        assert state.gen_speed_rpm == 7.56  # direct drive

    def test_losses_are_conversion_losses(self) -> None:
        state = compute_drivetrain_state(7.56, 20e6, RATED_TORQUE_NM)
        gap = RATED_TORQUE_NM * rpm_to_rad_s(7.56)
        assert state.losses_w == pytest.approx(gap * (1 - 0.95756), rel=1e-4)

    def test_tsr_reference(self) -> None:
        """ω_ref = 9·V/R → 8 m/s gives 0.597 rad/s (5.70 rpm)."""
        assert compute_torque_reference_rad_s(8.0, RADIUS_M) == pytest.approx(0.5966, abs=1e-3)

    def test_torque_rises_when_rotor_too_fast(self) -> None:
        torque, integral = compute_generator_torque_nm(0.65, 0.60, 10e6, 10e6, 0.1)
        assert torque > 10e6 and integral > 10e6

    def test_torque_saturates_at_rated(self) -> None:
        torque, integral = compute_generator_torque_nm(0.79, 0.70, RATED_TORQUE_NM, 25e6, 0.1)
        assert torque == pytest.approx(RATED_TORQUE_NM) and integral == RATED_TORQUE_NM

    def test_torque_rate_limit(self) -> None:
        """VS_MaxRat 4.5 MN·m/s → at most 0.45 MN·m per 0.1 s step."""
        torque, _ = compute_generator_torque_nm(0.79, 0.50, 5e6, 0.0, 0.1)
        assert torque == pytest.approx(5.45e6)

    def test_converter_caps_power(self) -> None:
        """Overspeed: torque cut to P_rated/(η·ω) so P stays ≤ 15 MW (Rule 1)."""
        cfg = DrivetrainConfig()
        torque, _ = compute_generator_torque_nm(0.95, 0.79, RATED_TORQUE_NM, 25e6, 0.1)
        assert torque * 0.95 * cfg.efficiency == pytest.approx(15e6)


# ════════════════════════════════════════════════════════════════════════
# 4. PITCH CONTROL TESTS
# ════════════════════════════════════════════════════════════════════════


class TestPitchControl:
    """ROSCO gain-scheduled PI on rotor speed."""

    def test_rate_limit_from_rosco(self) -> None:
        assert pytest.approx(2.0, abs=0.01) == PITCH_RATE_LIMIT_DEG_S

    def test_below_rated_sits_on_minimum_pitch(self) -> None:
        """Below rated the integral winds down onto β_min(V)."""
        state = compute_pitch_command(5.0, 3.44, 3.44, 0.1, wind_speed_ms=4.0)
        assert state.angle_deg == pytest.approx(3.44, abs=0.01)
        assert state.region == "below_rated"
        state = compute_pitch_command(6.0, 0.0, 0.0, 0.1, wind_speed_ms=8.0)
        assert state.angle_deg == 0.0

    def test_above_rated_pitch_increases(self) -> None:
        config = PitchConfig()
        state = compute_pitch_command(config.rated_speed_rpm + 0.3, 5.0, 5.0, 0.1, config, 14.0)
        assert state.angle_deg > 5.0
        assert state.region == "above_rated"

    def test_rate_limit_enforced(self) -> None:
        state = compute_pitch_command(9.0, 5.0, 40.0, 0.1, wind_speed_ms=15.0)
        assert state.angle_deg - 5.0 == pytest.approx(PITCH_RATE_LIMIT_DEG_S * 0.1)

    def test_pitch_bounds(self) -> None:
        state = compute_pitch_command(20.0, 89.0, 1000.0, 1.0, wind_speed_ms=20.0)
        assert 0.0 <= state.angle_deg <= 90.0

    def test_shutdown_feathering(self) -> None:
        assert compute_shutdown_pitch(0.0, 1.0) == pytest.approx(2.0, abs=0.01)
        assert compute_shutdown_pitch(89.5, 1.0) == 90.0


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

    def test_rosco_yaw_settings(self) -> None:
        """ROSCO Y_Rate 0.0087 rad/s (0.50 °/s), Y_ErrThresh 8°."""
        assert pytest.approx(0.4985, abs=1e-3) == YAW_RATE_DEG_S
        assert DEADBAND_DEG == 8.0

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


def _eog(v_hub: float, t: np.ndarray, start_s: float = 20.0) -> np.ndarray:
    """IEC 61400-1 §6.3.3.2 extreme operating gust, class I-B (I_ref 0.14), Λ₁ 42 m."""
    sigma1 = 0.14 * (0.75 * v_hub + 5.6)
    v_gust = 3.3 * sigma1 / (1 + 0.1 * 241.35 / 42.0)
    tt = t - start_s
    period = 10.5
    on = (tt >= 0) & (tt <= period)
    shape = np.sin(3 * np.pi * tt / period) * (1 - np.cos(2 * np.pi * tt / period))
    return np.where(on, v_hub - 0.37 * v_gust * shape, v_hub)


class TestSimulator:
    """The time-domain model must land on the official steady-state table."""

    @pytest.mark.parametrize("v", [6.0, 8.0, 10.0, 13.0, 20.0])
    def test_steady_state_matches_the_official_table(self, v: float) -> None:
        """Rotor speed, pitch and power after 300 s vs the IEA 15 MW table.

        Region 2 lands 1.7 % above the table: the ROSCO surface (Cp 0.469) is a
        CCBlade run, the table (Cp 0.462) a WISDEM one. Above rated the pitch loop
        holds 7.56 rpm (PC_RefSpd) where the table lists the 7.52 rpm tip-speed limit.
        """
        result = run_simulation([v] * 3000)
        ref = get_turbine().operating_point(v)
        assert result.electrical_power_mw[-1] == pytest.approx(
            get_turbine().power_curve_kw(v) / 1e3, rel=0.02
        )
        assert result.rotor_speed_rpm[-1] == pytest.approx(ref["rotor_rpm"], rel=0.01)
        assert result.pitch_angle_deg[-1] == pytest.approx(ref["pitch_deg"], abs=0.5)

    def test_step_response_settles_at_rated(self) -> None:
        result = run_step_response(8.0, 14.0, 10.0, 120.0)
        assert result.electrical_power_mw[-1] == pytest.approx(15.0, abs=0.01)
        assert result.rotor_speed_rpm[-1] == pytest.approx(7.56, abs=0.01)

    def test_extreme_operating_gust_stays_below_overspeed(self) -> None:
        """IEC EOG at 12 m/s (+4.3 m/s): the rotor peaks ≈ 8.3 rpm < 9.07 rpm trip."""
        t = np.arange(0, 100, 0.1)
        result = run_simulation(_eog(12.0, t))
        assert 7.9 < result.rotor_speed_rpm.max() < OVERSPEED_SHUTDOWN_RPM
        assert result.rotor_speed_rpm[-1] == pytest.approx(7.56, abs=0.01)

    def test_cut_out_feathers_and_slows_the_rotor(self) -> None:
        result = run_simulation([24.0] * 300 + [26.0] * 1200)
        assert result.status[-1] == "normal_shutdown"
        assert result.pitch_angle_deg[-1] == 90.0
        assert result.electrical_power_mw[-1] == 0.0
        assert result.rotor_speed_rpm[300:].max() < OVERSPEED_SHUTDOWN_RPM
        assert result.rotor_speed_rpm[-1] < 3.0

    def test_start_up_from_rest(self) -> None:
        result = run_simulation([2.0] * 300 + [8.0] * 3000)
        assert result.rotor_speed_rpm[299] == 0.0
        assert result.rotor_speed_rpm[-1] == pytest.approx(5.70, abs=0.01)

    @pytest.mark.parametrize("dt", [0.1, 0.5, 1.0])
    def test_rule1_power_clamped(self, dt: float) -> None:
        """Rule 1: 0 ≤ P ≤ 15 MW for any input, also at the largest allowed step."""
        steps = [int(100 / dt), int(200 / dt), int(100 / dt), int(100 / dt)]
        wind = [5.0] * steps[0] + [20.0] * steps[1] + [30.0] * steps[2] + [2.0] * steps[3]
        result = run_simulation(wind, config=SimulationConfig(dt=dt))
        assert float(np.max(result.electrical_power_mw)) <= 15.0
        assert float(np.min(result.electrical_power_mw)) >= 0.0

    def test_below_cut_in_no_power(self) -> None:
        result = run_simulation([2.0] * 200)
        assert float(np.max(result.electrical_power_mw)) == 0.0

    def test_summary_energy(self) -> None:
        """20 s at 10 m/s steady: E = P·t = 12.59 MW × 20 s / 3600."""
        result = run_simulation([10.0] * 200)
        assert result.summary.total_energy_mwh == pytest.approx(
            result.summary.mean_power_mw * 19.9 / 3600, rel=0.01
        )
        assert result.summary.num_steps == 200

    def test_output_array_lengths(self) -> None:
        result = run_simulation([12.0] * 50)
        assert len(result.time_s) == len(result.rotor_speed_rpm) == len(result.status) == 50

    def test_direct_drive_generator_speed(self) -> None:
        result = run_simulation([9.0] * 50)
        assert np.allclose(result.gen_speed_rpm, result.rotor_speed_rpm)


# ════════════════════════════════════════════════════════════════════════
# 7. ROUTER / API TESTS
# ════════════════════════════════════════════════════════════════════════


class TestRouter:
    """Test FastAPI endpoints for turbine physics."""

    def test_get_config(self) -> None:
        data = client.get("/api/v1/turbine-physics/config").json()
        assert "IEA" in data["turbine_name"]
        assert data["rated_power_mw"] == 15.0
        assert data["rotor_diameter_m"] == 241.35
        assert data["drivetrain"] == "Low speed, Direct drive"
        assert data["generator_poles"] == 200
        assert data["tsr_opt"] == 9.0
        assert len(data["pitch_gain_schedule_deg"]) == len(data["pitch_kp_s"]) == 30
        assert "gearbox_ratio" not in data

    def test_get_cp_surface(self) -> None:
        data = client.get("/api/v1/turbine-physics/cp-surface").json()
        assert data["lambda_opt"] == 9.0
        assert data["cp_max"] == pytest.approx(0.4693, abs=0.001)
        assert len(data["cp_matrix"]) == len(data["pitch_angles_deg"])
        assert data["pitch_angles_deg"][0] == 0.0
        assert data["betz_limit"] == pytest.approx(BETZ_LIMIT, abs=1e-5)
        assert "Cp_Ct_Cq" in data["source"]

    def test_post_aerodynamic_state(self) -> None:
        resp = client.post(
            "/api/v1/turbine-physics/aerodynamic-state",
            json={"wind_speed_ms": 12.0, "rotor_speed_rpm": 7.5, "pitch_angle_deg": 0.0},
        )
        assert resp.status_code == 200
        assert resp.json()["cp"] > 0.0

    def test_post_simulate(self) -> None:
        resp = client.post(
            "/api/v1/turbine-physics/simulate",
            json={"wind_speeds_ms": [8.0, 10.0, 12.0, 14.0, 12.0, 10.0], "dt": 1.0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["time_s"]) == 6
        assert data["summary"]["num_steps"] == 6

    def test_simulate_rejects_large_timestep(self) -> None:
        resp = client.post(
            "/api/v1/turbine-physics/simulate", json={"wind_speeds_ms": [8.0, 9.0], "dt": 2.0}
        )
        assert resp.status_code == 422

    def test_post_step_response(self) -> None:
        resp = client.post(
            "/api/v1/turbine-physics/step-response",
            json={"v_init_ms": 8.0, "v_final_ms": 14.0, "ramp_s": 5.0, "total_s": 30.0, "dt": 0.5},
        )
        assert resp.status_code == 200
        assert resp.json()["summary"]["max_power_mw"] > 0.0

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
