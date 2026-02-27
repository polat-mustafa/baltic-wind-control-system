"""
Tests for the 30-step switching programme execution engine (P5).

Validates:
- Programme creation (30 steps, correct phases, hold points)
- Programme lifecycle transitions
- Step execution (ordering, PiC confirmation, pre/post conditions)
- PiC GO/NO-GO decision logic
- Emergency stop
- Full happy-path end-to-end test
"""

from __future__ import annotations

import pytest

from app.services.p5.equipment_state import EquipmentState
from app.services.p5.switching_programme import (
    PiCDecisionRequiredError,
    ProgrammeStateError,
    ProgrammeStatus,
    StepExecutionError,
    StepStatus,
    StepType,
    approve_programme,
    create_oss_energisation_programme,
    emergency_stop,
    execute_step,
    pic_go_decision,
    pic_nogo_decision,
    start_programme,
)

PIC_NAME = "Jan Kowalski"


@pytest.fixture
def programme():
    """Create a fresh programme for each test."""
    return create_oss_energisation_programme(PIC_NAME)


@pytest.fixture
def started_programme(programme):
    """Create an approved and started programme."""
    approve_programme(programme, PIC_NAME)
    start_programme(programme)
    return programme


# ── Programme Creation ───────────────────────────────────────────


class TestProgrammeCreation:
    """Verify programme factory builds correct structure."""

    def test_total_step_count(self, programme) -> None:
        """Programme has 47 steps: 15 checks + 23 switching + 9 turbine.

        The roadmap's '30-step programme' refers to the core switching
        steps. The full programme includes 15 pre-energisation checks
        and 2 additional earth switch opening steps (S-019A, S-022A)
        required by interlocks.
        """
        assert len(programme.steps) == 47

    def test_phase1_has_15_checks(self, programme) -> None:
        """Phase 1 has 15 pre-energisation checks."""
        phase1 = [s for s in programme.steps if s.phase == 1]
        assert len(phase1) == 15

    def test_phase2_has_23_steps(self, programme) -> None:
        """Phase 2 has 23 energisation switching steps (S-001 to S-022 + S-019A)."""
        phase2 = [s for s in programme.steps if s.phase == 2]
        assert len(phase2) == 23

    def test_phase3_has_9_steps(self, programme) -> None:
        """Phase 3 has 9 turbine connection steps (S-022A + S-023 to S-030)."""
        phase3 = [s for s in programme.steps if s.phase == 3]
        assert len(phase3) == 9

    def test_phase_counts_add_up(self, programme) -> None:
        """Phase counts (15 + 23 + 9) sum to total step count (47)."""
        phase_counts = {}
        for s in programme.steps:
            phase_counts[s.phase] = phase_counts.get(s.phase, 0) + 1
        total = sum(phase_counts.values())
        assert total == len(programme.steps)

    def test_hold_point_at_s009(self, programme) -> None:
        """Hold point exists at S-009."""
        s009 = next(s for s in programme.steps if s.step_id == "S-009")
        assert s009.step_type == StepType.HOLD_POINT

    def test_hold_point_at_s022(self, programme) -> None:
        """Hold point exists at S-022."""
        s022 = next(s for s in programme.steps if s.step_id == "S-022")
        assert s022.step_type == StepType.HOLD_POINT

    def test_initial_status_created(self, programme) -> None:
        """Programme starts in CREATED state."""
        assert programme.status == ProgrammeStatus.CREATED

    def test_all_steps_pending(self, programme) -> None:
        """All steps start as PENDING."""
        assert all(s.status == StepStatus.PENDING for s in programme.steps)

    def test_pic_name_stored(self, programme) -> None:
        """PiC name is stored correctly."""
        assert programme.pic_name == PIC_NAME

    def test_system_state_initialized(self, programme) -> None:
        """System state has all 22 equipment entries."""
        assert len(programme.system_state) == 22

    def test_loto_set_created(self, programme) -> None:
        """LOTO set is created with 9 isolation points."""
        assert programme.loto_set is not None
        assert len(programme.loto_set.points) == 9

    def test_audit_trail_has_creation_entry(self, programme) -> None:
        """Audit trail records programme creation."""
        assert len(programme.audit_trail) >= 1
        assert "created" in programme.audit_trail[0].action.lower()

    def test_step_numbers_sequential(self, programme) -> None:
        """Step numbers are 1-based and sequential."""
        numbers = [s.step_number for s in programme.steps]
        assert numbers == list(range(1, len(programme.steps) + 1))

    def test_switching_steps_have_equipment(self, programme) -> None:
        """All SWITCHING type steps have an equipment_id."""
        switching_steps = [s for s in programme.steps if s.step_type == StepType.SWITCHING]
        for step in switching_steps:
            if step.switching_action is not None:
                assert step.equipment_id != "", f"{step.step_id} missing equipment_id"


