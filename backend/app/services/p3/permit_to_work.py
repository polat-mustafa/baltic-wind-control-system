"""
Permit-to-Work (PtW) state machine for offshore wind HV operations.

Implements the 9-state PtW lifecycle per offshore wind industry practice,
integrated with IEC 62443 RBAC for role-based transition authorisation.

Physics — Why Permits-to-Work Exist
------------------------------------
Offshore 220 kV switchgear carries enough energy to cause fatal arc flash:

  Incident energy = k × V × I_arc × t_arc / D²

At 220 kV with 40 kA fault current, the arc flash boundary (where incident
energy = 1.2 cal/cm² — the threshold for second-degree burns) extends to
~8 metres (IEEE 1584-2018). Every person within this boundary during a
switching error is at risk of fatal injury.

The Permit-to-Work system is the **administrative control** that ensures:
1. Equipment is correctly identified before isolation
2. All energy sources are locked out (LOTO)
3. Absence of voltage is proven before work begins
4. Only authorised persons can restore power

This is not optional — it is mandated by:
  - OSHA 1910.147 (Control of Hazardous Energy)
  - EN 50110-1 (Operation of Electrical Installations)
  - HSE Electricity at Work Regulations 1989 (UK)
  - IEC 62443 (SCADA cybersecurity for LOTO commands)

Standard — OSHA 1910.147 LOTO Requirements
-------------------------------------------
The 6 steps of LOTO (Lock-Out / Tag-Out):

  1. PREPARATION:    Identify all energy sources for the equipment
  2. NOTIFICATION:    Notify all affected employees
  3. SHUTDOWN:        Shut down the equipment using normal procedures
  4. ISOLATION:       Isolate all energy sources (open disconnectors)
  5. LOCK & TAG:      Apply personal locks and tags to isolation points
  6. VERIFICATION:    Verify zero energy state (test with voltmeter)

Our 9-state PtW lifecycle maps directly to these LOTO steps plus the
administrative controls (request, approval, work completion, closure).

Maths — State Machine Transitions
-----------------------------------
The PtW lifecycle is a directed acyclic graph (DAG) with 9 states and
8 forward transitions plus cancel edges:

  REQUESTED → RISK_ASSESSED → APPROVED → ISOLATION_CONFIRMED
  → LOTO_APPLIED → ACTIVE → WORK_COMPLETE → LOTO_REMOVED → CLOSED

  Cancel edge: any non-terminal state → CANCELLED

State transition function:
  T(current_state, action, user_role) → next_state | error

  T is valid iff:
    1. (current_state, next_state) ∈ TRANSITION_MAP
    2. user_role has permission for the required action
    3. permit is not expired (checked only for ACTIVE state)

Validity period: 12 hours from ACTIVE state entry (offshore standard).
After 12h, the permit expires and must be extended or re-issued.

References
----------
- OSHA 1910.147: Control of hazardous energy (lockout/tagout)
- EN 50110-1: Operation of electrical installations
- IEC 62443-3-3: System security requirements and security levels
- IEEE 1584-2018: Guide for performing arc-flash hazard calculations
- HSG85: Electricity at work — Safe working practices (UK HSE)
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from app.services.p3.rbac import Permission, RoleLevel, check_permission

# ── Enums ──────────────────────────────────────────────────────────


class PermitStatus(StrEnum):
    """Permit-to-Work lifecycle states.

    The 9 forward states model the complete LOTO sequence from initial
    request through to final closure. CANCELLED is reachable from any
    non-terminal state.

    State mapping to OSHA 1910.147:
      REQUESTED           → Preparation (identify equipment)
      RISK_ASSESSED        → Preparation (identify hazards)
      APPROVED             → Notification (supervisor authorises)
      ISOLATION_CONFIRMED  → Shutdown + Isolation (equipment de-energised)
      LOTO_APPLIED         → Lock & Tag (personal locks applied)
      ACTIVE               → Verification + Work begins
      WORK_COMPLETE        → Work finished, ready for restoration
      LOTO_REMOVED         → Locks removed, equipment ready for re-energisation
      CLOSED               → Permit archived, equipment returned to service
    """

    REQUESTED = "requested"
    RISK_ASSESSED = "risk_assessed"
    APPROVED = "approved"
    ISOLATION_CONFIRMED = "isolation_confirmed"
    LOTO_APPLIED = "loto_applied"
    ACTIVE = "active"
    WORK_COMPLETE = "work_complete"
    LOTO_REMOVED = "loto_removed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class RiskCategory(StrEnum):
    """Risk categories for offshore wind HV work.

    Each category requires specific control measures in the PtW risk
    assessment. Multiple categories can apply to a single permit.
    """

    ELECTRICAL = "electrical"
    MECHANICAL = "mechanical"
    ENVIRONMENTAL = "environmental"
    CONFINED_SPACE = "confined_space"
    CHEMICAL = "chemical"
    DROPPED_OBJECTS = "dropped_objects"


class RiskLevel(StrEnum):
    """Risk severity levels per risk assessment matrix.

    Maps to control requirements:
      LOW:      Standard PPE, toolbox talk
      MEDIUM:   Additional controls, buddy system
      HIGH:     Senior operator oversight, rescue plan required
      CRITICAL: Engineer approval, emergency response team on standby
    """

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ── Constants ──────────────────────────────────────────────────────

# Offshore standard: permits valid for one 12-hour shift
PTW_VALIDITY_HOURS = 12

# Terminal states — no further transitions allowed
_TERMINAL_STATES: frozenset[PermitStatus] = frozenset(
    {
        PermitStatus.CLOSED,
        PermitStatus.CANCELLED,
    }
)

# PTW number prefix for the Baltic Wind Alpha project
_PTW_PREFIX = "BWA-PTW"

# Step number mapping for each permit status (1-based, CANCELLED=0)
_STATUS_TO_STEP: dict[PermitStatus, int] = {
    PermitStatus.REQUESTED: 1,
    PermitStatus.RISK_ASSESSED: 2,
    PermitStatus.APPROVED: 3,
    PermitStatus.ISOLATION_CONFIRMED: 4,
    PermitStatus.LOTO_APPLIED: 5,
    PermitStatus.ACTIVE: 6,
    PermitStatus.WORK_COMPLETE: 7,
    PermitStatus.LOTO_REMOVED: 8,
    PermitStatus.CLOSED: 9,
    PermitStatus.CANCELLED: 0,
}


# ── Transition Map ────────────────────────────────────────────────
#
# Maps (from_state, to_state) → (required_permission, description).
# Each transition requires a specific RBAC permission check.

TRANSITION_MAP: dict[tuple[PermitStatus, PermitStatus], tuple[Permission, str]] = {
    (PermitStatus.REQUESTED, PermitStatus.RISK_ASSESSED): (
        Permission.PTW_REQUEST,
        "Risk assessment completed — hazards identified and controls defined.",
    ),
    (PermitStatus.RISK_ASSESSED, PermitStatus.APPROVED): (
        Permission.PTW_APPROVE,
        "Permit approved by senior operator — work scope and controls accepted.",
    ),
    (PermitStatus.APPROVED, PermitStatus.ISOLATION_CONFIRMED): (
        Permission.PTW_ISOLATE,
        "Equipment isolated — disconnectors open, absence of voltage confirmed.",
    ),
    (PermitStatus.ISOLATION_CONFIRMED, PermitStatus.LOTO_APPLIED): (
        Permission.PTW_LOTO,
        "LOTO applied — personal locks and danger tags on all isolation points.",
    ),
    (PermitStatus.LOTO_APPLIED, PermitStatus.ACTIVE): (
        Permission.PTW_ACTIVATE,
        "Permit activated — zero energy verified, work may commence.",
    ),
    (PermitStatus.ACTIVE, PermitStatus.WORK_COMPLETE): (
        Permission.PTW_COMPLETE,
        "Work complete — all personnel clear, tools removed, area inspected.",
    ),
    (PermitStatus.WORK_COMPLETE, PermitStatus.LOTO_REMOVED): (
        Permission.PTW_LOTO,
        "LOTO removed — personal locks removed, equipment ready for re-energisation.",
    ),
    (PermitStatus.LOTO_REMOVED, PermitStatus.CLOSED): (
        Permission.PTW_CLOSE,
        "Permit closed — equipment returned to service, permit archived.",
    ),
}


# ── Exceptions ────────────────────────────────────────────────────

from app.core.exceptions import DomainError, StateTransitionError  # noqa: E402


class InvalidStateTransitionError(StateTransitionError):
    """Raised when a PtW state transition is not allowed.

    This means the requested (from_state → to_state) pair is not in the
    transition map, or the transition is to a terminal state from an
    invalid origin.
    """


class PermitExpiredError(DomainError):
    """Raised when a PtW has exceeded its 12-hour validity period.

    Expired permits cannot be transitioned — they must be extended or
    a new permit must be issued.
    """


# ── Data Models ────────────────────────────────────────────────────


@dataclass(frozen=True)
class RiskAssessment:
    """Risk assessment for a Permit-to-Work.

    Attributes
    ----------
    categories : tuple[RiskCategory, ...]
        All risk categories applicable to this work.
    risk_level : RiskLevel
        Overall risk severity after control measures.
    control_measures : str
        Description of hazard controls (PPE, procedures, etc.).
    assessor : str
        Name of the person who performed the risk assessment.
    """

    categories: tuple[RiskCategory, ...]
    risk_level: RiskLevel
    control_measures: str
    assessor: str


@dataclass(frozen=True)
class PTWTransition:
    """A single state transition in the PtW audit trail.

    Every transition is recorded as an immutable audit event. This log
    is append-only — entries cannot be modified or deleted.

    Attributes
    ----------
    from_status : PermitStatus
        State before the transition.
    to_status : PermitStatus
        State after the transition.
    performed_by : str
        User who performed the transition.
    user_level : RoleLevel
        RBAC level of the user at the time of transition.
    timestamp : datetime
        UTC timestamp of the transition.
    notes : str
        Optional notes or justification for the transition.
    """

    from_status: PermitStatus
    to_status: PermitStatus
    performed_by: str
    user_level: RoleLevel
    timestamp: datetime
    notes: str = ""


@dataclass
class PermitRecord:
    """Complete Permit-to-Work record with lifecycle state.

    This is a mutable dataclass because the permit's status changes
    over its lifecycle. The audit trail (transitions) is append-only.

    Attributes
    ----------
    id : uuid.UUID
        Unique permit identifier.
    ptw_number : str
        Human-readable permit number (e.g., 'BWA-PTW-2026-00001').
    status : PermitStatus
        Current lifecycle state.
    work_description : str
        Description of the work to be performed.
    equipment_id : str
        Equipment identifier (IED name, bay, cable section).
    requested_by : str
        User who created the permit request.
    person_in_charge : str
        Person in Charge (PiC) — responsible for the work party.
    risk_assessment : RiskAssessment | None
        Risk assessment, set after RISK_ASSESSED state.
    valid_from : datetime | None
        Start of validity period (set when ACTIVE).
    valid_until : datetime | None
        End of validity period (valid_from + 12h).
    created_at : datetime
        UTC timestamp of permit creation.
    transitions : list[PTWTransition]
        Append-only audit trail of all state transitions.
    """

    id: uuid.UUID
    ptw_number: str
    status: PermitStatus
    work_description: str
    equipment_id: str
    requested_by: str
    person_in_charge: str = ""
    risk_assessment: RiskAssessment | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    transitions: list[PTWTransition] = field(default_factory=list)


@dataclass(frozen=True)
class TransitionResult:
    """Result of attempting a PtW state transition.

    Attributes
    ----------
    success : bool
        True if the transition was applied.
    permit : PermitRecord
        The permit record after the transition attempt.
    transition : PTWTransition | None
        The transition that was applied (None if failed).
    message : str
        Human-readable description of the result.
    """

    success: bool
    permit: PermitRecord
    transition: PTWTransition | None
    message: str


# ── Public Functions ──────────────────────────────────────────────


def generate_ptw_number(sequence: int = 1) -> str:
    """Generate a human-readable PtW number.

    Format: BWA-PTW-{YEAR}-{SEQUENCE:05d}

    Parameters
    ----------
    sequence : int
        Sequential number for this permit (1-based).

    Returns
    -------
    str
        Formatted PtW number, e.g. 'BWA-PTW-2026-00001'.
    """
    year = datetime.now(UTC).year
    return f"{_PTW_PREFIX}-{year}-{sequence:05d}"


def create_permit(
    work_description: str,
    equipment_id: str,
    requested_by: str,
    sequence: int = 1,
) -> PermitRecord:
    """Create a new Permit-to-Work in REQUESTED state.

    Parameters
    ----------
    work_description : str
        Description of the work to be performed.
    equipment_id : str
        Equipment identifier (IED name, bay, cable section).
    requested_by : str
        User who is requesting the permit.
    sequence : int
        Sequential number for PtW numbering.

    Returns
    -------
    PermitRecord
        New permit in REQUESTED state with empty audit trail.
    """
    return PermitRecord(
        id=uuid.uuid4(),
        ptw_number=generate_ptw_number(sequence),
        status=PermitStatus.REQUESTED,
        work_description=work_description,
        equipment_id=equipment_id,
        requested_by=requested_by,
    )


def validate_transition(
    permit: PermitRecord,
    target_status: PermitStatus,
    user_level: RoleLevel,
) -> tuple[bool, str]:
    """Validate whether a state transition is allowed.

    Checks three conditions:
    1. The (current → target) transition exists in the transition map
    2. The user has the required RBAC permission
    3. The permit is not expired (if currently ACTIVE)

    Parameters
    ----------
    permit : PermitRecord
        The permit to transition.
    target_status : PermitStatus
        The desired next state.
    user_level : RoleLevel
        The RBAC level of the user requesting the transition.

    Returns
    -------
    tuple[bool, str]
        (is_valid, reason) — reason explains why the transition is
        allowed or denied.
    """
    # Check for cancellation (allowed from any non-terminal state)
    if target_status == PermitStatus.CANCELLED:
        if permit.status in _TERMINAL_STATES:
            return (
                False,
                f"Cannot cancel permit in terminal state '{permit.status.value}'.",
            )
        # Cancellation requires at least PTW_REQUEST permission
        result = check_permission(user_level, Permission.PTW_REQUEST)
        if not result.granted:
            return (False, result.reason)
        return (True, "Cancellation authorised.")

    # Check transition map
    transition_key = (permit.status, target_status)
    if transition_key not in TRANSITION_MAP:
        return (
            False,
            f"Invalid transition: '{permit.status.value}' → '{target_status.value}'. "
            f"No such transition exists in the PtW lifecycle.",
        )

    required_permission, _description = TRANSITION_MAP[transition_key]

    # Check RBAC permission
    perm_result = check_permission(user_level, required_permission)
    if not perm_result.granted:
        return (False, perm_result.reason)

    # Check expiry (only relevant for ACTIVE permits)
    if permit.status == PermitStatus.ACTIVE and is_expired(permit):
        return (
            False,
            f"Permit {permit.ptw_number} has expired. "
            f"Valid until: {permit.valid_until}. Extend or re-issue.",
        )

    return (True, "Transition authorised.")


def apply_transition(
    permit: PermitRecord,
    target_status: PermitStatus,
    performed_by: str,
    user_level: RoleLevel,
    notes: str = "",
) -> TransitionResult:
    """Attempt to apply a state transition to a permit.

    Validates the transition and, if allowed, mutates the permit record
    and appends an audit trail entry.

    Parameters
    ----------
    permit : PermitRecord
        The permit to transition.
    target_status : PermitStatus
        The desired next state.
    performed_by : str
        User performing the transition.
    user_level : RoleLevel
        RBAC level of the user.
    notes : str
        Optional notes for the audit trail.

    Returns
    -------
    TransitionResult
        Result including success status, updated permit, and audit entry.

    Raises
    ------
    InvalidStateTransitionError
        If the transition is not valid.
    PermitExpiredError
        If the permit has expired (only for ACTIVE state).
    """
    is_valid, reason = validate_transition(permit, target_status, user_level)

    if not is_valid:
        # Distinguish between expiry and invalid transition
        if permit.status == PermitStatus.ACTIVE and is_expired(permit):
            raise PermitExpiredError(reason)
        raise InvalidStateTransitionError(reason)

    now = datetime.now(UTC)

    # Record the transition
    transition = PTWTransition(
        from_status=permit.status,
        to_status=target_status,
        performed_by=performed_by,
        user_level=user_level,
        timestamp=now,
        notes=notes,
    )
    permit.transitions.append(transition)

    # Update permit state
    old_status = permit.status
    permit.status = target_status

    # Set validity period when entering ACTIVE state
    if target_status == PermitStatus.ACTIVE:
        permit.valid_from = now
        permit.valid_until = now + timedelta(hours=PTW_VALIDITY_HOURS)

    # Build transition description
    if target_status == PermitStatus.CANCELLED:
        message = (
            f"Permit {permit.ptw_number} cancelled from '{old_status.value}' by {performed_by}."
        )
    else:
        _perm, desc = TRANSITION_MAP[(old_status, target_status)]
        message = f"Permit {permit.ptw_number}: {desc}"

    return TransitionResult(
        success=True,
        permit=permit,
        transition=transition,
        message=message,
    )


def is_expired(permit: PermitRecord) -> bool:
    """Check if a permit has exceeded its validity period.

    Expiry only applies to permits that have reached ACTIVE state
    (where valid_from and valid_until are set). Permits that haven't
    reached ACTIVE yet cannot expire.

    Parameters
    ----------
    permit : PermitRecord
        The permit to check.

    Returns
    -------
    bool
        True if the permit has expired, False otherwise.
    """
    if permit.valid_until is None:
        return False
    return datetime.now(UTC) > permit.valid_until


def get_next_transitions(permit: PermitRecord) -> list[tuple[PermitStatus, Permission]]:
    """Get all valid next states for a permit.

    Parameters
    ----------
    permit : PermitRecord
        The permit to check.

    Returns
    -------
    list[tuple[PermitStatus, Permission]]
        List of (target_status, required_permission) pairs.
    """
    if permit.status in _TERMINAL_STATES:
        return []

    transitions: list[tuple[PermitStatus, Permission]] = []
    for (from_s, to_s), (perm, _desc) in TRANSITION_MAP.items():
        if from_s == permit.status:
            transitions.append((to_s, perm))

    # Cancel is always available from non-terminal states
    transitions.append((PermitStatus.CANCELLED, Permission.PTW_REQUEST))
    return transitions


def get_step_number(status: PermitStatus) -> int:
    """Get the step number (1-based) for a permit status.

    Maps the 9 forward states to step numbers 1–9.
    CANCELLED maps to 0 (special case).

    Parameters
    ----------
    status : PermitStatus
        The permit status.

    Returns
    -------
    int
        Step number (1–9 for forward states, 0 for CANCELLED).
    """
    return _STATUS_TO_STEP.get(status, 0)
