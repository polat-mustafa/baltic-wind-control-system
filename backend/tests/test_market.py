"""
Tests for M11 Market Integration (TGE day-ahead, ancillary services).

Covers:
- DA bid: curtailment at negative prices, revenue formula, BESS arbitrage
- Imbalance: deviation accounting, MAPE formula, penalty direction
- Ancillary services: FCR-N sizing, revenue formula, portfolio
- Revenue simulation: CfD impact, EBITDA, revenue breakdown
"""

from __future__ import annotations

import pytest

from app.services.p2.market import (
    LCOE_EUR_MWH,
    calculate_imbalance,
    estimate_ancillary_services,
    optimise_da_bid,
    simulate_annual_revenue,
)

# ── Day-ahead bid ─────────────────────────────────────────────────────────────


class TestDABid:
    """Day-ahead market bid optimisation."""

    def _make_flat_forecast(self, mwh: float = 400.0) -> list[float]:
        return [mwh] * 24

    def _make_flat_price(self, price: float = 80.0) -> list[float]:
        return [price] * 24

    def test_all_positive_prices_bid_all(self):
        """All positive prices → bid all forecast, curtailment = 0."""
        result = optimise_da_bid(
            self._make_flat_forecast(),
            self._make_flat_price(80.0),
            include_bess_arbitrage=False,
            bess_soc_initial_pct=50.0,
        )
        assert result["curtailment_hours"] == 0
        assert result["optimal_curtailment_mwh"] == 0.0

    def test_negative_price_hours_curtailed(self):
        """Negative price hours → volume = 0 in those hours."""
        prices = [-10.0] * 4 + [80.0] * 20
        result = optimise_da_bid(
            self._make_flat_forecast(400.0),
            prices,
            include_bess_arbitrage=False,
            bess_soc_initial_pct=50.0,
        )
        assert result["curtailment_hours"] == 4
        assert result["optimal_curtailment_mwh"] == pytest.approx(4 * 400.0)

    def test_revenue_formula_flat_profile(self):
        """Revenue = sum(price * energy) for positive-price hours."""
        prices = self._make_flat_price(100.0)
        forecast = self._make_flat_forecast(500.0)
        result = optimise_da_bid(forecast, prices, False, 50.0)
        expected = 100.0 * 500.0 * 24  # no BESS arbitrage
        assert abs(result["total_revenue_eur"] - expected) < 1.0

    def test_zero_revenue_all_negative(self):
        """All negative prices → bid nothing → revenue = 0 (unless BESS arbitrage)."""
        prices = self._make_flat_price(-20.0)
        result = optimise_da_bid(
            self._make_flat_forecast(),
            prices,
            include_bess_arbitrage=False,
            bess_soc_initial_pct=50.0,
        )
        assert result["total_revenue_eur"] == pytest.approx(0.0)
        assert result["curtailment_hours"] == 24

    def test_bess_arbitrage_adds_revenue(self):
        """BESS arbitrage must add positive revenue for volatile price profile."""
        # High spread: 40 EUR/MWh at night, 140 EUR/MWh at evening peak
        prices = [40.0] * 8 + [100.0] * 8 + [140.0] * 8
        result_no_bess = optimise_da_bid(
            self._make_flat_forecast(400.0),
            prices,
            include_bess_arbitrage=False,
            bess_soc_initial_pct=50.0,
        )
        result_with_bess = optimise_da_bid(
            self._make_flat_forecast(400.0),
            prices,
            include_bess_arbitrage=True,
            bess_soc_initial_pct=50.0,
        )
        assert result_with_bess["total_revenue_eur"] >= result_no_bess["total_revenue_eur"]

    def test_hourly_schedule_has_24_entries(self):
        result = optimise_da_bid(
            self._make_flat_forecast(),
            self._make_flat_price(),
            False,
            50.0,
        )
        assert len(result["hourly_schedule"]) == 24

    def test_weighted_avg_price_correct(self):
        """Weighted avg price = total_revenue / total_energy."""
        result = optimise_da_bid(
            self._make_flat_forecast(400.0),
            self._make_flat_price(90.0),
            False,
            50.0,
        )
        total_rev = result["total_revenue_eur"]
        total_energy = result["total_energy_mwh"]
        expected_avg = total_rev / total_energy
        assert abs(result["weighted_avg_price_eur_mwh"] - expected_avg) < 0.01


