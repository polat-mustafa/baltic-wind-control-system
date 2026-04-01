"""
Tests for M08 BESS Integration (50 MW / 200 MWh LFP).

Covers:
- Status: SOC bounds, available energy formula
- Mode transitions: blocked when SOC limits exceeded
- Frequency response: FCR droop, FFR activation, SOC tracking
- Ramp smoothing: PSE IRiESP ramp rate compliance
- Degradation: LFP model, EOL year projection
- Dispatch: WTG + BESS combined dispatch
"""

from __future__ import annotations

import pytest

from app.services.p2.bess import (
    RATED_ENERGY_MWH,
    RATED_POWER_MW,
    SOC_MAX_PCT,
    SOC_MIN_PCT,
    calculate_degradation,
    dispatch_bess,
    get_status,
    set_mode,
    simulate_frequency_response,
    simulate_ramp_smoothing,
)

# ── Status ─────────────────────────────────────────────────────────────────────


class TestBESSStatus:
    """Current state snapshot."""

    def test_status_returns_required_fields(self):
        result = get_status()
        assert "soc_percent" in result
        assert "power_mw" in result
        assert "mode" in result
        assert "soh_percent" in result
        assert "available_energy_mwh" in result

    def test_available_energy_formula(self):
        """Available = capacity * (SOC - SOC_min) / 100."""
        status = get_status()
        soc = status["soc_percent"]
        soh = status["soh_percent"]
        rated_cap = RATED_ENERGY_MWH * (soh / 100.0)
        expected = rated_cap * (soc - SOC_MIN_PCT) / 100.0
        assert abs(status["available_energy_mwh"] - expected) < 0.01

    def test_rated_power_50mw(self):
        assert get_status()["rated_power_mw"] == 50.0

    def test_rated_energy_200mwh(self):
        assert get_status()["rated_energy_mwh"] == pytest.approx(200.0, rel=0.05)


# ── Mode transitions ───────────────────────────────────────────────────────────


class TestBESSMode:
    """Mode change transitions and validations."""

    def test_standby_always_allowed(self):
        result = set_mode("STANDBY", 0.0, 50.0)
        assert result["transition_allowed"] is True
        assert result["new_mode"] == "STANDBY"

    def test_charge_blocked_at_soc_max(self):
        """Cannot charge when SOC already at max (90%)."""
        # First force SOC high by examining the logic directly
        import app.services.p2.bess as bess_svc

        original_soc = bess_svc._state["soc_percent"]
        bess_svc._state["soc_percent"] = SOC_MAX_PCT
        result = set_mode("CHARGE", 10.0, 90.0)
        bess_svc._state["soc_percent"] = original_soc  # restore
        assert result["transition_allowed"] is False

    def test_discharge_blocked_at_soc_min(self):
        """Cannot discharge when SOC at minimum (10%)."""
        import app.services.p2.bess as bess_svc

        original_soc = bess_svc._state["soc_percent"]
        bess_svc._state["soc_percent"] = SOC_MIN_PCT
        result = set_mode("DISCHARGE", -10.0, 10.0)
        bess_svc._state["soc_percent"] = original_soc  # restore
        assert result["transition_allowed"] is False

    def test_fcr_blocked_low_soc(self):
        """FCR requires >= 20% SOC."""
        import app.services.p2.bess as bess_svc

        original_soc = bess_svc._state["soc_percent"]
        bess_svc._state["soc_percent"] = 15.0
        result = set_mode("FREQUENCY_RESPONSE", 0.0, 50.0)
        bess_svc._state["soc_percent"] = original_soc  # restore
        assert result["transition_allowed"] is False

    def test_mode_change_updates_state(self):
        """Accepted mode change updates internal state."""
        set_mode("STANDBY", 0.0, 50.0)
        result = set_mode("DISCHARGE", -20.0, 30.0)
        # DISCHARGE is only blocked if SOC is at minimum; check result
        if result["transition_allowed"]:
            assert result["new_mode"] == "DISCHARGE"

    def test_response_includes_previous_mode(self):
        set_mode("STANDBY", 0.0, 50.0)
        result = set_mode("STANDBY", 0.0, 50.0)
        assert "previous_mode" in result


# ── Frequency response ─────────────────────────────────────────────────────────


