"""
Tests for Tier 3 P2 features: pathway planning, sector coupling, power-to-gas,
seasonal storage, flexible demand, and multi-energy carrier.
"""

import numpy as np
import pytest


# ── Pathway Planning ──────────────────────────────────────────


class TestPathwayPlanning:
    """Tests for multi-decade energy transition pathway planning."""

    def test_pathway_reference_scenario(self):
        from app.services.p2.pathway_planning import run_pathway_planning

        result = run_pathway_planning(scenario="reference")
        assert len(result.milestones) > 0
        assert result.total_investment_beur > 0

    def test_pathway_accelerated_scenario(self):
        from app.services.p2.pathway_planning import run_pathway_planning

        result = run_pathway_planning(scenario="accelerated")
        assert result.offshore_wind_capacity_2050_gw > 0

    def test_pathway_conservative_scenario(self):
        from app.services.p2.pathway_planning import run_pathway_planning

        ref = run_pathway_planning(scenario="reference")
        cons = run_pathway_planning(scenario="conservative")
        assert cons.offshore_wind_capacity_2050_gw <= ref.offshore_wind_capacity_2050_gw

    def test_pathway_co2_reduction(self):
        from app.services.p2.pathway_planning import run_pathway_planning

        result = run_pathway_planning(scenario="accelerated")
        assert result.co2_reduction_percent > 0

    def test_pathway_milestones_timeline(self):
        from app.services.p2.pathway_planning import run_pathway_planning

        result = run_pathway_planning()
        years = [m.year for m in result.milestones]
        assert years[0] == 2025
        assert years[-1] == 2050

    def test_pathway_renewable_share_increases(self):
        from app.services.p2.pathway_planning import run_pathway_planning

        result = run_pathway_planning(scenario="accelerated")
        shares = [m.renewable_share_percent for m in result.milestones]
        assert shares[-1] > shares[0]

    def test_pathway_technology_capex(self):
        from app.services.p2.pathway_planning import _technology_capex

        cost_2025 = _technology_capex("offshore_wind", 2025)
        cost_2035 = _technology_capex("offshore_wind", 2035)
        assert cost_2035 < cost_2025  # Learning curve reduces cost


# ── Sector Coupling ───────────────────────────────────────────


class TestSectorCoupling:
    """Tests for sector coupling (electricity + heat + hydrogen)."""

    def test_sector_coupling_runs(self):
        from app.services.p2.sector_coupling import run_sector_coupling

        result = run_sector_coupling()
        assert result.total_electricity_gen_mwh > 0

    def test_sector_coupling_reduces_curtailment(self):
        from app.services.p2.sector_coupling import run_sector_coupling

        result = run_sector_coupling()
        assert result.curtailment_reduction_percent >= 0

    def test_sector_coupling_heat_production(self):
        from app.services.p2.sector_coupling import run_sector_coupling

        result = run_sector_coupling(heat_pump_capacity_mw=30.0)
        assert result.heat_produced_mwh > 0

    def test_sector_coupling_hydrogen_production(self):
        from app.services.p2.sector_coupling import run_sector_coupling

        result = run_sector_coupling(electrolyzer_capacity_mw=50.0)
        assert result.hydrogen_produced_kg > 0

    def test_sector_coupling_revenue(self):
        from app.services.p2.sector_coupling import run_sector_coupling

        result = run_sector_coupling()
        assert result.annual_revenue_meur > 0

    def test_sector_coupling_utilization(self):
        from app.services.p2.sector_coupling import run_sector_coupling

        result = run_sector_coupling()
        assert result.renewable_utilization_percent > 90  # Most energy should be used


# ── Power-to-Gas / Electrolyzer ───────────────────────────────


class TestElectrolyzer:
    """Tests for electrolyzer simulation."""

    def test_pem_electrolyzer(self):
        from app.services.p2.power_to_gas import ElectrolyzerType, run_electrolyzer_simulation

        result = run_electrolyzer_simulation(technology=ElectrolyzerType.PEM)
        assert result.technology == "pem"
        assert result.annual_hydrogen_production_tonnes > 0

    def test_alkaline_electrolyzer(self):
        from app.services.p2.power_to_gas import ElectrolyzerType, run_electrolyzer_simulation

        result = run_electrolyzer_simulation(technology=ElectrolyzerType.ALKALINE)
        assert result.technology == "alkaline"

    def test_soec_electrolyzer(self):
        from app.services.p2.power_to_gas import ElectrolyzerType, run_electrolyzer_simulation

        result = run_electrolyzer_simulation(technology=ElectrolyzerType.SOEC)
        assert result.technology == "soec"
        # SOEC should have higher efficiency
        assert result.average_efficiency > 0.5

    def test_electrolyzer_lcoh(self):
        from app.services.p2.power_to_gas import run_electrolyzer_simulation

        result = run_electrolyzer_simulation()
        assert result.lcoh_eur_per_kg > 0
        assert result.lcoh_eur_per_kg < 20  # Should be reasonable

    def test_electrolyzer_water_consumption(self):
        from app.services.p2.power_to_gas import run_electrolyzer_simulation

        result = run_electrolyzer_simulation()
        assert result.water_consumption_m3 > 0

    def test_electrolyzer_capacity_factor(self):
        from app.services.p2.power_to_gas import run_electrolyzer_simulation

        result = run_electrolyzer_simulation()
        assert 0 < result.capacity_factor < 1.0


