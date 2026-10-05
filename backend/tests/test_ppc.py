"""
Power Plant Controller (services/p2/power_plant_controller.py).

Building blocks (power curve, ramp limiter, droops, dispatch, Q modes) and the
closed-loop simulation against PSE's NC RfG requirements: set-point accuracy
and deadline, LFSM-O/U/FSM droop values, voltage-control Q within 5 s.
"""

from __future__ import annotations

import pytest

from app.schemas.ppc import (
    ActivePowerMode,
    PPCConfig,
    PPCSimulationRequest,
    PPCState,
    ReactivePowerMode,
    TSOSetpoint,
)
from app.services.p2.network_model import TOTAL_CAPACITY_MW
from app.services.p2.power_plant_controller import (
    _apply_ramp_limit,
    _frequency_response_delta_p,
    _lfsm_delta_p,
    _pro_rata_dispatch,
    _q_from_power_factor,
    _q_from_qv_droop,
    _split_q_statcom_wtg,
    _turbine_available_power,
    get_ppc_status,
    run_ppc_simulation,
)

K_LFSM = TOTAL_CAPACITY_MW / 0.05 / 50.0  # 204 MW/Hz at 5 % droop on P_max


def _sim(**kw) -> object:
    tso = kw.pop("tso", TSOSetpoint(active_power_mw=300.0))
    kw.setdefault("wind_speed_ms", 12.0)
    return run_ppc_simulation(PPCSimulationRequest(tso_setpoint=tso, **kw))


class TestBuildingBlocks:
    def test_power_curve_is_the_v236_table(self):
        assert _turbine_available_power(2.0) == 0.0
        assert _turbine_available_power(12.0) == pytest.approx(15.0)
        assert 4.0 < _turbine_available_power(8.0) < 7.0  # not the old cubic-from-cut-in shape
        assert _turbine_available_power(32.0) == 0.0

    def test_ramp_limiter(self):
        assert _apply_ramp_limit(500, 300, 1.0, 1.0, 2.0) == pytest.approx(498.0)
        assert _apply_ramp_limit(300, 500, 1.0, 1.0, 2.0) == pytest.approx(301.0)
        assert _apply_ramp_limit(300, 300.5, 1.0, 1.0, 2.0) == pytest.approx(300.5)

    def test_lfsm_pse_defaults(self):
        cfg = PPCConfig()
        assert _lfsm_delta_p(50.1, cfg) == 0.0
        assert _lfsm_delta_p(50.5, cfg) == pytest.approx(-0.3 * K_LFSM)
        assert _lfsm_delta_p(49.5, cfg) == pytest.approx(0.3 * K_LFSM)
        assert _lfsm_delta_p(49.9, cfg) == 0.0

    def test_fsm_droop_outside_deadband(self):
        assert _frequency_response_delta_p(50.1, 0.2, 5.0) == 0.0
        assert _frequency_response_delta_p(50.3, 0.2, 5.0) == pytest.approx(-0.1 * K_LFSM)

    def test_pro_rata_dispatch(self):
        out = _pro_rata_dispatch(30.0, [15.0, 15.0, 0.0], [True, True, True])
        assert out == pytest.approx([15.0, 15.0, 0.0])
        out = _pro_rata_dispatch(20.0, [15.0, 5.0], [True, True])
        assert out == pytest.approx([15.0, 5.0])
        assert _pro_rata_dispatch(10.0, [15.0, 15.0], [True, False]) == pytest.approx([10.0, 0.0])

    def test_reactive_helpers(self):
        assert _q_from_power_factor(510.0, 0.95) == pytest.approx(167.6, abs=0.1)
        assert _q_from_power_factor(510.0, -0.95) == pytest.approx(-167.6, abs=0.1)
        assert _q_from_qv_droop(0.99, 1.0, 1000.0, 0.02) == 0.0
        assert _q_from_qv_droop(0.95, 1.0, 1000.0, 0.02) == pytest.approx(30.0)

    def test_q_split_wtgs_first_then_statcom(self):
        statcom, per_wtg = _split_q_statcom_wtg(100.0, 34)
        assert statcom == 0.0 and per_wtg == pytest.approx(100 / 34)
        statcom, per_wtg = _split_q_statcom_wtg(250.0, 34)
        assert per_wtg == pytest.approx(4.95) and statcom == pytest.approx(250 - 34 * 4.95)


