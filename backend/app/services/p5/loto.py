"""
Isolation locks (lock-out / tag-out) of circuit 1.

While circuit 1 is under construction it is held dead by the safety measures of
EN 50110-1 §6.2: disconnect, *secure against reconnection* (disconnectors locked
OPEN), verify absence of voltage, *earth and short-circuit* (earth switches
locked CLOSED). Each locked device is one isolation point carrying a personal
safety lock and a danger tag.

The programme starts from that condition: all points are APPLIED. A switching
programme step may only operate a device once its lock has been removed under
the Person in Control's authority (interlock ILK-004 in ``equipment_state``).
Re-applying a lock is allowed whenever the device is back in its secured
position — e.g. to re-isolate after a NO-GO.

The second circuit (TX-OSS-02, section B, strings 4–6) keeps its locks; it is
commissioned by its own programme.

References: EN 50110-1:2013 §6.2 (five safety rules); IEC 61936-1:2021.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

from app.core.exceptions import NotFoundError, StateTransitionError
from app.services.p5.equipment_state import (
    OSS_EQUIPMENT,
    EquipmentState,
    EquipmentType,
)


class LOTOStatus(StrEnum):
    """APPLIED = lock and danger tag on the device; REMOVED = released."""

    APPLIED = "applied"
    REMOVED = "removed"


@dataclass
class IsolationPoint:
    """One safety lock + danger tag on a disconnector (OPEN) or earth switch (CLOSED)."""

    point_id: str
    equipment_id: str
    secured_state: EquipmentState  # position the lock holds the device in
    tag_number: str
    status: LOTOStatus = LOTOStatus.APPLIED
    locked_by: str = ""
    applied_at: datetime | None = None
    removed_by: str = ""
    removed_at: datetime | None = None


@dataclass
class LOTOSet:
    """All isolation points of one programme, keyed by point_id."""

    programme_id: str
    points: dict[str, IsolationPoint] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def locked_equipment(self) -> frozenset[str]:
        """Devices currently held by a lock (input to interlock ILK-004)."""
        return frozenset(
            p.equipment_id for p in self.points.values() if p.status == LOTOStatus.APPLIED
        )


class LOTOStateError(StateTransitionError):
    """Lock already in the requested state, or device not in its secured position."""


class LOTOPointNotFoundError(NotFoundError):
    """Unknown isolation point."""


def point_id_for(equipment_id: str) -> str:
    return f"LOTO-{equipment_id}"


def create_loto_set_for_oss(programme_id: str, locked_by: str) -> LOTOSet:
    """Isolation established for construction: every disconnector and earth switch locked."""
    now = datetime.now(UTC)
    loto = LOTOSet(programme_id=programme_id, created_at=now)
    for eq in OSS_EQUIPMENT:
        if eq.equipment_type in (EquipmentType.DISCONNECTOR, EquipmentType.EARTH_SWITCH):
            pid = point_id_for(eq.equipment_id)
            loto.points[pid] = IsolationPoint(
                point_id=pid,
                equipment_id=eq.equipment_id,
                secured_state=eq.initial_state,
                tag_number=f"DT-{programme_id[-6:]}-{len(loto.points) + 1:02d}",
                locked_by=locked_by,
                applied_at=now,
            )
    return loto


def _point(loto: LOTOSet, point_id: str) -> IsolationPoint:
    try:
        return loto.points[point_id]
    except KeyError:
        raise LOTOPointNotFoundError(f"Isolation point '{point_id}' not found.") from None


def apply_loto(
    loto: LOTOSet,
    point_id: str,
    locked_by: str,
    system_state: dict[str, EquipmentState],
) -> IsolationPoint:
    """Re-apply a lock; the device must be in its secured position."""
    point = _point(loto, point_id)
    if point.status == LOTOStatus.APPLIED:
        raise LOTOStateError(f"{point_id} is already locked by {point.locked_by}.")
    if system_state.get(point.equipment_id) != point.secured_state:
        raise LOTOStateError(
            f"{point.equipment_id} must be {point.secured_state.value} before it can be locked."
        )
    point.status = LOTOStatus.APPLIED
    point.locked_by = locked_by
    point.applied_at = datetime.now(UTC)
    return point


def remove_loto(loto: LOTOSet, point_id: str, removed_by: str) -> IsolationPoint:
    """Release a lock (authority of the Person in Control is checked by the caller)."""
    point = _point(loto, point_id)
    if point.status != LOTOStatus.APPLIED:
        raise LOTOStateError(f"{point_id} is not locked.")
    point.status = LOTOStatus.REMOVED
    point.removed_by = removed_by
    point.removed_at = datetime.now(UTC)
    return point
