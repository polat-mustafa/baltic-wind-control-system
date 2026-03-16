"""
Tests for Tier 2 P2 features: DC power flow, economic dispatch,
BESS, AC-DC comparison, and capacity expansion planning.
"""

import numpy as np
import pytest


# ── DC Power Flow ───────────────────────────────────────────────


class TestDCPowerFlow:
    """Tests for DC (linearized) power flow."""

    def test_dc_power_flow_converges(self):
        from app.services.p2.dc_power_flow import run_dc_power_flow

        result = run_dc_power_flow(generation_fraction=1.0)
        assert result.converged is True

    def test_dc_power_flow_generation(self):
        from app.services.p2.dc_power_flow import run_dc_power_flow

        result = run_dc_power_flow(generation_fraction=1.0)
        assert result.total_generation_mw > 400.0  # 34 × 15 = 510 MW

    def test_dc_power_flow_half_load(self):
        from app.services.p2.dc_power_flow import run_dc_power_flow

        result = run_dc_power_flow(generation_fraction=0.5)
        assert result.converged is True
        assert result.total_generation_mw < 300.0

    def test_dc_power_flow_line_results(self):
        from app.services.p2.dc_power_flow import run_dc_power_flow

        result = run_dc_power_flow(generation_fraction=1.0)
        assert len(result.line_results) > 0
        assert all(lr.loading_percent >= 0 for lr in result.line_results)

    def test_dc_power_flow_bus_angles(self):
        from app.services.p2.dc_power_flow import run_dc_power_flow

        result = run_dc_power_flow(generation_fraction=1.0)
        assert len(result.bus_angles_deg) > 0

    def test_dc_contingency_screening(self):
        from app.services.p2.dc_power_flow import run_dc_contingency_screening

        result = run_dc_contingency_screening(generation_fraction=1.0)
        assert result.n_contingencies == 7  # 7 strings
        assert result.n_secure + result.n_violations == result.n_contingencies

    def test_dc_contingency_worst_case(self):
        from app.services.p2.dc_power_flow import run_dc_contingency_screening

        result = run_dc_contingency_screening(generation_fraction=1.0)
        assert result.worst_contingency != ""
        assert result.worst_loading_percent > 0


# ── Economic Dispatch ───────────────────────────────────────────


class TestEconomicDispatch:
    """Tests for 24-hour economic dispatch."""

    def test_wind_forecast_shape(self):
        from app.services.p2.economic_dispatch import generate_wind_forecast

        forecast = generate_wind_forecast()
        assert len(forecast) == 24
        assert all(f >= 0 for f in forecast)

    def test_wind_forecast_range(self):
        from app.services.p2.economic_dispatch import generate_wind_forecast

        forecast = generate_wind_forecast(mean_speed_ms=10.5)
        assert float(np.max(forecast)) <= 510.0
        assert float(np.mean(forecast)) > 50.0

    def test_dispatch_24_hours(self):
        from app.services.p2.economic_dispatch import run_economic_dispatch

        result = run_economic_dispatch()
        assert len(result.timesteps) == 24

    def test_dispatch_generation_positive(self):
        from app.services.p2.economic_dispatch import run_economic_dispatch

        result = run_economic_dispatch()
        assert result.total_generation_mwh > 0

    def test_dispatch_ramp_compliance(self):
        from app.services.p2.economic_dispatch import run_economic_dispatch

        result = run_economic_dispatch()
        # Most timesteps should be ramp compliant
        compliant = sum(1 for ts in result.timesteps if ts.ramp_compliant)
        assert compliant >= 20  # At least 20/24 compliant

    def test_dispatch_curtailment_order(self):
        from app.services.p2.economic_dispatch import run_economic_dispatch

        result = run_economic_dispatch(curtailment_order_mw=200.0)
        # All dispatched power should be <= 200 MW
        for ts in result.timesteps:
            assert ts.wind_power_dispatched_mw <= 200.1  # Small tolerance

    def test_dispatch_capacity_factor(self):
        from app.services.p2.economic_dispatch import run_economic_dispatch

        result = run_economic_dispatch()
        assert 0.0 < result.capacity_factor < 1.0


# ── Battery Energy Storage ──────────────────────────────────────


