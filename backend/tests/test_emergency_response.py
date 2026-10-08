"""Emergency procedures and their effect on the programme (services/p5/emergency_response.py)."""

import pytest

from app.services.p5.emergency_response import (
    EMERGENCY_PROCEDURES,
    EmergencyType,
    ProgrammeEffect,
    UnknownEmergencyError,
    trigger_emergency,
)
from app.services.p5.equipment_state import EquipmentState
from app.services.p5.switching_programme import ProgrammeStatus, execute_step, pic_go_decision
from tests.p5_support import PIC, ready_programme, run_until


def test_electrical_hazards_trip_the_others_suspend():
    trips = {t for t, p in EMERGENCY_PROCEDURES.items() if p.effect == ProgrammeEffect.TRIP}
    assert trips == {EmergencyType.INTERNAL_ARC, EmergencyType.UNEXPECTED_VOLTAGE}
    assert len(EMERGENCY_PROCEDURES) == len(EmergencyType)
    for p in EMERGENCY_PROCEDURES.values():
        assert "IEEE 1584" not in p.reference_document  # 208 V–15 kV only


def test_internal_arc_trips_circuit_1():
    p = ready_programme()
    run_until(p, "2.12")  # cable 1 energised (2.11)
    event = trigger_emergency(p, "internal_arc", PIC)
    assert "CB-ON-220-01" in event["breakers_opened"]
    assert p.system_state["CB-ON-220-01"] == EquipmentState.OPEN
    assert p.status == ProgrammeStatus.ABORTED
    assert p.emergency_log == [event]


def test_comms_failure_suspends_until_pic_resumes():
    p = ready_programme()
    run_until(p, "2.01")
    event = trigger_emergency(p, "comms_failure", "Operator")
    assert event["effect"] == "suspend" and event["breakers_opened"] == []
    assert p.status == ProgrammeStatus.SUSPENDED
    with pytest.raises(Exception, match="suspended"):
        execute_step(p, "2.01", PIC)
    pic_go_decision(p, PIC, "Voice link restored")
    assert p.status == ProgrammeStatus.IN_PROGRESS
    assert p.steps[p.current_step_index].step_id == "2.01"  # resuming completes nothing


def test_unknown_emergency():
    with pytest.raises(UnknownEmergencyError):
        trigger_emergency(ready_programme(), "meteor", PIC)