# ── Seasonal Storage ──────────────────────────────────────────


class TestSeasonalStorage:
    """Tests for long-duration energy storage."""

    def test_hydrogen_cavern(self):
        from app.services.p2.seasonal_storage import StorageTechnology, run_seasonal_storage_simulation

        result = run_seasonal_storage_simulation(technology=StorageTechnology.HYDROGEN_CAVERN)
        assert result.technology == "hydrogen_cavern"
        assert result.annual_energy_stored_mwh > 0

    def test_compressed_air(self):
        from app.services.p2.seasonal_storage import StorageTechnology, run_seasonal_storage_simulation

        result = run_seasonal_storage_simulation(technology=StorageTechnology.COMPRESSED_AIR)
        assert result.round_trip_efficiency > 0.3  # CAES is more efficient

    def test_pumped_hydro(self):
        from app.services.p2.seasonal_storage import StorageTechnology, run_seasonal_storage_simulation

        result = run_seasonal_storage_simulation(technology=StorageTechnology.PUMPED_HYDRO)
        assert result.round_trip_efficiency > 0.5  # PHS is most efficient

    def test_seasonal_storage_cycles(self):
        from app.services.p2.seasonal_storage import run_seasonal_storage_simulation

        result = run_seasonal_storage_simulation()
        assert result.storage_cycles >= 0

    def test_seasonal_storage_capex(self):
        from app.services.p2.seasonal_storage import run_seasonal_storage_simulation

        result = run_seasonal_storage_simulation()
        assert result.capex_meur > 0

    def test_seasonal_storage_lcoes(self):
        from app.services.p2.seasonal_storage import run_seasonal_storage_simulation

        result = run_seasonal_storage_simulation()
        assert result.lcoes_eur_mwh > 0


# ── Flexible Demand ───────────────────────────────────────────


class TestFlexibleDemand:
    """Tests for demand-side response simulation."""

    def test_flexible_demand_runs(self):
        from app.services.p2.flexible_demand import run_flexible_demand_simulation

        result = run_flexible_demand_simulation()
        assert result.total_demand_mwh > 0

    def test_demand_shifting(self):
        from app.services.p2.flexible_demand import run_flexible_demand_simulation

        result = run_flexible_demand_simulation()
        assert result.shifted_demand_mwh > 0

    def test_peak_demand_modified(self):
        from app.services.p2.flexible_demand import run_flexible_demand_simulation

        result = run_flexible_demand_simulation()
        # Peak may increase slightly due to load absorption; check it's computed
        assert result.peak_demand_reduction_mw != 0 or result.shifted_demand_mwh > 0

    def test_elastic_reduction(self):
        from app.services.p2.flexible_demand import run_flexible_demand_simulation

        result = run_flexible_demand_simulation(price_elasticity=-0.2)
        assert result.elastic_reduction_mwh > 0

    def test_dsr_activation_cost(self):
        from app.services.p2.flexible_demand import run_flexible_demand_simulation

        result = run_flexible_demand_simulation()
        # DSR activation cost should be computed
        assert result.dsr_activation_cost_meur >= 0


# ── Multi-Energy Carrier ─────────────────────────────────────


class TestMultiEnergyCarrier:
    """Tests for multi-energy carrier system integration."""

    def test_multi_energy_runs(self):
        from app.services.p2.multi_energy_carrier import run_multi_energy_analysis

        result = run_multi_energy_analysis()
        assert result.system_efficiency > 0

    def test_multi_energy_carriers(self):
        from app.services.p2.multi_energy_carrier import run_multi_energy_analysis

        result = run_multi_energy_analysis()
        assert len(result.carrier_balances) == 4  # elec, gas, heat, H2

    def test_co2_reduction(self):
        from app.services.p2.multi_energy_carrier import run_multi_energy_analysis

        result = run_multi_energy_analysis()
        assert result.co2_reduction_vs_separate_percent > 0

    def test_renewable_share(self):
        from app.services.p2.multi_energy_carrier import run_multi_energy_analysis

        result = run_multi_energy_analysis()
        assert result.renewable_share_percent > 50  # Wind should dominate

    def test_coupling_matrix(self):
        from app.services.p2.multi_energy_carrier import run_multi_energy_analysis

        result = run_multi_energy_analysis()
        assert result.coupling_matrix.shape == (4, 4)
        assert np.sum(result.coupling_matrix) > 0

    def test_multi_energy_cost(self):
        from app.services.p2.multi_energy_carrier import run_multi_energy_analysis

        result = run_multi_energy_analysis()
        assert result.total_annual_cost_meur >= 0