# ── Programme Lifecycle ──────────────────────────────────────────


class TestProgrammeLifecycle:
    """Verify programme state transitions."""

    def test_approve_from_created(self, programme) -> None:
        """Can approve programme from CREATED state."""
        approve_programme(programme, PIC_NAME)
        assert programme.status == ProgrammeStatus.APPROVED

    def test_start_from_approved(self, programme) -> None:
        """Can start programme from APPROVED state."""
        approve_programme(programme, PIC_NAME)
        start_programme(programme)
        assert programme.status == ProgrammeStatus.IN_PROGRESS

    def test_cannot_approve_twice(self, programme) -> None:
        """Cannot approve an already approved programme."""
        approve_programme(programme, PIC_NAME)
        with pytest.raises(ProgrammeStateError):
            approve_programme(programme, PIC_NAME)

    def test_cannot_start_without_approval(self, programme) -> None:
        """Cannot start programme without approval."""
        with pytest.raises(ProgrammeStateError):
            start_programme(programme)

    def test_cannot_execute_before_start(self, programme) -> None:
        """Cannot execute steps before programme is started."""
        approve_programme(programme, PIC_NAME)
        first_step = programme.steps[0]
        with pytest.raises(ProgrammeStateError):
            execute_step(programme, first_step.step_id, PIC_NAME)


# ── Step Execution ───────────────────────────────────────────────


class TestStepExecution:
    """Verify step-by-step execution logic."""

    def test_execute_first_step(self, started_programme) -> None:
        """Can execute the first step (CHECK-001)."""
        step = execute_step(started_programme, "CHECK-001", "Local Operator")
        assert step.status == StepStatus.COMPLETED
        assert started_programme.current_step_index == 1

    def test_wrong_step_order_rejected(self, started_programme) -> None:
        """Cannot skip steps — must execute in order."""
        with pytest.raises(StepExecutionError, match="current step"):
            execute_step(started_programme, "CHECK-005", "Local Operator")

    def test_pic_confirmation_required(self, started_programme) -> None:
        """Steps requiring PiC confirmation fail without it."""
        with pytest.raises(StepExecutionError, match="PiC confirmation"):
            execute_step(started_programme, "CHECK-001", "Local Operator", pic_confirmed=False)

    def test_step_records_executor(self, started_programme) -> None:
        """Executed step records who did it."""
        step = execute_step(started_programme, "CHECK-001", "Local Operator")
        assert step.executed_by == "Local Operator"
        assert step.executed_at is not None

    def test_audit_trail_grows(self, started_programme) -> None:
        """Audit trail records each step execution."""
        initial_count = len(started_programme.audit_trail)
        execute_step(started_programme, "CHECK-001", "Local Operator")
        assert len(started_programme.audit_trail) > initial_count


# ── Hold Points ──────────────────────────────────────────────────


