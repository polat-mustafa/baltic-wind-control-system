"""
Tests for Power Plant Controller (PPC) service.

Validates the complete PPC control loop: TSO dispatch, ramp rate limiting,
pro-rata dispatch, voltage/reactive power control, frequency response,
emergency stop, and PSE IRiESP / ENTSO-E NC RfG compliance.
"""

from __future__ import annotations

import pytest

from app.schemas.ppc import (
    ActivePowerMode,
    PPCSimulationRequest,
    PPCState,
    ReactivePowerMode,
    TSOSetpoint,
)
from app.services.p2.power_plant_controller import (
    _apply_ramp_limit,
    _frequency_response_delta_p,
    _pro_rata_dispatch,
    _q_from_power_factor,
    _q_from_qv_droop,
    _split_q_statcom_wtg,
    _turbine_available_power,
    get_ppc_status,
    run_ppc_simulation,
)

# ── Power Curve Tests ────────────────────────────────────────────


class TestTurbinePowerCurve:
    """V236-15.0 MW power curve: cut-in 3 m/s, rated 11.1 m/s, cut-out 31 m/s."""

    def test_below_cut_in(self) -> None:
        assert _turbine_available_power(0.0) == 0.0
        assert _turbine_available_power(2.9) == 0.0

    def test_at_cut_in(self) -> None:
        assert _turbine_available_power(3.0) == 0.0  # (3-3)^3 = 0

    def test_cubic_region(self) -> None:
        p = _turbine_available_power(7.75)
        assert 0.0 < p < 15.0  # Between cut-in and rated

    def test_at_rated(self) -> None:
        assert _turbine_available_power(12.5) == 15.0

    def test_above_rated(self) -> None:
        assert _turbine_available_power(20.0) == 15.0
        assert _turbine_available_power(30.0) == 15.0

    def test_above_cut_out(self) -> None:
        assert _turbine_available_power(31.1) == 0.0
        assert _turbine_available_power(40.0) == 0.0

    def test_rule_1_physical_constraint(self) -> None:
        """Rule 1: Power output MUST be >= 0 and <= Prated."""
        for ws in [0, 2, 5, 8, 10, 12.5, 15, 25, 31, 35]:
            p = _turbine_available_power(float(ws))
            assert 0.0 <= p <= 15.0


# ── Ramp Rate Limiter Tests ──────────────────────────────────────


class TestRampRateLimiter:
    """PSE IRiESP: ramp up 10% Pn/min, ramp down 20% Pn/min."""

    def test_ramp_up(self) -> None:
        """Ramp up at 0.85 MW/s (= 51 MW/min = 10% of 510 MW)."""
        r = _apply_ramp_limit(400.0, 510.0, 1.0, 0.85, 1.70)
        assert r == pytest.approx(400.85, abs=0.01)

    def test_ramp_down(self) -> None:
        """Ramp down at 1.70 MW/s (= 102 MW/min = 20% of 510 MW)."""
        r = _apply_ramp_limit(510.0, 400.0, 1.0, 0.85, 1.70)
        assert r == pytest.approx(508.30, abs=0.01)

    def test_no_change(self) -> None:
        r = _apply_ramp_limit(400.0, 400.0, 1.0, 0.85, 1.70)
        assert r == pytest.approx(400.0)

    def test_reaches_target(self) -> None:
        """Small step within ramp limit."""
        r = _apply_ramp_limit(400.0, 400.5, 1.0, 0.85, 1.70)
        assert r == pytest.approx(400.5)

    def test_zero_dt(self) -> None:
        """Zero time step = no change."""
        r = _apply_ramp_limit(400.0, 510.0, 0.0, 0.85, 1.70)
        assert r == pytest.approx(400.0)


# ── Frequency Response Tests ─────────────────────────────────────


class TestFrequencyResponse:
    """ENTSO-E NC RfG Type D: droop 5%, deadband +/-200 mHz."""

    def test_overfrequency(self) -> None:
        """50.5 Hz with 200 mHz deadband: effective Df = 0.3 Hz."""
        dp = _frequency_response_delta_p(50.5, 0.2, 5.0)
        assert dp < 0  # Reduce power
        assert dp == pytest.approx(-61.2, abs=1.0)

    def test_underfrequency(self) -> None:
        """49.5 Hz with 200 mHz deadband: effective Df = -0.3 Hz."""
        dp = _frequency_response_delta_p(49.5, 0.2, 5.0)
        assert dp > 0  # Increase power
        assert dp == pytest.approx(61.2, abs=1.0)

    def test_within_deadband(self) -> None:
        """50.1 Hz within +/-200 mHz deadband: no response."""
        dp = _frequency_response_delta_p(50.1, 0.2, 5.0)
        assert dp == 0.0

    def test_nominal_frequency(self) -> None:
        dp = _frequency_response_delta_p(50.0, 0.2, 5.0)
        assert dp == 0.0

    def test_droop_sensitivity(self) -> None:
        """Tighter droop (2%) gives larger response."""
        dp_5pct = _frequency_response_delta_p(50.5, 0.2, 5.0)
        dp_2pct = _frequency_response_delta_p(50.5, 0.2, 2.0)
        assert abs(dp_2pct) > abs(dp_5pct)


