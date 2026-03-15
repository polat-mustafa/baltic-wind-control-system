"""
Lock-Out / Tag-Out (LOTO) tracking for HV commissioning.

Manages the isolation point lifecycle for the OSS first energisation
switching programme: creation, application, removal, and verification.

Physics — Why LOTO Exists
--------------------------
A 220 kV circuit with 40 kA fault capacity stores enough energy to cause
fatal arc flash injuries at distances up to 8 metres (IEEE 1584-2018).
LOTO is the physical control that prevents accidental re-energisation:

    1. Lock: A personal padlock on each isolation point (earth switch,
       disconnector) — the lock physically prevents operation.
    2. Tag: A danger tag with the worker's name, date, and reason —
       the tag communicates the intent.

OSHA 1910.147 mandates LOTO for any work on equipment that could release
hazardous energy. In HV substations, each earth switch IS an isolation
point — when the earth switch is CLOSED and locked, the bus is earthed
and cannot be energised.

Standard — OSHA 1910.147 & EN 50110-1
---------------------------------------
- OSHA 1910.147: "The machine or equipment shall be turned off or shut
  down using the procedures established for the machine or equipment.
  An orderly shutdown must be utilised to avoid any additional or
  increased hazard(s) to employees as a result of the equipment
  stoppage."
- EN 50110-1 §6.2.3: "Locking devices or interlocking devices shall be
  used to prevent the operating device from being operated."

Each LOTO point requires:
  - Unique tag number (traceable to the PiC)
  - Timestamp of application and removal
  - Identity of the person who applied/removed the lock

Maths — LOTO Set Completeness
-------------------------------
For a programme with N isolation points, the LOTO set L is defined as:

    L = {(p_i, status_i) | i = 1..N}

The programme can only proceed to energisation when:

    ∀ p_i ∈ L : status_i = REMOVED

And the programme cannot start energisation without prior verification:

    ∀ p_i ∈ L : status_i = APPLIED  (at programme start)

References
----------
- OSHA 1910.147: Control of hazardous energy (lockout/tagout)
- EN 50110-1:2013: Operation of electrical installations
- IEEE 1584-2018: Guide for performing arc-flash hazard calculations
- NFPA 70E: Standard for electrical safety in the workplace
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

from app.services.p5.equipment_state import (
    OSS_EQUIPMENT,
    EquipmentType,
)

# ── Enums ──────────────────────────────────────────────────────────


class LOTOStatus(StrEnum):
    """LOTO isolation point lifecycle states.

    NOT_APPLIED: Lock and tag not yet placed (initial state)
    APPLIED:     Lock and danger tag are in place — equipment cannot be operated
    REMOVED:     Lock and tag removed — equipment ready for operation
    """

    NOT_APPLIED = "not_applied"
    APPLIED = "applied"
    REMOVED = "removed"


# ── Data Models ────────────────────────────────────────────────────


@dataclass
class IsolationPoint:
    """A single LOTO isolation point on an earth switch.

    Each isolation point represents one padlock and danger tag on a
    specific earth switch. The lock physically prevents the switch
    from being operated.

    Attributes
    ----------
    point_id : str
        Unique identifier (e.g. 'LOTO-ES-ON-220-01').
    equipment_id : str
        Associated earth switch equipment ID.
    status : LOTOStatus
        Current LOTO state.
    locked_by : str
        Name of person who applied the lock (empty if not applied).
    tag_number : str
        Danger tag number for traceability.
    applied_at : datetime | None
        UTC timestamp when LOTO was applied.
    removed_at : datetime | None
        UTC timestamp when LOTO was removed.
    removed_by : str
        Name of person who removed the lock.
    """

    point_id: str
    equipment_id: str
    status: LOTOStatus = LOTOStatus.NOT_APPLIED
    locked_by: str = ""
    tag_number: str = ""
    applied_at: datetime | None = None
    removed_at: datetime | None = None
    removed_by: str = ""


@dataclass
class LOTOSet:
    """Programme-scoped collection of LOTO isolation points.

    Manages all isolation points for a single switching programme.
    Each point maps to an earth switch in the OSS equipment registry.

    Attributes
    ----------
    programme_id : str
        Switching programme this LOTO set belongs to.
    points : dict[str, IsolationPoint]
        Isolation points keyed by point_id.
    created_at : datetime
        UTC timestamp of LOTO set creation.
    """

    programme_id: str
    points: dict[str, IsolationPoint] = field(default_factory=dict)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


# ── Exceptions ───────────────────────────────────────────────────

from app.core.exceptions import DomainError, NotFoundError, StateTransitionError  # noqa: E402


class LOTOError(DomainError):
    """Base exception for LOTO operations."""


class LOTOAlreadyAppliedError(StateTransitionError):
    """Raised when trying to apply LOTO to a point that already has it."""


class LOTONotAppliedError(StateTransitionError):
    """Raised when trying to remove LOTO from a point that doesn't have it."""


