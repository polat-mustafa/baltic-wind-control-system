"""
Unit tests for Permit-to-Work state machine (P3 — permit_to_work.py).

Tests validate the 9-state PtW lifecycle, RBAC-controlled transitions,
audit trail integrity, permit expiry, and cancellation rules.

Test Strategy
-------------
- Happy path: full 9-state traversal (REQUESTED → CLOSED)
- Invalid transitions: verify all illegal state jumps are rejected
- RBAC enforcement: each transition requires the correct permission level
- Audit trail: every transition logged with user, timestamp, notes
- Expiry: 12-hour validity from ACTIVE, checked on transition
- Cancellation: allowed from non-terminal, blocked from CLOSED/CANCELLED
"""

from datetime import UTC, datetime, timedelta

import pytest

from app.services.p3.permit_to_work import (
    PTW_VALIDITY_HOURS,
    TRANSITION_MAP,
    InvalidStateTransitionError,
    PermitExpiredError,
    PermitRecord,
    PermitStatus,
    RiskCategory,
    RiskLevel,
    apply_transition,
    create_permit,
    generate_ptw_number,
    get_next_transitions,
    get_step_number,
    is_expired,
    validate_transition,
)
from app.services.p3.rbac import RoleLevel

# ── Helper: advance permit through states ────────────────────────

# Full happy path sequence: the states to traverse in order
_HAPPY_PATH_STATES = [
    PermitStatus.RISK_ASSESSED,
    PermitStatus.APPROVED,
    PermitStatus.ISOLATION_CONFIRMED,
    PermitStatus.LOTO_APPLIED,
    PermitStatus.ACTIVE,
    PermitStatus.WORK_COMPLETE,
    PermitStatus.LOTO_REMOVED,
    PermitStatus.CLOSED,
]


def _advance_to(permit: PermitRecord, target: PermitStatus) -> PermitRecord:
    """Advance a permit through the happy path up to target state.

    Uses ADMIN level (has all permissions) for convenience in tests.
    """
    for state in _HAPPY_PATH_STATES:
        if permit.status == target:
            break
        apply_transition(
            permit=permit,
            target_status=state,
            performed_by="test_user",
            user_level=RoleLevel.ADMIN,
            notes=f"Test advance to {state.value}",
        )
    return permit


# ── Permit Creation Tests ────────────────────────────────────────


class TestPermitCreation:
    """Tests for permit creation and initial state."""

    def test_new_permit_starts_as_requested(self):
        """A new permit must start in REQUESTED state."""
        permit = create_permit(
            work_description="Replace CT on 220 kV busbar",
            equipment_id="OSS_BAY_CTRL01",
            requested_by="j.kowalski",
        )
        assert permit.status == PermitStatus.REQUESTED

    def test_ptw_number_format(self):
        """PtW number must follow BWA-PTW-{YEAR}-{SEQ:05d} format."""
        number = generate_ptw_number(sequence=42)
        year = datetime.now(UTC).year
        assert number == f"BWA-PTW-{year}-00042"

    def test_ptw_number_on_permit(self):
        """Created permit has a properly formatted PtW number."""
        permit = create_permit(
            work_description="Test",
            equipment_id="IED01",
            requested_by="user1",
            sequence=7,
        )
        assert permit.ptw_number.startswith("BWA-PTW-")
        assert "00007" in permit.ptw_number

    def test_new_permit_has_no_person_in_charge(self):
        """PiC is empty until assigned during approval."""
        permit = create_permit(
            work_description="Test",
            equipment_id="IED01",
            requested_by="user1",
        )
        assert permit.person_in_charge == ""

    def test_new_permit_has_no_risk_assessment(self):
        """Risk assessment is None until RISK_ASSESSED state."""
        permit = create_permit(
            work_description="Test",
            equipment_id="IED01",
            requested_by="user1",
        )
        assert permit.risk_assessment is None

    def test_new_permit_has_empty_audit_trail(self):
        """New permit has no transitions yet."""
        permit = create_permit(
            work_description="Test",
            equipment_id="IED01",
            requested_by="user1",
        )
        assert len(permit.transitions) == 0

    def test_new_permit_has_no_validity_period(self):
        """Validity period is not set until ACTIVE state."""
        permit = create_permit(
            work_description="Test",
            equipment_id="IED01",
            requested_by="user1",
        )
        assert permit.valid_from is None
        assert permit.valid_until is None

    def test_new_permit_has_unique_id(self):
        """Each permit gets a unique UUID."""
        p1 = create_permit("Test 1", "IED01", "user1")
        p2 = create_permit("Test 2", "IED02", "user2")
        assert p1.id != p2.id


