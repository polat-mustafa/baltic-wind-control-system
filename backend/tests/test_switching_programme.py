"""Circuit 1 first-energisation programme (services/p5/switching_programme.py)."""

import pytest

from app.services.p2.network_model import STRING_BUSBAR_SECTION, STRING_LAYOUT, TURBINE_RATED_MW
from app.services.p5.equipment_state import EquipmentState, ZoneStatus, zone_status
from app.services.p5.grid_code_testing import NotificationStage
from app.services.p5.loto import LOTOStatus, point_id_for
from app.services.p5.switching_programme import (
    CHECKS,
    PHASES,
    PiCDecisionRequiredError,
    ProgrammeStateError,
    ProgrammeStatus,
    StepExecutionError,
    StepStatus,
    StepType,
    approve_programme,
    create_oss_energisation_programme,
    emergency_trip,
    execute_step,
    pic_go_decision,
    pic_nogo_decision,
    start_programme,
)
from tests.p5_support import PIC, issue, ready_programme, run_until


def test_programme_structure():
    p = create_oss_energisation_programme(PIC)
    assert len(p.steps) == 60
    assert [s.step_number for s in p.steps] == list(range(1, 61))
    assert {s.phase for s in p.steps} == set(PHASES)
    assert len({s.step_id for s in p.steps}) == len(p.steps)
    for s in p.steps:
        if s.step_type == StepType.VERIFICATION:
            assert s.check_id in CHECKS
        if s.step_type == StepType.GATE:
            assert s.check_id in ("sat", "eon", "ion")
    # Every switching step on a lockable device is preceded by its lock removal
    removed = set()
    for s in p.steps:
        if s.step_type == StepType.ISOLATION:
            removed.add(s.equipment_id)
        if s.step_type == StepType.SWITCHING and s.equipment_id.startswith(("DS-", "ES-")):
            assert s.equipment_id in removed, s.step_id


def test_scope_is_section_a_only():
    """One circuit (one cable, one 300 MVA transformer) feeds section A: strings 1–3."""
    p = create_oss_energisation_programme(PIC)
    strings = {s.equipment_id for s in p.steps if s.equipment_id.startswith("CB-STR-")}
    assert strings == {f"CB-STR-0{n}" for n, sec in STRING_BUSBAR_SECTION.items() if sec == "A"}
    assert sum(STRING_LAYOUT[:3]) * TURBINE_RATED_MW == 270.0


def test_full_run_completes_and_leaves_section_b_earthed():
    p = ready_programme()
    run_until(p)
    assert p.status == ProgrammeStatus.COMPLETED
    assert all(s.status == StepStatus.COMPLETED for s in p.steps)
    zones = zone_status(p.system_state)
    for z in ("CABLE1", "OSS220", "TX1", "66A", "STR1", "STR2", "STR3"):
        assert zones[z] == ZoneStatus.LIVE
    for z in ("66B", "STR4", "STR5", "STR6"):
        assert zones[z] == ZoneStatus.EARTHED
    assert p.loto_set is not None
    assert p.loto_set.points[point_id_for("ES-OSS-66-02")].status == LOTOStatus.APPLIED
    rated = next(s for s in p.steps if s.check_id == "rated")
    assert "270 MW" in rated.reading


def test_verification_readings_are_recorded():
    p = ready_programme()
    run_until(p)
    by_check = {s.check_id: s.reading for s in p.steps if s.step_type == StepType.VERIFICATION}
    assert "Ferranti" in by_check["cable_energised"]
    assert "charging current" in by_check["cable_energised"]
    assert "STATCOM" in by_check["statcom"]
    assert "Magnetising current" in by_check["tx1_no_load"]


