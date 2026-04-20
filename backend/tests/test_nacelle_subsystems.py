"""Tests for nacelle subsystem physics models — A3/A4.

Validates HPU accumulator model, oil cooling thermal equilibrium,
ISO 10816-21 vibration zones, cable twist limits, UPS backup time,
and the FastAPI nacelle endpoints.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.services.turbine_physics.nacelle_subsystems import (
    CABLE_TWIST_HARD_LIMIT_DEG,
    CABLE_TWIST_SOFT_LIMIT_DEG,
    GEARBOX_OIL_TRIP_TEMP_C,
    HPU_NOMINAL_PRESSURE_BAR,
    HPU_PRECHARGE_PRESSURE_BAR,
    OVERSPEED_HARDWARE_RPM,
    OVERSPEED_WARNING_RPM,
    RATED_ROTOR_SPEED_RPM,
    UPS_BATTERY_CAPACITY_KWH,
    UPS_DISCHARGE_EFFICIENCY,
    UPS_LOAD_POWER_KW,
    VIBRATION_ZONE_A_MAX_MM_S,
    compute_cable_twist_state,
    compute_cooling_state,
    compute_hpu_state,
    compute_nacelle_subsystems,
    compute_oil_viscosity_cst,
    compute_safety_state,
    compute_ups_state,
)

# ── HPU tests ─────────────────────────────────────────────────────────────────


class TestHPUState:
    """Hydraulic Power Unit physics."""

    def test_nominal_pressure_when_operating(self) -> None:
        state = compute_hpu_state(power_mw=10.0, is_operating=True)
        assert state.line_pressure_bar == HPU_NOMINAL_PRESSURE_BAR

    def test_pump_running_when_operating(self) -> None:
        state = compute_hpu_state(power_mw=10.0, is_operating=True)
        assert state.pump_running is True

    def test_brake_released_when_operating(self) -> None:
        state = compute_hpu_state(power_mw=10.0, is_operating=True)
        assert state.brake_caliper_pressure_bar == 0.0

    def test_brake_clamped_when_parked(self) -> None:
        state = compute_hpu_state(power_mw=0.0, is_operating=False, pitch_deg=90.0)
        assert state.brake_caliper_pressure_bar == 250.0

    def test_pitch_cylinder_fully_extended_at_fine_pitch(self) -> None:
        """0° pitch → 100% extension (max power, fine pitch)."""
        state = compute_hpu_state(power_mw=10.0, is_operating=True, pitch_deg=0.0)
        assert state.pitch_cylinder_extension_pct == pytest.approx(100.0, abs=1.0)

    def test_pitch_cylinder_fully_retracted_at_feather(self) -> None:
        """90° pitch → 0% extension (feathered/parked)."""
        state = compute_hpu_state(power_mw=0.0, is_operating=False, pitch_deg=90.0)
        assert state.pitch_cylinder_extension_pct == pytest.approx(0.0, abs=1.0)

    def test_iso_cleanliness_high_load(self) -> None:
        """High load (>95% rated) → higher particulate generation."""
        state = compute_hpu_state(power_mw=14.5, is_operating=True)
        assert state.iso_cleanliness_code == "17/15/12"

    def test_iso_cleanliness_mid_load(self) -> None:
        state = compute_hpu_state(power_mw=8.0, is_operating=True)
        assert state.iso_cleanliness_code == "16/14/11"

    def test_iso_cleanliness_low_load(self) -> None:
        state = compute_hpu_state(power_mw=2.0, is_operating=True)
        assert state.iso_cleanliness_code == "15/13/10"

    def test_no_alarm_at_nominal_pressure(self) -> None:
        state = compute_hpu_state(power_mw=10.0, is_operating=True)
        assert state.alarm is False

    def test_accumulator_charge_bounded_0_to_100(self) -> None:
        for pitch in [0.0, 45.0, 90.0]:
            state = compute_hpu_state(power_mw=5.0, is_operating=True, pitch_deg=pitch)
            assert 0.0 <= state.accumulator_charge_pct <= 100.0

    def test_accumulator_pressure_above_precharge(self) -> None:
        """Accumulator must always be at or above pre-charge pressure."""
        state = compute_hpu_state(power_mw=10.0, is_operating=True)
        assert state.accumulator_pressure_bar >= HPU_PRECHARGE_PRESSURE_BAR


# ── Oil viscosity tests ───────────────────────────────────────────────────────


class TestOilViscosity:
    """Walther equation for ISO VG 320 synthetic gear oil."""

    def test_viscosity_at_40c_near_320_cst(self) -> None:
        """ISO VG 320 nominal: 320 cSt at 40°C."""
        nu = compute_oil_viscosity_cst(40.0)
        assert nu == pytest.approx(320.0, rel=0.15)  # ±15 % — Walther fit

    def test_viscosity_at_100c_near_38_cst(self) -> None:
        """ISO VG 320 nominal: ~38 cSt at 100°C (VI = 140)."""
        nu = compute_oil_viscosity_cst(100.0)
        assert nu == pytest.approx(38.0, rel=0.20)

    def test_viscosity_decreases_with_temperature(self) -> None:
        """Viscosity must strictly decrease with temperature."""
        assert compute_oil_viscosity_cst(40.0) > compute_oil_viscosity_cst(65.0)
        assert compute_oil_viscosity_cst(65.0) > compute_oil_viscosity_cst(100.0)

    def test_viscosity_minimum_clamp(self) -> None:
        """Viscosity should not go below 5 cSt (physical lower bound)."""
        assert compute_oil_viscosity_cst(200.0) >= 5.0


# ── Cooling state tests ───────────────────────────────────────────────────────


class TestCoolingState:
    """Thermal equilibrium cooling model."""

    def test_zero_power_oil_temp_near_ambient(self) -> None:
        """No heat input → oil temperature ≈ ambient."""
        state = compute_cooling_state(power_mw=0.0, ambient_temp_c=15.0)
        assert state.oil_temp_c == pytest.approx(15.0, abs=2.0)

    def test_rated_power_oil_temp_reasonable(self) -> None:
        """At 15 MW, 15°C ambient → oil should be below trip threshold."""
        state = compute_cooling_state(power_mw=15.0, ambient_temp_c=15.0)
        assert state.oil_temp_c < GEARBOX_OIL_TRIP_TEMP_C

    def test_high_ambient_raises_oil_temp(self) -> None:
        """Hot summer day (35°C) should raise oil temp vs winter (0°C)."""
        hot = compute_cooling_state(power_mw=15.0, ambient_temp_c=35.0)
        cold = compute_cooling_state(power_mw=15.0, ambient_temp_c=0.0)
        assert hot.oil_temp_c > cold.oil_temp_c

    def test_alarm_not_set_at_normal_operation(self) -> None:
        state = compute_cooling_state(power_mw=10.0, ambient_temp_c=15.0)
        assert not state.oil_temp_alarm
        assert not state.oil_temp_trip

    def test_heat_rejection_scales_with_power(self) -> None:
        low = compute_cooling_state(power_mw=5.0)
        high = compute_cooling_state(power_mw=15.0)
        assert high.cooler_heat_rejection_kw > low.cooler_heat_rejection_kw

    def test_fan_speed_increases_at_higher_load(self) -> None:
        low = compute_cooling_state(power_mw=2.0)
        high = compute_cooling_state(power_mw=15.0)
        assert high.fan_speed_pct >= low.fan_speed_pct

    def test_viscosity_populated(self) -> None:
        state = compute_cooling_state(power_mw=10.0)
        assert state.viscosity_cst > 0.0

    def test_heat_rejection_at_rated_near_450_kw(self) -> None:
        """At 15 MW: Q_loss = 15 MW × (1 − 0.97) / total_eta ≈ ~460 kW."""
        state = compute_cooling_state(power_mw=15.0, ambient_temp_c=15.0)
        assert state.cooler_heat_rejection_kw == pytest.approx(460.0, rel=0.05)


# ── Safety state tests ────────────────────────────────────────────────────────


class TestSafetyState:
    """IEC 61400-1 overspeed + ISO 10816-21 vibration zones."""

    def test_no_overspeed_at_rated_rpm(self) -> None:
        state = compute_safety_state(rotor_speed_rpm=RATED_ROTOR_SPEED_RPM)
        assert not state.overspeed_warning
        assert not state.overspeed_hardware

    def test_overspeed_warning_at_110pct(self) -> None:
        state = compute_safety_state(rotor_speed_rpm=RATED_ROTOR_SPEED_RPM * 1.11)
        assert state.overspeed_warning
        assert not state.overspeed_hardware

    def test_overspeed_hardware_at_120pct(self) -> None:
        state = compute_safety_state(rotor_speed_rpm=RATED_ROTOR_SPEED_RPM * 1.21)
        assert state.overspeed_warning
        assert state.overspeed_hardware

    def test_overspeed_warning_threshold_exact(self) -> None:
        """Warning triggers at > 110% rated (> 9.163 rpm)."""
        assert pytest.approx(RATED_ROTOR_SPEED_RPM * 1.10, abs=0.01) == OVERSPEED_WARNING_RPM

    def test_overspeed_hardware_threshold_exact(self) -> None:
        """Hardware governor triggers at > 120% rated (> 9.996 rpm)."""
        assert pytest.approx(RATED_ROTOR_SPEED_RPM * 1.20, abs=0.01) == OVERSPEED_HARDWARE_RPM

    def test_vibration_zone_a(self) -> None:
        """Vibration ≤ 2.3 mm/s → Zone A (new equipment acceptance)."""
        state = compute_safety_state(
            rotor_speed_rpm=8.0, power_mw=0.0, vibration_mm_s=VIBRATION_ZONE_A_MAX_MM_S - 0.1
        )
        assert state.vibration_zone == "A"
        assert not state.vibration_alarm
        assert not state.vibration_trip

    def test_vibration_zone_b(self) -> None:
        """Vibration 2.3–4.5 mm/s → Zone B (unrestricted operation)."""
        state = compute_safety_state(rotor_speed_rpm=8.0, power_mw=0.0, vibration_mm_s=3.5)
        assert state.vibration_zone == "B"
        assert not state.vibration_alarm

    def test_vibration_zone_c_triggers_alarm(self) -> None:
        """Vibration 4.5–7.1 mm/s → Zone C (alarm, plan maintenance)."""
        state = compute_safety_state(rotor_speed_rpm=8.0, power_mw=0.0, vibration_mm_s=6.0)
        assert state.vibration_zone == "C"
        assert state.vibration_alarm
        assert not state.vibration_trip

    def test_vibration_zone_d_triggers_trip(self) -> None:
        """Vibration > 7.1 mm/s → Zone D (emergency stop)."""
        state = compute_safety_state(rotor_speed_rpm=8.0, power_mw=0.0, vibration_mm_s=8.0)
        assert state.vibration_zone == "D"
        assert state.vibration_alarm
        assert state.vibration_trip

    def test_ice_detection_propagated(self) -> None:
        state = compute_safety_state(rotor_speed_rpm=5.0, ice_detection=True)
        assert state.ice_detection_active

    def test_fire_alarm_propagated(self) -> None:
        state = compute_safety_state(rotor_speed_rpm=5.0, fire_alarm=True)
        assert state.fire_alarm

    def test_lightning_count_propagated(self) -> None:
        state = compute_safety_state(rotor_speed_rpm=5.0, lightning_count=7)
        assert state.lightning_strike_count == 7

    def test_vibration_zone_a_at_rated_power(self) -> None:
        """Rated operation with normal vibration stays in Zone A."""
        state = compute_safety_state(rotor_speed_rpm=8.33, power_mw=15.0, vibration_mm_s=1.5)
        assert state.vibration_zone == "A"


# ── Cable twist tests ─────────────────────────────────────────────────────────


class TestCableTwistState:
    """Cable twist counter with ±1.75 and ±3.5 turn limits."""

    def test_no_alarm_below_soft_limit(self) -> None:
        state = compute_cable_twist_state(accumulated_yaw_deg=360.0)
        assert not state.soft_limit_reached
        assert not state.hard_limit_reached

    def test_soft_limit_at_630_degrees(self) -> None:
        """630° = 1.75 turns → soft limit warning."""
        state = compute_cable_twist_state(accumulated_yaw_deg=CABLE_TWIST_SOFT_LIMIT_DEG)
        assert state.soft_limit_reached
        assert not state.hard_limit_reached

    def test_hard_limit_at_1260_degrees(self) -> None:
        """1260° = 3.5 turns → forced untwist."""
        state = compute_cable_twist_state(accumulated_yaw_deg=CABLE_TWIST_HARD_LIMIT_DEG)
        assert state.hard_limit_reached

    def test_soft_limit_negative_direction(self) -> None:
        """Soft limit applies in both CW and CCW directions."""
        state = compute_cable_twist_state(accumulated_yaw_deg=-CABLE_TWIST_SOFT_LIMIT_DEG)
        assert state.soft_limit_reached

    def test_twist_turns_calculation(self) -> None:
        """720° = 2.0 full turns."""
        state = compute_cable_twist_state(accumulated_yaw_deg=720.0)
        assert state.twist_turns == pytest.approx(2.0, abs=0.01)

    def test_untwist_flag_propagated(self) -> None:
        state = compute_cable_twist_state(90.0, untwist_in_progress=True)
        assert state.untwist_in_progress

    def test_zero_yaw_clean_state(self) -> None:
        state = compute_cable_twist_state(0.0)
        assert state.soft_limit_reached is False
        assert state.hard_limit_reached is False
        assert state.twist_turns == pytest.approx(0.0)


# ── UPS tests ─────────────────────────────────────────────────────────────────


class TestUPSState:
    """UPS backup time and battery state logic."""

    def test_charging_when_grid_available_and_not_full(self) -> None:
        state = compute_ups_state(grid_available=True, soc_pct=90.0)
        assert state.charging
        assert not state.on_battery

    def test_not_charging_when_battery_full(self) -> None:
        """At 99.5% SOC the float charge stops."""
        state = compute_ups_state(grid_available=True, soc_pct=99.5)
        assert not state.charging

    def test_on_battery_when_grid_lost(self) -> None:
        state = compute_ups_state(grid_available=False, soc_pct=98.0)
        assert state.on_battery
        assert not state.charging

    def test_backup_time_calculation(self) -> None:
        """t_backup = 6.6 kWh × 0.85 / 15 kW × 60 min ≈ 22.4 min at 100% SOC."""
        state = compute_ups_state(grid_available=True, soc_pct=100.0)
        expected_min = (
            UPS_BATTERY_CAPACITY_KWH * UPS_DISCHARGE_EFFICIENCY / UPS_LOAD_POWER_KW * 60.0
        )
        assert state.backup_time_min == pytest.approx(expected_min, abs=0.5)

    def test_backup_time_scales_with_soc(self) -> None:
        full = compute_ups_state(soc_pct=100.0)
        half = compute_ups_state(soc_pct=50.0)
        assert full.backup_time_min == pytest.approx(2.0 * half.backup_time_min, rel=0.01)

    def test_alarm_on_low_battery(self) -> None:
        state = compute_ups_state(grid_available=False, soc_pct=10.0)
        assert state.alarm

    def test_no_alarm_normal_operation(self) -> None:
        state = compute_ups_state(grid_available=True, soc_pct=98.0)
        assert not state.alarm

    def test_battery_voltage_nominal_on_grid(self) -> None:
        """Float charge voltage: ~54 V (above 48 V nominal)."""
        state = compute_ups_state(grid_available=True, soc_pct=98.0)
        assert state.battery_voltage_v == pytest.approx(54.0, abs=1.0)

    def test_load_kw_constant(self) -> None:
        state = compute_ups_state()
        assert state.load_kw == UPS_LOAD_POWER_KW


# ── Aggregate tests ───────────────────────────────────────────────────────────


class TestComputeNacelleSubsystems:
    """Full aggregate function tests."""

    def test_returns_all_subsystems(self) -> None:
        state = compute_nacelle_subsystems()
        assert state.hpu is not None
        assert state.cooling is not None
        assert state.safety is not None
        assert state.cable_twist is not None
        assert state.ups is not None

    def test_normal_operating_conditions_no_alarms(self) -> None:
        """Full-load nominal conditions should produce no alarms."""
        state = compute_nacelle_subsystems(
            power_mw=10.0,
            ambient_temp_c=15.0,
            rotor_speed_rpm=7.5,
            pitch_deg=5.0,
            accumulated_yaw_deg=90.0,
            is_operating=True,
            grid_available=True,
            battery_soc_pct=98.0,
            vibration_mm_s=1.5,
        )
        assert not state.hpu.alarm
        assert not state.cooling.oil_temp_alarm
        assert not state.safety.overspeed_warning
        assert not state.safety.vibration_alarm
        assert not state.ups.alarm

    def test_overspeed_propagates_to_safety(self) -> None:
        state = compute_nacelle_subsystems(rotor_speed_rpm=RATED_ROTOR_SPEED_RPM * 1.15)
        assert state.safety.overspeed_warning

    def test_fire_alarm_propagates(self) -> None:
        state = compute_nacelle_subsystems(fire_alarm=True)
        assert state.safety.fire_alarm

    def test_grid_loss_puts_ups_on_battery(self) -> None:
        state = compute_nacelle_subsystems(grid_available=False)
        assert state.ups.on_battery


# ── FastAPI endpoint tests ────────────────────────────────────────────────────


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    return TestClient(app)


class TestNacelleAPI:
    """Smoke tests for nacelle subsystem REST endpoints."""

    def test_subsystems_endpoint_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/v1/turbine-sim/nacelle/subsystems")
        assert response.status_code == 200

    def test_subsystems_response_has_all_keys(self, client: TestClient) -> None:
        data = client.get("/api/v1/turbine-sim/nacelle/subsystems").json()
        assert "hpu" in data
        assert "cooling" in data
        assert "safety" in data
        assert "cable_twist" in data
        assert "ups" in data
        assert "any_alarm" in data

    def test_hpu_endpoint_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/v1/turbine-sim/nacelle/hpu")
        assert response.status_code == 200

    def test_hpu_response_has_pressure(self, client: TestClient) -> None:
        data = client.get("/api/v1/turbine-sim/nacelle/hpu").json()
        assert "line_pressure_bar" in data
        assert data["line_pressure_bar"] == HPU_NOMINAL_PRESSURE_BAR

    def test_cooling_endpoint_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/v1/turbine-sim/nacelle/cooling")
        assert response.status_code == 200

    def test_cooling_response_has_oil_temp(self, client: TestClient) -> None:
        data = client.get("/api/v1/turbine-sim/nacelle/cooling").json()
        assert "oil_temp_c" in data
        assert data["oil_temp_c"] > 0.0

    def test_safety_endpoint_returns_200(self, client: TestClient) -> None:
        response = client.get("/api/v1/turbine-sim/nacelle/safety")
        assert response.status_code == 200

    def test_safety_response_has_vibration_zone(self, client: TestClient) -> None:
        data = client.get("/api/v1/turbine-sim/nacelle/safety").json()
        assert "vibration_zone" in data
        assert data["vibration_zone"] in {"A", "B", "C", "D"}

    def test_safety_overspeed_via_query_param(self, client: TestClient) -> None:
        """Pass overspeed RPM via query parameter and verify warning flag."""
        speed = RATED_ROTOR_SPEED_RPM * 1.15
        data = client.get(f"/api/v1/turbine-sim/nacelle/safety?rotor_speed_rpm={speed}").json()
        assert data["overspeed_warning"] is True

    def test_cooling_high_ambient_via_query_param(self, client: TestClient) -> None:
        """Summer ambient (35°C) should raise oil temp vs default (15°C)."""
        hot = client.get(
            "/api/v1/turbine-sim/nacelle/cooling?ambient_temp_c=35.0&power_mw=15.0"
        ).json()
        cold = client.get(
            "/api/v1/turbine-sim/nacelle/cooling?ambient_temp_c=0.0&power_mw=15.0"
        ).json()
        assert hot["oil_temp_c"] > cold["oil_temp_c"]

    def test_hpu_feathered_pitch_via_query_param(self, client: TestClient) -> None:
        data = client.get(
            "/api/v1/turbine-sim/nacelle/hpu?pitch_deg=90.0&is_operating=false"
        ).json()
        assert data["pitch_cylinder_extension_pct"] == pytest.approx(0.0, abs=1.0)
        assert data["brake_caliper_pressure_bar"] == 250.0

    def test_subsystems_any_alarm_false_nominal(self, client: TestClient) -> None:
        data = client.get(
            "/api/v1/turbine-sim/nacelle/subsystems"
            "?power_mw=10.0&rotor_speed_rpm=7.5&vibration_mm_s=1.5"
        ).json()
        assert data["any_alarm"] is False

    def test_subsystems_any_alarm_true_on_fire(self, client: TestClient) -> None:
        data = client.get("/api/v1/turbine-sim/nacelle/subsystems?fire_alarm=true").json()
        assert data["any_alarm"] is True
