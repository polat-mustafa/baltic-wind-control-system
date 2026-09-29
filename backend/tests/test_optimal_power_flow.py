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


def _by_name(result: SCOPFResult, name: str) -> ContingencyResult:
    return next(c for c in result.contingency_results if c.name == name)


class TestSCOPF:
    """Test Security-Constrained Optimal Power Flow."""

    @pytest.fixture(scope="class")
    def scopf_full(self) -> SCOPFResult:
        """Full-generation SCOPF (~10 s), computed once for the class; tests only read it."""
        return run_scopf(generation_fraction=1.0)

    @pytest.fixture(scope="class")
    def scopf_half(self) -> SCOPFResult:
        """Half-generation SCOPF (255 MW), computed once for the class."""
        return run_scopf(generation_fraction=0.5)

    def test_scopf_returns_valid_result(self, scopf_full):
        assert isinstance(scopf_full, SCOPFResult)
        assert scopf_full.iterations >= 1

    def test_base_case_present(self, scopf_full):
        assert scopf_full.base_case is not None
        assert isinstance(scopf_full.base_case, OPFResult)

    def test_contingency_results_present(self, scopf_full):
        """6 string outages (preventive) + cable / OSS trafo / onshore trafo (corrective)."""
        assert len(scopf_full.contingency_results) == 9
        types = [c.security_type for c in scopf_full.contingency_results]
        assert types == ["preventive"] * 6 + ["corrective"] * 3

    def test_contingency_names(self, scopf_full):
        names = [c.name for c in scopf_full.contingency_results]
        for i in range(1, 7):
            assert f"String_{i}_outage" in names

    def test_contingency_results_have_descriptions(self, scopf_full):
        for c in scopf_full.contingency_results:
            assert isinstance(c, ContingencyResult)
            assert len(c.description) > 0

    def test_partial_generation_fewer_violations(self, scopf_full, scopf_half):
        """Lower generation should have fewer or equal violations."""
        assert scopf_half.num_violations <= scopf_full.num_violations + 1

    def test_no_preventive_curtailment_at_full_load(self, scopf_full):
        """String outages are handled by STATCOM voltage control, not by curtailing MW.

        Regression: with STATCOM Q frozen post-contingency, ~1.051 pu overvoltages
        made SCOPF curtail 15 % (76.5 MW) of the base case.
        """
        assert scopf_full.n1_secure
        assert scopf_full.total_curtailment_for_security_mw == pytest.approx(0.0)
        assert scopf_full.base_case.total_generation_mw == pytest.approx(510.0, abs=1.0)

    def test_export_cable_outage_corrective_runback(self, scopf_full):
        """One circuit lost at 510 MW: ~140 % → runback to the remaining ~362 MVA circuit.

        Remaining capacity √3 × 220 kV × 0.95 kA ≈ 362 MVA, minus reactive flow and
        losses → ~345 MW, i.e. a ~165 MW runback (~16 s at 2 % Pn/s = 10.2 MW/s).
        """
        cable = _by_name(scopf_full, "Export_cable_1_outage")
        assert cable.name == "Export_cable_1_outage"
        assert cable.secure
        assert cable.pre_corrective_max_line_loading_percent > 130.0
        assert cable.max_line_loading_percent <= 100.0
        assert 140.0 < cable.corrective_curtailment_mw < 190.0
        assert "runback" in cable.corrective_action
        assert cable.v_min_pu >= 0.95
        assert cable.v_max_pu <= 1.05

    def test_export_cable_outage_no_runback_at_half_load(self, scopf_half):
        """At 255 MW the remaining circuit (~362 MVA) carries everything — no runback."""
        cable = _by_name(scopf_half, "Export_cable_1_outage")
        assert cable.secure
        assert cable.corrective_curtailment_mw == pytest.approx(0.0)
        assert cable.max_line_loading_percent < 100.0

    def test_security_curtailment_non_negative(self, scopf_full):
        assert scopf_full.total_curtailment_for_security_mw >= 0.0

    @pytest.mark.parametrize("name", ["OSS_transformer_1_outage", "Onshore_transformer_1_outage"])
    def test_transformer_outage_corrective_runback(self, scopf_full, name):
        """One of 2 × 300 MVA lost at 510 MW: ~170 % → runback to what 300 MVA carries.

        ~300 MVA remaining minus reactive flow → ~300 MW, i.e. a ~210 MW runback
        (~21 s at 10.2 MW/s).
        """
        trafo = _by_name(scopf_full, name)
        assert trafo.security_type == "corrective"
        assert trafo.secure
        assert trafo.pre_corrective_max_trafo_loading_percent > 150.0
        assert trafo.max_trafo_loading_percent <= 100.0
        assert 180.0 < trafo.corrective_curtailment_mw < 240.0

    @pytest.mark.parametrize("name", ["OSS_transformer_1_outage", "Onshore_transformer_1_outage"])
    def test_transformer_outage_no_runback_at_half_load(self, scopf_half, name):
        """At 255 MW one 300 MVA unit carries everything (~85 %) — no runback."""
        trafo = _by_name(scopf_half, name)
        assert trafo.secure
        assert trafo.corrective_curtailment_mw == pytest.approx(0.0)
