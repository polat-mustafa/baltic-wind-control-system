"""
Tests for M10 cable DTS — IEC 60287 losses, fibre vs conductor, zone ratings,
the 950 A calibration and the N-1 transient.
"""

from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.p2 import cable_dts as m
from app.services.p2.network_model import EXPORT_CABLE_1000, EXPORT_CABLE_LENGTH_KM


class TestCableSpec:
    def test_spec_matches_network_model(self):
        """Regression: DTS once used its own 1×800 mm² Al / 800 A cable."""
        assert pytest.approx(950.0) == m.STATIC_RATING_A
        assert m.CABLE_LENGTH_KM == EXPORT_CABLE_LENGTH_KM

    def test_ac_resistance_at_90c(self):
        """0.0176 × 1.039 × (1 + 0.00393 × 70) ≈ 0.0233 Ω/km, the network model's R_AC."""
        assert (
            pytest.approx(EXPORT_CABLE_1000.r_ac_ohm_per_km, rel=1e-3) == m.R_AC90_OHM_PER_M * 1000
        )

    def test_dielectric_loss(self):
        """ω·C·U0²·tan δ = 2π·50 · 190 nF/km · (127 kV)² · 0.001 ≈ 0.96 W/m."""
        assert pytest.approx(0.963, abs=0.005) == m.W_DIELECTRIC


class TestSteadyState:
    def test_static_rating_reaches_90c_in_j_tube(self):
        t_c, _ = m.steady_temps(950.0, 15.0, m.R_EXT_J_TUBE)
        assert t_c == pytest.approx(90.0, abs=0.01)
        assert m.rating_a(15.0, m.R_EXT_J_TUBE) == pytest.approx(950.0, abs=0.1)

    def test_conductor_hotter_than_fibre(self):
        t_c, t_f = m.steady_temps(730.0, 15.0, m.R_EXT_J_TUBE)
        assert t_c > t_f > 15.0

    def test_dielectric_loss_heats_unloaded_cable(self):
        t_c, _ = m.steady_temps(0.0, 15.0, m.R_EXT_J_TUBE)
        assert 15.0 < t_c < 20.0

    def test_resistance_rises_with_temperature(self):
        """Self-consistent R_AC(T): the rise grows faster than I²."""
        rise = [m.steady_temps(i, 15.0, m.R_EXT_J_TUBE)[0] - 15.0 for i in (500.0, 1000.0)]
        assert rise[1] / rise[0] > 4.0

    def test_thermal_runaway_has_no_steady_state(self):
        assert math.isinf(m.steady_temps(3000.0, 15.0, m.R_EXT_J_TUBE)[0])

    @pytest.mark.parametrize(("ambient", "lo", "hi"), [(4.0, 1010, 1030), (22.0, 895, 910)])
    def test_rating_follows_ambient(self, ambient, lo, hi):
        assert lo < m.rating_a(ambient, m.R_EXT_J_TUBE) < hi


class TestProfile:
    def test_full_farm_load_is_normal(self):
        """510 MW over 2 circuits ≈ 730 A each → about 56 °C at the J-tube."""
        r = m.simulate_dts(730.0, 15.0)
        assert r["assessment"].startswith("NORMAL")
        assert r["alarm_length_km"] == 0
        assert len(r["profile"]) == m.N_POINTS

    def test_j_tube_is_hottest_and_limits_the_route(self):
        r = m.simulate_dts(950.0, 15.0)
        assert r["max_location_km"] <= m.J_TUBE_END_KM
        assert r["limiting_zone"] == "OSS J-tube"
        assert r["rating_at_ambient_a"] == 950
        by_name = {z["name"]: z for z in r["zones"]}
        assert by_name["Subsea burial"]["rating_a"] > by_name["HDD landfall"]["rating_a"] > 950

    def test_export_capability(self):
        """√3 · 220 kV · 950 A · 2 circuits ≈ 724 MVA."""
        assert m.simulate_dts(730.0, 15.0)["export_capability_mva"] == pytest.approx(724, abs=1)

    def test_summer_at_rating_is_over_limit(self):
        r = m.simulate_dts(950.0, 22.0)
        assert r["assessment"].startswith("OVER LIMIT")
        assert r["rating_at_ambient_a"] < 950

    def test_rating_curve_falls_with_ambient(self):
        for z in m.rating_curve()["zones"]:
            assert all(a > b for a, b in zip(z["rating_a"], z["rating_a"][1:], strict=False))


class TestTransient:
    def test_n1_survivor_has_hours_before_limit(self):
        r = m.simulate_transient(730.0, 1360.0, 15.0)
        assert r["limiting_zone"] == "OSS J-tube"
        assert 240 < r["allowed_minutes"] < 720
        assert r["zones"][0]["conductor_temp_c"][0] == pytest.approx(56.1, abs=0.5)

    def test_below_rating_never_reaches_limit(self):
        r = m.simulate_transient(730.0, 900.0, 15.0)
        assert r["allowed_minutes"] is None
        assert all(z["steady_state_c"] < 90 for z in r["zones"])

    def test_cold_ambient_buys_time(self):
        warm = m.simulate_transient(730.0, 1360.0, 20.0)["allowed_minutes"]
        cold = m.simulate_transient(730.0, 1360.0, 4.0)["allowed_minutes"]
        assert cold > warm


class TestAPI:
    def test_endpoints(self):
        c = TestClient(app)
        r = c.get("/api/v1/grid/cable/dts/profile", params={"current_a": 730, "ambient_temp_c": 15})
        assert r.status_code == 200
        assert r.json()["limiting_zone"] == "OSS J-tube"
        r = c.post("/api/v1/grid/cable/dts/transient", json={"emergency_current_a": 1360})
        assert r.status_code == 200
        assert r.json()["allowed_minutes"] > 0
        assert (
            c.get("/api/v1/grid/cable/dts/profile", params={"current_a": 5000}).status_code == 422
        )