# ── Pro-Rata Dispatch Tests ──────────────────────────────────────


class TestProRataDispatch:
    """PPC distributes P to WTGs proportional to available power."""

    def test_equal_available(self) -> None:
        """All WTGs same available -> equal dispatch."""
        d = _pro_rata_dispatch(340.0, [15.0] * 34, [True] * 34)
        assert sum(d) == pytest.approx(340.0)
        assert d[0] == pytest.approx(10.0, abs=0.01)

    def test_full_power(self) -> None:
        """Target = available = no curtailment."""
        d = _pro_rata_dispatch(510.0, [15.0] * 34, [True] * 34)
        assert sum(d) == pytest.approx(510.0)
        assert all(p == pytest.approx(15.0) for p in d)

    def test_offline_turbines(self) -> None:
        """Offline WTGs get zero dispatch."""
        online = [True] * 30 + [False] * 4
        d = _pro_rata_dispatch(300.0, [15.0] * 34, online)
        assert sum(d) == pytest.approx(300.0)
        assert all(d[i] == 0.0 for i in range(30, 34))

    def test_target_exceeds_available(self) -> None:
        """Target clamped to available power."""
        d = _pro_rata_dispatch(600.0, [15.0] * 34, [True] * 34)
        assert sum(d) == pytest.approx(510.0)

    def test_zero_available(self) -> None:
        """Zero wind = zero dispatch."""
        d = _pro_rata_dispatch(100.0, [0.0] * 34, [True] * 34)
        assert sum(d) == 0.0


# ── Reactive Power Tests ─────────────────────────────────────────


class TestReactivePower:
    """Reactive power control modes: PF, Q(V) droop, STATCOM split."""

    def test_power_factor_unity(self) -> None:
        q = _q_from_power_factor(400.0, 1.0)
        assert q == 0.0

    def test_power_factor_lagging(self) -> None:
        """PF = 0.95 lagging -> Q > 0 (generating, Rule 4)."""
        q = _q_from_power_factor(400.0, 0.95)
        assert q > 0
        assert q == pytest.approx(131.5, abs=1.0)

    def test_power_factor_leading(self) -> None:
        """PF = -0.95 (leading) -> Q < 0 (absorbing, Rule 4)."""
        q = _q_from_power_factor(400.0, -0.95)
        assert q < 0

    def test_qv_droop_within_deadband(self) -> None:
        q = _q_from_qv_droop(1.01, 1.0, 100.0, 0.02)
        assert q == 0.0  # 0.01 pu deviation < 0.02 deadband

    def test_qv_droop_low_voltage(self) -> None:
        """Low voltage -> positive Q (generating = voltage support)."""
        q = _q_from_qv_droop(0.95, 1.0, 100.0, 0.02)
        assert q > 0

    def test_qv_droop_high_voltage(self) -> None:
        """High voltage -> negative Q (absorbing = voltage reduction)."""
        q = _q_from_qv_droop(1.05, 1.0, 100.0, 0.02)
        assert q < 0

    def test_statcom_wtg_split(self) -> None:
        """Small Q handled by WTGs, large Q needs STATCOM."""
        s_q, w_q = _split_q_statcom_wtg(50.0, 34)
        # 34 WTGs * 5 MVAR = 170 MVAR capacity, so WTGs handle 50 MVAR
        assert s_q == 0.0
        assert w_q == pytest.approx(50.0 / 34, abs=0.01)

    def test_statcom_handles_overflow(self) -> None:
        """Q exceeding WTG capacity goes to STATCOM."""
        s_q, w_q = _split_q_statcom_wtg(200.0, 34)
        assert s_q > 0  # STATCOM absorbs overflow
        assert w_q == pytest.approx(5.0)  # WTGs at max


# ── PPC Simulation Tests ─────────────────────────────────────────