# ── Valid Transition Tests ───────────────────────────────────────


class TestValidTransitions:
    """Tests for the complete happy path through all 9 states."""

    def test_full_happy_path(self):
        """A permit can traverse all 9 states to CLOSED."""
        permit = create_permit(
            work_description="220 kV busbar maintenance",
            equipment_id="OSS_BAY_CTRL01",
            requested_by="j.kowalski",
        )
        _advance_to(permit, PermitStatus.CLOSED)
        assert permit.status == PermitStatus.CLOSED

    def test_requested_to_risk_assessed(self):
        """REQUESTED → RISK_ASSESSED: risk assessment completed."""
        permit = create_permit("Test", "IED01", "user1")
        result = apply_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            "assessor1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.RISK_ASSESSED

    def test_risk_assessed_to_approved(self):
        """RISK_ASSESSED → APPROVED: supervisor authorises work."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.RISK_ASSESSED)
        result = apply_transition(
            permit,
            PermitStatus.APPROVED,
            "supervisor1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.APPROVED

    def test_approved_to_isolation_confirmed(self):
        """APPROVED → ISOLATION_CONFIRMED: equipment isolated."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.APPROVED)
        result = apply_transition(
            permit,
            PermitStatus.ISOLATION_CONFIRMED,
            "operator1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.ISOLATION_CONFIRMED

    def test_isolation_to_loto_applied(self):
        """ISOLATION_CONFIRMED → LOTO_APPLIED: locks and tags on."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.ISOLATION_CONFIRMED)
        result = apply_transition(
            permit,
            PermitStatus.LOTO_APPLIED,
            "operator1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.LOTO_APPLIED

    def test_loto_to_active(self):
        """LOTO_APPLIED → ACTIVE: zero energy verified, work begins."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.LOTO_APPLIED)
        result = apply_transition(
            permit,
            PermitStatus.ACTIVE,
            "engineer1",
            RoleLevel.ENGINEER,
        )
        assert result.success is True
        assert permit.status == PermitStatus.ACTIVE

    def test_active_to_work_complete(self):
        """ACTIVE → WORK_COMPLETE: work finished, area clear."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.ACTIVE)
        result = apply_transition(
            permit,
            PermitStatus.WORK_COMPLETE,
            "engineer1",
            RoleLevel.ENGINEER,
        )
        assert result.success is True
        assert permit.status == PermitStatus.WORK_COMPLETE

    def test_work_complete_to_loto_removed(self):
        """WORK_COMPLETE → LOTO_REMOVED: locks removed."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.WORK_COMPLETE)
        result = apply_transition(
            permit,
            PermitStatus.LOTO_REMOVED,
            "operator1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.LOTO_REMOVED

    def test_loto_removed_to_closed(self):
        """LOTO_REMOVED → CLOSED: permit archived."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.LOTO_REMOVED)
        result = apply_transition(
            permit,
            PermitStatus.CLOSED,
            "admin1",
            RoleLevel.ADMIN,
        )
        assert result.success is True
        assert permit.status == PermitStatus.CLOSED

    def test_active_sets_validity_period(self):
        """Entering ACTIVE state sets the 12-hour validity window."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.ACTIVE)
        assert permit.valid_from is not None
        assert permit.valid_until is not None
        delta = permit.valid_until - permit.valid_from
        assert delta == timedelta(hours=PTW_VALIDITY_HOURS)

    def test_transition_map_covers_all_forward_pairs(self):
        """Transition map must define all 8 forward transitions."""
        assert len(TRANSITION_MAP) == 8


# ── Invalid Transition Tests ─────────────────────────────────────


class TestInvalidTransitions:
    """Tests for illegal state transitions that must be rejected."""

    def test_cannot_skip_risk_assessment(self):
        """REQUESTED → APPROVED: cannot skip risk assessment."""
        permit = create_permit("Test", "IED01", "user1")
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.APPROVED,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_cannot_skip_loto(self):
        """APPROVED → ACTIVE: cannot skip LOTO — unsafe."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.APPROVED)
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.ACTIVE,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_cannot_skip_isolation(self):
        """APPROVED → LOTO_APPLIED: cannot apply LOTO without isolation."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.APPROVED)
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.LOTO_APPLIED,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_cannot_go_backwards(self):
        """APPROVED → REQUESTED: cannot reverse direction."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.APPROVED)
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.REQUESTED,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_closed_is_terminal(self):
        """CLOSED state is terminal — no further transitions."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.CLOSED)
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.REQUESTED,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_cannot_jump_to_closed(self):
        """REQUESTED → CLOSED: cannot jump directly to CLOSED."""
        permit = create_permit("Test", "IED01", "user1")
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.CLOSED,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_operator_cannot_approve(self):
        """Level 2 operator cannot approve a permit (Level 3 required)."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.RISK_ASSESSED)
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.APPROVED,
                "operator1",
                RoleLevel.OPERATOR,
            )

    def test_viewer_cannot_transition(self):
        """Level 1 viewer cannot perform any PtW transition."""
        permit = create_permit("Test", "IED01", "user1")
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.RISK_ASSESSED,
                "viewer1",
                RoleLevel.VIEWER,
            )


# ── Audit Trail Tests ────────────────────────────────────────────


class TestAuditTrail:
    """Tests for the append-only transition audit trail."""

    def test_every_transition_logged(self):
        """Each transition adds exactly one entry to the audit trail."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.CLOSED)
        # 8 transitions in happy path (REQUESTED→...→CLOSED)
        assert len(permit.transitions) == 8

    def test_transition_records_user(self):
        """Audit entry records who performed the transition."""
        permit = create_permit("Test", "IED01", "user1")
        apply_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            "j.kowalski",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert permit.transitions[0].performed_by == "j.kowalski"

    def test_transition_records_user_level(self):
        """Audit entry records the RBAC level of the user."""
        permit = create_permit("Test", "IED01", "user1")
        apply_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            "j.kowalski",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert permit.transitions[0].user_level == RoleLevel.SENIOR_OPERATOR

    def test_transition_records_timestamp(self):
        """Audit entry has a UTC timestamp."""
        permit = create_permit("Test", "IED01", "user1")
        before = datetime.now(UTC)
        apply_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            "user1",
            RoleLevel.ADMIN,
        )
        after = datetime.now(UTC)
        ts = permit.transitions[0].timestamp
        assert before <= ts <= after

    def test_transition_records_notes(self):
        """Audit entry preserves notes/justification."""
        permit = create_permit("Test", "IED01", "user1")
        apply_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            "user1",
            RoleLevel.ADMIN,
            notes="All hazards identified per JSA-2026-042",
        )
        assert "JSA-2026-042" in permit.transitions[0].notes

    def test_transition_records_from_and_to_states(self):
        """Audit entry records the before and after states."""
        permit = create_permit("Test", "IED01", "user1")
        apply_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            "user1",
            RoleLevel.ADMIN,
        )
        entry = permit.transitions[0]
        assert entry.from_status == PermitStatus.REQUESTED
        assert entry.to_status == PermitStatus.RISK_ASSESSED

    def test_audit_trail_is_ordered(self):
        """Audit trail timestamps are in chronological order."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.CLOSED)
        for i in range(1, len(permit.transitions)):
            assert permit.transitions[i].timestamp >= permit.transitions[i - 1].timestamp


# ── Permit Expiry Tests ──────────────────────────────────────────


class TestPermitExpiry:
    """Tests for the 12-hour validity period on ACTIVE permits."""

    def test_permit_not_expired_within_validity(self):
        """A permit within its 12-hour window is not expired."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.ACTIVE)
        assert is_expired(permit) is False

    def test_permit_expires_after_12_hours(self):
        """A permit past its 12-hour window is expired."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.ACTIVE)
        # Simulate time passing beyond validity
        permit.valid_until = datetime.now(UTC) - timedelta(minutes=1)
        assert is_expired(permit) is True

    def test_expired_permit_cannot_transition(self):
        """An expired ACTIVE permit raises PermitExpiredError on transition."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.ACTIVE)
        # Force expiry
        permit.valid_until = datetime.now(UTC) - timedelta(minutes=1)
        with pytest.raises(PermitExpiredError):
            apply_transition(
                permit,
                PermitStatus.WORK_COMPLETE,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_pre_active_permit_not_expired(self):
        """Permits before ACTIVE state have no validity period — never expired."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.APPROVED)
        assert is_expired(permit) is False

    def test_validity_period_is_12_hours(self):
        """Validity period constant must be 12 hours."""
        assert PTW_VALIDITY_HOURS == 12

    def test_validity_set_on_active_entry(self):
        """valid_from and valid_until are set when entering ACTIVE."""
        permit = create_permit("Test", "IED01", "user1")
        assert permit.valid_from is None
        _advance_to(permit, PermitStatus.ACTIVE)
        assert permit.valid_from is not None
        assert permit.valid_until is not None


# ── Cancellation Tests ───────────────────────────────────────────


class TestCancellation:
    """Tests for permit cancellation from non-terminal states."""

    def test_cancel_from_requested(self):
        """Permit can be cancelled from REQUESTED state."""
        permit = create_permit("Test", "IED01", "user1")
        result = apply_transition(
            permit,
            PermitStatus.CANCELLED,
            "user1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.CANCELLED

    def test_cancel_from_approved(self):
        """Permit can be cancelled from APPROVED state."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.APPROVED)
        result = apply_transition(
            permit,
            PermitStatus.CANCELLED,
            "user1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.CANCELLED

    def test_cancel_from_active(self):
        """Permit can be cancelled from ACTIVE state (emergency)."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.ACTIVE)
        result = apply_transition(
            permit,
            PermitStatus.CANCELLED,
            "user1",
            RoleLevel.SENIOR_OPERATOR,
        )
        assert result.success is True
        assert permit.status == PermitStatus.CANCELLED

    def test_cannot_cancel_from_closed(self):
        """Cannot cancel a permit that is already CLOSED."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.CLOSED)
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.CANCELLED,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_cannot_cancel_from_cancelled(self):
        """Cannot cancel a permit that is already CANCELLED."""
        permit = create_permit("Test", "IED01", "user1")
        apply_transition(
            permit,
            PermitStatus.CANCELLED,
            "user1",
            RoleLevel.SENIOR_OPERATOR,
        )
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.CANCELLED,
                "user1",
                RoleLevel.ADMIN,
            )

    def test_cancellation_logged_in_audit_trail(self):
        """Cancellation is recorded in the audit trail."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.APPROVED)
        apply_transition(
            permit,
            PermitStatus.CANCELLED,
            "supervisor1",
            RoleLevel.SENIOR_OPERATOR,
            notes="Weather deteriorated — helicopter recall",
        )
        last = permit.transitions[-1]
        assert last.to_status == PermitStatus.CANCELLED
        assert "helicopter" in last.notes

    def test_viewer_cannot_cancel(self):
        """Level 1 viewer cannot cancel permits."""
        permit = create_permit("Test", "IED01", "user1")
        with pytest.raises(InvalidStateTransitionError):
            apply_transition(
                permit,
                PermitStatus.CANCELLED,
                "viewer1",
                RoleLevel.VIEWER,
            )


# ── Helper Function Tests ────────────────────────────────────────


class TestHelperFunctions:
    """Tests for utility functions."""

    def test_get_step_number_requested(self):
        """REQUESTED is step 1."""
        assert get_step_number(PermitStatus.REQUESTED) == 1

    def test_get_step_number_closed(self):
        """CLOSED is step 9."""
        assert get_step_number(PermitStatus.CLOSED) == 9

    def test_get_step_number_cancelled(self):
        """CANCELLED is step 0 (special case)."""
        assert get_step_number(PermitStatus.CANCELLED) == 0

    def test_get_next_transitions_from_requested(self):
        """REQUESTED has exactly 2 next states: RISK_ASSESSED and CANCELLED."""
        permit = create_permit("Test", "IED01", "user1")
        nexts = get_next_transitions(permit)
        targets = {t[0] for t in nexts}
        assert PermitStatus.RISK_ASSESSED in targets
        assert PermitStatus.CANCELLED in targets

    def test_get_next_transitions_from_closed(self):
        """CLOSED (terminal) has no next transitions."""
        permit = create_permit("Test", "IED01", "user1")
        _advance_to(permit, PermitStatus.CLOSED)
        nexts = get_next_transitions(permit)
        assert len(nexts) == 0

    def test_risk_category_values(self):
        """All 6 risk categories must be defined."""
        assert len(RiskCategory) == 6

    def test_risk_level_values(self):
        """All 4 risk levels must be defined."""
        assert len(RiskLevel) == 4

    def test_validate_transition_returns_reason(self):
        """validate_transition always returns a reason string."""
        permit = create_permit("Test", "IED01", "user1")
        is_valid, reason = validate_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            RoleLevel.ADMIN,
        )
        assert is_valid is True
        assert reason != ""

    def test_transition_result_has_message(self):
        """TransitionResult always includes a human-readable message."""
        permit = create_permit("Test", "IED01", "user1")
        result = apply_transition(
            permit,
            PermitStatus.RISK_ASSESSED,
            "user1",
            RoleLevel.ADMIN,
        )
        assert result.message != ""
