"""
Tests for the Site Acceptance Test (SAT) module (P5).

Validates:
- 12 SAT specifications match IEC standards
- FAT-gate enforcement (SAT blocked without approved FAT)
- Campaign lifecycle and result recording
- Integration with switching programme (SAT gate for start_programme)
- Backward compatibility (programmes without SAT still work)
"""

from __future__ import annotations

import pytest

from app.services.p5.fat import (
    TestCampaignStatus,
    TestVerdict,
    approve_fat_campaign,
    create_fat_campaign,
    record_fat_result,
)
from app.services.p5.sat import (
    SAT_SPECS,
    SATCampaignStateError,
    SATFATGateError,
    SATTestNotFoundError,
    all_sat_passed,
    approve_sat_campaign,
    create_sat_campaign,
    record_sat_result,
)
from app.services.p5.switching_programme import (
    ProgrammeStateError,
    approve_programme,
    create_oss_energisation_programme,
    start_programme,
)

ENGINEER = "Maria Nowak"
PIC_NAME = "Jan Kowalski"
PROGRAMME_ID = "BWA-SP-TEST-001"


@pytest.fixture
def sat_campaign():
    """Create a fresh SAT campaign (no FAT gate)."""
    return create_sat_campaign(PROGRAMME_ID)


@pytest.fixture
def approved_fat():
    """Create and approve a FAT campaign."""
    fat = create_fat_campaign("TX-OSS-01")
    _PASSING_FAT = {
        "FAT-001": 465.0,
        "FAT-002": 5.0,
        "FAT-003": 3.333,
        "FAT-004": 12.0,
        "FAT-005": -20.0,
        "FAT-006": 30.0,
        "FAT-007": 2.0,
        "FAT-008": 0.3,
    }
    for test_id, value in _PASSING_FAT.items():
        record_fat_result(fat, test_id, value, ENGINEER)
    approve_fat_campaign(fat, ENGINEER)
    return fat


# ── Specification Validation ────────────────────────────────────


class TestSATSpecs:
    """Validate the 12 SAT test specifications."""

    def test_has_12_specs(self) -> None:
        assert len(SAT_SPECS) == 12

    def test_all_specs_have_unique_ids(self) -> None:
        ids = [s.test_id for s in SAT_SPECS]
        assert len(ids) == len(set(ids))

    def test_insulation_resistance_spec(self) -> None:
        spec = SAT_SPECS[0]
        assert spec.test_id == "SAT-001"
        assert spec.standard == "IEC 60229"
        assert spec.min_value == 100.0

    def test_ct_ratio_spec(self) -> None:
        spec = SAT_SPECS[1]
        assert spec.test_id == "SAT-002"
        assert spec.standard == "IEC 61869-2"
        assert spec.min_value == -1.0
        assert spec.max_value == 1.0

    def test_vt_ratio_spec(self) -> None:
        spec = SAT_SPECS[2]
        assert spec.test_id == "SAT-003"
        assert spec.standard == "IEC 61869-3"
        assert spec.min_value == -0.5
        assert spec.max_value == 0.5

    def test_cb_close_timing_spec(self) -> None:
        spec = SAT_SPECS[3]
        assert spec.test_id == "SAT-004"
        assert spec.standard == "IEC 62271-100"
        assert spec.max_value == 80.0

    def test_cb_open_timing_spec(self) -> None:
        spec = SAT_SPECS[4]
        assert spec.test_id == "SAT-005"
        assert spec.max_value == 60.0

    def test_goose_latency_spec(self) -> None:
        spec = SAT_SPECS[6]
        assert spec.test_id == "SAT-007"
        assert spec.standard == "IEC 61850-8-1"
        assert spec.max_value == 4.0

    def test_scada_point_verification_spec(self) -> None:
        spec = SAT_SPECS[7]
        assert spec.test_id == "SAT-008"
        assert spec.standard == "IEC 60870-5-104"
        assert spec.min_value == 100.0
        assert spec.max_value == 100.0

    def test_fire_detection_spec(self) -> None:
        spec = SAT_SPECS[9]
        assert spec.test_id == "SAT-010"
        assert spec.standard == "EN 54"
        assert spec.max_value == 30.0

    def test_cable_impedance_spec(self) -> None:
        spec = SAT_SPECS[11]
        assert spec.test_id == "SAT-012"
        assert spec.standard == "IEC 60502"
        assert spec.min_value == -5.0
        assert spec.max_value == 5.0


# ── FAT-Gate Enforcement ────────────────────────────────────────


class TestFATGate:
    """Test that SAT creation enforces FAT approval gate."""

    def test_create_sat_without_fat_gate(self) -> None:
        """SAT can be created without FAT gate (backward compat)."""
        sat = create_sat_campaign(PROGRAMME_ID)
        assert sat.status == TestCampaignStatus.CREATED
        assert sat.fat_campaign_id == ""

    def test_create_sat_with_approved_fat(self, approved_fat) -> None:
        """SAT creation succeeds when FAT is approved."""
        sat = create_sat_campaign(PROGRAMME_ID, fat_campaign=approved_fat)
        assert sat.fat_campaign_id == approved_fat.campaign_id

    def test_create_sat_blocked_by_unapproved_fat(self) -> None:
        """SAT creation fails when FAT is not approved."""
        fat = create_fat_campaign("TX-OSS-01")
        with pytest.raises(SATFATGateError, match="must be 'approved'"):
            create_sat_campaign(PROGRAMME_ID, fat_campaign=fat)


# ── Campaign Lifecycle ──────────────────────────────────────────