class TestSimulation:
    def test_curtailment_ramps_at_the_set_limit_and_meets_pse_deadline(self):
        r = _sim(simulation_duration_s=400.0)
        assert r.final_power_mw == pytest.approx(300.0, abs=0.5)
        # 210 MW at 10 % P_max/min = 51 MW/min → ≈ 247 s (+ settling)
        assert 240 < r.ramp_time_s < 260
        assert r.setpoint_accuracy_compliant and r.ramp_rate_compliant
        assert max(p.ramp_rate_mw_per_min for p in r.time_series) <= 51.0 * 1.01
        assert r.wtg_dispatch[0].dispatched_power_mw == pytest.approx(300.0 / 34, abs=0.05)

    def test_deadline_judged_beyond_the_window(self):
        r = _sim()  # 120 s window, 247 s needed
        assert r.final_power_mw > 300.0
        assert r.setpoint_accuracy_compliant  # 247 s ≪ 15 min

    def test_delta_and_absolute_modes(self):
        delta = _sim(
            tso=TSOSetpoint(delta_reserve_mw=30.0),
            active_power_mode=ActivePowerMode.DELTA_CONTROL,
            simulation_duration_s=200.0,
        )
        assert delta.final_power_mw == pytest.approx(480.0, abs=0.5)
        cap = _sim(
            tso=TSOSetpoint(absolute_limit_mw=400.0),
            active_power_mode=ActivePowerMode.ABSOLUTE_LIMITATION,
            simulation_duration_s=300.0,
        )
        assert cap.final_power_mw == pytest.approx(400.0, abs=0.5)

    def test_power_never_exceeds_available(self):
        r = _sim(tso=TSOSetpoint(active_power_mw=510.0), wind_speed_ms=8.0, initial_power_mw=100.0)
        avail = r.total_available_mw
        assert avail < 510.0
        assert max(p.power_actual_mw for p in r.time_series) <= avail + 1e-6

    def test_lfsm_o_follows_the_droop(self):
        r = _sim(frequency_event_hz=50.5)
        assert r.frequency_response_expected_mw == pytest.approx(-0.3 * K_LFSM)
        assert r.frequency_response_compliant

    def test_lfsm_u_needs_headroom(self):
        full = _sim(tso=TSOSetpoint(active_power_mw=510.0), frequency_event_hz=49.5)
        assert full.frequency_response_expected_mw == pytest.approx(
            0.0, abs=0.5
        )  # no wind headroom
        reserve = _sim(
            tso=TSOSetpoint(delta_reserve_mw=50.0),
            active_power_mode=ActivePowerMode.DELTA_CONTROL,
            frequency_event_hz=49.7,
        )
        # LFSM-U (0.1 Hz) + FSM (0.1 Hz beyond 200 mHz deadband), each 204 MW/Hz
        assert reserve.frequency_response_expected_mw == pytest.approx(0.2 * K_LFSM)
        assert reserve.frequency_response_compliant

    def test_voltage_step_q_within_5_s(self):
        r = _sim(voltage_step_pu=-0.03)
        assert r.final_q_mvar > 50.0  # capacitive support for a low voltage
        assert 0.0 < r.q_response_90_s <= 5.0 and r.q_response_compliant
        assert r.final_voltage_pu > 0.97  # recovered part of the 3 % step
        high = _sim(voltage_step_pu=0.03)
        assert high.final_q_mvar < -50.0

    def test_power_factor_and_q_setpoint_modes(self):
        pf = _sim(
            tso=TSOSetpoint(active_power_mw=510.0, power_factor=-0.95),
            reactive_power_mode=ReactivePowerMode.POWER_FACTOR,
        )
        assert pf.final_q_mvar == pytest.approx(-167.6, abs=1.0)
        q = _sim(
            tso=TSOSetpoint(active_power_mw=510.0, reactive_power_mvar=80.0),
            reactive_power_mode=ReactivePowerMode.REACTIVE_POWER,
        )
        assert q.final_q_mvar == pytest.approx(80.0, abs=0.5)

    def test_emergency_stop(self):
        r = _sim(tso=TSOSetpoint(emergency_stop=True))
        assert r.ppc_state == PPCState.EMERGENCY_STOP
        assert r.final_power_mw == 0.0
        assert r.ramp_time_s == pytest.approx(50.0)  # 2 % P_max/s


class TestStatus:
    def test_default_snapshot(self):
        s = get_ppc_status()
        assert s.power_actual_mw == pytest.approx(510.0)
        assert s.ppc_state == PPCState.RUNNING

    def test_overfrequency_snapshot(self):
        s = get_ppc_status(frequency_hz=50.5)
        assert s.frequency_response_active
        assert s.frequency_delta_p_mw == pytest.approx(-0.3 * K_LFSM)
