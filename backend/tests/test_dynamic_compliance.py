"""
Unit tests for dynamic compliance orchestrator (P2B — dynamic_compliance.py).

Tests validate the full NC RfG Type D compliance report generation
with all sub-checks populated and overall_compliant verdict correct.

Test Strategy
-------------
- Full report: all fields populated (LVRT, HVRT, frequency, SSO, converter)
- Overall compliant: True for nominal case (strong grid, 510 MW)
- Individual checks: each sub-result has correct type
- Frequency modes: all 4 modes present
"""

import pytest

from app.schemas.grid import FrequencyMode, FRTType, SSOGRiskLevel
from app.services.p2.dynamic_compliance import run_full_compliance_assessment


class TestFullComplianceReport:
    """Tests for complete NC RfG Type D dynamic compliance report."""

    @pytest.fixture(scope="class")
    def compliance_report(self):
        """Run full compliance assessment once for all tests in this class.

        This is expensive (runs all P2B simulations), so we cache the result.
        """
        return run_full_compliance_assessment(
            export_length_km=45.0,
            grid_ssc_mva=10_000.0,
            generation_fraction=1.0,
        )

    def test_lvrt_populated(self, compliance_report):
        """LVRT result must be populated with correct type."""
        assert compliance_report.lvrt.frt_type == FRTType.LVRT

    def test_hvrt_populated(self, compliance_report):
        """HVRT result must be populated with correct type."""
        assert compliance_report.hvrt.frt_type == FRTType.HVRT

    def test_lfsm_o_populated(self, compliance_report):
        """LFSM-O result must be populated with correct mode."""
        assert compliance_report.lfsm_o.mode == FrequencyMode.LFSM_O

    def test_lfsm_u_populated(self, compliance_report):
        """LFSM-U result must be populated with correct mode."""
        assert compliance_report.lfsm_u.mode == FrequencyMode.LFSM_U

    def test_fsm_populated(self, compliance_report):
        """FSM result must be populated with correct mode."""
        assert compliance_report.fsm.mode == FrequencyMode.FSM

    def test_rocof_populated(self, compliance_report):
        """RoCoF result must be populated with correct mode."""
        assert compliance_report.rocof.mode == FrequencyMode.ROCOF

    def test_sso_populated(self, compliance_report):
        """SSO screening result must be populated."""
        assert compliance_report.sso.resonance_frequency_hz > 0
        assert compliance_report.sso.risk_level in list(SSOGRiskLevel)

    def test_converter_comparison_populated(self, compliance_report):
        """Converter comparison must be populated."""
        assert len(compliance_report.converter_comparison.gfm_advantage) > 0

    def test_overall_compliant_for_nominal(self, compliance_report):
        """Overall compliance must be True for nominal strong-grid case.

        With SCR ≈ 19.6, 510 MW, standard 45 km export cable, all NC RfG
        Type D checks should pass.
        """
        assert compliance_report.overall_compliant, (
            "Overall compliance FAILED for nominal case — "
            f"LVRT connected={compliance_report.lvrt.stayed_connected}, "
            f"LVRT Iq={compliance_report.lvrt.reactive_current_compliant}, "
            f"LVRT recovery={compliance_report.lvrt.recovery_compliant}, "
            f"HVRT={compliance_report.hvrt.stayed_connected}, "
            f"LFSM-O={compliance_report.lfsm_o.compliant}, "
            f"LFSM-U={compliance_report.lfsm_u.compliant}, "
            f"FSM={compliance_report.fsm.compliant}, "
            f"RoCoF={compliance_report.rocof.compliant}, "
            f"SSO={compliance_report.sso.stable}"
        )

    def test_lvrt_compliant_details(self, compliance_report):
        """LVRT must pass all three sub-checks."""
        lvrt = compliance_report.lvrt
        assert lvrt.stayed_connected, "LVRT: WTGs disconnected"
        assert lvrt.reactive_current_compliant, f"LVRT: Kqv = {lvrt.reactive_current_gain} < 2.0"
        assert lvrt.recovery_compliant, f"LVRT: recovery time = {lvrt.recovery_time_s}s > 1.0s"

    def test_all_frequency_modes_compliant(self, compliance_report):
        """All frequency response modes must be compliant."""
        assert compliance_report.lfsm_o.compliant, "LFSM-O not compliant"
        assert compliance_report.lfsm_u.compliant, "LFSM-U not compliant"
        assert compliance_report.fsm.compliant, "FSM not compliant"
        assert compliance_report.rocof.compliant, "RoCoF not compliant"

    def test_sso_stable(self, compliance_report):
        """SSO must be stable for nominal case."""
        assert compliance_report.sso.stable, (
            f"SSO unstable: risk={compliance_report.sso.risk_level}, "
            f"min_damping={compliance_report.sso.minimum_damping_ratio}"
        )
