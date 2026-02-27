"""
Tests for the Factory Acceptance Test (FAT) module (P5).

Validates:
- 8 FAT specifications match IEC standards
- Campaign lifecycle (CREATED → IN_PROGRESS → COMPLETED → APPROVED)
- Result recording with auto-evaluated verdicts
- Pass/fail boundary conditions
- Approval gating (all tests must pass)
"""

from __future__ import annotations

import pytest

from app.services.p5.fat import (
    FAT_SPECS,
    FATCampaignStateError,
    FATTestNotFoundError,
    TestCampaignStatus,
    TestVerdict,
    all_fat_passed,
    approve_fat_campaign,
    create_fat_campaign,
    evaluate_test_verdict,
    record_fat_result,
)

ENGINEER = "Maria Nowak"
EQUIPMENT = "TX-OSS-01"


@pytest.fixture
def campaign():
    """Create a fresh FAT campaign for each test."""
    return create_fat_campaign(EQUIPMENT)


# ── Specification Validation ────────────────────────────────────


class TestFATSpecs:
    """Validate the 8 FAT test specifications."""

    def test_has_8_specs(self) -> None:
        assert len(FAT_SPECS) == 8

    def test_all_specs_have_unique_ids(self) -> None:
        ids = [s.test_id for s in FAT_SPECS]
        assert len(ids) == len(set(ids))

    def test_hv_withstand_spec(self) -> None:
        spec = FAT_SPECS[0]
        assert spec.test_id == "FAT-001"
        assert spec.standard == "IEC 60060-1"
        assert spec.min_value == 460.0
        assert spec.unit == "kV"

    def test_partial_discharge_spec(self) -> None:
        spec = FAT_SPECS[1]
        assert spec.test_id == "FAT-002"
        assert spec.standard == "IEC 60270"
        assert spec.max_value == 10.0
        assert spec.unit == "pC"

    def test_transformer_ratio_spec(self) -> None:
        spec = FAT_SPECS[2]
        assert spec.test_id == "FAT-003"
        assert spec.standard == "IEC 60076-1"
        assert spec.unit == "ratio"
        # ±0.5% of 3.333
        assert spec.min_value == pytest.approx(3.317, abs=0.001)
        assert spec.max_value == pytest.approx(3.350, abs=0.001)

    def test_transformer_impedance_spec(self) -> None:
        spec = FAT_SPECS[3]
        assert spec.test_id == "FAT-004"
        assert spec.standard == "IEC 60076-1"
        assert spec.min_value == pytest.approx(10.8)
        assert spec.max_value == pytest.approx(13.2)

    def test_fra_baseline_spec(self) -> None:
        spec = FAT_SPECS[4]
        assert spec.test_id == "FAT-005"
        assert spec.standard == "IEC 60076-18"

    def test_dga_baseline_spec(self) -> None:
        spec = FAT_SPECS[5]
        assert spec.test_id == "FAT-006"
        assert spec.standard == "IEC 60567"
        assert spec.max_value == 50.0

    def test_relay_type_test_spec(self) -> None:
        spec = FAT_SPECS[6]
        assert spec.test_id == "FAT-007"
        assert spec.standard == "IEC 60255"
        assert spec.min_value == -5.0
        assert spec.max_value == 5.0

    def test_gis_gas_tightness_spec(self) -> None:
        spec = FAT_SPECS[7]
        assert spec.test_id == "FAT-008"
        assert spec.standard == "IEC 62271-203"
        assert spec.max_value == 0.5


# ── Verdict Evaluation ──────────────────────────────────────────


class TestVerdictEvaluation:
    """Test the pure evaluate_test_verdict function."""

    def test_pass_within_bounds(self) -> None:
        spec = FAT_SPECS[2]  # ratio: 3.317–3.350
        assert evaluate_test_verdict(spec, 3.333) == TestVerdict.PASS

    def test_pass_at_lower_boundary(self) -> None:
        spec = FAT_SPECS[2]
        assert evaluate_test_verdict(spec, spec.min_value) == TestVerdict.PASS

    def test_pass_at_upper_boundary(self) -> None:
        spec = FAT_SPECS[2]
        assert evaluate_test_verdict(spec, spec.max_value) == TestVerdict.PASS

    def test_fail_below_lower_bound(self) -> None:
        spec = FAT_SPECS[2]
        assert evaluate_test_verdict(spec, 3.0) == TestVerdict.FAIL

    def test_fail_above_upper_bound(self) -> None:
        spec = FAT_SPECS[1]  # PD < 10 pC
        assert evaluate_test_verdict(spec, 15.0) == TestVerdict.FAIL

    def test_pass_single_upper_bound(self) -> None:
        spec = FAT_SPECS[1]  # PD < 10 pC
        assert evaluate_test_verdict(spec, 5.0) == TestVerdict.PASS

    def test_pass_single_lower_bound(self) -> None:
        spec = FAT_SPECS[0]  # HV withstand >= 460 kV
        assert evaluate_test_verdict(spec, 465.0) == TestVerdict.PASS


