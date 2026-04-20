"""Tests for IEC 61400-1 turbine state machine.

Validates all state transitions, overspeed logic, and the wind-speed
classifier used by the simulator.
"""

from __future__ import annotations

import pytest

from app.services.turbine_physics.state_machine import (
    StateMachineInput,
    TurbineOperatingState,
    classify_wind_state,
    is_overspeed,
    next_state,
)

S = TurbineOperatingState

# V236-15.0 MW reference values
RATED_RPM: float = 8.33
CUT_IN: float = 3.0
CUT_OUT: float = 31.0


def _inputs(
    wind: float = 10.0,
    rpm: float = 7.0,
    rated_rpm: float = RATED_RPM,
    fault: bool = False,
    critical: bool = False,
    op_shutdown: bool = False,
    op_maintenance: bool = False,
    fault_cleared: bool = False,
    maintenance_done: bool = False,
) -> StateMachineInput:
    """Helper: build StateMachineInput with sensible defaults."""
    return StateMachineInput(
        wind_speed_ms=wind,
        rotor_speed_rpm=rpm,
        rated_rotor_speed_rpm=rated_rpm,
        cut_in_speed_ms=CUT_IN,
        cut_out_speed_ms=CUT_OUT,
        fault_active=fault,
        critical_fault=critical,
        operator_shutdown=op_shutdown,
        operator_maintenance=op_maintenance,
        fault_cleared=fault_cleared,
        maintenance_complete=maintenance_done,
    )


# ── TurbineOperatingState enum ─────────────────────────────────────


class TestTurbineOperatingStateEnum:
    """Verify enum values match IEC 61400-25-2 SCADA codes."""

    def test_power_production_value(self) -> None:
        assert S.POWER_PRODUCTION.value == "power_production"

    def test_emergency_shutdown_value(self) -> None:
        assert S.EMERGENCY_SHUTDOWN.value == "emergency_shutdown"

    def test_parked_standby_value(self) -> None:
        assert S.PARKED_STANDBY.value == "parked_standby"

    def test_maintenance_value(self) -> None:
        assert S.MAINTENANCE.value == "maintenance"

    def test_all_eight_states_exist(self) -> None:
        assert len(TurbineOperatingState) == 8


# ── is_overspeed ──────────────────────────────────────────────────


class TestIsOverspeed:
    """Verify overspeed detection at 110 % of rated speed."""

    def test_normal_speed_not_overspeed(self) -> None:
        assert not is_overspeed(8.33, RATED_RPM)

    def test_at_110pct_is_overspeed(self) -> None:
        assert is_overspeed(RATED_RPM * 1.10 + 0.01, RATED_RPM)

    def test_just_below_110pct_not_overspeed(self) -> None:
        assert not is_overspeed(RATED_RPM * 1.09, RATED_RPM)

    def test_hardware_trip_speed_is_overspeed(self) -> None:
        assert is_overspeed(RATED_RPM * 1.20, RATED_RPM)

    def test_zero_rpm_not_overspeed(self) -> None:
        assert not is_overspeed(0.0, RATED_RPM)


# ── POWER_PRODUCTION transitions ─────────────────────────────────


class TestPowerProductionTransitions:
    """From POWER_PRODUCTION."""

    def test_stays_in_power_production_normal_wind(self) -> None:
        result = next_state(S.POWER_PRODUCTION, _inputs(wind=10.0))
        assert result == S.POWER_PRODUCTION

    def test_overspeed_triggers_emergency_shutdown(self) -> None:
        result = next_state(S.POWER_PRODUCTION, _inputs(rpm=RATED_RPM * 1.15))
        assert result == S.EMERGENCY_SHUTDOWN

    def test_critical_fault_triggers_emergency_shutdown(self) -> None:
        result = next_state(S.POWER_PRODUCTION, _inputs(critical=True))
        assert result == S.EMERGENCY_SHUTDOWN

    def test_minor_fault_goes_to_fault_state(self) -> None:
        result = next_state(S.POWER_PRODUCTION, _inputs(fault=True))
        assert result == S.POWER_PRODUCTION_FAULT

    def test_wind_below_cut_in_triggers_normal_shutdown(self) -> None:
        result = next_state(S.POWER_PRODUCTION, _inputs(wind=2.0))
        assert result == S.NORMAL_SHUTDOWN

    def test_wind_above_cut_out_triggers_normal_shutdown(self) -> None:
        result = next_state(S.POWER_PRODUCTION, _inputs(wind=32.0))
        assert result == S.NORMAL_SHUTDOWN

    def test_operator_shutdown_triggers_normal_shutdown(self) -> None:
        result = next_state(S.POWER_PRODUCTION, _inputs(op_shutdown=True))
        assert result == S.NORMAL_SHUTDOWN

    def test_overspeed_takes_priority_over_minor_fault(self) -> None:
        """Overspeed must override fault (priority rule)."""
        result = next_state(
            S.POWER_PRODUCTION, _inputs(fault=True, rpm=RATED_RPM * 1.15)
        )
        assert result == S.EMERGENCY_SHUTDOWN


