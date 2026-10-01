"""Live load flow for the landing map's operating point (POST /grid/live-load-flow)."""

import pytest
from pydantic import ValidationError

from app.schemas.grid import LiveLoadFlowRequest
from app.services.p2.load_flow import run_live_load_flow


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


@pytest.mark.parametrize("bad", [[16.0] * 34, [-1.0] * 34, [10.0] * 33])
def test_request_rejects_out_of_rating_or_wrong_count(bad: list[float]) -> None:
    with pytest.raises(ValidationError):
        LiveLoadFlowRequest(wtg_p_mw=bad)
