"""Planning & P2X: HVAC vs HVDC export over distance, electrolyser on surplus energy."""

from __future__ import annotations

import math
from itertools import pairwise

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.p2.planning import (
    H2_LHV_KWH_PER_KG,
    SEC_KWH_PER_KG,
    export_comparison,
    farm_duration_mw,
    p2x_study,
)


def test_duration_curve_is_physical():
    """Rule 1: 0 ≤ P ≤ 510 MW; 8760 sorted hours; offshore CF 0.4–0.6 before wakes."""
    p = farm_duration_mw()
    assert len(p) == 8760
    assert p.min() >= 0 and p.max() <= 510
    assert all(p[:-1] >= p[1:])
    assert 0.4 < p.mean() / 510 < 0.6


def test_hvac_charging_matches_omega_c_v2_l():
    """Rule 7: Q = ωCV²L per circuit, 2 circuits at 45 km ≈ 260 Mvar (the farm's reactor sizing)."""
    r = export_comparison(45.0)
    q = 2 * 2 * math.pi * 50 * 190e-9 * 45 * 220e3**2 / 1e6
    assert r["hvac"]["charging_mvar"] == pytest.approx(q, rel=1e-3)
    assert 255 < q < 265


def test_hvac_capacity_falls_with_length_and_limits_510_mw():
    """Charging current eats the ampacity: AC capacity falls with length, below 510 MW."""
    r = export_comparison()
    caps = [p["hvac_capacity_mw"] for p in r["sweep"]]
    assert all(a > b for a, b in pairwise(caps))
    assert r["hvac"]["capacity_mw"] > 510  # the 45 km design carries the farm
    assert r["hvac_capacity_limit_km"] is not None and 150 <= r["hvac_capacity_limit_km"] <= 220


def test_hvdc_converter_losses_dominate_at_short_distance():
    """At 45 km HVAC loses less; HVDC wins on losses only on long routes."""
    r = export_comparison(45.0)
    assert r["hvac"]["loss_gwh"] < r["hvdc"]["loss_gwh"]
    assert r["loss_crossover_km"] is not None and r["loss_crossover_km"] > 100
    # Converter: 2 stations × 1 % of the annual energy
    assert r["hvdc"]["loss_gwh"] > 0.02 * r["annual_energy_gwh"]


def test_no_surplus_at_full_connection():
    s = p2x_study(connection_mw=510.0, electrolyser_mw=60.0)
    assert s["surplus_gwh"] == 0 and s["h2_tonnes"] == 0 and s["lcoh_eur_kg"] is None


def test_electrolyser_energy_balance():
    """Absorbed + still lost = surplus; H2 = E / SEC; efficiency = LHV / SEC."""
    s = p2x_study(connection_mw=400.0, electrolyser_mw=60.0)
    assert s["absorbed_gwh"] + s["still_lost_gwh"] == pytest.approx(s["surplus_gwh"], abs=0.02)
    assert s["h2_tonnes"] == pytest.approx(s["absorbed_gwh"] * 1e6 / SEC_KWH_PER_KG / 1e3, rel=1e-3)
    assert s["efficiency_lhv"] == pytest.approx(H2_LHV_KWH_PER_KG / SEC_KWH_PER_KG, abs=1e-3)
    assert s["full_load_hours"] <= s["surplus_hours"]


def test_oversized_electrolyser_runs_fewer_hours_and_costs_more():
    small, big = p2x_study(400.0, 30.0), p2x_study(400.0, 150.0)
    assert big["full_load_hours"] < small["full_load_hours"]
    assert big["lcoh_eur_kg"] > small["lcoh_eur_kg"]


def test_lcoh_curves_fall_with_full_load_hours():
    s = p2x_study()
    for curve in s["lcoh_curves"]:
        y = curve["lcoh_eur_kg"]
        assert all(a > b for a, b in pairwise(y))


def test_api():
    c = TestClient(app)
    r = c.post("/api/v1/grid/planning/export", json={"design_length_km": 120})
    assert r.status_code == 200 and len(r.json()["sweep"]) == 39
    r = c.post("/api/v1/grid/planning/p2x", json={"connection_mw": 350, "electrolyser_mw": 100})
    assert r.status_code == 200 and r.json()["h2_tonnes"] > 0
    assert c.post("/api/v1/grid/planning/p2x", json={"connection_mw": 600}).status_code == 422
