"""
IEC 62443 Role-Based Access Control (RBAC) for offshore wind SCADA systems.

Implements a 5-level permission matrix aligned with IEC 62443-3-3 (System
security requirements and security levels) for the 510 MW Baltic Sea OWF
SCADA/EMS platform.

Physics — Why RBAC Exists in HV Systems
----------------------------------------
A 220 kV circuit breaker carries 1,200 A at rated load. An incorrect switching
operation — opening a loaded breaker without isolating the load — creates an
arc flash with energy proportional to I² × t. At 220 kV, arc flash incidents
release 20–40 cal/cm² at 600 mm, enough to cause fatal burns (IEEE 1584).

LOTO (Lock-Out / Tag-Out) prevents this by ensuring only authorised personnel
can control switchgear. In SCADA systems, RBAC is the digital equivalent of
LOTO: it restricts who can issue control commands (open/close breakers),
approve permits-to-work, and configure protection relays.

Standard — IEC 62443-3-3 Security Levels
-----------------------------------------
IEC 62443 defines four Security Levels (SL):
  SL 1: Protection against casual/unintentional violation
  SL 2: Protection against intentional violation using simple means
  SL 3: Protection against sophisticated attacks (state-sponsored)
  SL 4: Protection against sophisticated attacks with extended resources

For offshore wind SCADA, SL 2–3 is typical. Our RBAC model maps 5 role
levels to these security levels:

  Level 1 (Viewer)          → SL 1: read-only dashboards
  Level 2 (Operator)        → SL 2: alarm acknowledgement, basic monitoring
  Level 3 (Senior Operator) → SL 2: switchgear control, PtW approval
  Level 4 (Engineer)        → SL 3: IED configuration, protection settings
  Level 5 (Admin)           → SL 3: user management, system configuration

Standard — IEC 62443-3-3 Zones and Conduits
--------------------------------------------
The network is segmented into security zones:
  Zone 0 (Enterprise):  Corporate IT — email, ERP, weather services
  Zone 1 (Control Centre): SCADA HMI, historian, alarm management
  Zone 2 (Communication): IEC 60870-5-104 gateway, data concentrator
  Zone 3 (Field):       IED configuration, relay access, RTU
  Zone 4 (Process):     IEC 61850 GOOSE/MMS — direct device control
  DMZ:                  Data diode, OPC-UA gateway — one-way data flow

Each zone has a minimum access level. Level 1 users cannot enter Zone 3+.
Level 3+ users must use MFA (multi-factor authentication) per IEC 62443-3-3
requirement SR 1.1 (human user identification and authentication).

Maths — Permission Inheritance
-------------------------------
Permissions follow a strict hierarchy with cumulative inheritance:

  P(level) = P_own(level) ∪ P(level - 1)

  P(1) = {VIEW_DATA}
  P(2) = P(1) ∪ {ACK_ALARM, CONTROL_SWITCHGEAR}
  P(3) = P(2) ∪ {PTW_REQUEST, PTW_APPROVE, PTW_ISOLATE, PTW_LOTO}
  P(4) = P(3) ∪ {CONFIG_IED, PTW_ACTIVATE, PTW_COMPLETE}
  P(5) = P(4) ∪ {PTW_CLOSE, ADMIN_USERS, ADMIN_SYSTEM}

  |P(5)| = 14 permissions (full set)

References
----------
- IEC 62443-3-3: System security requirements and security levels
- IEC 62443-2-1: Security management system for IACS
- OSHA 1910.147: Control of hazardous energy (LOTO)
- IEEE 1584: Guide for performing arc-flash hazard calculations
- NERC CIP-004: Personnel & training (North American grid equivalent)
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum, StrEnum

# ── Enums ──────────────────────────────────────────────────────────


class RoleLevel(IntEnum):
    """IEC 62443 user role levels for SCADA access control.

    Higher levels inherit all permissions from lower levels. This mirrors
    the real-world offshore wind organisational hierarchy:
      - Viewer: shore-based stakeholders (investors, regulators)
      - Operator: 24/7 control room watch keeper
      - Senior Operator: shift supervisor, authorised to approve PtW
      - Engineer: protection engineer, IED commissioning specialist
      - Admin: SCADA system administrator, cybersecurity officer
    """

    VIEWER = 1
    OPERATOR = 2
    SENIOR_OPERATOR = 3
    ENGINEER = 4
    ADMIN = 5


class Permission(StrEnum):
    """Granular SCADA permissions mapped to IEC 62443 security levels.

    Each permission maps to a specific SCADA operation. The naming follows
    the convention: {VERB}_{RESOURCE} for clarity in audit logs.

    Permit-to-Work permissions (PTW_*) follow the 9-state lifecycle:
      REQUEST → APPROVE → ISOLATE → LOTO → ACTIVATE → COMPLETE → CLOSE
    """

    # Level 1: Read-only
    VIEW_DATA = "view_data"

    # Level 2: Operator actions
    ACK_ALARM = "ack_alarm"
    CONTROL_SWITCHGEAR = "control_switchgear"

    # Level 3: Senior operator — PtW initiation
    PTW_REQUEST = "ptw_request"
    PTW_APPROVE = "ptw_approve"
    PTW_ISOLATE = "ptw_isolate"
    PTW_LOTO = "ptw_loto"

    # Level 4: Engineer — PtW execution + IED config
    CONFIG_IED = "config_ied"
    PTW_ACTIVATE = "ptw_activate"
    PTW_COMPLETE = "ptw_complete"

    # Level 5: Admin — PtW closure + system admin
    PTW_CLOSE = "ptw_close"
    ADMIN_USERS = "admin_users"
    ADMIN_SYSTEM = "admin_system"


class IEC62443Zone(StrEnum):
    """IEC 62443-3-3 network security zones for the offshore wind SCADA.

    Zones provide defence-in-depth: each zone boundary has firewalls,
    access control lists, and intrusion detection. The DMZ uses a data
    diode for one-way information flow from OT to IT.
    """

    ENTERPRISE = "enterprise"
    CONTROL_CENTRE = "control_centre"
    COMMUNICATION = "communication"
    FIELD = "field"
    PROCESS = "process"
    DMZ = "dmz"


# ── Constants ──────────────────────────────────────────────────────

# IEC 62443-3-3 SR 1.1: MFA required for privileged access
# Level 3+ can control switchgear and approve permits — MFA mandatory
MFA_REQUIRED_LEVEL = RoleLevel.SENIOR_OPERATOR


# ── Permission Matrix ─────────────────────────────────────────────
#
# Static mapping: each level defines its OWN permissions. Higher levels
# inherit all lower permissions via _build_cumulative_permissions().

_LEVEL_OWN_PERMISSIONS: dict[RoleLevel, frozenset[Permission]] = {
    RoleLevel.VIEWER: frozenset(
        {
            Permission.VIEW_DATA,
        }
    ),
    RoleLevel.OPERATOR: frozenset(
        {
            Permission.ACK_ALARM,
            Permission.CONTROL_SWITCHGEAR,
        }
    ),
    RoleLevel.SENIOR_OPERATOR: frozenset(
        {
            Permission.PTW_REQUEST,
            Permission.PTW_APPROVE,
            Permission.PTW_ISOLATE,
            Permission.PTW_LOTO,
        }
    ),
    RoleLevel.ENGINEER: frozenset(
        {
            Permission.CONFIG_IED,
            Permission.PTW_ACTIVATE,
            Permission.PTW_COMPLETE,
        }
    ),
    RoleLevel.ADMIN: frozenset(
        {
            Permission.PTW_CLOSE,
            Permission.ADMIN_USERS,
            Permission.ADMIN_SYSTEM,
        }
    ),
}


def _build_cumulative_permissions() -> dict[RoleLevel, frozenset[Permission]]:
    """Build the cumulative permission matrix with inheritance.

    Each level inherits all permissions from lower levels:
      P(n) = P_own(n) ∪ P_own(n-1) ∪ ... ∪ P_own(1)

    Returns
    -------
    dict[RoleLevel, frozenset[Permission]]
        Complete permission set for each role level.
    """
    cumulative: dict[RoleLevel, frozenset[Permission]] = {}
    accumulated: frozenset[Permission] = frozenset()

    for level in sorted(RoleLevel):
        accumulated = accumulated | _LEVEL_OWN_PERMISSIONS[level]
        cumulative[level] = accumulated

    return cumulative


PERMISSION_MATRIX: dict[RoleLevel, frozenset[Permission]] = _build_cumulative_permissions()


# ── Zone Definitions ──────────────────────────────────────────────

_ZONE_DEFINITIONS: dict[IEC62443Zone, tuple[int, str]] = {
    IEC62443Zone.ENTERPRISE: (
        1,
        "Corporate IT network — weather data, ERP, email. Separated from OT by DMZ data diode.",
    ),
    IEC62443Zone.CONTROL_CENTRE: (
        2,
        "SCADA HMI, historian, alarm management server. "
        "Operators monitor and control the wind farm from here.",
    ),
    IEC62443Zone.COMMUNICATION: (
        2,
        "IEC 60870-5-104 gateway, data concentrator, VPN tunnel "
        "to offshore substation. Bridges control centre and field.",
    ),
    IEC62443Zone.FIELD: (
        3,
        "IED configuration access, relay testing, RTU maintenance. "
        "Requires on-site presence or secure remote VPN.",
    ),
    IEC62443Zone.PROCESS: (
        4,
        "IEC 61850 GOOSE and MMS — direct device control at process bus level. "
        "Highest security: only protection engineers and administrators.",
    ),
    IEC62443Zone.DMZ: (
        2,
        "Demilitarised zone with data diode for one-way OT → IT data flow. "
        "OPC-UA gateway publishes read-only data to enterprise zone.",
    ),
}


# ── Data Models ────────────────────────────────────────────────────


@dataclass(frozen=True)
class RoleDefinition:
    """Complete definition of an IEC 62443 RBAC role.

    Attributes
    ----------
    level : RoleLevel
        Numeric role level (1–5).
    name : str
        Human-readable role name (e.g., 'Senior Operator').
    description : str
        Engineering description of the role's responsibilities.
    permissions : frozenset[Permission]
        Complete permission set (own + inherited).
    mfa_required : bool
        True if multi-factor authentication is mandatory.
    security_level : int
        IEC 62443 Security Level (SL 1–3) for this role.
    """

    level: RoleLevel
    name: str
    description: str
    permissions: frozenset[Permission]
    mfa_required: bool
    security_level: int


@dataclass(frozen=True)
class ZoneDefinition:
    """IEC 62443-3-3 network security zone definition.

    Attributes
    ----------
    zone : IEC62443Zone
        Zone identifier.
    min_access_level : int
        Minimum RoleLevel required to access this zone.
    description : str
        Engineering description of the zone's purpose and boundaries.
    """

    zone: IEC62443Zone
    min_access_level: int
    description: str


@dataclass(frozen=True)
class PermissionCheckResult:
    """Result of a permission check against the RBAC matrix.

    Attributes
    ----------
    granted : bool
        True if the permission is granted for this role level.
    role_level : RoleLevel
        The role level that was checked.
    permission : Permission
        The permission that was checked.
    reason : str
        Human-readable explanation of why access was granted or denied.
    mfa_required : bool
        True if this role level requires MFA authentication.
    """

    granted: bool
    role_level: RoleLevel
    permission: Permission
    reason: str
    mfa_required: bool


# ── Role Metadata ─────────────────────────────────────────────────

_ROLE_METADATA: dict[RoleLevel, tuple[str, str, int]] = {
    RoleLevel.VIEWER: (
        "Viewer",
        "Read-only access to SCADA dashboards, trends, and reports. "
        "Typical users: investors, regulatory auditors, shore-based managers.",
        1,
    ),
    RoleLevel.OPERATOR: (
        "Operator",
        "24/7 control room watch keeper. Can acknowledge alarms and "
        "perform basic switchgear control under supervision. "
        "Requires BWEA/GWO Basic Safety Training.",
        2,
    ),
    RoleLevel.SENIOR_OPERATOR: (
        "Senior Operator",
        "Shift supervisor with authority to approve Permits-to-Work, "
        "authorise isolation, and apply LOTO. Minimum 3 years offshore "
        "HV experience. MFA authentication mandatory.",
        2,
    ),
    RoleLevel.ENGINEER: (
        "Engineer",
        "Protection engineer or commissioning specialist. Can configure "
        "IEDs, modify relay settings, and manage PtW lifecycle. "
        "Requires IEC 61850 competency certification.",
        3,
    ),
    RoleLevel.ADMIN: (
        "Administrator",
        "SCADA system administrator and cybersecurity officer. Full system "
        "access including user management and security configuration. "
        "Requires IEC 62443 Cybersecurity Certificate (ISA/IEC 62443).",
        3,
    ),
}


# ── Public Functions ──────────────────────────────────────────────


def check_permission(
    role_level: RoleLevel,
    permission: Permission,
) -> PermissionCheckResult:
    """Check whether a role level has a specific permission.

    Looks up the cumulative permission matrix to determine if the
    given role level has the requested permission. Higher levels
    automatically inherit all lower-level permissions.

    Parameters
    ----------
    role_level : RoleLevel
        The user's role level (1–5).
    permission : Permission
        The permission to check.

    Returns
    -------
    PermissionCheckResult
        Result including granted/denied status, reason, and MFA requirement.
    """
    permissions = PERMISSION_MATRIX.get(role_level, frozenset())
    granted = permission in permissions
    mfa_required = role_level >= MFA_REQUIRED_LEVEL

    if granted:
        reason = (
            f"Level {role_level} ({role_level.name}) has permission "
            f"'{permission.value}' (direct or inherited)."
        )
    else:
        # Find the minimum level that has this permission
        min_level = None
        for level in sorted(RoleLevel):
            if permission in PERMISSION_MATRIX[level]:
                min_level = level
                break
        if min_level is not None:
            reason = (
                f"Level {role_level} ({role_level.name}) does not have "
                f"'{permission.value}'. Minimum required: Level {min_level} "
                f"({min_level.name})."
            )
        else:
            reason = f"Permission '{permission.value}' is not assigned to any role."

    return PermissionCheckResult(
        granted=granted,
        role_level=role_level,
        permission=permission,
        reason=reason,
        mfa_required=mfa_required,
    )


def get_role_definition(role_level: RoleLevel) -> RoleDefinition:
    """Get the complete definition for a role level.

    Parameters
    ----------
    role_level : RoleLevel
        The role level to look up.

    Returns
    -------
    RoleDefinition
        Full role definition including permissions and MFA requirement.
    """
    name, description, security_level = _ROLE_METADATA[role_level]
    return RoleDefinition(
        level=role_level,
        name=name,
        description=description,
        permissions=PERMISSION_MATRIX[role_level],
        mfa_required=role_level >= MFA_REQUIRED_LEVEL,
        security_level=security_level,
    )


def get_all_roles() -> list[RoleDefinition]:
    """Get definitions for all 5 role levels.

    Returns
    -------
    list[RoleDefinition]
        All role definitions, ordered by level (1–5).
    """
    return [get_role_definition(level) for level in sorted(RoleLevel)]


def get_zone_definitions() -> list[ZoneDefinition]:
    """Get all IEC 62443-3-3 security zone definitions.

    Returns
    -------
    list[ZoneDefinition]
        All zone definitions with minimum access levels.
    """
    return [
        ZoneDefinition(
            zone=zone,
            min_access_level=min_level,
            description=desc,
        )
        for zone, (min_level, desc) in _ZONE_DEFINITIONS.items()
    ]
