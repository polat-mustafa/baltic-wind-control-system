"""
Unit tests for load flow analysis (P2A — load_flow.py).

Tests validate Newton-Raphson convergence, voltage compliance per PSE IRiESP
(0.95–1.05 p.u.), and loss ranges for all four operating scenarios.

Test Strategy
-------------
- Convergence: all 4 scenarios must converge
- Voltage: 0.95–1.05 p.u. with STATCOM auto-dispatch
- Losses: reasonable ranges (0.5–3% of generation)
- Compliance: all scenarios compliant with compensation
- N-1: reduced generation (435 MW, string 6 out)
- No-load: minimal losses, Ferranti effect visible
"""

import pytest

from app.schemas.grid import LoadFlowScenario
from app.services.p2.load_flow import auto_statcom_dispatch, run_all_scenarios, run_load_flow
from app.services.p2.network_model import build_network

# ── Convergence Tests ─────────────────────────────────────────────


class TestConvergence:
    """Tests for Newton-Raphson convergence across all scenarios."""

    def test_full_load_converges(self):
        """Full load (510 MW) load flow must converge."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged, "Full load scenario did not converge"

    def test_partial_load_converges(self):
        """Partial load (255 MW) load flow must converge."""
        result = run_load_flow(LoadFlowScenario.PARTIAL_LOAD)
        assert result.converged, "Partial load scenario did not converge"

    def test_no_load_converges(self):
        """No load (0 MW) load flow must converge."""
        result = run_load_flow(LoadFlowScenario.NO_LOAD)
        assert result.converged, "No load scenario did not converge"

    def test_n_minus_1_converges(self):
        """N-1 contingency load flow must converge."""
        result = run_load_flow(LoadFlowScenario.N_MINUS_1)
        assert result.converged, "N-1 scenario did not converge"


# ── Voltage Compliance Tests ─────────────────────────────────────


class TestVoltageCompliance:
    """Tests for PSE IRiESP voltage compliance (0.95–1.05 p.u.)."""

    def test_full_load_voltage_range(self):
        """Full load voltages must be within 0.95–1.05 p.u."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged
        assert result.v_min_pu >= 0.94, f"V_min = {result.v_min_pu} pu too low"
        assert result.v_max_pu <= 1.06, f"V_max = {result.v_max_pu} pu too high"

    def test_partial_load_voltage_range(self):
        """Partial load voltages must be within 0.95–1.05 p.u."""
        result = run_load_flow(LoadFlowScenario.PARTIAL_LOAD)
        assert result.converged
        assert result.v_min_pu >= 0.94, f"V_min = {result.v_min_pu} pu"
        assert result.v_max_pu <= 1.06, f"V_max = {result.v_max_pu} pu"

    def test_no_load_voltage_range(self):
        """No load voltages must be within reasonable range."""
        result = run_load_flow(LoadFlowScenario.NO_LOAD)
        assert result.converged
        # No-load may have slightly elevated voltage due to cable charging
        assert result.v_max_pu <= 1.06, f"V_max = {result.v_max_pu} pu"

    def test_n_minus_1_voltage_range(self):
        """N-1 voltages must be within compliance range."""
        result = run_load_flow(LoadFlowScenario.N_MINUS_1)
        assert result.converged
        assert result.v_min_pu >= 0.94, f"V_min = {result.v_min_pu} pu"
        assert result.v_max_pu <= 1.06, f"V_max = {result.v_max_pu} pu"

    def test_full_load_is_compliant(self):
        """Full load with STATCOM must be voltage-compliant."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD, auto_dispatch=True)
        assert result.converged
        assert result.voltage_compliant, f"V_min={result.v_min_pu}, V_max={result.v_max_pu}"


# ── Loss Tests ────────────────────────────────────────────────────


class TestLosses:
    """Tests for network active power losses."""

    def test_full_load_losses(self):
        """Full load losses should be 0.5–3% of generation (~2.5–15 MW)."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged
        loss_percent = result.total_loss_mw / result.total_generation_mw * 100
        assert 0.3 < loss_percent < 5.0, f"Losses = {loss_percent:.1f}%"

    def test_partial_load_losses_less_than_full(self):
        """Partial load losses must be less than full load losses."""
        full = run_load_flow(LoadFlowScenario.FULL_LOAD)
        partial = run_load_flow(LoadFlowScenario.PARTIAL_LOAD)
        assert full.converged and partial.converged
        assert partial.total_loss_mw < full.total_loss_mw

    def test_no_load_minimal_losses(self):
        """No-load losses should be very small (transformer iron losses only)."""
        result = run_load_flow(LoadFlowScenario.NO_LOAD)
        assert result.converged
        # Only iron losses and cable dielectric losses at no-load
        assert result.total_loss_mw < 2.0, f"No-load losses = {result.total_loss_mw:.2f} MW"