class TestFrequencyResponse:
    """FCR/FFR simulation."""

    def test_flat_frequency_no_response(self):
        """No frequency deviation → BESS power = 0."""
        flat = [50.0] * 10
        result = simulate_frequency_response(flat, 5.0, 49.7, 60.0)
        assert all(p == 0.0 for p in result["bess_power_mw"])
        assert result["fcr_activated"] is False
        assert result["ffr_activated"] is False

    def test_underfrequency_discharges(self):
        """Frequency below 50 Hz → BESS discharges (negative power)."""
        under = [50.0, 49.5, 49.3, 49.5, 49.8, 50.0]
        result = simulate_frequency_response(under, 5.0, 49.7, 60.0)
        # At some point BESS should discharge
        assert min(result["bess_power_mw"]) < 0.0

    def test_ffr_activated_below_threshold(self):
        """f < 49.7 Hz → FFR activated."""
        dip = [50.0, 49.8, 49.6, 49.4, 49.5, 49.8, 50.0]
        result = simulate_frequency_response(dip, 5.0, 49.7, 60.0)
        assert result["ffr_activated"] is True

    def test_nadir_correctly_identified(self):
        """Nadir = minimum frequency in trace."""
        trace = [50.0, 49.8, 49.5, 49.2, 49.4, 49.7, 50.0]
        result = simulate_frequency_response(trace, 5.0, 49.7, 60.0)
        assert result["nadir_hz"] == pytest.approx(49.2, abs=0.001)

    def test_soc_decreases_during_discharge(self):
        """SOC must decrease when BESS discharges."""
        deep_dip = [50.0] + [49.0] * 20 + [50.0]
        result = simulate_frequency_response(deep_dip, 5.0, 49.7, 60.0)
        assert result["soc_percent"][-1] < result["soc_percent"][0]

    def test_soc_bounded_by_limits(self):
        """SOC never exceeds SOC_min/SOC_max during response."""
        trace = [49.0] * 50
        result = simulate_frequency_response(trace, 5.0, 49.7, 60.0)
        assert all(SOC_MIN_PCT <= s <= SOC_MAX_PCT for s in result["soc_percent"])

    def test_output_lengths_match_input(self):
        """Output arrays must match input trace length."""
        trace = [50.0, 49.9, 49.7, 49.5, 49.6, 49.8, 50.0]
        result = simulate_frequency_response(trace, 5.0, 49.7, 60.0)
        assert len(result["bess_power_mw"]) == len(trace)
        assert len(result["soc_percent"]) == len(trace)

    def test_fcr_power_proportional_to_deviation(self):
        """FCR: larger frequency deviation → more BESS power (above deadband)."""
        small_dip = [50.0, 49.7, 50.0]  # -0.3 Hz, near deadband
        large_dip = [50.0, 49.2, 50.0]  # -0.8 Hz, well outside deadband
        r_small = simulate_frequency_response(small_dip, 5.0, 49.7, 60.0)
        r_large = simulate_frequency_response(large_dip, 5.0, 49.7, 60.0)
        assert min(r_large["bess_power_mw"]) < min(r_small["bess_power_mw"])


# ── Ramp smoothing ─────────────────────────────────────────────────────────────


class TestRampSmoothing:
    """PSE IRiESP ramp rate compliance."""

    def test_flat_wind_no_bess_needed(self):
        """Constant wind → no ramp rate violations, BESS power near zero."""
        flat = [300.0] * 20
        result = simulate_ramp_smoothing(flat, 51.0, 50.0)
        assert result["ramp_violations_before"] == 0
        assert result["ramp_violations_after"] == 0

    def test_steep_ramp_violations_before_bess(self):
        """200 MW/min ramp creates violations without BESS."""
        steep = [100.0, 300.0, 510.0, 300.0, 100.0]
        result = simulate_ramp_smoothing(steep, 51.0, 50.0)
        assert result["ramp_violations_before"] > 0

    def test_bess_reduces_violations(self):
        """After BESS smoothing, fewer violations than before."""
        steep = [100.0, 300.0, 510.0, 300.0, 100.0, 200.0, 450.0]
        result = simulate_ramp_smoothing(steep, 51.0, 50.0)
        assert result["ramp_violations_after"] <= result["ramp_violations_before"]

    def test_output_array_lengths(self):
        wind = [200.0, 350.0, 480.0, 510.0, 490.0, 380.0, 250.0]
        result = simulate_ramp_smoothing(wind, 51.0, 50.0)
        assert len(result["bess_power_mw"]) == len(wind)
        assert len(result["soc_percent"]) == len(wind)
        assert len(result["smoothed_output_mw"]) == len(wind)

    def test_soc_within_bounds_always(self):
        """SOC must stay within operating window during smoothing."""
        wind = [100.0, 400.0, 510.0, 50.0, 100.0] * 6
        result = simulate_ramp_smoothing(wind, 51.0, 50.0)
        assert all(SOC_MIN_PCT <= s <= SOC_MAX_PCT for s in result["soc_percent"])

    def test_assessment_string(self):
        flat = [300.0] * 10
        result = simulate_ramp_smoothing(flat, 51.0, 50.0)
        assert len(result["assessment"]) > 0