class TestBESS:
    """Tests for battery energy storage dispatch."""

    def test_bess_dispatch_runs(self):
        from app.services.p2.energy_storage import run_bess_dispatch

        wind = np.array([300.0] * 24)
        result = run_bess_dispatch(wind_power_mw=wind)
        assert len(result.timesteps) == 24

    def test_bess_soc_bounds(self):
        from app.services.p2.energy_storage import run_bess_dispatch

        wind = np.array([300.0] * 24)
        result = run_bess_dispatch(wind_power_mw=wind)
        for ts in result.timesteps:
            assert 0.05 <= ts.soc <= 0.95  # Within SoC limits (with tolerance)

    def test_bess_revenue_non_negative(self):
        from app.services.p2.energy_storage import run_bess_dispatch

        wind = np.array([300.0] * 24)
        result = run_bess_dispatch(wind_power_mw=wind)
        assert result.total_revenue_eur > 0

    def test_bess_curtailment_reduction(self):
        from app.services.p2.energy_storage import run_bess_dispatch

        # Scenario with excess wind (above grid limit)
        wind = np.array([600.0] * 24)  # Over 510 MW limit
        result = run_bess_dispatch(
            wind_power_mw=wind,
            grid_export_limit_mw=510.0,
            bess_power_mw=100.0,
            bess_energy_mwh=400.0,
        )
        assert result.curtailment_without_bess_mwh > 0
        assert result.curtailment_reduction_mwh >= 0

    def test_bess_cycles_reasonable(self):
        from app.services.p2.energy_storage import run_bess_dispatch

        wind = np.array([300.0] * 24)
        result = run_bess_dispatch(wind_power_mw=wind)
        assert result.bess_cycles >= 0
        assert result.bess_cycles < 5.0  # Max ~2-3 cycles per day


# ── AC-DC Comparison ────────────────────────────────────────────


class TestACDCComparison:
    """Tests for HVAC/HVDC export technology comparison."""

    def test_three_options(self):
        from app.services.p2.ac_dc_network import compare_export_options

        result = compare_export_options()
        assert len(result.options) == 3

    def test_hvac_no_converter_loss(self):
        from app.services.p2.ac_dc_network import compare_export_options

        result = compare_export_options()
        hvac = next(o for o in result.options if o.technology == "HVAC")
        assert hvac.converter_loss_mw == 0.0

    def test_hvdc_no_reactive_compensation(self):
        from app.services.p2.ac_dc_network import compare_export_options

        result = compare_export_options()
        hvdc = next(o for o in result.options if o.technology == "HVDC-VSC")
        assert hvdc.reactive_compensation_mvar == 0.0

    def test_recommendation_exists(self):
        from app.services.p2.ac_dc_network import compare_export_options

        result = compare_export_options(cable_length_km=45.0)
        assert result.recommended in ("HVAC", "HVDC-VSC", "Hybrid")

    def test_short_cable_recommends_hvac(self):
        from app.services.p2.ac_dc_network import compare_export_options

        result = compare_export_options(cable_length_km=30.0)
        assert result.recommended == "HVAC"

    def test_long_cable_recommends_hvdc(self):
        from app.services.p2.ac_dc_network import compare_export_options

        result = compare_export_options(cable_length_km=150.0)
        assert result.recommended == "HVDC-VSC"

    def test_losses_positive(self):
        from app.services.p2.ac_dc_network import compare_export_options

        result = compare_export_options()
        for opt in result.options:
            assert opt.total_loss_mw > 0


# ── Capacity Expansion Planning ─────────────────────────────────


class TestCapacityExpansion:
    """Tests for multi-project capacity expansion planning."""

    def test_five_phases(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion()
        assert len(result.phases) == 5

    def test_total_capacity(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion()
        assert result.total_capacity_mw == 2550.0  # 5 × 510

    def test_lcoe_positive(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion()
        assert result.portfolio_lcoe_eur_mwh > 0
        for phase in result.phases:
            assert phase.lcoe_eur_mwh > 0

    def test_technology_learning(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion()
        # Later phases should have lower CAPEX per MW (technology learning)
        capex_per_mw = [p.capex_meur / p.capacity_mw for p in result.phases]
        assert capex_per_mw[-1] < capex_per_mw[0]

    def test_bess_in_later_phases(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion(include_bess=True)
        # P1 and P2 should have no BESS, P3+ should
        assert result.phases[0].bess_mwh == 0.0
        assert result.phases[1].bess_mwh == 0.0
        assert result.phases[2].bess_mwh > 0

    def test_no_bess_option(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion(include_bess=False)
        assert result.total_bess_mwh == 0.0

    def test_npv_positive(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion(electricity_price_eur_mwh=72.0)
        # At least some phases should have positive NPV
        positive_npv_count = sum(1 for p in result.phases if p.npv_meur > 0)
        assert positive_npv_count > 0

    def test_buildout_years(self):
        from app.services.p2.capacity_expansion import plan_capacity_expansion

        result = plan_capacity_expansion()
        assert result.buildout_years > 0
        assert result.buildout_years <= 12  # 5 projects, ~2 years apart