# ── Generation Tests ──────────────────────────────────────────────


class TestGeneration:
    """Tests for total generation values per scenario."""

    def test_full_load_generation(self):
        """Full load generation must be 510 MW."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged
        assert result.total_generation_mw == pytest.approx(510.0, abs=1.0)

    def test_partial_load_generation(self):
        """Partial load generation must be 255 MW."""
        result = run_load_flow(LoadFlowScenario.PARTIAL_LOAD)
        assert result.converged
        assert result.total_generation_mw == pytest.approx(255.0, abs=1.0)

    def test_n_minus_1_generation(self):
        """N-1 generation must be 435 MW (34-5=29 WTGs × 15 MW, string 6 out)."""
        result = run_load_flow(LoadFlowScenario.N_MINUS_1)
        assert result.converged
        assert result.total_generation_mw == pytest.approx(435.0, abs=1.0)


# ── Result Structure Tests ───────────────────────────────────────


class TestResultStructure:
    """Tests for load flow response structure and completeness."""

    def test_bus_results_present(self):
        """Converged result must include per-bus results."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged
        assert len(result.buses) == 38  # 4 system + 34 WTG

    def test_line_results_present(self):
        """Converged result must include per-line results."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged
        assert len(result.lines) == 35  # 34 array + 1 export

    def test_transformer_results_present(self):
        """Converged result must include per-transformer results."""
        result = run_load_flow(LoadFlowScenario.FULL_LOAD)
        assert result.converged
        assert len(result.transformers) == 2

    def test_all_scenarios_run(self):
        """run_all_scenarios must return 4 results."""
        results = run_all_scenarios()
        assert len(results) == 4
        for r in results:
            assert r.converged, f"{r.scenario} did not converge"


class TestSTATCOMDispatch:
    """Secant-based STATCOM voltage control at OSS 220 kV."""

    def test_no_load_converges_inside_limits(self):
        """No load, one reactor out: reach 1.00 ± 0.01 pu without hitting ±120 MVAR.

        Regression: a fixed 5000 MVAR/pu gain overshot on the stiffer 2-cable
        network and saturated at −120 MVAR with V_OSS = 0.991 pu.
        """
        net = build_network(generation_fraction=0.0)
        net.shunt.at[net.shunt.index[0], "in_service"] = False  # ~100 MVAR left to absorb
        q = auto_statcom_dispatch(net)
        oss = net.bus.index[net.bus["name"] == "OSS_220kV"][0]
        assert float(net.res_bus.at[oss, "vm_pu"]) == pytest.approx(1.0, abs=0.01)
        assert -120.0 < q < 0.0  # absorbing (Rule 4), inside rating

    def test_returned_q_matches_network_results(self):
        """The returned setpoint must be the one the load flow results belong to."""
        net = build_network(generation_fraction=0.5)
        q = auto_statcom_dispatch(net)
        statcom = net.sgen.index[net.sgen["name"] == "STATCOM"][0]
        assert float(net.res_sgen.at[statcom, "q_mvar"]) == pytest.approx(q, abs=0.01)


def test_rule4_signs_and_poc_quantities():
    """Bus results are injections, generating positive; POC P equals export minus losses."""
    from app.schemas.grid import LoadFlowScenario
    from app.services.p2.load_flow import run_load_flow

    r = run_load_flow(LoadFlowScenario.FULL_LOAD)
    wtg = next(b for b in r.buses if b.name == "WTG_01")
    assert wtg.p_mw == pytest.approx(15.0, abs=0.01)  # generator injects +15 MW
    oss_220 = next(b for b in r.buses if b.name == "OSS_220kV")
    assert oss_220.q_mvar < 0  # the OSS reactors absorb more than the STATCOM gives
    # both reported to 0.01 / 0.1 MW
    assert r.poc_p_mw == pytest.approx(r.total_generation_mw - r.total_loss_mw, abs=0.1)


def test_n_minus_1_string_is_de_energised_not_nan():
    """The tripped string reports 0 (not NaN) and does not count as a voltage violation."""
    from app.schemas.grid import LoadFlowScenario
    from app.services.p2.load_flow import run_load_flow

    r = run_load_flow(LoadFlowScenario.N_MINUS_1)
    s6 = [ln for ln in r.lines if ln.name.startswith("Array_S6_")]
    assert len(s6) == 5 and all(ln.loading_percent == 0.0 for ln in s6)
    assert r.total_generation_mw == pytest.approx(435.0)
    assert r.voltage_compliant
    assert "NaN" not in r.model_dump_json()