def test_gate_blocks_without_eon():
    p = create_oss_energisation_programme(PIC)
    from app.services.p5.fat import approve_campaign
    from app.services.p5.sat import create_sat_campaign
    from tests.p5_support import approved_fats, fill_typical

    sat = create_sat_campaign(p.programme_id, approved_fats())
    fill_typical(sat)
    approve_campaign(sat, PIC)
    p.sat_campaign = sat
    approve_programme(p, PIC)
    start_programme(p)
    execute_step(p, "1.01", PIC)
    execute_step(p, "1.02", PIC)  # SAT gate passes
    with pytest.raises(StepExecutionError, match=r"EON not issued|No grid-code"):
        execute_step(p, "1.03", PIC)
    assert p.steps[2].status == StepStatus.PENDING  # retry possible
    issue(p, NotificationStage.EON)
    execute_step(p, "1.03", PIC)
    assert p.steps[2].status == StepStatus.COMPLETED


def test_sat_gate_blocks_without_sat():
    p = create_oss_energisation_programme(PIC)
    approve_programme(p, PIC)
    start_programme(p)
    execute_step(p, "1.01", PIC)
    with pytest.raises(StepExecutionError, match="No SAT"):
        execute_step(p, "1.02", PIC)


def test_steps_execute_in_order_only():
    p = ready_programme()
    with pytest.raises(StepExecutionError, match=r"Current step is 1.01"):
        execute_step(p, "2.01", PIC)


def test_pic_confirmation_required():
    p = ready_programme()
    with pytest.raises(StepExecutionError, match="confirmation"):
        execute_step(p, "1.01", PIC, pic_confirmed=False)


def test_hold_point_and_go():
    p = ready_programme()
    run_until(p, "1.07")
    with pytest.raises(PiCDecisionRequiredError):
        execute_step(p, "1.07", PIC)
    assert p.status == ProgrammeStatus.HOLD
    with pytest.raises(StepExecutionError, match="Person in Control"):
        pic_go_decision(p, "Someone else")
    pic_go_decision(p, PIC)
    assert p.status == ProgrammeStatus.IN_PROGRESS
    assert p.steps[p.current_step_index].step_id == "2.01"


def test_nogo_aborts():
    p = ready_programme()
    run_until(p, "1.07")
    with pytest.raises(PiCDecisionRequiredError):
        execute_step(p, "1.07", PIC)
    pic_nogo_decision(p, PIC, "Weather window closed")
    assert p.status == ProgrammeStatus.ABORTED
    with pytest.raises(ProgrammeStateError):
        execute_step(p, "2.01", PIC)


def test_isolation_step_removes_lock():
    p = ready_programme()
    run_until(p, "2.01")
    assert p.loto_set is not None
    pid = point_id_for("ES-OSS-220-01")
    assert p.loto_set.points[pid].status == LOTOStatus.APPLIED
    execute_step(p, "2.01", PIC)
    assert p.loto_set.points[pid].status == LOTOStatus.REMOVED


def test_switching_blocked_by_reapplied_lock():
    """A lock re-applied after its removal step blocks the switching step (ILK-004)."""
    p = ready_programme()
    run_until(p, "2.02")
    assert p.loto_set is not None
    from app.services.p5.loto import apply_loto

    apply_loto(p.loto_set, point_id_for("ES-OSS-220-01"), "Technician", p.system_state)
    with pytest.raises(StepExecutionError, match="ILK-004"):
        execute_step(p, "2.02", PIC)
    assert p.system_state["ES-OSS-220-01"] == EquipmentState.CLOSED
    assert "ILK-004" in p.audit_trail[-1].details


def test_emergency_trip_opens_breakers_and_aborts():
    p = ready_programme()
    run_until(p, "3.07")  # cable energised, OSS bus live
    assert p.system_state["CB-ON-220-01"] == EquipmentState.CLOSED
    opened = emergency_trip(p, PIC, "Internal arc")
    assert "CB-ON-220-01" in opened and "CB-OSS-220-01" in opened
    assert p.status == ProgrammeStatus.ABORTED
    assert zone_status(p.system_state)["CABLE1"] != ZoneStatus.LIVE
    assert p.system_state["DS-ON-220-01"] == EquipmentState.CLOSED  # disconnectors untouched
