"""
Tests for M08 BESS (50 MW / 200 MWh LFP). Battery power positive = discharge.

- FCR follows the SO GL CE characteristic (full at ±200 mHz, ±10 mHz insensitivity)
- SOC bookkeeping with the charge-side efficiency and the 10–90 % window
- ramp smoothing keeps the POC within the limit while the battery can
- degradation = cycle loss + calendar loss
- dispatch keeps the POC on target in both surplus and deficit
"""

from __future__ import annotations

from itertools import pairwise

import pytest
from fastapi.testclient import TestClient

import app.services.p2.bess as bess_svc
from app.main import app
from app.services.p2.bess import (
    RATED_ENERGY_MWH,
    RATED_POWER_MW,
    SOC_MAX_PCT,
    SOC_MIN_PCT,
    calculate_degradation,
    dispatch_bess,
    fcr_power_mw,
    get_status,
    set_mode,
    simulate_frequency_response,
    simulate_ramp_smoothing,
)


@pytest.fixture(autouse=True)
def _restore_state():
    saved = dict(bess_svc._state)
    yield
    bess_svc._state.clear()
    bess_svc._state.update(saved)


# ── Status and modes ───────────────────────────────────────────────────────────


def test_available_energy_counts_from_soc_floor():
    s = get_status()
    capacity = RATED_ENERGY_MWH * s["soh_percent"] / 100
    assert s["available_energy_mwh"] == pytest.approx(
        capacity * (s["soc_percent"] - SOC_MIN_PCT) / 100, abs=0.01
    )
    assert s["rated_power_mw"] == RATED_POWER_MW


@pytest.mark.parametrize(
    ("mode", "soc", "allowed"),
    [
        ("CHARGE", SOC_MAX_PCT, False),
        ("DISCHARGE", SOC_MIN_PCT, False),
        ("DISCHARGE", 50.0, True),
        # FCR needs 15 min at 50 MW = 12.5 MWh = 6.25 % SOC above the floor
        ("FREQUENCY_RESPONSE", 16.0, False),
        ("FREQUENCY_RESPONSE", 16.5, True),
    ],
)
def test_mode_transitions_respect_soc(mode, soc, allowed):
    bess_svc._state["soc_percent"] = soc
    r = set_mode(mode, 10.0, 50.0)
    assert r["transition_allowed"] is allowed
    assert (r["new_mode"] == mode) is allowed


def test_discharge_setpoint_is_positive():
    bess_svc._state["soc_percent"] = 50.0
    assert set_mode("DISCHARGE", 20.0, 30.0)["power_setpoint_mw"] == 20.0
    assert set_mode("FREQUENCY_RESPONSE", 20.0, 30.0)["power_setpoint_mw"] == 0.0


# ── FCR ────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("f", "p"),
    [
        (50.0, 0.0),
        (49.995, 0.0),  # inside ±10 mHz insensitivity
        (49.9, 25.0),  # half of the 200 mHz band
        (49.8, 50.0),  # full activation
        (49.0, 50.0),  # clamped
        (50.1, -25.0),  # over-frequency → charge
        (50.5, -50.0),
    ],
)
def test_fcr_characteristic(f, p):
    assert fcr_power_mw(f) == pytest.approx(p)


def test_fcr_scales_with_offered_capacity():
    assert fcr_power_mw(49.9, 20.0) == pytest.approx(10.0)


def test_underfrequency_event_discharges_and_drains_soc():
    trace = [50.0] * 5 + [49.8] * 60 + [50.0] * 5
    r = simulate_frequency_response(trace, 50.0, None, 60.0)
    assert max(r["bess_power_mw"]) == pytest.approx(50.0)
    assert r["fcr_activated"] and not r["ffr_activated"]
    # 50 MW for 60 s = 0.833 MWh = 0.417 % SOC
    assert r["energy_delivered_mwh"] == pytest.approx(50 / 60, rel=1e-3)
    assert r["soc_percent"][0] - r["soc_percent"][-1] == pytest.approx(50 / 60 / 2, abs=0.01)
    assert len(r["bess_power_mw"]) == len(r["soc_percent"]) == len(trace)


def test_charging_stores_less_than_it_draws():
    r = simulate_frequency_response([50.2] * 60, 50.0, None, 50.0)
    assert min(r["bess_power_mw"]) == pytest.approx(-50.0)
    gained = r["soc_percent"][-1] - 50.0
    assert gained == pytest.approx(r["energy_absorbed_mwh"] * 0.92 / 2, abs=0.01)


def test_ffr_step_only_below_threshold():
    trace = [50.0, 49.9, 49.65, 49.6, 49.9]
    r = simulate_frequency_response(trace, 50.0, 49.7, 60.0)
    assert r["ffr_activated"]
    assert r["bess_power_mw"][1] == pytest.approx(25.0)
    assert r["bess_power_mw"][2] == pytest.approx(50.0)
    assert r["nadir_hz"] == pytest.approx(49.6)
    assert r["nadir_time_s"] == 3