# ── POWER_PRODUCTION_FAULT transitions ───────────────────────────


class TestPowerProductionFaultTransitions:
    """From POWER_PRODUCTION_FAULT."""

    def test_stays_in_fault_state_until_cleared(self) -> None:
        result = next_state(S.POWER_PRODUCTION_FAULT, _inputs(fault=True))
        assert result == S.POWER_PRODUCTION_FAULT

    def test_fault_cleared_returns_to_power_production(self) -> None:
        result = next_state(
            S.POWER_PRODUCTION_FAULT, _inputs(fault=False, fault_cleared=True)
        )
        assert result == S.POWER_PRODUCTION

    def test_critical_fault_goes_to_emergency_shutdown(self) -> None:
        result = next_state(S.POWER_PRODUCTION_FAULT, _inputs(critical=True))
        assert result == S.EMERGENCY_SHUTDOWN

    def test_wind_cutout_goes_to_normal_shutdown(self) -> None:
        result = next_state(S.POWER_PRODUCTION_FAULT, _inputs(wind=32.0, fault=True))
        assert result == S.NORMAL_SHUTDOWN


# ── STARTUP transitions ───────────────────────────────────────────


class TestStartupTransitions:
    """From STARTUP."""

    def test_stays_in_startup_below_80pct_rated(self) -> None:
        result = next_state(S.STARTUP, _inputs(wind=8.0, rpm=RATED_RPM * 0.5))
        assert result == S.STARTUP

    def test_reaches_power_production_at_80pct_rated(self) -> None:
        result = next_state(S.STARTUP, _inputs(wind=8.0, rpm=RATED_RPM * 0.8))
        assert result == S.POWER_PRODUCTION

    def test_wind_drop_goes_to_normal_shutdown(self) -> None:
        result = next_state(S.STARTUP, _inputs(wind=1.0, rpm=2.0))
        assert result == S.NORMAL_SHUTDOWN

    def test_critical_fault_goes_to_emergency_shutdown(self) -> None:
        result = next_state(S.STARTUP, _inputs(wind=8.0, critical=True, rpm=2.0))
        assert result == S.EMERGENCY_SHUTDOWN

    def test_overspeed_during_startup_goes_to_emergency(self) -> None:
        result = next_state(S.STARTUP, _inputs(wind=8.0, rpm=RATED_RPM * 1.15))
        assert result == S.EMERGENCY_SHUTDOWN


# ── NORMAL_SHUTDOWN transitions ───────────────────────────────────


class TestNormalShutdownTransitions:
    """From NORMAL_SHUTDOWN."""

    def test_stays_in_shutdown_while_spinning(self) -> None:
        result = next_state(S.NORMAL_SHUTDOWN, _inputs(rpm=5.0))
        assert result == S.NORMAL_SHUTDOWN

    def test_goes_to_parked_standby_when_stopped(self) -> None:
        result = next_state(S.NORMAL_SHUTDOWN, _inputs(rpm=0.2))
        assert result == S.PARKED_STANDBY

    def test_goes_to_parked_fault_if_fault_active_when_stopped(self) -> None:
        result = next_state(S.NORMAL_SHUTDOWN, _inputs(rpm=0.2, fault=True))
        assert result == S.PARKED_FAULT

    def test_critical_fault_escalates_to_emergency_shutdown(self) -> None:
        result = next_state(S.NORMAL_SHUTDOWN, _inputs(rpm=5.0, critical=True))
        assert result == S.EMERGENCY_SHUTDOWN


# ── EMERGENCY_SHUTDOWN transitions ────────────────────────────────


class TestEmergencyShutdownTransitions:
    """From EMERGENCY_SHUTDOWN."""

    def test_stays_in_emergency_while_spinning(self) -> None:
        result = next_state(S.EMERGENCY_SHUTDOWN, _inputs(rpm=3.0))
        assert result == S.EMERGENCY_SHUTDOWN

    def test_goes_to_parked_fault_when_stopped(self) -> None:
        result = next_state(S.EMERGENCY_SHUTDOWN, _inputs(rpm=0.3))
        assert result == S.PARKED_FAULT

    def test_always_goes_to_parked_fault_after_emergency(self) -> None:
        """Emergency shutdown always transitions to PARKED_FAULT, never PARKED_STANDBY."""
        result = next_state(S.EMERGENCY_SHUTDOWN, _inputs(rpm=0.0, fault_cleared=True))
        assert result == S.PARKED_FAULT


# ── PARKED_STANDBY transitions ────────────────────────────────────


