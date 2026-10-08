"""Isolation locks (services/p5/loto.py)."""

import pytest

from app.services.p5.equipment_state import OSS_EQUIPMENT, EquipmentState, EquipmentType
from app.services.p5.loto import (
    LOTOPointNotFoundError,
    LOTOStateError,
    LOTOStatus,
    apply_loto,
    create_loto_set_for_oss,
    point_id_for,
    remove_loto,
)
from app.services.p5.switching_programme import create_oss_energisation_programme


def test_every_disconnector_and_earth_switch_is_locked_at_start():
    loto = create_loto_set_for_oss("SB5-SP-TEST-ABC123", "PiC")
    lockable = [
        eq for eq in OSS_EQUIPMENT
        if eq.equipment_type in (EquipmentType.DISCONNECTOR, EquipmentType.EARTH_SWITCH)
    ]  # fmt: skip
    assert len(loto.points) == len(lockable) == 18  # 2 DS + 16 ES (incl. onshore reactor bay)
    assert all(p.status == LOTOStatus.APPLIED for p in loto.points.values())
    ds = loto.points[point_id_for("DS-ON-220-01")]
    es = loto.points[point_id_for("ES-ON-220-01")]
    assert ds.secured_state == EquipmentState.OPEN  # secured against reconnection
    assert es.secured_state == EquipmentState.CLOSED  # earthed and short-circuited
    assert len({p.tag_number for p in loto.points.values()}) == len(loto.points)
    assert loto.locked_equipment() == {eq.equipment_id for eq in lockable}


def test_remove_then_reapply_only_in_secured_position():
    p = create_oss_energisation_programme("PiC")
    loto, state = p.loto_set, p.system_state
    assert loto is not None
    pid = point_id_for("ES-ON-220-01")
    remove_loto(loto, pid, "PiC")
    assert "ES-ON-220-01" not in loto.locked_equipment()
    with pytest.raises(LOTOStateError):
        remove_loto(loto, pid, "PiC")
    state["ES-ON-220-01"] = EquipmentState.OPEN
    with pytest.raises(LOTOStateError, match="must be closed"):
        apply_loto(loto, pid, "Technician", state)
    state["ES-ON-220-01"] = EquipmentState.CLOSED
    point = apply_loto(loto, pid, "Technician", state)
    assert point.status == LOTOStatus.APPLIED and point.locked_by == "Technician"


def test_unknown_point():
    loto = create_loto_set_for_oss("SB5-SP-TEST-ABC123", "PiC")
    with pytest.raises(LOTOPointNotFoundError):
        remove_loto(loto, "LOTO-NOPE", "PiC")