def test_no_discharge_at_soc_floor_and_endurance_reported():
    r = simulate_frequency_response([49.5] * 10, 50.0, None, SOC_MIN_PCT)
    assert all(p == 0.0 for p in r["bess_power_mw"])
    assert r["fcr_endurance_min"] == pytest.approx(0.0)
    full = simulate_frequency_response([50.0, 50.0], 50.0, None, 60.0)
    assert full["fcr_endurance_min"] == pytest.approx(120.0)  # 100 MWh / 50 MW


# ── Ramp smoothing ─────────────────────────────────────────────────────────────


def test_ramp_smoothing_holds_the_limit():
    wind = [200.0] * 3 + [300.0] * 10 + [200.0] * 10
    r = simulate_ramp_smoothing(wind, 51.0, 50.0)
    out = r["smoothed_output_mw"]
    assert r["ramp_violations_before"] == 2
    assert r["ramp_violations_after"] == 0
    assert max(abs(b - a) for a, b in pairwise(out)) <= 51.0 + 1e-6
    # step up 100 MW → battery charges 49 MW first, step down → discharges
    assert r["bess_power_mw"][3] == pytest.approx(-49.0)
    assert r["peak_bess_discharge_mw"] > 0
    assert r["assessment"].startswith("PASS")


def test_ramp_beyond_battery_power_is_partial():
    wind = [0.0, 300.0] + [300.0] * 8
    r = simulate_ramp_smoothing(wind, 51.0, 50.0)
    assert r["ramp_violations_after"] == 1
    assert r["peak_bess_charge_mw"] == pytest.approx(50.0)
    assert all(SOC_MIN_PCT <= s <= SOC_MAX_PCT for s in r["soc_percent"])


# ── Degradation ────────────────────────────────────────────────────────────────


def test_degradation_adds_cycle_and_calendar_loss():
    r = calculate_degradation(20, 365.0, 80.0)
    p1 = r["projection"][1]
    assert p1["soh_percent"] == pytest.approx(100 - 365 / 3000 * 20 - 0.5, abs=0.01)
    assert p1["calendar_loss_pct"] == 0.5
    assert p1["soh_percent"] == pytest.approx(100 - p1["cycle_loss_pct"] - 0.5, abs=0.01)
    assert r["projection"][0]["capacity_mwh"] == pytest.approx(200.0)
    # 2.93 %/year → 80 % first reached in year 7
    assert r["eol_year"] == 7 and r["eol_reached"]


def test_shallower_cycles_last_longer():
    deep = calculate_degradation(30, 300.0, 90.0)
    shallow = calculate_degradation(30, 300.0, 50.0)
    assert deep["eol_year"] < shallow["eol_year"]


def test_degradation_horizon_without_eol():
    r = calculate_degradation(5, 50.0, 50.0)
    assert not r["eol_reached"] and r["eol_year"] == 5
    assert r["replacement_cost_m_eur"] == pytest.approx(70.0)
    assert r["lcoe_contribution_eur_mwh"] > 0


# ── Dispatch ───────────────────────────────────────────────────────────────────


def test_surplus_charges_without_moving_the_poc():
    r = dispatch_bess(200.0, 400.0, 50.0)
    assert r["p_bess_mw"] == pytest.approx(-50.0)
    assert r["p_wtg_dispatch_mw"] == pytest.approx(250.0)
    assert r["p_poc_mw"] == pytest.approx(200.0)
    assert r["bess_mode"] == "CHARGE" and r["dispatch_feasible"]
    assert r["soc_after_pct"] > 50.0


def test_deficit_discharges_up_to_rated():
    r = dispatch_bess(420.0, 400.0, 60.0)
    assert r["p_bess_mw"] == pytest.approx(20.0)
    assert r["p_poc_mw"] == pytest.approx(420.0) and r["dispatch_feasible"]
    assert r["soc_after_pct"] < 60.0
    big = dispatch_bess(560.0, 400.0, 60.0)
    assert big["p_bess_mw"] == pytest.approx(RATED_POWER_MW)
    assert big["dispatch_feasible"] is False


def test_soc_limits_block_dispatch():
    assert dispatch_bess(450.0, 400.0, SOC_MIN_PCT)["p_bess_mw"] == 0.0
    full = dispatch_bess(200.0, 400.0, SOC_MAX_PCT)
    assert full["p_bess_mw"] == 0.0 and full["p_wtg_dispatch_mw"] == pytest.approx(200.0)


def test_api_frequency_response():
    r = TestClient(app).post(
        "/api/v1/grid/bess/simulate/frequency-response",
        json={"frequency_trace_hz": [50.0, 49.9, 49.8], "fcr_capacity_mw": 40},
    )
    assert r.status_code == 200
    assert r.json()["bess_power_mw"] == [0.0, 20.0, 40.0]