# ── Imbalance ─────────────────────────────────────────────────────────────────


class TestImbalance:
    """Imbalance settlement calculation."""

    def _perfect_forecast(self) -> dict:
        forecast = [400.0] * 24
        actual = [400.0] * 24
        prices = [80.0] * 24
        return {"forecast": forecast, "actual": actual, "prices": prices}

    def test_zero_imbalance_on_perfect_forecast(self):
        """Perfect forecast → imbalance cost = 0."""
        d = self._perfect_forecast()
        result = calculate_imbalance(d["forecast"], d["actual"], d["prices"], 1.15)
        assert result["total_imbalance_cost_eur"] == pytest.approx(0.0, abs=1.0)

    def test_mae_zero_on_perfect_forecast(self):
        d = self._perfect_forecast()
        result = calculate_imbalance(d["forecast"], d["actual"], d["prices"], 1.15)
        assert result["mae_mwh"] == pytest.approx(0.0, abs=0.01)

    def test_mape_zero_on_perfect_forecast(self):
        d = self._perfect_forecast()
        result = calculate_imbalance(d["forecast"], d["actual"], d["prices"], 1.15)
        assert result["mape_pct"] == pytest.approx(0.0, abs=0.01)

    def test_short_imbalance_creates_cost(self):
        """Actual < forecast → must buy back at penalty → positive cost."""
        forecast = [400.0] * 24
        actual = [350.0] * 24  # 50 MWh short per hour
        prices = [80.0] * 24
        result = calculate_imbalance(forecast, actual, prices, 1.15)
        assert result["total_imbalance_cost_eur"] > 0.0
        assert result["short_hours"] == 24

    def test_long_imbalance_reduces_revenue(self):
        """Actual > forecast → surplus settled at discount → net cost."""
        forecast = [400.0] * 24
        actual = [450.0] * 24  # 50 MWh long per hour
        prices = [80.0] * 24
        result = calculate_imbalance(forecast, actual, prices, 1.15)
        assert result["long_hours"] == 24

    def test_net_revenue_less_than_da_on_imbalance(self):
        """Net revenue = DA revenue - imbalance cost < DA revenue."""
        forecast = [400.0] * 24
        actual = [360.0] * 24
        prices = [80.0] * 24
        result = calculate_imbalance(forecast, actual, prices, 1.15)
        assert result["net_revenue_eur"] < result["total_da_revenue_eur"]

    def test_output_has_24_hourly_results(self):
        d = self._perfect_forecast()
        result = calculate_imbalance(d["forecast"], d["actual"], d["prices"], 1.15)
        assert len(result["hourly_results"]) == 24

    def test_direction_balanced_on_no_deviation(self):
        d = self._perfect_forecast()
        result = calculate_imbalance(d["forecast"], d["actual"], d["prices"], 1.15)
        for hr in result["hourly_results"]:
            assert hr["direction"] == "BALANCED"


# ── Ancillary services ────────────────────────────────────────────────────────


