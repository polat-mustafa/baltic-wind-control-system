"""
Tests for M10 Cable DTS Thermal Monitoring.

Covers:
- DTS profile has correct number of points
- Temperature rises with current (physics)
- Hotspot detection at overload conditions
- Dynamic rating higher in winter, lower in summer
- IEC 60287 temperature formula correctness
"""

from __future__ import annotations

from app.services.p2.cable_dts import (
    CABLE_LENGTH_KM,
    N_POINTS,
    STATIC_RATING_A,
    T_CRIT,
    T_WARN,
    calculate_dynamic_rating,
    detect_hotspots,
    simulate_dts,
)

# ── DTS Profile ────────────────────────────────────────────────────────────────


class TestDTSProfile:
    """Temperature profile generation and physics validation."""

    def test_profile_has_correct_point_count(self):
        result = simulate_dts(650.0, 10.0)
        assert len(result["profile"]) == N_POINTS

    def test_cable_length_correct(self):
        result = simulate_dts(650.0, 10.0)
        assert result["cable_length_km"] == CABLE_LENGTH_KM

    def test_all_points_have_required_fields(self):
        result = simulate_dts(650.0, 10.0)
        for pt in result["profile"][:10]:  # check first 10
            assert "distance_km" in pt
            assert "temperature_c" in pt
            assert "loading_percent" in pt
            assert "is_hotspot" in pt

    def test_distance_increases_monotonically(self):
        result = simulate_dts(650.0, 10.0)
        distances = [pt["distance_km"] for pt in result["profile"]]
        for i in range(1, len(distances)):
            assert distances[i] > distances[i - 1]

    def test_loading_percent_proportional_to_current(self):
        """Loading % = current / static_rating * 100."""
        result = simulate_dts(400.0, 10.0)
        expected_loading = 100.0 * 400.0 / STATIC_RATING_A
        for pt in result["profile"][:5]:
            assert abs(pt["loading_percent"] - expected_loading) < 0.1

    def test_higher_current_higher_max_temp(self):
        """More current → higher conductor temperature (physics check)."""
        low = simulate_dts(400.0, 10.0)
        high = simulate_dts(800.0, 10.0)
        assert high["max_temp_c"] > low["max_temp_c"]

    def test_higher_ambient_higher_max_temp(self):
        """Higher ambient temperature → higher conductor temperature."""
        cold = simulate_dts(650.0, 4.0)
        warm = simulate_dts(650.0, 22.0)
        assert warm["max_temp_c"] > cold["max_temp_c"]

    def test_max_temp_location_within_cable(self):
        result = simulate_dts(650.0, 10.0)
        assert 0.0 <= result["max_temp_location_km"] <= CABLE_LENGTH_KM

    def test_assessment_string_non_empty(self):
        result = simulate_dts(650.0, 10.0)
        assert len(result["assessment"]) > 0

    def test_normal_load_no_hotspots(self):
        """At 50% load and cool ambient — should have no hotspots."""
        result = simulate_dts(400.0, 5.0)
        assert result["hotspot_count"] == 0

    def test_overload_creates_hotspots(self):
        """At 110% load (880 A) with warm ambient — hotspots should appear."""
        result = simulate_dts(880.0, 22.0)
        assert result["hotspot_count"] > 0

    def test_hotspot_flag_consistent_with_temperature(self):
        """Points flagged as hotspot must have temp >= T_WARN."""
        result = simulate_dts(750.0, 20.0)
        for pt in result["profile"]:
            if pt["is_hotspot"]:
                assert pt["temperature_c"] >= T_WARN - 0.5  # small tolerance for noise


# ── Hotspot Detection ──────────────────────────────────────────────────────────


class TestHotspotDetection:
    """Hotspot classification and severity."""

    def test_normal_conditions_no_hotspots(self):
        result = detect_hotspots(400.0, 5.0)
        assert result["hotspot_count"] == 0
        assert result["max_severity"] == "NORMAL"

    def test_overload_hotspots_detected(self):
        result = detect_hotspots(900.0, 25.0)
        assert result["hotspot_count"] > 0
        assert result["max_severity"] in ("WARNING", "CRITICAL")

    def test_hotspot_fields_present(self):
        result = detect_hotspots(850.0, 20.0)
        for hs in result["hotspots"]:
            assert "distance_km" in hs
            assert "temperature_c" in hs
            assert "severity" in hs
            assert "cause" in hs

    def test_hotspot_severity_matches_temperature(self):
        result = detect_hotspots(900.0, 25.0)
        for hs in result["hotspots"]:
            if hs["severity"] == "CRITICAL":
                assert hs["temperature_c"] >= T_CRIT - 1.0
            else:
                assert hs["temperature_c"] >= T_WARN - 1.0

    def test_assessment_non_empty(self):
        result = detect_hotspots(650.0, 10.0)
        assert len(result["assessment"]) > 0


# ── Dynamic Rating ─────────────────────────────────────────────────────────────


class TestDynamicRating:
    """IEC 60287 dynamic rating calculation."""

    def test_winter_rating_exceeds_static(self):
        """Cold ambient (4°C) → dynamic rating > 800 A static."""
        result = calculate_dynamic_rating(650.0, 4.0)
        assert result["dynamic_rating_a"] > STATIC_RATING_A

    def test_summer_rating_below_static(self):
        """Warm ambient (25°C) → dynamic rating < 800 A static."""
        result = calculate_dynamic_rating(650.0, 25.0)
        assert result["dynamic_rating_a"] < STATIC_RATING_A

    def test_design_ambient_equals_static(self):
        """At design ambient (15°C), dynamic rating = static rating."""
        result = calculate_dynamic_rating(650.0, 15.0)
        assert abs(result["dynamic_rating_a"] - STATIC_RATING_A) < 5.0

    def test_headroom_positive_when_not_overloaded(self):
        result = calculate_dynamic_rating(600.0, 10.0)
        assert result["headroom_a"] > 0.0

    def test_headroom_negative_when_overloaded(self):
        """At 900 A in warm ambient, should be over dynamic rating."""
        result = calculate_dynamic_rating(900.0, 25.0)
        assert result["headroom_a"] < 0.0

    def test_utilisation_correct(self):
        """thermal_utilisation_pct = current / dynamic_rating * 100."""
        result = calculate_dynamic_rating(650.0, 10.0)
        expected = 100.0 * 650.0 / result["dynamic_rating_a"]
        assert abs(result["thermal_utilisation_pct"] - expected) < 0.5

    def test_required_fields_present(self):
        result = calculate_dynamic_rating(650.0, 10.0)
        for field in (
            "current_a",
            "ambient_temp_c",
            "static_rating_a",
            "dynamic_rating_a",
            "headroom_a",
            "headroom_pct",
            "thermal_utilisation_pct",
            "assessment",
        ):
            assert field in result

    def test_assessment_non_empty(self):
        result = calculate_dynamic_rating(650.0, 10.0)
        assert len(result["assessment"]) > 0