class TestPPCSimulation:
    """Full PPC control loop simulation tests."""

    def test_curtailment_ramp(self) -> None:
        """TSO curtails from 510 to 300 MW. Verify ramp and dispatch."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(active_power_mw=300.0),
                active_power_mode=ActivePowerMode.POWER_REFERENCE,
                wind_speed_ms=12.5,
                available_turbines=34,
                initial_power_mw=510.0,
                simulation_duration_s=600.0,
            )
        )
        assert r.final_power_mw == pytest.approx(300.0)
        assert r.total_curtailment_mw == pytest.approx(210.0)
        assert r.setpoint_accuracy_compliant
        assert r.ramp_rate_compliant
        assert r.overall_compliant
        assert len(r.wtg_dispatch) == 34
        # Each WTG should be dispatched equally (pro-rata with equal available)
        assert r.wtg_dispatch[0].dispatched_power_mw == pytest.approx(300.0 / 34, abs=0.1)

    def test_delta_control(self) -> None:
        """Delta control: keep 30 MW reserve below available."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(delta_reserve_mw=30.0),
                active_power_mode=ActivePowerMode.DELTA_CONTROL,
                wind_speed_ms=12.5,
                available_turbines=34,
                initial_power_mw=510.0,
                simulation_duration_s=600.0,
            )
        )
        assert r.final_power_mw == pytest.approx(480.0)
        assert r.total_curtailment_mw == pytest.approx(30.0)

    def test_absolute_limitation(self) -> None:
        """Absolute cap at 400 MW."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(absolute_limit_mw=400.0),
                active_power_mode=ActivePowerMode.ABSOLUTE_LIMITATION,
                wind_speed_ms=12.5,
                available_turbines=34,
                initial_power_mw=510.0,
                simulation_duration_s=600.0,
            )
        )
        assert r.final_power_mw == pytest.approx(400.0)

    def test_emergency_stop(self) -> None:
        """Emergency stop: 2% Pn/s = 10.2 MW/s from 510 MW."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(emergency_stop=True),
                initial_power_mw=510.0,
                simulation_duration_s=120.0,
                time_step_s=0.5,
            )
        )
        assert r.ppc_state == PPCState.EMERGENCY_STOP
        assert r.final_power_mw == 0.0
        assert r.ramp_time_s == pytest.approx(50.0, abs=0.5)

    def test_low_wind_no_power(self) -> None:
        """Below cut-in: no power available."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(active_power_mw=510.0),
                wind_speed_ms=2.0,
                available_turbines=34,
                initial_power_mw=0.0,
                simulation_duration_s=60.0,
            )
        )
        assert r.final_power_mw == 0.0
        assert r.total_available_mw == 0.0

    def test_power_factor_mode(self) -> None:
        """PF = 0.95: verify Q is calculated correctly."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(active_power_mw=400.0, power_factor=0.95),
                reactive_power_mode=ReactivePowerMode.POWER_FACTOR,
                wind_speed_ms=12.5,
                available_turbines=34,
                initial_power_mw=400.0,
                simulation_duration_s=60.0,
            )
        )
        assert r.final_q_mvar == pytest.approx(131.5, abs=2.0)

    def test_voltage_compliance(self) -> None:
        """Normal operation should maintain voltage within 0.95-1.05 pu."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(active_power_mw=510.0),
                reactive_power_mode=ReactivePowerMode.VOLTAGE_CONTROL,
                wind_speed_ms=12.5,
                available_turbines=34,
                initial_power_mw=510.0,
                simulation_duration_s=60.0,
            )
        )
        assert r.voltage_compliant

    def test_ramp_time_correct(self) -> None:
        """510 to 300 MW at 102 MW/min down = ~123 s ramp time."""
        r = run_ppc_simulation(
            PPCSimulationRequest(
                tso_setpoint=TSOSetpoint(active_power_mw=300.0),
                wind_speed_ms=12.5,
                available_turbines=34,
                initial_power_mw=510.0,
                simulation_duration_s=600.0,
                time_step_s=1.0,
            )
        )
        # 210 MW / 102 MW/min = 2.06 min = 123.5 s
        # But ramp time is measured to accuracy band (+-25.5 MW), so shorter
        assert r.ramp_time_s > 50.0  # At least 50 seconds
        assert r.ramp_time_s < 200.0  # But not too long


# ── PPC Status Tests ─────────────────────────────────────────────


class TestPPCStatus:
    """Real-time PPC status snapshot tests."""

    def test_running_at_rated(self) -> None:
        s = get_ppc_status(wind_speed_ms=12.5, available_turbines=34)
        assert s.ppc_state == PPCState.RUNNING
        assert s.power_actual_mw == 510.0
        assert s.turbines_online == 34

    def test_stopped_no_wind(self) -> None:
        s = get_ppc_status(wind_speed_ms=2.0, available_turbines=34)
        assert s.ppc_state == PPCState.STOPPED

    def test_derated_missing_turbines(self) -> None:
        s = get_ppc_status(wind_speed_ms=12.5, available_turbines=29)
        assert s.ppc_state == PPCState.DERATED
        assert s.turbines_online == 29

    def test_frequency_response_active(self) -> None:
        s = get_ppc_status(wind_speed_ms=12.5, available_turbines=34, frequency_hz=50.5)
        assert s.frequency_response_active
        assert s.frequency_delta_p_mw < 0  # Reduce for overfrequency

    def test_frequency_response_inactive(self) -> None:
        s = get_ppc_status(wind_speed_ms=12.5, available_turbines=34, frequency_hz=50.0)
        assert not s.frequency_response_active

    def test_emergency_stop(self) -> None:
        s = get_ppc_status(
            wind_speed_ms=12.5,
            available_turbines=34,
            tso_setpoint=TSOSetpoint(emergency_stop=True),
        )
        assert s.ppc_state == PPCState.EMERGENCY_STOP