class LOTOPointNotFoundError(NotFoundError):
    """Raised when a LOTO point ID is not in the set."""


# ── Public Functions ─────────────────────────────────────────────


def create_loto_set_for_oss(programme_id: str) -> LOTOSet:
    """Build a LOTO set with isolation points for all OSS earth switches.

    Creates one isolation point per earth switch in the OSS equipment
    registry. For the 510 MW Baltic Wind OSS, this gives 9 isolation
    points (ES-ON-220-01, ES-OSS-220-01, ES-OSS-66-01, ES-STR-01..06).

    Parameters
    ----------
    programme_id : str
        Switching programme identifier.

    Returns
    -------
    LOTOSet
        LOTO set with all isolation points in NOT_APPLIED state.
    """
    loto_set = LOTOSet(programme_id=programme_id)

    for equipment in OSS_EQUIPMENT:
        if equipment.equipment_type == EquipmentType.EARTH_SWITCH:
            point_id = f"LOTO-{equipment.equipment_id}"
            loto_set.points[point_id] = IsolationPoint(
                point_id=point_id,
                equipment_id=equipment.equipment_id,
                tag_number=f"BWA-TAG-{equipment.equipment_id}",
            )

    return loto_set


def apply_loto(
    loto_set: LOTOSet,
    point_id: str,
    locked_by: str,
) -> IsolationPoint:
    """Apply LOTO (lock and danger tag) to an isolation point.

    Parameters
    ----------
    loto_set : LOTOSet
        The LOTO set containing the point.
    point_id : str
        Isolation point to lock.
    locked_by : str
        Name of the person applying the lock.

    Returns
    -------
    IsolationPoint
        The updated isolation point.

    Raises
    ------
    LOTOPointNotFoundError
        If point_id is not in the LOTO set.
    LOTOAlreadyAppliedError
        If LOTO is already applied to this point.
    """
    if point_id not in loto_set.points:
        raise LOTOPointNotFoundError(
            f"LOTO point '{point_id}' not found in programme '{loto_set.programme_id}'."
        )

    point = loto_set.points[point_id]

    if point.status == LOTOStatus.APPLIED:
        raise LOTOAlreadyAppliedError(
            f"LOTO already applied to '{point_id}' by {point.locked_by}. "
            f"Cannot double-lock an isolation point."
        )

    point.status = LOTOStatus.APPLIED
    point.locked_by = locked_by
    point.applied_at = datetime.now(UTC)

    return point


def remove_loto(
    loto_set: LOTOSet,
    point_id: str,
    removed_by: str,
) -> IsolationPoint:
    """Remove LOTO (lock and danger tag) from an isolation point.

    Only the PiC or the person who applied the lock should remove it.
    This function does not enforce that rule (RBAC handles it) but
    records who performed the removal for audit.

    Parameters
    ----------
    loto_set : LOTOSet
        The LOTO set containing the point.
    point_id : str
        Isolation point to unlock.
    removed_by : str
        Name of the person removing the lock.

    Returns
    -------
    IsolationPoint
        The updated isolation point.

    Raises
    ------
    LOTOPointNotFoundError
        If point_id is not in the LOTO set.
    LOTONotAppliedError
        If LOTO is not currently applied to this point.
    """
    if point_id not in loto_set.points:
        raise LOTOPointNotFoundError(
            f"LOTO point '{point_id}' not found in programme '{loto_set.programme_id}'."
        )

    point = loto_set.points[point_id]

    if point.status != LOTOStatus.APPLIED:
        raise LOTONotAppliedError(
            f"LOTO is not applied to '{point_id}' (status: {point.status.value}). "
            f"Cannot remove what is not there."
        )

    point.status = LOTOStatus.REMOVED
    point.removed_by = removed_by
    point.removed_at = datetime.now(UTC)

    return point


def all_loto_applied(loto_set: LOTOSet) -> bool:
    """Check if all isolation points have LOTO applied.

    Returns True only when every point in the set has status APPLIED.
    Used as a pre-condition for starting the switching programme.

    Parameters
    ----------
    loto_set : LOTOSet
        The LOTO set to check.

    Returns
    -------
    bool
        True if all points are APPLIED.
    """
    return all(p.status == LOTOStatus.APPLIED for p in loto_set.points.values())


def all_loto_removed(loto_set: LOTOSet) -> bool:
    """Check if all isolation points have LOTO removed.

    Returns True only when every point in the set has status REMOVED.
    Used as a pre-condition for proceeding past Phase 1 into energisation.

    Parameters
    ----------
    loto_set : LOTOSet
        The LOTO set to check.

    Returns
    -------
    bool
        True if all points are REMOVED.
    """
    return all(p.status == LOTOStatus.REMOVED for p in loto_set.points.values())