class TestSATCampaignLifecycle:
    """Test SAT campaign status transitions."""

    def test_create_campaign(self, sat_campaign) -> None:
        assert sat_campaign.campaign_id.startswith("SAT-")
        assert sat_campaign.programme_id == PROGRAMME_ID
        assert sat_campaign.status == TestCampaignStatus.CREATED
        assert len(sat_campaign.specs) == 12

    def test_transitions_to_in_progress(self, sat_campaign) -> None:
        record_sat_result(sat_campaign, "SAT-001", 150.0, ENGINEER)
        assert sat_campaign.status == TestCampaignStatus.IN_PROGRESS

    def test_transitions_to_completed(self, sat_campaign) -> None:
        _record_all_passing_sat(sat_campaign)
        assert sat_campaign.status == TestCampaignStatus.COMPLETED

    def test_approve_completed_campaign(self, sat_campaign) -> None:
        _record_all_passing_sat(sat_campaign)
        approve_sat_campaign(sat_campaign, ENGINEER)
        assert sat_campaign.status == TestCampaignStatus.APPROVED


# ── Result Recording ────────────────────────────────────────────


class TestSATResultRecording:
    """Test SAT result recording."""

    def test_record_passing_result(self, sat_campaign) -> None:
        result = record_sat_result(sat_campaign, "SAT-001", 150.0, ENGINEER)
        assert result.verdict == TestVerdict.PASS

    def test_record_failing_result(self, sat_campaign) -> None:
        result = record_sat_result(sat_campaign, "SAT-001", 50.0, ENGINEER)
        assert result.verdict == TestVerdict.FAIL

    def test_invalid_test_id(self, sat_campaign) -> None:
        with pytest.raises(SATTestNotFoundError):
            record_sat_result(sat_campaign, "INVALID", 0.0, ENGINEER)

    def test_cannot_record_on_approved(self, sat_campaign) -> None:
        _record_all_passing_sat(sat_campaign)
        approve_sat_campaign(sat_campaign, ENGINEER)
        with pytest.raises(SATCampaignStateError, match="already approved"):
            record_sat_result(sat_campaign, "SAT-001", 150.0, ENGINEER)


# ── Approval Gating ─────────────────────────────────────────────


class TestSATApprovalGating:
    """Test SAT approval requires all tests to pass."""

    def test_cannot_approve_incomplete(self, sat_campaign) -> None:
        record_sat_result(sat_campaign, "SAT-001", 150.0, ENGINEER)
        with pytest.raises(SATCampaignStateError, match="must be 'completed'"):
            approve_sat_campaign(sat_campaign, ENGINEER)

    def test_cannot_approve_with_failures(self, sat_campaign) -> None:
        _record_all_passing_sat(sat_campaign)
        # Override one to fail
        record_sat_result(sat_campaign, "SAT-001", 50.0, ENGINEER)
        with pytest.raises(SATCampaignStateError, match="not all tests passed"):
            approve_sat_campaign(sat_campaign, ENGINEER)

    def test_all_sat_passed_false_incomplete(self, sat_campaign) -> None:
        assert all_sat_passed(sat_campaign) is False

    def test_all_sat_passed_true(self, sat_campaign) -> None:
        _record_all_passing_sat(sat_campaign)
        assert all_sat_passed(sat_campaign) is True


# ── Programme Integration ───────────────────────────────────────


class TestProgrammeIntegration:
    """Test SAT gate in switching programme start."""

    def test_programme_starts_without_sat(self) -> None:
        """Backward compat: no SAT campaign = no gate."""
        prog = create_oss_energisation_programme(PIC_NAME)
        approve_programme(prog, PIC_NAME)
        start_programme(prog)  # Should not raise
        assert prog.status.value == "in_progress"

    def test_programme_blocked_by_incomplete_sat(self) -> None:
        """Programme cannot start if SAT is attached but not passed."""
        prog = create_oss_energisation_programme(PIC_NAME)
        prog.sat_campaign = create_sat_campaign(prog.programme_id)
        approve_programme(prog, PIC_NAME)
        with pytest.raises(ProgrammeStateError, match="SAT campaign has not passed"):
            start_programme(prog)

    def test_programme_starts_with_passed_sat(self) -> None:
        """Programme can start when SAT is fully passed."""
        prog = create_oss_energisation_programme(PIC_NAME)
        sat = create_sat_campaign(prog.programme_id)
        _record_all_passing_sat(sat)
        approve_sat_campaign(sat, ENGINEER)
        prog.sat_campaign = sat
        approve_programme(prog, PIC_NAME)
        start_programme(prog)
        assert prog.status.value == "in_progress"


# ── Helpers ─────────────────────────────────────────────────────

_PASSING_SAT: dict[str, float] = {
    "SAT-001": 150.0,   # Insulation resistance > 100 MOhm
    "SAT-002": 0.5,     # CT ratio ±1%
    "SAT-003": 0.3,     # VT ratio ±0.5%
    "SAT-004": 65.0,    # CB close < 80 ms
    "SAT-005": 45.0,    # CB open < 60 ms
    "SAT-006": 80.0,    # Protection trip < 100 ms
    "SAT-007": 2.5,     # GOOSE < 4 ms
    "SAT-008": 100.0,   # SCADA 100%
    "SAT-009": 17.0,    # Tap changer position (1–33)
    "SAT-010": 15.0,    # Fire detection < 30 s
    "SAT-011": 1.0,     # E-stop pass flag
    "SAT-012": 2.0,     # Cable impedance ±5%
}


def _record_all_passing_sat(campaign) -> None:
    """Record passing results for all 12 SAT specs."""
    for test_id, value in _PASSING_SAT.items():
        record_sat_result(campaign, test_id, value, ENGINEER)
