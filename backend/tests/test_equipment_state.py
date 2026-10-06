"""Topology-based interlocking of circuit 1 (services/p5/equipment_state.py)."""

import pytest

from app.services.p5.equipment_state import (
    OSS_EQUIPMENT,
    EquipmentNotFoundError,
    EquipmentState,
    EquipmentType,
    InterlockError,
    InvalidTransitionError,
    SwitchingAction,
    ZoneStatus,
    build_initial_state,
    check_interlocks,
    execute_switching_action,
    zone_status,
)

SHUT, OPENED = EquipmentState.CLOSED, EquipmentState.OPEN
CLOSE, OPEN = SwitchingAction.CLOSE, SwitchingAction.OPEN


def ids(violations):
    return {v.interlock_id for v in violations}


def cable_ready():
    """Both cable earths open, onshore DS closed — CB-ON-220-01 may close."""
    s = build_initial_state()
    s["ES-ON-220-01"] = s["ES-OSS-220-01"] = OPENED
    s["DS-ON-220-01"] = SHUT
    return s


def test_initial_condition_everything_earthed_but_the_source():
    s = build_initial_state()
    zones = zone_status(s)
    assert zones["ONS220"] == ZoneStatus.LIVE
    for z in ("CABLE1", "OSS220", "66A", "66B", "STR1", "STR6"):
        assert zones[z] == ZoneStatus.EARTHED
    for eq in OSS_EQUIPMENT:
        expected = SHUT if eq.equipment_type == EquipmentType.EARTH_SWITCH else OPENED
        assert s[eq.equipment_id] == expected


def test_ilk001_far_end_earth_blocks_cable_energisation():
    """The classic accident: energising a cable earthed 45 km away at the OSS."""
    s = cable_ready()
    s["ES-OSS-220-01"] = SHUT
    v = check_interlocks("CB-ON-220-01", CLOSE, s)
    assert ids(v) == {"ILK-001"}
    assert v[0].blocking_equipment == "ES-OSS-220-01"
    s["ES-OSS-220-01"] = OPENED
    assert check_interlocks("CB-ON-220-01", CLOSE, s) == []


def test_ilk001_through_a_closed_chain():
    """Earth on the OSS busbar is reached through the closed DS/CB of bay E1."""
    s = cable_ready()
    s["CB-ON-220-01"] = SHUT
    s["DS-OSS-220-01"] = SHUT  # OSS-E1 joined to the still-earthed busbar
    assert ids(check_interlocks("CB-OSS-220-01", CLOSE, s)) == {"ILK-001"}


def test_ilk002_no_earthing_of_a_live_zone():
    s = cable_ready()
    execute_switching_action("CB-ON-220-01", CLOSE, s)
    assert zone_status(s)["CABLE1"] == ZoneStatus.LIVE
    assert ids(check_interlocks("ES-OSS-220-01", CLOSE, s)) == {"ILK-002"}


def test_ilk003_disconnector_only_off_load():
    s = cable_ready()
    execute_switching_action("CB-ON-220-01", CLOSE, s)
    assert ids(check_interlocks("DS-ON-220-01", OPEN, s)) == {"ILK-003"}
    execute_switching_action("CB-ON-220-01", OPEN, s)
    assert check_interlocks("DS-ON-220-01", OPEN, s) == []


def test_ilk004_isolation_lock():
    s = build_initial_state()
    v = check_interlocks("ES-ON-220-01", OPEN, s, locked=frozenset({"ES-ON-220-01"}))
    assert ids(v) == {"ILK-004"}
    assert check_interlocks("ES-ON-220-01", OPEN, s) == []


def test_ilk005_turbines_need_a_live_string():
    s = build_initial_state()
    assert ids(check_interlocks("WTG-GRP-01", CLOSE, s)) == {"ILK-005"}


def test_opening_a_breaker_is_never_interlocked():
    s = cable_ready()
    execute_switching_action("CB-ON-220-01", CLOSE, s)
    assert check_interlocks("CB-ON-220-01", OPEN, s) == []


def test_execute_rejects_and_leaves_state_unchanged():
    s = build_initial_state()
    s["DS-ON-220-01"] = SHUT
    with pytest.raises(InterlockError) as exc:
        execute_switching_action("CB-ON-220-01", CLOSE, s)
    assert "ILK-001" in str(exc.value)
    assert s["CB-ON-220-01"] == OPENED
    with pytest.raises(InvalidTransitionError):
        execute_switching_action("CB-ON-220-01", OPEN, s)
    with pytest.raises(EquipmentNotFoundError):
        execute_switching_action("CB-XYZ", CLOSE, s)


def test_section_b_strings_hang_off_tx_oss_02():
    by_id = {eq.equipment_id: eq for eq in OSS_EQUIPMENT}
    assert by_id["CB-STR-04"].zones == ("66B", "STR4")
    assert by_id["CB-TX-OSS-02-LV"].zones == ("TX2", "66B")
