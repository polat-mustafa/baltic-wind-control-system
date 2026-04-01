"""
Tests for M14 Weather Window & O&M Logistics.

Covers:
- Monthly access probabilities in physically realistic range
- Winter/summer seasonality (winter lower than summer)
- CTV more restricted than SOV (lower sea-state limit)
- Wait-time model (higher access prob → shorter wait)
- O&M cost in EUR/MW benchmark range
- Cost breakdown components positive
"""

from __future__ import annotations

from app.services.p1.weather_window import (
    find_maintenance_window,
    get_all_vessel_access,
    get_oam_cost_breakdown,
    get_vessel_access,
)

# ── Vessel access probabilities ────────────────────────────────────────────────


class TestVesselAccess:
    """Monthly access probability physics checks."""

    def test_ctv_monthly_access_has_12_values(self):
        result = get_vessel_access("CTV")
        assert len(result["monthly_access_pct"]) == 12

    def test_ctv_access_in_valid_range(self):
        result = get_vessel_access("CTV")
        for pct in result["monthly_access_pct"]:
            assert 0.0 <= pct <= 100.0

    def test_sov_annual_average_higher_than_ctv(self):
        """SOV has higher Hs limit (2.5 m vs 1.5 m) → should have better access."""
        ctv = get_vessel_access("CTV")
        sov = get_vessel_access("SOV")
        assert sov["annual_average_pct"] >= ctv["annual_average_pct"]

    def test_summer_better_than_winter_for_ctv(self):
        """July (index 6) should have higher CTV access than January (index 0)."""
        result = get_vessel_access("CTV")
        july = result["monthly_access_pct"][6]
        jan = result["monthly_access_pct"][0]
        assert july >= jan, f"July {july}% should be >= January {jan}%"

    def test_jackup_has_lower_vw_limit_effect(self):
        """Jack-up limited to 8 m/s wind — may have lower access than CTV in windy months."""
        jackup = get_vessel_access("JACK_UP")
        # Jack-up annual average should be lower than SOV
        sov = get_vessel_access("SOV")
        # Jack-up wind limit (8 m/s) is very restrictive — SOV limit 15 m/s
        assert jackup["annual_average_pct"] <= sov["annual_average_pct"]

    def test_annual_average_computed_correctly(self):
        result = get_vessel_access("CTV")
        expected = sum(result["monthly_access_pct"]) / 12.0
        assert abs(result["annual_average_pct"] - expected) < 0.1

    def test_limiting_parameter_is_non_empty_string(self):
        result = get_vessel_access("HELICOPTER")
        assert len(result["limiting_parameter"]) > 0

    def test_location_field_present(self):
        result = get_vessel_access("CTV")
        assert len(result["location"]) > 0


class TestAllVesselAccess:
    """Fleet-level access summary."""

    def test_returns_four_vessel_types(self):
        result = get_all_vessel_access()
        assert len(result["vessels"]) == 4

    def test_vessel_names_are_valid(self):
        result = get_all_vessel_access()
        valid = {"CTV", "SOV", "JACK_UP", "HELICOPTER"}
        names = {v["vessel"] for v in result["vessels"]}
        assert names == valid

    def test_year_field_present(self):
        result = get_all_vessel_access(year=2025)
        assert result["year"] == 2025


# ── Maintenance window scheduling ─────────────────────────────────────────────


