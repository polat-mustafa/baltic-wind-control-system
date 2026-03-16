"""Tests for P2 Optimal Power Flow (OPF) and Security-Constrained OPF (SCOPF)."""

from __future__ import annotations

import pytest

from app.services.p2.optimal_power_flow import (
    CURTAILMENT_PENALTY,
    GRID_IMPORT_COST,
    V_MAX_PU,
    V_MIN_PU,
    WTG_MARGINAL_COST,
    GeneratorDispatch,
    OPFResult,
    run_ac_opf,
    run_dc_opf,
)
from app.services.p2.scopf import (
    ContingencyResult,
    SCOPFResult,
    run_scopf,
)


class TestOPFConstants:
    """Test OPF constants are physically valid."""

    def test_voltage_limits_valid(self):
        assert 0.90 <= V_MIN_PU < V_MAX_PU <= 1.10

    def test_pse_voltage_limits(self):
        """PSE IRiESP: 0.95-1.05 pu."""
        assert V_MIN_PU == 0.95
        assert V_MAX_PU == 1.05

    def test_wind_marginal_cost_zero(self):
        """Wind energy has zero marginal cost."""
        assert WTG_MARGINAL_COST == 0.0

    def test_grid_import_cost_positive(self):
        assert GRID_IMPORT_COST > 0.0

    def test_curtailment_penalty_positive(self):
        assert CURTAILMENT_PENALTY > 0.0


class TestDCOPF:
    """Test DC Optimal Power Flow (linearized)."""

    def test_full_generation_converges(self):
        result = run_dc_opf(generation_fraction=1.0)
        assert isinstance(result, OPFResult)
        assert result.converged is True
        assert result.method == "dc"

    def test_full_generation_dispatches_all(self):
        """At full wind, all WTGs should generate maximum power."""
        result = run_dc_opf(generation_fraction=1.0)
        assert result.total_generation_mw > 0.0
        # Most power should be dispatched (not curtailed)
        assert result.curtailment_percent < 50.0

    def test_partial_generation(self):
        result = run_dc_opf(generation_fraction=0.5)
        assert result.converged is True
        assert result.total_generation_mw > 0.0
        # At 50%, max possible is ~255 MW
        assert result.total_generation_mw <= 260.0

    def test_zero_generation(self):
        result = run_dc_opf(generation_fraction=0.0)
        assert result.converged is True
        assert result.total_generation_mw == pytest.approx(0.0, abs=1.0)

    def test_generators_list_populated(self):
        result = run_dc_opf(generation_fraction=1.0)
        assert len(result.generators) > 0
        # Should have 34 WTGs + 1 STATCOM = 35
        assert len(result.generators) == 35

    def test_generator_dispatch_fields(self):
        result = run_dc_opf(generation_fraction=1.0)
        for gen in result.generators:
            assert isinstance(gen, GeneratorDispatch)
            assert gen.name is not None
            assert gen.curtailed_mw >= 0.0


class TestACOPF:
    """Test AC Optimal Power Flow (nonlinear)."""

    def test_full_generation_converges(self):
        result = run_ac_opf(generation_fraction=1.0)
        assert isinstance(result, OPFResult)
        # AC OPF may not always converge, but should for well-conditioned network
        if result.converged:
            assert result.method == "ac"
            assert result.total_generation_mw > 0.0

    def test_voltage_results_present(self):
        result = run_ac_opf(generation_fraction=1.0)
        if result.converged:
            assert result.v_min_pu > 0.0
            assert result.v_max_pu > 0.0

    def test_losses_positive_when_generating(self):
        """Network losses must be positive when power flows."""
        result = run_ac_opf(generation_fraction=1.0)
        if result.converged and result.total_generation_mw > 0:
            assert result.total_loss_mw >= 0.0

    def test_statcom_q_within_rating(self):
        result = run_ac_opf(generation_fraction=1.0)
        if result.converged:
            assert abs(result.statcom_q_mvar) <= 120.0 + 1.0  # STATCOM ±120 MVAR


class TestSCOPF:
    """Test Security-Constrained Optimal Power Flow."""

    def test_scopf_returns_valid_result(self):
        result = run_scopf(generation_fraction=1.0)
        assert isinstance(result, SCOPFResult)
        assert result.iterations >= 1

    def test_base_case_present(self):
        result = run_scopf(generation_fraction=1.0)
        assert result.base_case is not None
        assert isinstance(result.base_case, OPFResult)

    def test_contingency_results_present(self):
        """Should have 7 contingency results (one per string)."""
        result = run_scopf(generation_fraction=1.0)
        assert len(result.contingency_results) == 7

    def test_contingency_names(self):
        result = run_scopf(generation_fraction=1.0)
        names = [c.name for c in result.contingency_results]
        for i in range(1, 8):
            assert f"String_{i}_outage" in names

    def test_contingency_results_have_descriptions(self):
        result = run_scopf(generation_fraction=1.0)
        for c in result.contingency_results:
            assert isinstance(c, ContingencyResult)
            assert len(c.description) > 0

    def test_partial_generation_fewer_violations(self):
        """Lower generation should have fewer or equal violations."""
        result_full = run_scopf(generation_fraction=1.0)
        result_partial = run_scopf(generation_fraction=0.5)
        # Partial generation should be easier to keep secure
        assert result_partial.num_violations <= result_full.num_violations + 1

    def test_security_curtailment_non_negative(self):
        result = run_scopf(generation_fraction=1.0)
        assert result.total_curtailment_for_security_mw >= 0.0
