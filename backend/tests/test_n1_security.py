"""N-1 security of the export system: preventive string trips, corrective runbacks."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.p2.n1_security import RUNBACK_MW_PER_S, run_n1_security


@pytest.fixture(scope="module")
def full() -> dict:
    return run_n1_security(1.0)


@pytest.fixture(scope="module")
def half() -> dict:
    return run_n1_security(0.5)


def _c(result: dict, cid: str) -> dict:
    return next(c for c in result["contingencies"] if c["id"] == cid)


def test_base_case_is_the_grid_tab_operating_point(full):
    """510 MW, ~10.2 MW losses on 108 km, OSS held at 1.0 p.u., everything under 100 %
    (the export cable at 99 %: the 108 km route uses the circuits to the limit)."""
    base = full["base_case"]
    assert base["output_mw"] == pytest.approx(510.0)
    assert base["export_mw"] == pytest.approx(499.8, abs=0.5)
    assert base["secure"]
    assert base["loading_pct"] < 100.0


def test_contingency_list(full):
    kinds = [c["kind"] for c in full["contingencies"]]
    assert kinds == ["preventive"] * 6 + ["corrective"] * 3


def test_string_trip_only_loses_its_generation(full):
    """A tripped feeder unloads the rest: secure without any action."""
    for i, n in enumerate([6, 6, 6, 6, 5, 5], start=1):
        c = _c(full, f"string_{i}")
        assert c["secure"] and c["runback_mw"] == 0.0
        assert c["lost_mw"] == pytest.approx(15.0 * n)


def test_export_circuit_trip_needs_runback_at_full_output(full):
    """One circuit left (√3·220 kV·825 A = 314 MVA): 164 % right after the trip → runback by
    ≈ 221 MW to ≈ 289 MW (its own 221 Mvar of charging current shares the ampacity)."""
    c = _c(full, "export_circuit")
    assert c["immediate"]["limiting_element"] == "Export_220kV"
    assert c["immediate"]["loading_pct"] > 130.0
    assert c["after_action"]["loading_pct"] <= 100.0
    assert c["secure"]
    assert 200.0 < c["runback_mw"] < 240.0
    assert c["runback_s"] == pytest.approx(c["runback_mw"] / RUNBACK_MW_PER_S, abs=0.1)
    # the circuit's reactors (onshore + OSS) intertripped with it → voltage stays in the band
    assert c["after_action"]["v_min_pu"] >= 0.95


@pytest.mark.parametrize("cid", ["oss_trafo", "onshore_trafo"])
def test_transformer_trip_runs_back_to_one_unit(full, cid):
    """One 300 MVA unit left: ~170 % → runback to ~300 MW."""
    c = _c(full, cid)
    assert c["immediate"]["loading_pct"] > 150.0
    assert c["after_action"]["loading_pct"] <= 100.0
    assert 280.0 < c["after_action"]["output_mw"] < 320.0


def test_firm_output_is_the_tightest_runback(full):
    corrective = [c for c in full["contingencies"] if c["kind"] == "corrective"]
    assert full["firm_output_mw"] == pytest.approx(
        min(c["after_action"]["output_mw"] for c in corrective)
    )
    assert full["n1_secure"]


def test_no_runback_at_half_output(half):
    """At 255 MW one circuit or one transformer carries everything."""
    assert all(c["runback_mw"] == 0.0 for c in half["contingencies"])
    assert half["firm_output_mw"] == pytest.approx(255.0)


def test_api():
    client = TestClient(app)
    r = client.post("/api/v1/grid/security/n1", json={"generation_fraction": 0.5})
    assert r.status_code == 200
    assert len(r.json()["contingencies"]) == 9
    assert (
        client.post("/api/v1/grid/security/n1", json={"generation_fraction": 2}).status_code == 422
    )