# ── Campaign Lifecycle ──────────────────────────────────────────


class TestCampaignLifecycle:
    """Test FAT campaign creation and status transitions."""

    def test_create_campaign(self, campaign) -> None:
        assert campaign.campaign_id.startswith("FAT-")
        assert campaign.equipment_tag == EQUIPMENT
        assert campaign.status == TestCampaignStatus.CREATED
        assert len(campaign.specs) == 8
        assert len(campaign.results) == 0

    def test_transitions_to_in_progress_on_first_result(self, campaign) -> None:
        record_fat_result(campaign, "FAT-001", 465.0, ENGINEER)
        assert campaign.status == TestCampaignStatus.IN_PROGRESS

    def test_transitions_to_completed_when_all_recorded(self, campaign) -> None:
        _record_all_passing(campaign)
        assert campaign.status == TestCampaignStatus.COMPLETED

    def test_approve_completed_campaign(self, campaign) -> None:
        _record_all_passing(campaign)
        approve_fat_campaign(campaign, ENGINEER)
        assert campaign.status == TestCampaignStatus.APPROVED
        assert campaign.approved_by == ENGINEER
        assert campaign.approved_at is not None


# ── Result Recording ────────────────────────────────────────────


class TestResultRecording:
    """Test FAT result recording and auto-evaluation."""

    def test_record_passing_result(self, campaign) -> None:
        result = record_fat_result(campaign, "FAT-001", 465.0, ENGINEER)
        assert result.verdict == TestVerdict.PASS
        assert result.measured_value == 465.0
        assert result.recorded_by == ENGINEER

    def test_record_failing_result(self, campaign) -> None:
        result = record_fat_result(campaign, "FAT-002", 15.0, ENGINEER)
        assert result.verdict == TestVerdict.FAIL

    def test_overwrite_result(self, campaign) -> None:
        record_fat_result(campaign, "FAT-002", 15.0, ENGINEER)
        result = record_fat_result(campaign, "FAT-002", 5.0, ENGINEER)
        assert result.verdict == TestVerdict.PASS

    def test_invalid_test_id_raises(self, campaign) -> None:
        with pytest.raises(FATTestNotFoundError):
            record_fat_result(campaign, "INVALID-999", 0.0, ENGINEER)

    def test_cannot_record_on_approved_campaign(self, campaign) -> None:
        _record_all_passing(campaign)
        approve_fat_campaign(campaign, ENGINEER)
        with pytest.raises(FATCampaignStateError, match="already approved"):
            record_fat_result(campaign, "FAT-001", 465.0, ENGINEER)


# ── Approval Gating ─────────────────────────────────────────────


class TestApprovalGating:
    """Test that approval requires all tests to pass."""

    def test_cannot_approve_uncompleted_campaign(self, campaign) -> None:
        record_fat_result(campaign, "FAT-001", 465.0, ENGINEER)
        with pytest.raises(FATCampaignStateError, match="must be 'completed'"):
            approve_fat_campaign(campaign, ENGINEER)

    def test_cannot_approve_with_failing_tests(self, campaign) -> None:
        # Record all but make one fail
        _record_all_passing(campaign)
        record_fat_result(campaign, "FAT-002", 15.0, ENGINEER)  # PD > 10 pC = FAIL
        with pytest.raises(FATCampaignStateError, match="not all tests passed"):
            approve_fat_campaign(campaign, ENGINEER)

    def test_all_fat_passed_false_when_incomplete(self, campaign) -> None:
        assert all_fat_passed(campaign) is False

    def test_all_fat_passed_false_with_failure(self, campaign) -> None:
        _record_all_passing(campaign)
        record_fat_result(campaign, "FAT-002", 15.0, ENGINEER)
        assert all_fat_passed(campaign) is False

    def test_all_fat_passed_true_when_all_pass(self, campaign) -> None:
        _record_all_passing(campaign)
        assert all_fat_passed(campaign) is True


# ── Helpers ─────────────────────────────────────────────────────


# Passing values for each FAT spec
_PASSING_VALUES: dict[str, float] = {
    "FAT-001": 465.0,   # HV withstand >= 460 kV
    "FAT-002": 5.0,     # PD < 10 pC
    "FAT-003": 3.333,   # Ratio within ±0.5%
    "FAT-004": 12.0,    # Impedance within ±10%
    "FAT-005": -20.0,   # FRA baseline (any value)
    "FAT-006": 30.0,    # DGA < 50 ppm
    "FAT-007": 2.0,     # Relay error within ±5%
    "FAT-008": 0.3,     # SF6 leak < 0.5%/yr
}


def _record_all_passing(campaign) -> None:
    """Record passing results for all 8 FAT specs."""
    for test_id, value in _PASSING_VALUES.items():
        record_fat_result(campaign, test_id, value, ENGINEER)