class TestParkedStandbyTransitions:
    """From PARKED_STANDBY."""

    def test_starts_up_when_wind_in_range(self) -> None:
        result = next_state(S.PARKED_STANDBY, _inputs(wind=8.0, rpm=0.5))
        assert result == S.STARTUP

    def test_stays_parked_below_cut_in(self) -> None:
        result = next_state(S.PARKED_STANDBY, _inputs(wind=2.0))
        assert result == S.PARKED_STANDBY

    def test_critical_fault_goes_to_parked_fault(self) -> None:
        result = next_state(S.PARKED_STANDBY, _inputs(wind=2.0, critical=True))
        assert result == S.PARKED_FAULT

    def test_maintenance_command_goes_to_maintenance(self) -> None:
        result = next_state(S.PARKED_STANDBY, _inputs(wind=2.0, op_maintenance=True))
        assert result == S.MAINTENANCE

    def test_fault_active_prevents_startup(self) -> None:
        """Minor fault should keep turbine parked even with good wind."""
        result = next_state(S.PARKED_STANDBY, _inputs(wind=10.0, fault=True))
        assert result == S.PARKED_STANDBY


# ── PARKED_FAULT transitions ──────────────────────────────────────


class TestParkedFaultTransitions:
    """From PARKED_FAULT."""

    def test_stays_parked_fault_until_cleared(self) -> None:
        result = next_state(S.PARKED_FAULT, _inputs(critical=True))
        assert result == S.PARKED_FAULT

    def test_goes_to_parked_standby_when_fault_cleared(self) -> None:
        result = next_state(S.PARKED_FAULT, _inputs(fault_cleared=True))
        assert result == S.PARKED_STANDBY

    def test_stays_if_critical_fault_still_active(self) -> None:
        result = next_state(S.PARKED_FAULT, _inputs(critical=True, fault_cleared=True))
        assert result == S.PARKED_FAULT


# ── MAINTENANCE transitions ───────────────────────────────────────


class TestMaintenanceTransitions:
    """From MAINTENANCE."""

    def test_stays_in_maintenance_until_complete(self) -> None:
        result = next_state(S.MAINTENANCE, _inputs())
        assert result == S.MAINTENANCE

    def test_goes_to_parked_standby_when_complete(self) -> None:
        result = next_state(S.MAINTENANCE, _inputs(maintenance_done=True))
        assert result == S.PARKED_STANDBY

    def test_good_wind_does_not_trigger_startup_from_maintenance(self) -> None:
        """LOTO lockout: good wind must not cause automatic startup."""
        result = next_state(S.MAINTENANCE, _inputs(wind=12.0))
        assert result == S.MAINTENANCE


# ── classify_wind_state ───────────────────────────────────────────


class TestClassifyWindState:
    """Verify the wind-speed-only classifier used by simulator.py."""

    def test_below_cut_in(self) -> None:
        assert classify_wind_state(2.0) == S.PARKED_STANDBY

    def test_at_cut_in(self) -> None:
        assert classify_wind_state(3.0) == S.POWER_PRODUCTION

    def test_in_operating_range(self) -> None:
        assert classify_wind_state(15.0) == S.POWER_PRODUCTION

    def test_at_cut_out(self) -> None:
        assert classify_wind_state(31.0) == S.POWER_PRODUCTION

    def test_above_cut_out(self) -> None:
        assert classify_wind_state(32.0) == S.NORMAL_SHUTDOWN

    def test_custom_thresholds(self) -> None:
        assert classify_wind_state(4.0, cut_in_ms=5.0) == S.PARKED_STANDBY
        assert classify_wind_state(4.0, cut_in_ms=3.0) == S.POWER_PRODUCTION


# ── Full sequence integration test ────────────────────────────────


class TestFullSequence:
    """Walk through a realistic turbine startup → shutdown sequence."""

    def test_parked_to_startup_to_production_to_shutdown(self) -> None:
        state = S.PARKED_STANDBY

        # Wind picks up — start-up
        state = next_state(state, _inputs(wind=8.0, rpm=0.5))
        assert state == S.STARTUP

        # Rotor accelerates to 80 % rated
        state = next_state(state, _inputs(wind=8.0, rpm=RATED_RPM * 0.8))
        assert state == S.POWER_PRODUCTION

        # Producing power
        state = next_state(state, _inputs(wind=10.0, rpm=8.0))
        assert state == S.POWER_PRODUCTION

        # Wind drops below cut-in
        state = next_state(state, _inputs(wind=2.0, rpm=6.0))
        assert state == S.NORMAL_SHUTDOWN

        # Rotor coasts to rest
        state = next_state(state, _inputs(wind=2.0, rpm=0.2))
        assert state == S.PARKED_STANDBY

    def test_production_fault_to_emergency_shutdown(self) -> None:
        state = S.POWER_PRODUCTION

        # Minor fault detected
        state = next_state(state, _inputs(wind=10.0, fault=True))
        assert state == S.POWER_PRODUCTION_FAULT

        # Critical fault escalates
        state = next_state(state, _inputs(wind=10.0, critical=True))
        assert state == S.EMERGENCY_SHUTDOWN

        # Rotor braked to rest
        state = next_state(state, _inputs(wind=10.0, rpm=0.3))
        assert state == S.PARKED_FAULT