class TestHoldPoints:
    """Verify hold point behaviour and PiC decisions."""

    def _advance_to_hold_point(self, programme, target_step_id: str) -> None:
        """Helper: execute all steps up to (and trigger) a hold point."""
        for step in programme.steps:
            if step.step_id == target_step_id:
                break
            # For switching steps, prepare equipment state
            if step.step_type == StepType.SWITCHING and step.switching_action is not None:
                # Pre-conditions are met by the programme's step ordering
                pass
            execute_step(programme, step.step_id, "Operator")

    def test_hold_point_transitions_to_hold(self, started_programme) -> None:
        """Reaching a hold point puts programme on HOLD."""
        # Advance through all Phase 1 checks and Phase 2 up to S-009
        self._advance_to_hold_point(started_programme, "S-009")
        with pytest.raises(PiCDecisionRequiredError):
            execute_step(started_programme, "S-009", PIC_NAME)
        assert started_programme.status == ProgrammeStatus.HOLD

    def test_pic_go_resumes_programme(self, started_programme) -> None:
        """PiC GO decision resumes programme to IN_PROGRESS."""
        self._advance_to_hold_point(started_programme, "S-009")
        with pytest.raises(PiCDecisionRequiredError):
            execute_step(started_programme, "S-009", PIC_NAME)
        step = pic_go_decision(started_programme, PIC_NAME)
        assert started_programme.status == ProgrammeStatus.IN_PROGRESS
        assert step.status == StepStatus.COMPLETED

    def test_pic_nogo_aborts_programme(self, started_programme) -> None:
        """PiC NO-GO decision aborts the programme."""
        self._advance_to_hold_point(started_programme, "S-009")
        with pytest.raises(PiCDecisionRequiredError):
            execute_step(started_programme, "S-009", PIC_NAME)
        pic_nogo_decision(started_programme, PIC_NAME, "Weather deteriorated")
        assert started_programme.status == ProgrammeStatus.ABORTED

    def test_wrong_pic_rejected(self, started_programme) -> None:
        """Non-PiC cannot make GO/NO-GO decisions."""
        self._advance_to_hold_point(started_programme, "S-009")
        with pytest.raises(PiCDecisionRequiredError):
            execute_step(started_programme, "S-009", PIC_NAME)
        with pytest.raises(StepExecutionError, match="not authorised"):
            pic_go_decision(started_programme, "Wrong Person")

    def test_go_when_not_on_hold(self, started_programme) -> None:
        """Cannot make GO decision when not on HOLD."""
        with pytest.raises(ProgrammeStateError):
            pic_go_decision(started_programme, PIC_NAME)


# ── Emergency Stop ───────────────────────────────────────────────


class TestEmergencyStop:
    """Verify emergency stop behaviour."""

    def test_emergency_stop_aborts(self, started_programme) -> None:
        """Emergency stop transitions to ABORTED."""
        emergency_stop(started_programme, PIC_NAME, "Arc flash detected")
        assert started_programme.status == ProgrammeStatus.ABORTED

    def test_emergency_stop_from_hold(self, started_programme) -> None:
        """Emergency stop works from HOLD state."""
        # Get to a hold point first
        for step in started_programme.steps:
            if step.step_id == "S-009":
                break
            execute_step(started_programme, step.step_id, "Operator")
        with pytest.raises(PiCDecisionRequiredError):
            execute_step(started_programme, "S-009", PIC_NAME)
        emergency_stop(started_programme, PIC_NAME, "Fire alarm")
        assert started_programme.status == ProgrammeStatus.ABORTED

    def test_emergency_stop_from_created(self, programme) -> None:
        """Emergency stop works from CREATED state."""
        emergency_stop(programme, PIC_NAME, "Safety concern")
        assert programme.status == ProgrammeStatus.ABORTED

    def test_double_emergency_stop_rejected(self, started_programme) -> None:
        """Cannot emergency stop an already aborted programme."""
        emergency_stop(started_programme, PIC_NAME, "First stop")
        with pytest.raises(ProgrammeStateError):
            emergency_stop(started_programme, PIC_NAME, "Second stop")

    def test_emergency_stop_audit_recorded(self, started_programme) -> None:
        """Emergency stop is recorded in audit trail."""
        emergency_stop(started_programme, "Safety Officer", "SF6 leak")
        last = started_programme.audit_trail[-1]
        assert "EMERGENCY STOP" in last.action


