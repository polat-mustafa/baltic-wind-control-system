"""
Tests for M11 market day — day-ahead schedule, CEN imbalance, two-sided CfD,
BESS arbitrage.
"""

from __future__ import annotations

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.p2 import market as m


def _hours(r, key):
    return np.array([h[key] for h in r["hours"]])


class TestSchedule:
    def test_power_within_rating(self):
        """Rule 1: 0 ≤ P ≤ 510 MW, zero below cut-in."""
        p = m.farm_mw(np.array([0.0, 2.9, 8.0, 15.0, 40.0]))
        assert p[0] == p[1] == p[-1] == 0.0
        assert 0 < p[2] < p[3] <= m.RATED_MW

    def test_negative_hours_curtailed(self):
        r = m.simulate_day("windy_spring_sunday")
        neg = _hours(r, "da_price_pln_mwh") < 0
        assert r["negative_hours"] == neg.sum() > 0
        assert (_hours(r, "metered_mwh")[neg] == 0).all()
        assert (_hours(r, "bid_mwh")[neg] == 0).all()
        assert r["curtailed_mwh"] > 0

    def test_settlement_adds_up(self):
        r = m.simulate_day("winter_weekday")
        parts = (
            r["energy_value_pln"]
            + r["imbalance_pln"]
            + r["cfd_settlement_pln"]
            + r["bess_arbitrage_pln"]
        )
        assert parts == pytest.approx(r["total_pln"], abs=3)


class TestImbalance:
    def test_perfect_forecast_costs_nothing(self):
        r = m.simulate_day(forecast_sigma_ms=0.0)
        assert r["imbalance_pln"] == 0
        assert r["rmse_mwh"] == 0

    def test_cost_is_lambda_sum_dev_squared(self):
        r = m.simulate_day()
        dev = _hours(r, "deviation_mwh")
        assert -r["imbalance_pln"] == pytest.approx(
            m.LAMBDA_PLN_PER_MWH2 * (dev**2).sum(), rel=1e-2
        )

    def test_cen_moves_against_the_farm(self):
        r = m.simulate_day()
        dev = _hours(r, "deviation_mwh")
        gap = _hours(r, "cen_pln_mwh") - _hours(r, "da_price_pln_mwh")
        assert (gap[dev > 1] < 0).all() and (gap[dev < -1] > 0).all()

    def test_bigger_error_costs_more(self):
        small = m.simulate_day(forecast_sigma_ms=0.5)["imbalance_pln"]
        big = m.simulate_day(forecast_sigma_ms=2.0)["imbalance_pln"]
        assert big < small < 0


class TestCfD:
    def test_cfd_fixes_the_price(self):
        """With a perfect forecast the farm earns exactly the strike per MWh."""
        r = m.simulate_day("winter_weekday", strike_pln_mwh=489.0, forecast_sigma_ms=0.0)
        assert r["farm_price_pln_mwh"] == pytest.approx(489.0, abs=0.1)

    def test_high_prices_claw_back(self):
        r = m.simulate_day("winter_weekday", strike_pln_mwh=489.0)
        assert r["captured_price_pln_mwh"] > 489.0
        assert r["cfd_settlement_pln"] < 0

    def test_merchant_has_no_settlement(self):
        assert m.simulate_day(include_cfd=False)["cfd_settlement_pln"] == 0


class TestBESS:
    def test_soc_within_limits_and_returns(self):
        r = m.simulate_day("calm_summer_day")
        soc = _hours(r, "bess_soc_pct")
        assert soc.min() >= 10 - 1e-6 and soc.max() <= 90 + 1e-6
        assert soc[-1] == pytest.approx(50.0, abs=0.1)
        assert np.abs(_hours(r, "bess_mw")).max() <= 50 + 1e-6

    def test_arbitrage_buys_low_sells_high(self):
        r = m.simulate_day("calm_summer_day")
        price, bess = _hours(r, "da_price_pln_mwh"), _hours(r, "bess_mw")
        assert price[bess < -1].mean() < price[bess > 1].mean()
        assert r["bess_arbitrage_pln"] > 0

    def test_flat_price_earns_nothing(self):
        _, _, margin = m.bess_arbitrage(np.full(24, 400.0))
        assert margin == pytest.approx(0.0, abs=1e-6)


class TestAPI:
    def test_day_endpoint(self):
        c = TestClient(app)
        r = c.post("/api/v1/grid/market/day", json={"scenario": "winter_weekday"})
        assert r.status_code == 200
        assert len(r.json()["hours"]) == 24
        assert c.post("/api/v1/grid/market/day", json={"scenario": "x"}).status_code == 422
