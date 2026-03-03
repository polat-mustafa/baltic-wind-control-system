"""
Unit tests for P5 grid code compliance testing (EON/ION/FON pipeline).

Tests cover:
- Campaign creation with 3 stages and 17 tests
- Test result recording and verdict tracking
- Stage gate enforcement (EON → ION → FON)
- Notification submission and approval lifecycle
- COD achievement on FON approval
"""

from __future__ import annotations

import pytest

from app.services.p5.grid_code_testing import (
    ComplianceGateError,
    ComplianceTestNotFoundError,
    ComplianceVerdict,
    NotificationStage,
    approve_notification,
    clear_campaigns,
    create_compliance_campaign,
    get_compliance_campaign,
    get_stage_summary,
    record_test_result,
    submit_notification,
)

PROGRAMME_ID = "BWA-SP-TEST-001"
TESTER = "Maria Nowak"


@pytest.fixture(autouse=True)
def _clean_campaigns():
    """Clear campaigns before each test."""
    clear_campaigns()
    yield
    clear_campaigns()


@pytest.fixture
def campaign():
    """Create a compliance campaign for testing."""
    return create_compliance_campaign(PROGRAMME_ID)


# ── Campaign Creation ─────────────────────────────────────────────


class TestCampaignCreation:
    """Verify campaign structure and initial state."""

    def test_campaign_has_three_stages(self, campaign) -> None:
        assert len(campaign.stages) == 3
        assert NotificationStage.EON in campaign.stages
        assert NotificationStage.ION in campaign.stages
        assert NotificationStage.FON in campaign.stages

    def test_eon_has_six_tests(self, campaign) -> None:
        eon = campaign.stages[NotificationStage.EON]
        assert len(eon.tests) == 6

    def test_ion_has_five_tests(self, campaign) -> None:
        ion = campaign.stages[NotificationStage.ION]
        assert len(ion.tests) == 5

    def test_fon_has_six_tests(self, campaign) -> None:
        fon = campaign.stages[NotificationStage.FON]
        assert len(fon.tests) == 6

    def test_total_seventeen_tests(self, campaign) -> None:
        total = sum(len(s.tests) for s in campaign.stages.values())
        assert total == 17

    def test_all_tests_initially_pending(self, campaign) -> None:
        for stage in campaign.stages.values():
            for test in stage.tests:
                assert test.verdict == ComplianceVerdict.PENDING

    def test_cod_not_achieved_initially(self, campaign) -> None:
        assert campaign.cod_achieved is False
        assert campaign.cod_date is None

    def test_get_campaign_returns_created(self, campaign) -> None:
        retrieved = get_compliance_campaign(PROGRAMME_ID)
        assert retrieved is not None
        assert retrieved.campaign_id == campaign.campaign_id

    def test_get_nonexistent_returns_none(self) -> None:
        assert get_compliance_campaign("nonexistent") is None


# ── Test Result Recording ─────────────────────────────────────────


class TestResultRecording:
    """Verify recording compliance test results."""

    def test_record_compliant_verdict(self, campaign) -> None:
        test = record_test_result(
            PROGRAMME_ID,
            "EON-001",
            ComplianceVerdict.COMPLIANT,
            "Protection settings verified per PSE requirements",
            TESTER,
        )
        assert test.verdict == ComplianceVerdict.COMPLIANT
        assert test.tested_by == TESTER
        assert test.tested_at is not None

    def test_record_non_compliant_verdict(self, campaign) -> None:
        test = record_test_result(
            PROGRAMME_ID,
            "EON-002",
            ComplianceVerdict.NON_COMPLIANT,
            "SCADA telemetry failed commissioning check",
            TESTER,
        )
        assert test.verdict == ComplianceVerdict.NON_COMPLIANT

    def test_record_conditional_verdict(self, campaign) -> None:
        test = record_test_result(
            PROGRAMME_ID,
            "EON-003",
            ComplianceVerdict.CONDITIONAL,
            "SAT passed with minor deviations — remediation plan submitted",
            TESTER,
        )
        assert test.verdict == ComplianceVerdict.CONDITIONAL

    def test_invalid_test_id_raises(self, campaign) -> None:
        with pytest.raises(ComplianceTestNotFoundError):
            record_test_result(
                PROGRAMME_ID,
                "INVALID-001",
                ComplianceVerdict.COMPLIANT,
                "N/A",
                TESTER,
            )

    def test_evidence_is_stored(self, campaign) -> None:
        evidence = "Relay settings match approved protection study rev. 3"
        test = record_test_result(
            PROGRAMME_ID,
            "EON-001",
            ComplianceVerdict.COMPLIANT,
            evidence,
            TESTER,
        )
        assert test.evidence == evidence