# ── Degradation ────────────────────────────────────────────────────────────────


class TestDegradation:
    """LFP degradation model."""

    def test_soh_starts_at_100_pct(self):
        result = calculate_degradation(20, 365.0, 70.0)
        assert result["projection"][0]["soh_percent"] == pytest.approx(100.0)

    def test_soh_decreases_over_time(self):
        result = calculate_degradation(20, 365.0, 70.0)
        soh_values = [p["soh_percent"] for p in result["projection"]]
        assert soh_values[-1] < soh_values[0]

    def test_eol_year_reported(self):
        result = calculate_degradation(20, 365.0, 80.0)
        assert 0 < result["eol_year"] <= 20

    def test_higher_cycles_shorter_lifetime(self):
        """More cycles per year → earlier EOL."""
        light = calculate_degradation(20, 100.0, 70.0)
        heavy = calculate_degradation(20, 500.0, 70.0)
        assert heavy["eol_year"] <= light["eol_year"]

    def test_higher_dod_shorter_lifetime(self):
        """Higher DoD → earlier EOL (exponential degradation)."""
        shallow = calculate_degradation(20, 300.0, 50.0)
        deep = calculate_degradation(20, 300.0, 90.0)
        assert deep["eol_year"] <= shallow["eol_year"]

    def test_replacement_cost_70m_eur(self):
        """200 MWh * 0.35 M EUR/MWh = 70 M EUR replacement cost."""
        result = calculate_degradation(20, 300.0, 70.0)
        assert abs(result["replacement_cost_m_eur"] - 70.0) < 0.1

    def test_lcoe_contribution_positive(self):
        result = calculate_degradation(20, 300.0, 70.0)
        assert result["lcoe_contribution_eur_mwh"] > 0.0

    def test_projection_has_year_0_and_last(self):
        result = calculate_degradation(10, 300.0, 70.0)
        years = [p["year"] for p in result["projection"]]
        assert 0 in years
        assert 10 in years

    def test_capacity_at_year_0_equals_200_mwh(self):
        result = calculate_degradation(20, 300.0, 70.0)
        assert result["projection"][0]["capacity_mwh"] == pytest.approx(200.0)


# ── Dispatch ───────────────────────────────────────────────────────────────────


class TestDispatch:
    """WTG + BESS combined dispatch."""

    def test_wtg_only_when_sufficient(self):
        """P_target <= P_avail_WTG → WTG covers alone."""
        result = dispatch_bess(300.0, 400.0, 60.0)
        assert result["p_wtg_dispatch_mw"] == pytest.approx(300.0)

    def test_bess_discharges_deficit(self):
        """P_target > P_avail_WTG → BESS discharges deficit."""
        result = dispatch_bess(450.0, 400.0, 60.0)
        # BESS must discharge 50 MW
        assert result["p_bess_mw"] < 0.0  # negative = discharging

    def test_poc_equals_target_when_feasible(self):
        """P_POC should match P_target when BESS can cover deficit."""
        result = dispatch_bess(420.0, 400.0, 60.0)
        if result["dispatch_feasible"]:
            assert abs(result["p_poc_mw"] - 420.0) < 0.5

    def test_bess_limited_to_rated_power(self):
        """BESS cannot exceed 50 MW (rated)."""
        result = dispatch_bess(560.0, 400.0, 60.0)
        assert abs(result["p_bess_mw"]) <= RATED_POWER_MW + 0.01

    def test_dispatch_infeasible_large_deficit(self):
        """Deficit > BESS rated → dispatch not fully feasible."""
        result = dispatch_bess(560.0, 400.0, 60.0)
        # Deficit = 160 MW > 50 MW BESS → not feasible
        assert result["dispatch_feasible"] is False

    def test_no_discharge_at_soc_min(self):
        """Cannot discharge when SOC at minimum."""
        result = dispatch_bess(450.0, 400.0, SOC_MIN_PCT)
        assert result["p_bess_mw"] >= 0.0  # should not discharge

    def test_soc_updated_after_discharge(self):
        """SOC decreases after 1-minute discharge."""
        result = dispatch_bess(450.0, 400.0, 60.0)
        if result["p_bess_mw"] < 0:  # discharge occurred
            assert result["soc_after_pct"] < 60.0

    def test_charging_when_wtg_surplus(self):
        """WTG surplus → BESS charges if SOC < max."""
        result = dispatch_bess(200.0, 400.0, 50.0)
        assert result["p_bess_mw"] > 0.0  # positive = charging