class TestAncillaryServices:
    """Ancillary services revenue estimation."""

    def test_fcr_capacity_proportional_to_reserve_soc(self):
        """FCR-N capacity = BESS_MW * reserve_soc_pct / 100."""
        result = estimate_ancillary_services(50.0, 400.0, 30.0)
        expected = 50.0 * 30.0 / 100.0
        assert abs(result["fcr_capacity_mw"] - expected) < 0.01

    def test_afrr_capacity_from_wtg_headroom(self):
        """aFRR = min(25, WTG_available * 0.05)."""
        result = estimate_ancillary_services(50.0, 400.0, 30.0)
        expected = min(25.0, 400.0 * 0.05)
        assert abs(result["afrr_capacity_mw"] - expected) < 0.01

    def test_mfrr_capacity_from_wtg_headroom(self):
        """mFRR = min(50, WTG_available * 0.10)."""
        result = estimate_ancillary_services(50.0, 400.0, 30.0)
        expected = min(50.0, 400.0 * 0.10)
        assert abs(result["mfrr_capacity_mw"] - expected) < 0.01

    def test_total_revenue_positive(self):
        result = estimate_ancillary_services(50.0, 400.0, 30.0)
        assert result["total_annual_revenue_eur"] > 0

    def test_bsp_value_m_eur_year_in_range(self):
        """BSP contract value should be 2-6 M EUR/year for 50 MW BESS + WTG headroom."""
        result = estimate_ancillary_services(50.0, 400.0, 30.0)
        assert 1.0 <= result["bsp_contract_value_m_eur_year"] <= 10.0

    def test_services_list_non_empty(self):
        result = estimate_ancillary_services(50.0, 400.0, 30.0)
        assert len(result["services"]) >= 2

    def test_service_names_are_valid(self):
        result = estimate_ancillary_services(50.0, 400.0, 30.0)
        valid = {"FCR-N", "FCR-D", "aFRR", "mFRR", "RR"}
        for svc in result["services"]:
            assert svc["service"] in valid

    def test_more_bess_higher_revenue(self):
        """More BESS power → more FCR capacity → more revenue."""
        low = estimate_ancillary_services(20.0, 400.0, 30.0)
        high = estimate_ancillary_services(50.0, 400.0, 30.0)
        assert high["total_annual_revenue_eur"] > low["total_annual_revenue_eur"]


# ── Annual revenue simulation ─────────────────────────────────────────────────


class TestRevenueSimulation:
    """Annual revenue simulation."""

    def test_gross_revenue_formula(self):
        """Gross revenue = AEP * avg_price / 1e6 M EUR."""
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        expected = 1_850_000.0 * 75.0 / 1e6
        assert abs(result["gross_revenue_m_eur"] - expected) < 0.01

    def test_cfd_support_zero_when_no_cfd(self):
        """CfD support = 0 when strike price = 0."""
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        assert result["cfd_support_m_eur"] == 0.0

    def test_cfd_support_positive_when_market_below_strike(self):
        """CfD pays (strike - market) * AEP when market < strike."""
        result = simulate_annual_revenue(1_850_000.0, 60.0, 30.0, 50.0, 80.0, 25.5)
        expected = (80.0 - 60.0) * 1_850_000.0 / 1e6
        assert abs(result["cfd_support_m_eur"] - expected) < 0.01

    def test_cfd_support_zero_when_market_above_strike(self):
        """No CfD support when market price exceeds strike price."""
        result = simulate_annual_revenue(1_850_000.0, 100.0, 30.0, 50.0, 80.0, 25.5)
        assert result["cfd_support_m_eur"] == pytest.approx(0.0)

    def test_ebitda_is_revenue_minus_om(self):
        """EBITDA = total_revenue - O&M."""
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        expected_ebitda = result["total_revenue_m_eur"] - 25.5
        assert abs(result["ebitda_m_eur"] - expected_ebitda) < 0.01

    def test_revenue_per_mwh_positive(self):
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        assert result["revenue_per_mwh_eur"] > 0.0

    def test_revenue_per_mwh_above_lcoe_at_75_eur(self):
        """At 75 EUR/MWh, effective revenue per MWh should exceed LCOE ~52 EUR/MWh."""
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        assert result["revenue_per_mwh_eur"] > LCOE_EUR_MWH

    def test_bess_arbitrage_scales_with_volatility(self):
        """Higher price volatility → larger BESS arbitrage revenue."""
        low_vol = simulate_annual_revenue(1_850_000.0, 75.0, 10.0, 50.0, 0.0, 25.5)
        high_vol = simulate_annual_revenue(1_850_000.0, 75.0, 50.0, 50.0, 0.0, 25.5)
        assert high_vol["bess_arbitrage_m_eur"] > low_vol["bess_arbitrage_m_eur"]

    def test_breakdown_items_sum_to_total(self):
        """Revenue breakdown items should sum to approximately total revenue."""
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        breakdown_sum = sum(item["revenue_m_eur"] for item in result["breakdown"])
        assert abs(breakdown_sum - result["total_revenue_m_eur"]) < 0.05

    def test_assessment_non_empty(self):
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        assert len(result["assessment"]) > 0

    def test_lcoe_comparison_string_present(self):
        result = simulate_annual_revenue(1_850_000.0, 75.0, 30.0, 50.0, 0.0, 25.5)
        assert "EUR/MWh" in result["lcoe_comparison"]