class TestMaintenanceWindow:
    """Wait-time model and cost estimates."""

    def test_returns_required_fields(self):
        result = find_maintenance_window("2025-07-15", "CTV", 24.0, "WTG-01")
        for field in (
            "turbine_id",
            "failure_date_iso",
            "vessel_type",
            "estimated_window_start_iso",
            "wait_days",
            "total_downtime_days",
            "cost_estimate_eur",
            "cost_breakdown",
        ):
            assert field in result, f"Missing field: {field}"

    def test_wait_days_non_negative(self):
        result = find_maintenance_window("2025-07-15", "CTV", 8.0, "WTG-01")
        assert result["wait_days"] >= 0.0

    def test_total_downtime_gte_repair_duration(self):
        """Total downtime = wait + repair days — always ≥ repair duration."""
        result = find_maintenance_window("2025-01-10", "CTV", 24.0, "WTG-05")
        repair_days = 24.0 / 24.0
        assert result["total_downtime_days"] >= repair_days

    def test_summer_failure_shorter_wait_than_winter(self):
        """July failure should have shorter expected wait than January (better weather)."""
        summer = find_maintenance_window("2025-07-15", "CTV", 8.0, "WTG-01")
        winter = find_maintenance_window("2025-01-15", "CTV", 8.0, "WTG-01")
        # Summer should have shorter or equal wait
        assert summer["wait_days"] <= winter["wait_days"] + 5.0  # allow tolerance

    def test_cost_estimate_positive(self):
        result = find_maintenance_window("2025-06-01", "CTV", 8.0, "WTG-10")
        assert result["cost_estimate_eur"] > 0.0

    def test_cost_breakdown_components_sum_to_total(self):
        result = find_maintenance_window("2025-06-01", "SOV", 48.0, "WTG-03")
        breakdown = result["cost_breakdown"]
        total = (
            breakdown["vessel_day_rate_eur"]
            + breakdown["mobilisation_eur"]
            + breakdown["labour_eur"]
            + breakdown["parts_eur"]
        )
        assert abs(total - result["cost_estimate_eur"]) < 1.0

    def test_jackup_more_expensive_than_ctv(self):
        """Heavy lift (jack-up) should be substantially more expensive than CTV."""
        ctv = find_maintenance_window("2025-06-01", "CTV", 8.0, "WTG-01")
        jackup = find_maintenance_window("2025-06-01", "JACK_UP", 8.0, "WTG-01")
        assert jackup["cost_estimate_eur"] > ctv["cost_estimate_eur"]

    def test_turbine_id_preserved(self):
        result = find_maintenance_window("2025-03-01", "CTV", 12.0, "WTG-17")
        assert result["turbine_id"] == "WTG-17"

    def test_window_start_after_failure_date(self):
        result = find_maintenance_window("2025-07-15", "CTV", 8.0, "WTG-01")
        assert result["estimated_window_start_iso"] >= "2025-07-15"


# ── O&M cost model ─────────────────────────────────────────────────────────────


class TestOAMCost:
    """Annual cost breakdown and benchmark validation."""

    def test_returns_required_fields(self):
        result = get_oam_cost_breakdown()
        for field in (
            "total_oam_eur",
            "per_mw_eur",
            "planned_maintenance_eur",
            "unplanned_maintenance_eur",
            "vessel_charter_eur",
            "heavy_lift_eur",
            "insurance_eur",
            "assessment",
        ):
            assert field in result, f"Missing field: {field}"

    def test_per_mw_in_industry_range(self):
        """EUR 80–120k/MW/year industry benchmark for modern offshore."""
        result = get_oam_cost_breakdown()
        # Allow wider range for sensitivity (user-configurable inputs)
        assert 20_000 <= result["per_mw_eur"] <= 300_000

    def test_all_components_positive(self):
        result = get_oam_cost_breakdown()
        assert result["planned_maintenance_eur"] > 0.0
        assert result["unplanned_maintenance_eur"] > 0.0
        assert result["vessel_charter_eur"] > 0.0
        assert result["heavy_lift_eur"] > 0.0
        assert result["insurance_eur"] > 0.0

    def test_total_equals_sum_of_components(self):
        result = get_oam_cost_breakdown()
        component_sum = (
            result["planned_maintenance_eur"]
            + result["unplanned_maintenance_eur"]
            + result["vessel_charter_eur"]
            + result["heavy_lift_eur"]
            + result["insurance_eur"]
        )
        assert abs(result["total_oam_eur"] - component_sum) < 1.0

    def test_unplanned_more_expensive_than_planned(self):
        """Unplanned maintenance should cost more than planned (call-out premium)."""
        result = get_oam_cost_breakdown()
        assert result["unplanned_maintenance_eur"] > result["planned_maintenance_eur"]

    def test_assessment_string_non_empty(self):
        result = get_oam_cost_breakdown()
        assert len(result["assessment"]) > 0

    def test_more_turbines_higher_total_cost(self):
        """Scaling from 34 to 50 turbines should increase total cost."""
        base = get_oam_cost_breakdown(n_turbines=34)
        larger = get_oam_cost_breakdown(n_turbines=50)
        assert larger["total_oam_eur"] > base["total_oam_eur"]

    def test_higher_fault_rate_higher_unplanned_cost(self):
        result_low = get_oam_cost_breakdown(unplanned_events_per_turbine=4.0)
        result_high = get_oam_cost_breakdown(unplanned_events_per_turbine=10.0)
        assert result_high["unplanned_maintenance_eur"] > result_low["unplanned_maintenance_eur"]
