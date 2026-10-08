"""M04 multi-farm comparison — physics sanity checks and the inline API contract."""

import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.farm_config import FarmConfigCreate
from app.services.p1 import farm_comparison as svc

client = TestClient(app)

BALTIC = FarmConfigCreate(name="SB-510", mean_wind_speed_ms=9.3)


def _eval(**kw: object) -> tuple:
    farm = svc.resolve_farms(None, [BALTIC.model_copy(update=kw)])[0]
    return svc.evaluate_farm(farm, 70.0)


def test_project_export_matches_p2_network():
    """510 MW @ 220 kV, 108 km → 2 circuits, Q = ωCU²L × 2 ≈ 624 MVAr (P2 statcom_sizing)."""
    _, _, grid = _eval()
    assert grid.export_circuits == 2
    assert grid.cable_charging_mvar == pytest.approx(624, abs=2)
    assert 0 < grid.export_cable_losses_pct < 1.5  # 108 km: ≈ 6.7 MW of 510 at full load
    assert grid.export_utilization_pct < 100


def test_aep_cascade_is_physical():
    aep, lcoe, grid = _eval()
    assert aep.weibull_a_ms == pytest.approx(9.3 / math.gamma(1 + 1 / 2.2), abs=0.01)
    assert aep.net_gwh < aep.gross_gwh
    assert aep.p90_gwh < aep.p50_gwh == aep.net_gwh
    assert 30 < aep.capacity_factor_pct < 60  # offshore Baltic range
    assert 0 < aep.wake_loss_pct < 20
    # Annual I²R loss < loss at rated because LLF < 1
    assert 0 < grid.loss_load_factor < 1
    assert grid.annual_electrical_loss_pct < grid.total_electrical_losses_pct
    assert lcoe.lcoe_eur_per_mwh > 0


def test_tighter_spacing_increases_wake_loss():
    loose, _, _ = _eval(turbine_spacing_d=10.0)
    tight, _, _ = _eval(turbine_spacing_d=5.0)
    assert tight.wake_loss_pct > loose.wake_loss_pct


def test_constant_specific_power_scaling():
    """At constant specific power, CF and wake loss don't depend on the rating."""
    a15, _, _ = _eval()
    a12, _, _ = _eval(turbine_rated_mw=12.0)
    assert a12.wake_loss_pct == a15.wake_loss_pct
    assert a12.gross_gwh == pytest.approx(a15.gross_gwh * 12 / 15, rel=1e-3)


def test_irr_bisection_matches_annuity():
    irr = svc.project_irr(100.0, 10.0, 25)
    assert -100 + 10 * (1 - (1 + irr) ** -25) / irr == pytest.approx(0, abs=1e-6)
    assert svc.project_irr(100.0, 3.0, 25) == 0.0  # never pays back


def test_compare_inline_api():
    body = {
        "farms": [
            {"name": "Alpha 15 MW", "turbine_count": 34},
            {"name": "Beta 12 MW", "turbine_count": 40, "turbine_rated_mw": 12.0},
        ]
    }
    r = client.post("/api/v1/wind/farms/compare", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert [a["farm_name"] for a in data["aep"]] == ["Alpha 15 MW", "Beta 12 MW"]
    assert data["best_lcoe_farm"] in ("Alpha 15 MW", "Beta 12 MW")
    # Inline farms are not persisted
    assert all(
        f["id"] not in {x["id"] for x in client.get("/api/v1/wind/farms").json()}
        for f in data["farms"]
    )


def test_compare_requires_exactly_one_source():
    r = client.post("/api/v1/wind/farms/compare", json={})
    assert r.status_code == 422
