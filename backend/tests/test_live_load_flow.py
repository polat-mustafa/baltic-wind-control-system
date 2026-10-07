"""Live load flow for the landing map's operating point (POST /grid/live-load-flow)."""

import json
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.exceptions import DomainError
from app.main import app
from app.schemas.grid import LiveLoadFlowRequest
from app.services.p2.load_flow import run_live_load_flow
from app.services.p2.network_model import design
from app.services.p2.statcom_sizing import check_reactors


def test_full_output_balances_power_and_holds_voltage() -> None:
    r = run_live_load_flow([15.0] * 34)
    assert r.converged
    assert r.total_generation_mw == pytest.approx(510.0)
    # energy balance: what reaches PSE = generation − losses (MW)
    assert r.poc_p_mw == pytest.approx(r.total_generation_mw - r.total_loss_mw, abs=0.05)
    assert 0.5 < r.total_loss_mw < 20.0  # ~1–3 % of 510 MW for a 45 km HVAC export
    assert r.voltage_compliant
    assert abs(r.v_oss_220_pu - 1.0) <= 0.011  # STATCOM holds the OSS bus (±0.01 pu band)
    assert r.export_cable_loading_pct > 50.0


def test_idle_farm_absorbs_cable_charging() -> None:
    r = run_live_load_flow([0.0] * 34)
    assert r.converged
    assert r.poc_p_mw < 0.0  # losses are drawn from the grid
    # 45 km of 220 kV cable is capacitive (rule 7): reactors + STATCOM keep V in range
    assert r.voltage_compliant


def test_one_string_down_changes_array_loading_only_on_that_string() -> None:
    full = run_live_load_flow([15.0] * 34)
    p = [15.0] * 34
    p[:6] = [0.0] * 6  # string 1 (6 WTGs) tripped
    r = run_live_load_flow(p)
    assert r.total_generation_mw == pytest.approx(420.0)
    assert r.export_cable_loading_pct < full.export_cable_loading_pct


@pytest.mark.parametrize("bad", [[16.0] * 34, [-1.0] * 34, [], [10.0] * 151])
def test_request_rejects_out_of_rating_or_wrong_count(bad: list[float]) -> None:
    with pytest.raises(ValidationError):
        LiveLoadFlowRequest(wtg_p_mw=bad)


def test_own_farm_solves_its_own_turbines() -> None:
    four = check_reactors(design((2, 2, 2, 2), 20.0, 1.5))  # 8 × 15 MW, one 20 km circuit
    r = run_live_load_flow([15.0] * 8, four)
    assert r.converged and r.voltage_compliant
    assert r.total_generation_mw == pytest.approx(120.0)
    assert r.poc_p_mw == pytest.approx(120.0 - r.total_loss_mw, abs=0.05)
    assert r.total_loss_mw < 0.03 * 120.0  # MW
    with pytest.raises(DomainError, match="8 turbines"):
        run_live_load_flow([15.0] * 34, four)


@pytest.mark.parametrize(
    ("layout", "km"), [((2, 2, 2, 2), 20.0), ((5,) * 5, 75.0), ((2,) * 4, 73.0)]
)
def test_reactor_switching_keeps_statcom_headroom(layout: tuple[int, ...], km: float) -> None:
    """All N+1 reactors in would pin the STATCOM at +rating on these designs."""
    spec = check_reactors(design(layout, km, 1.5))
    for f in (0.0, 0.5, 1.0):
        r = run_live_load_flow([15.0 * f] * spec.num_turbines, spec)
        assert r.converged and r.voltage_compliant
        assert abs(r.statcom_q_mvar) < spec.statcom_mvar  # not saturated [MVAR]
        assert abs(r.v_oss_220_pu - 1.0) <= 0.011  # STATCOM holds the OSS bus
        assert r.reactors_in_service < spec.num_reactors


def test_sb510_keeps_all_reactors_in() -> None:
    for f in (0.0, 0.5, 1.0):
        assert run_live_load_flow([15.0 * f] * 34).reactors_in_service == 3


def test_api_takes_the_farm_from_the_header() -> None:
    client = TestClient(app)
    url = "/api/v1/grid/live-load-flow"
    own = {"strings": [2, 2, 2, 2], "export_km": 20, "array_km": 1.5}
    farm = {"X-Farm": quote(json.dumps(own))}
    r = client.post(url, json={"wtg_p_mw": [10.0] * 8}, headers=farm)
    assert r.status_code == 200
    assert r.json()["total_generation_mw"] == pytest.approx(80.0)  # MW
    assert client.post(url, json={"wtg_p_mw": [10.0] * 34}, headers=farm).status_code == 422
    assert client.post(url, json={"wtg_p_mw": [10.0] * 34}).status_code == 200  # SB-510