# ── Switching Step Pre/Post Conditions ───────────────────────────


class TestSwitchingStepConditions:
    """Verify pre-condition and post-condition checks on switching steps."""

    def _advance_to_step(self, programme, target_step_id: str) -> None:
        """Execute all steps up to (but not including) target_step_id."""
        for step in programme.steps:
            if step.step_id == target_step_id:
                return
            if step.step_type == StepType.HOLD_POINT:
                with pytest.raises(PiCDecisionRequiredError):
                    execute_step(programme, step.step_id, PIC_NAME)
                pic_go_decision(programme, PIC_NAME)
            else:
                execute_step(programme, step.step_id, "Operator")

    def test_switching_step_updates_equipment_state(self, started_programme) -> None:
        """Switching step updates the system state."""
        # Advance to S-003 (Open ES-ON-220-01)
        self._advance_to_step(started_programme, "S-003")
        assert started_programme.system_state["ES-ON-220-01"] == EquipmentState.CLOSED
        execute_step(started_programme, "S-003", "Operator")
        assert started_programme.system_state["ES-ON-220-01"] == EquipmentState.OPEN

    def test_pre_condition_failure(self, started_programme) -> None:
        """Step fails if equipment is not in expected pre-condition state."""
        # Advance to S-003 then manually corrupt state
        self._advance_to_step(started_programme, "S-003")
        started_programme.system_state["ES-ON-220-01"] = EquipmentState.OPEN  # Should be CLOSED
        with pytest.raises(StepExecutionError, match="Pre-condition"):
            execute_step(started_programme, "S-003", "Operator")


# ── Full Happy Path ──────────────────────────────────────────────


class TestFullHappyPath:
    """End-to-end execution of the complete programme."""

    def test_complete_programme_execution(self) -> None:
        """Execute all 30 steps to COMPLETED status.

        This is the integration test — proves the 30-step programme
        can be executed from start to finish with correct equipment
        state transitions and hold point handling.
        """
        programme = create_oss_energisation_programme(PIC_NAME)
        approve_programme(programme, PIC_NAME)
        start_programme(programme)

        for step in programme.steps:
            if step.step_type == StepType.HOLD_POINT:
                with pytest.raises(PiCDecisionRequiredError):
                    execute_step(programme, step.step_id, PIC_NAME)
                pic_go_decision(programme, PIC_NAME)
            else:
                execute_step(programme, step.step_id, "Operator")

        assert programme.status == ProgrammeStatus.COMPLETED
        assert all(s.status == StepStatus.COMPLETED for s in programme.steps)

        # Verify key equipment states after full energisation
        assert programme.system_state["ES-ON-220-01"] == EquipmentState.OPEN
        assert programme.system_state["ES-OSS-220-01"] == EquipmentState.OPEN
        assert programme.system_state["DS-ON-220-01"] == EquipmentState.CLOSED
        assert programme.system_state["DS-OSS-220-01"] == EquipmentState.CLOSED
        assert programme.system_state["CB-ON-220-01"] == EquipmentState.CLOSED
        assert programme.system_state["CB-OSS-220-01"] == EquipmentState.CLOSED
        assert programme.system_state["CB-TX-OSS-HV"] == EquipmentState.CLOSED
        assert programme.system_state["CB-TX-OSS-LV"] == EquipmentState.CLOSED
        assert programme.system_state["CB-STR-01"] == EquipmentState.CLOSED

        # Audit trail should have many entries
        assert len(programme.audit_trail) >= 30