# ── Stage Gate Enforcement ────────────────────────────────────────


class TestStageGates:
    """Verify EON → ION → FON ordering is enforced."""

    def _pass_all_stage_tests(self, programme_id: str, stage: NotificationStage) -> None:
        """Helper: mark all tests in a stage as compliant."""
        campaign = get_compliance_campaign(programme_id)
        assert campaign is not None
        stage_app = campaign.stages[stage]
        for test in stage_app.tests:
            record_test_result(
                programme_id,
                test.test_id,
                ComplianceVerdict.COMPLIANT,
                "Passed",
                TESTER,
            )

    def test_submit_eon_without_predecessor(self, campaign) -> None:
        """EON can be submitted without prior stages."""
        self._pass_all_stage_tests(PROGRAMME_ID, NotificationStage.EON)
        app = submit_notification(PROGRAMME_ID, NotificationStage.EON, TESTER)
        assert app.status == ComplianceVerdict.CONDITIONAL
        assert app.submitted_at is not None

    def test_submit_ion_requires_eon_approved(self, campaign) -> None:
        """ION submission should fail if EON is not approved."""
        self._pass_all_stage_tests(PROGRAMME_ID, NotificationStage.ION)
        with pytest.raises(ComplianceGateError):
            submit_notification(PROGRAMME_ID, NotificationStage.ION, TESTER)

    def test_submit_fon_requires_ion_approved(self, campaign) -> None:
        """FON submission should fail if ION is not approved."""
        # Approve EON first
        self._pass_all_stage_tests(PROGRAMME_ID, NotificationStage.EON)
        submit_notification(PROGRAMME_ID, NotificationStage.EON, TESTER)
        approve_notification(PROGRAMME_ID, NotificationStage.EON)

        # Pass ION tests but don't approve
        self._pass_all_stage_tests(PROGRAMME_ID, NotificationStage.ION)
        submit_notification(PROGRAMME_ID, NotificationStage.ION, TESTER)
        # DON'T approve ION

        # FON should still fail (ION not approved)
        self._pass_all_stage_tests(PROGRAMME_ID, NotificationStage.FON)
        with pytest.raises(ComplianceGateError):
            submit_notification(PROGRAMME_ID, NotificationStage.FON, TESTER)


# ── Notification Lifecycle ────────────────────────────────────────


class TestNotificationLifecycle:
    """Verify submit → approve → COD lifecycle."""

    def _pass_all_stage_tests(self, programme_id: str, stage: NotificationStage) -> None:
        """Helper: mark all tests in a stage as compliant."""
        campaign = get_compliance_campaign(programme_id)
        assert campaign is not None
        stage_app = campaign.stages[stage]
        for test in stage_app.tests:
            record_test_result(
                programme_id,
                test.test_id,
                ComplianceVerdict.COMPLIANT,
                "Passed",
                TESTER,
            )

    def test_approve_eon(self, campaign) -> None:
        self._pass_all_stage_tests(PROGRAMME_ID, NotificationStage.EON)
        submit_notification(PROGRAMME_ID, NotificationStage.EON, TESTER)
        app = approve_notification(PROGRAMME_ID, NotificationStage.EON)
        assert app.status == ComplianceVerdict.COMPLIANT
        assert app.approved_at is not None

    def test_fon_approval_triggers_cod(self, campaign) -> None:
        """Full EON → ION → FON lifecycle should achieve COD."""
        for stage in [NotificationStage.EON, NotificationStage.ION, NotificationStage.FON]:
            self._pass_all_stage_tests(PROGRAMME_ID, stage)
            submit_notification(PROGRAMME_ID, stage, TESTER)
            approve_notification(PROGRAMME_ID, stage)

        updated = get_compliance_campaign(PROGRAMME_ID)
        assert updated is not None
        assert updated.cod_achieved is True
        assert updated.cod_date is not None

    def test_stage_summary_structure(self, campaign) -> None:
        summary = get_stage_summary(PROGRAMME_ID, NotificationStage.EON)
        assert "stage" in summary
        assert "total_tests" in summary
